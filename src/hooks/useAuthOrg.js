import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";
import { useHostOrg } from "./useHostOrg";

// Whose brand goes on a sign-in or invite screen? Before anyone has signed in the page can't know who is looking at it,
// so it goes only by things the visitor brings along, never by what they type:
//   1. the dashboard domain, when it is a brokerage's own (useHostOrg)
//   2. a personal link: /login?org=<slug>
//   3. on the invite page, the organization of the person who just followed their invite link
//   4. the organization this browser last signed in to (remembered after a successful sign-in; only the logo)
// Anything else (or an unknown slug) gets the platform mark, with no error: the page never confirms which organizations exist.
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;
const REMEMBER_KEY = "lastLoginOrg";

export function rememberLoginOrg(slug) {
  try {
    if (slug && SLUG.test(slug)) localStorage.setItem(REMEMBER_KEY, slug);
  } catch {
    /* storage blocked: the personal link still works */
  }
}

function remembered() {
  try {
    const slug = localStorage.getItem(REMEMBER_KEY);
    return slug && SLUG.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

const cache = new Map();
function fetchOrg(column, value) {
  const key = `${column}:${value}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      supabase
        .from("organizations")
        .select("*")
        .eq(column, value)
        .maybeSingle()
        .then(({ data }) => data || null)
        .catch(() => null),
    );
  }
  return cache.get(key);
}

/** @returns {{ org: object|null, loading: boolean }} org null = show the platform mark */
export function useAuthOrg({ useSession = false } = {}) {
  const host = useHostOrg();
  const [params] = useSearchParams();
  const { profile, loading: authLoading } = useAuth();
  const asked = params.get("org");
  const slug = asked && SLUG.test(asked) ? asked : null;

  // What to look up: [column, value] or null when there is nothing to look up
  let lookup = null;
  if (!host.loading && !host.isApp) {
    if (slug) lookup = ["slug", slug];
    else if (useSession && profile?.org_id) lookup = ["id", profile.org_id];
    else if (!useSession) {
      const last = remembered();
      if (last) lookup = ["slug", last];
    }
  }
  const waitingForSession = useSession && !slug && authLoading;
  const lookupKey = lookup ? lookup.join(":") : "";

  const [found, setFound] = useState({ key: "", org: null });
  useEffect(() => {
    if (!lookup) return;
    let active = true;
    fetchOrg(lookup[0], lookup[1]).then((org) => active && setFound({ key: lookupKey, org }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  if (host.loading) return { org: null, loading: true };
  if (host.isApp) return { org: host.org, loading: false };
  if (waitingForSession) return { org: null, loading: true };
  if (!lookup) return { org: null, loading: false };
  if (found.key !== lookupKey) return { org: null, loading: true };
  return { org: found.org, loading: false };
}

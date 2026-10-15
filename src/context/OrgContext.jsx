import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { brandFromOrg } from "../lib/brand";

// Which organization is the dashboard working in?
//   * everyone else: their own (profiles.org_id), always.
//   * the platform owner: any organization, chosen with the switcher; remembered in this browser.
// Dashboard lists filter by this id: published items of other organizations are public by design, so
// the database rules alone would still let them appear in an unfiltered dashboard list.
const OrgContext = createContext(null);
const STORAGE_KEY = "activeOrgId";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function OrgProvider({ children }) {
  const { user, profile, isPlatformAdmin, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (authLoading || !profile) return;
    let active = true;
    (async () => {
      let list = [];
      if (isPlatformAdmin) {
        const { data } = await supabase.from("organizations").select("*").order("name");
        list = data || [];
      }
      const wanted = isPlatformAdmin ? readStored() || profile.org_id : profile.org_id;
      let current = list.find((o) => o.id === wanted) || list.find((o) => o.id === profile.org_id) || list[0] || null;
      if (!current && wanted) {
        const { data } = await supabase.from("organizations").select("*").eq("id", wanted).maybeSingle();
        current = data || null;
      }
      if (!active) return;
      setOrgs(list);
      setOrg(current);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authLoading, profile, isPlatformAdmin, reloadTick]);

  // Switching reloads the dashboard: lists, forms and realtime subscriptions all start clean for the new organization.
  const switchOrg = useCallback(
    async (orgId) => {
      if (!isPlatformAdmin || !orgId || orgId === org?.id) return;
      try {
        localStorage.setItem(STORAGE_KEY, orgId);
      } catch {
        /* storage blocked: the switch just won't persist */
      }
      await supabase.from("audit_log").insert({ actor_id: user?.id, org_id: orgId, action: "switch_org" });
      window.location.assign("/dashboard");
    },
    [isPlatformAdmin, org?.id, user?.id],
  );

  // After the Brand settings page saves, reload the organization so the menu logo and every preview update at once.
  const refreshOrg = useCallback(() => setReloadTick((t) => t + 1), []);

  const value = useMemo(
    () => ({ org, orgId: org?.id ?? null, brand: brandFromOrg(org), orgs, isPlatformAdmin, switchOrg, refreshOrg, loading }),
    [org, orgs, isPlatformAdmin, switchOrg, refreshOrg, loading],
  );
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

// Outside the provider (public pages, login) there is no active organization: lists get no filter and brand is the default.
const NO_ORG = { org: null, orgId: null, brand: brandFromOrg(null), orgs: [], isPlatformAdmin: false, switchOrg: async () => {}, refreshOrg: () => {}, loading: false };

export function useOrg() {
  return useContext(OrgContext) || NO_ORG;
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { bareHost, isAppHost, isMarketingHost } from "../lib/appHosts";

// Is this hostname a brokerage's OWN dashboard domain (org_domains, kind "app")? The platform's own hosts are known without
// asking; for any other hostname the registry decides: a registered app domain gets the full app (login, dashboard) wearing
// that organization's brand, anything else is a client's website domain (see App.jsx). Answers are shared across callers, so
// this is one lookup per page load.
const lookups = new Map();
const resolved = new Map();

function lookup(host) {
  if (!lookups.has(host)) {
    lookups.set(
      host,
      supabase
        .from("org_domains")
        .select("org:organizations(*)")
        .eq("domain", host)
        .eq("kind", "app")
        .maybeSingle()
        .then(({ data }) => {
          const answer = data?.org ? { isApp: true, org: data.org } : { isApp: false, org: null };
          resolved.set(host, answer);
          return answer;
        })
        .catch(() => {
          const answer = { isApp: false, org: null };
          resolved.set(host, answer);
          return answer;
        }),
    );
  }
  return lookups.get(host);
}

export function useHostOrg() {
  const host = bareHost(window.location.hostname);
  const platformHost = isAppHost(host) || isMarketingHost(host);
  const [state, setState] = useState(() => (platformHost ? null : resolved.get(host) || null));

  useEffect(() => {
    if (platformHost || state) return;
    let active = true;
    lookup(host).then((answer) => active && setState(answer));
    return () => {
      active = false;
    };
  }, [host, platformHost, state]);

  if (platformHost) return { loading: false, isApp: false, org: null };
  return state ? { loading: false, ...state } : { loading: true, isApp: false, org: null };
}

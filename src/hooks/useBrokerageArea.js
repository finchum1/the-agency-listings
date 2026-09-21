import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one brokerage area of expertise by slug, plus the (published)
// brokerage_site so the area page can render the same Navbar/Footer
// chrome around it. Parallel to useBrokeragePost.js — brokerage_site is
// a singleton, so there's no customDomain gate needed here the way
// useBrokerageSite.js has one; CustomDomainSitePage.jsx's fallback
// wrapper does that check itself before ever rendering this page.
export function useBrokerageArea({ areaSlug }) {
  const [site, setSite] = useState(null);
  const [area, setArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!areaSlug) return;
    let active = true;
    setLoading(true);
    setNotFound(false);

    (async () => {
      const { data: siteRow } = await supabase.from("brokerage_site").select("*").maybeSingle();
      if (!siteRow) {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: areaRow } = await supabase
        .from("brokerage_areas")
        .select("*")
        .eq("slug", areaSlug)
        .maybeSingle();

      if (!active) return;
      if (!areaRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSite(siteRow);
      setArea(areaRow);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [areaSlug]);

  return { site, area, loading, notFound };
}

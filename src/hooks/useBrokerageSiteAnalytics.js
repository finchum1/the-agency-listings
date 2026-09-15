import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const since30d = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function count(table, build) {
  const { count, error } = await build(supabase.from(table).select("*", { count: "exact", head: true }));
  if (error) console.error(`count(${table}) failed:`, error);
  return count || 0;
}

// All-time/30d view+lead totals for the brokerage site — parallel to
// useSiteAnalytics.js (agent sites). Views combine the site's own pages
// with its posts' (postIds), same as an agent site. Leads use
// target_type "brokerage_valuation" instead of "brokerage_site": the
// Home Valuation form is the only lead-generating form the brokerage
// site has today (its Contact page is mailto/tel-only, no stored lead —
// see ContactCard.jsx and api/contact.js).
export function useBrokerageSiteAnalytics({ siteId, postIds = [] }) {
  const [stats, setStats] = useState({ views: 0, views30d: 0, leads: 0, leads30d: 0, loading: true });
  const postIdsKey = JSON.stringify(postIds || []);

  useEffect(() => {
    if (!siteId) {
      setStats({ views: 0, views30d: 0, leads: 0, leads30d: 0, loading: false });
      return;
    }
    const ids = JSON.parse(postIdsKey);
    let active = true;
    (async () => {
      const sinceIso = since30d();
      const [siteViews, siteViews30d, postViews, postViews30d, leads, leads30d] = await Promise.all([
        count("page_views", (q) => q.eq("target_type", "brokerage_site").eq("target_id", siteId)),
        count("page_views", (q) =>
          q.eq("target_type", "brokerage_site").eq("target_id", siteId).gte("created_at", sinceIso),
        ),
        ids.length
          ? count("page_views", (q) => q.eq("target_type", "brokerage_post").in("target_id", ids))
          : Promise.resolve(0),
        ids.length
          ? count("page_views", (q) =>
              q.eq("target_type", "brokerage_post").in("target_id", ids).gte("created_at", sinceIso),
            )
          : Promise.resolve(0),
        count("leads", (q) => q.eq("target_type", "brokerage_valuation").eq("target_id", siteId)),
        count("leads", (q) =>
          q.eq("target_type", "brokerage_valuation").eq("target_id", siteId).gte("created_at", sinceIso),
        ),
      ]);
      if (active) {
        setStats({
          views: siteViews + postViews,
          views30d: siteViews30d + postViews30d,
          leads,
          leads30d,
          loading: false,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [siteId, postIdsKey]);

  return stats;
}

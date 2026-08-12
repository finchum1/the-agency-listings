import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const since30d = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function count(table, build) {
  const { count, error } = await build(supabase.from(table).select("*", { count: "exact", head: true }));
  if (error) console.error(`count(${table}) failed:`, error);
  return count || 0;
}

// View/lead counts for one agent site — powers the stats strip at the top
// of the site editor (used by both "My Site" and admin's "edit any
// agent's site"). Views include the site's homepage AND its blog posts
// (postIds); leads are always site-level since the contact form isn't
// per-post.
export function useSiteAnalytics({ siteId, postIds = [] }) {
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
        count("page_views", (q) => q.eq("target_type", "agent_site").eq("target_id", siteId)),
        count("page_views", (q) =>
          q.eq("target_type", "agent_site").eq("target_id", siteId).gte("created_at", sinceIso),
        ),
        ids.length
          ? count("page_views", (q) => q.eq("target_type", "agent_post").in("target_id", ids))
          : Promise.resolve(0),
        ids.length
          ? count("page_views", (q) =>
              q.eq("target_type", "agent_post").in("target_id", ids).gte("created_at", sinceIso),
            )
          : Promise.resolve(0),
        count("leads", (q) => q.eq("target_type", "agent_site").eq("target_id", siteId)),
        count("leads", (q) =>
          q.eq("target_type", "agent_site").eq("target_id", siteId).gte("created_at", sinceIso),
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

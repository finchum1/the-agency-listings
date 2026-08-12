import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const since30d = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

async function count(table, build) {
  const { count, error } = await build(supabase.from(table).select("*", { count: "exact", head: true }));
  if (error) console.error(`count(${table}) failed:`, error);
  return count || 0;
}

// Aggregate page-view/lead counts across a set of listings — powers the
// stats strip at the top of the Listings module. `listingIds` should
// already be scoped correctly by the caller (useListings() already
// returns "my listings, or all if admin" via RLS, so just pass their ids
// straight through).
export function useListingsAnalytics(listingIds) {
  const [stats, setStats] = useState({ views: 0, views30d: 0, leads: 0, leads30d: 0, loading: true });
  const key = JSON.stringify(listingIds || []);

  useEffect(() => {
    const ids = JSON.parse(key);
    if (ids.length === 0) {
      setStats({ views: 0, views30d: 0, leads: 0, leads30d: 0, loading: false });
      return;
    }
    let active = true;
    (async () => {
      const sinceIso = since30d();
      const [views, views30d, leads, leads30d] = await Promise.all([
        count("page_views", (q) => q.eq("target_type", "listing").in("target_id", ids)),
        count("page_views", (q) =>
          q.eq("target_type", "listing").in("target_id", ids).gte("created_at", sinceIso),
        ),
        count("leads", (q) => q.eq("target_type", "listing").in("target_id", ids)),
        count("leads", (q) => q.eq("target_type", "listing").in("target_id", ids).gte("created_at", sinceIso)),
      ]);
      if (active) setStats({ views, views30d, leads, leads30d, loading: false });
    })();
    return () => {
      active = false;
    };
  }, [key]);

  return stats;
}

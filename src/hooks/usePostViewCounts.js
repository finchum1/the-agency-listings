import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const PAGE = 1000;

// Per-post view counts ({ [postId]: { total, last30 } }) for the blog post
// list. Rows in page_views are already written per post (see
// api/track-view.js); this just tallies them client-side, paging past
// PostgREST's 1000-row default so a popular post doesn't silently cap.
export function usePostViewCounts(targetType, postIds) {
  const [counts, setCounts] = useState({});
  const idsKey = JSON.stringify(postIds || []);

  useEffect(() => {
    const ids = JSON.parse(idsKey);
    if (!ids.length) {
      setCounts({});
      return;
    }
    let active = true;
    (async () => {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const tally = {};
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("page_views")
          .select("target_id, created_at")
          .eq("target_type", targetType)
          .in("target_id", ids)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("usePostViewCounts failed:", error);
          break;
        }
        for (const row of data) {
          const t = (tally[row.target_id] ||= { total: 0, last30: 0 });
          t.total += 1;
          if (new Date(row.created_at).getTime() >= cutoff) t.last30 += 1;
        }
        if (data.length < PAGE) break;
      }
      if (active) setCounts(tally);
    })();
    return () => {
      active = false;
    };
  }, [targetType, idsKey]);

  return counts;
}

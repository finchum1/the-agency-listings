import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getWeekWindow, getDayBuckets, getMonthWindow, getWeekBucketsInMonth } from "../lib/periodBuckets";

async function fetchTimestampsInRange(table, sources, sinceIso, untilIso) {
  const results = await Promise.all(
    (sources || [])
      .filter((s) => s.targetIds && s.targetIds.length > 0)
      .map(async ({ targetType, targetIds }) => {
        const { data, error } = await supabase
          .from(table)
          .select("created_at")
          .eq("target_type", targetType)
          .in("target_id", targetIds)
          .gte("created_at", sinceIso)
          .lt("created_at", untilIso);
        if (error) {
          console.error(`period ${table} fetch failed:`, error);
          return [];
        }
        return data || [];
      }),
  );
  return results.flat();
}

function bucketRows(rows, buckets) {
  const counts = buckets.map(() => 0);
  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    for (let i = 0; i < buckets.length; i++) {
      if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

// mode "week" -> 7 daily buckets for that week; mode "month" -> that
// month's weekly buckets (~4-5, Monday-start, per the recommended shape
// for the Monthly toggle — same rollup the chart already did, just
// paginated one month at a time instead of a fixed trailing window).
function buildBucketShell(mode, offset) {
  if (mode === "month") {
    const { start, end } = getMonthWindow(offset);
    return { windowStart: start, windowEnd: end, buckets: getWeekBucketsInMonth(start, end) };
  }
  const { start, end } = getWeekWindow(offset);
  return { windowStart: start, windowEnd: end, buckets: getDayBuckets(start) };
}

const shellToZeroed = (buckets) => buckets.map((b) => ({ ...b, views: 0, leads: 0 }));

// Navigable view/lead trend for PeriodAnalyticsPanel — `offset` counts
// periods back from the current one (0 = this week/month). The panel
// itself clamps forward navigation at 0 (nothing to show beyond "now");
// this hook just answers whatever mode/offset it's given.
//
// `viewSources`/`leadSources` are arrays of { targetType, targetIds } —
// a site's views combine its own page views with its posts' (same shape
// useSiteAnalytics already uses for the all-time/30d totals).
export function usePeriodAnalytics({ viewSources, leadSources, mode, offset }) {
  const [state, setState] = useState(() => {
    const { buckets } = buildBucketShell(mode, offset);
    return { buckets: shellToZeroed(buckets), totalViews: 0, totalLeads: 0, loading: true };
  });
  const viewKey = JSON.stringify(viewSources || []);
  const leadKey = JSON.stringify(leadSources || []);

  useEffect(() => {
    const vSources = JSON.parse(viewKey);
    const lSources = JSON.parse(leadKey);
    const { windowStart, windowEnd, buckets: shell } = buildBucketShell(mode, offset);
    const hasAny = [...vSources, ...lSources].some((s) => s.targetIds?.length);

    setState({ buckets: shellToZeroed(shell), totalViews: 0, totalLeads: 0, loading: true });
    if (!hasAny) {
      setState({ buckets: shellToZeroed(shell), totalViews: 0, totalLeads: 0, loading: false });
      return;
    }

    let active = true;
    (async () => {
      const sinceIso = windowStart.toISOString();
      const untilIso = windowEnd.toISOString();
      const [viewRows, leadRows] = await Promise.all([
        fetchTimestampsInRange("page_views", vSources, sinceIso, untilIso),
        fetchTimestampsInRange("leads", lSources, sinceIso, untilIso),
      ]);
      const viewCounts = bucketRows(viewRows, shell);
      const leadCounts = bucketRows(leadRows, shell);
      const buckets = shell.map((b, i) => ({ ...b, views: viewCounts[i], leads: leadCounts[i] }));
      if (active) {
        setState({ buckets, totalViews: viewRows.length, totalLeads: leadRows.length, loading: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [viewKey, leadKey, mode, offset]);

  return state;
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { buildWeekBuckets } from "../lib/weeklyBuckets";

const WEEKS = 8;
const ROLLING_7D_MS = 7 * 24 * 60 * 60 * 1000;

// Fetches raw created_at timestamps for one or more (targetType,
// targetIds) sources since a given ISO date — a site's views combine its
// own page views with its posts' (same shape useSiteAnalytics already
// uses for the all-time/30d totals), so `sources` is always an array,
// even when there's only one.
async function fetchTimestampsSince(table, sources, sinceIso) {
  const results = await Promise.all(
    (sources || [])
      .filter((s) => s.targetIds && s.targetIds.length > 0)
      .map(async ({ targetType, targetIds }) => {
        const { data, error } = await supabase
          .from(table)
          .select("created_at")
          .eq("target_type", targetType)
          .in("target_id", targetIds)
          .gte("created_at", sinceIso);
        if (error) {
          console.error(`weekly ${table} fetch failed:`, error);
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

function countRollingWindow(rows, ms) {
  const cutoff = Date.now() - ms;
  return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
}

// Weekly (Monday-start) view/lead trend for the last 8 weeks, plus a
// rolling-7-day total for the "current" stat cards (a rolling window,
// same convention as the existing all-time/30d AnalyticsStats cards,
// rather than the calendar-week buckets the chart itself uses — those
// answer different questions: "right now" vs. "is this trending up").
//
// `viewSources`/`leadSources` are arrays of { targetType, targetIds }.
// weeks is always a full WEEKS-length array (zero-filled when there's
// nothing to show yet) — never empty — so a consumer can safely index
// weeks[0]/weeks[weeks.length - 1] the moment loading is false, including
// during the brief render where a target id (e.g. a listing still
// loading) hasn't arrived yet.
const emptyWeeks = () => buildWeekBuckets(WEEKS).map((b) => ({ start: b.start, views: 0, leads: 0 }));

export function useWeeklyAnalytics({ viewSources, leadSources }) {
  const [state, setState] = useState({ weeks: emptyWeeks(), views7d: 0, leads7d: 0, loading: true });
  const viewKey = JSON.stringify(viewSources || []);
  const leadKey = JSON.stringify(leadSources || []);

  useEffect(() => {
    const vSources = JSON.parse(viewKey);
    const lSources = JSON.parse(leadKey);
    const hasAny = [...vSources, ...lSources].some((s) => s.targetIds?.length);
    if (!hasAny) {
      setState({ weeks: emptyWeeks(), views7d: 0, leads7d: 0, loading: false });
      return;
    }
    let active = true;
    (async () => {
      const buckets = buildWeekBuckets(WEEKS);
      const sinceIso = buckets[0].start.toISOString();
      const [viewRows, leadRows] = await Promise.all([
        fetchTimestampsSince("page_views", vSources, sinceIso),
        fetchTimestampsSince("leads", lSources, sinceIso),
      ]);
      const viewCounts = bucketRows(viewRows, buckets);
      const leadCounts = bucketRows(leadRows, buckets);
      const weeks = buckets.map((b, i) => ({ start: b.start, views: viewCounts[i], leads: leadCounts[i] }));
      if (active) {
        setState({
          weeks,
          views7d: countRollingWindow(viewRows, ROLLING_7D_MS),
          leads7d: countRollingWindow(leadRows, ROLLING_7D_MS),
          loading: false,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [viewKey, leadKey]);

  return state;
}

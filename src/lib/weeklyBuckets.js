// Monday-start week buckets, computed in UTC to avoid the local-timezone
// off-by-one bugs that plagued date handling elsewhere in this app (see
// TC Dashboard's own date-parsing lessons) — the exact day boundary
// doesn't matter for a trend chart, only that it's consistent bucket to
// bucket. The most recent bucket is the current (possibly partial) week.
export function buildWeekBuckets(weeks) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = (today.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
  const currentWeekStart = new Date(today);
  currentWeekStart.setUTCDate(today.getUTCDate() - dayOfWeek);

  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setUTCDate(currentWeekStart.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    buckets.push({ start, end });
  }
  return buckets;
}

export function weekLabel(start) {
  return start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

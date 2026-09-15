// Monday-start week/day/month window helpers for the dashboard's
// navigable analytics chart (PeriodAnalyticsPanel). Computed in UTC to
// avoid local-timezone off-by-one bugs — the exact boundary doesn't
// matter for a trend chart, only that it's consistent bucket to bucket.

function utcMidnight(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function mondayOfWeek(d) {
  const day = utcMidnight(d);
  const dow = (day.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday
  day.setUTCDate(day.getUTCDate() - dow);
  return day;
}

// The week window `offset` weeks before the current week (0 = this week,
// Monday through the following Monday exclusive).
export function getWeekWindow(offset) {
  const start = mondayOfWeek(new Date());
  start.setUTCDate(start.getUTCDate() - offset * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

// 7 daily buckets spanning a week window.
export function getDayBuckets(weekStart) {
  const buckets = [];
  for (let i = 0; i < 7; i++) {
    const start = new Date(weekStart);
    start.setUTCDate(weekStart.getUTCDate() + i);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 1);
    buckets.push({ start, end });
  }
  return buckets;
}

// The calendar-month window `offset` months before the current month
// (0 = this month).
export function getMonthWindow(offset) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

// Monday-start weekly buckets covering every week that overlaps the given
// month window — the first/last bucket can spill a few days into the
// adjacent month, same as a calendar month-view grid would.
export function getWeekBucketsInMonth(monthStart, monthEnd) {
  const buckets = [];
  let cursor = mondayOfWeek(monthStart);
  while (cursor < monthEnd) {
    const start = new Date(cursor);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    buckets.push({ start, end });
    cursor = end;
  }
  return buckets;
}

export function dayLabel(d) {
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function shortDateLabel(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function monthLabel(d) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// "Sep 8–14" (or "Sep 29–Oct 5" across a month boundary) for a week
// window's header label — `end` is exclusive, so the displayed range is
// the day before it.
export function weekRangeLabel(start, end) {
  const endInclusive = new Date(end);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
  const sameMonth =
    start.getUTCMonth() === endInclusive.getUTCMonth() && start.getUTCFullYear() === endInclusive.getUTCFullYear();
  const startStr = shortDateLabel(start);
  const endStr = endInclusive.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" },
  );
  return `${startStr}–${endStr}`;
}

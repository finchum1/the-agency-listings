// Small date helpers for the dashboard home page. Dates are plain YYYY-MM-DD strings (no time zones to trip over).
export const toKey = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const daysBetween = (fromKeyStr, toKeyStr) => Math.round((fromKey(toKeyStr) - fromKey(fromKeyStr)) / 86400000);

/** "Today", "Tomorrow", "Mon, Oct 19", or "3 days ago" for the past. */
export function dayLabel(key, todayKeyStr) {
  const diff = daysBetween(todayKeyStr, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days ago`;
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** "just now" style relative text for how long ago a day was, in days/weeks/months. */
export function agoLabel(days) {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

/** The Sunday on or before a date. */
export const startOfWeek = (d) => addDays(d, -d.getDay());

/** The six-row (or five-row) grid of days a month calendar shows, Sunday first: [{ key, inMonth }]. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = startOfWeek(first);
  const last = new Date(year, month + 1, 0);
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(start, i);
    return { key: toKey(d), inMonth: d.getMonth() === month };
  });
}

export const timeLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

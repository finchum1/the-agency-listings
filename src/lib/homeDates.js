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

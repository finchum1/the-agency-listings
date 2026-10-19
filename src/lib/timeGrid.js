// Helpers for the schedule's hourly grid: minutes since midnight, 15-minute snapping, and side-by-side lanes for
// blocks that overlap. Times are plain "HH:MM" strings (what a <input type="time"> and agent_tasks.start_time use).
export const HOUR_PX = 48;
export const SNAP = 15;
export const DAY_MIN = 24 * 60;

const pad = (n) => String(n).padStart(2, "0");

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Minutes since midnight to "HH:MM". Midnight at the end of a day (1440) becomes "23:59" so it stays a valid time. */
export const fromMin = (min) => {
  if (min >= DAY_MIN) return "23:59";
  const m = Math.max(0, Math.round(min));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const snapMin = (min, step = SNAP) => Math.round(min / step) * step;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** "9:00 AM" (or "9 AM" when `short` and on the hour) for a number of minutes since midnight. */
export function minLabel(min, short = false) {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "AM" : "PM";
  return short && mm === 0 ? `${h} ${suffix}` : `${h}:${pad(mm)} ${suffix}`;
}

/** "9:00 – 10:30 AM" style range (the first half drops its AM/PM when it matches the second). */
export function rangeLabel(startMin, endMin) {
  const a = minLabel(startMin);
  const b = minLabel(endMin >= DAY_MIN ? DAY_MIN - 1 : endMin);
  const sa = a.slice(-2);
  const sb = b.slice(-2);
  return sa === sb ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/**
 * Lays out the blocks of one day side by side where they overlap. `items` need { id, startMin, endMin }. Returns a Map
 * of id -> { lane, lanes }: a block takes the lane's slice of the width, and every block in a cluster of overlapping
 * blocks shares the same number of lanes.
 */
export function layoutDay(items) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out = new Map();
  let cluster = [];
  let clusterEnd = -1;
  let laneEnds = [];
  const flush = () => {
    for (const it of cluster) out.set(it.id, { lane: it.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = it.endMin;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.endMin);
  }
  flush();
  return out;
}

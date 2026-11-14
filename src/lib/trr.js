// The TRR negotiation window on a deal: the day the report was received, and how many days there are to negotiate it (7 unless the
// contract says otherwise, so the number is kept per deal). The deadline is worked out from those two, never stored, so changing either
// moves it. Pure date arithmetic on "YYYY-MM-DD" keys, so it gives the same answer in the browser and on the server.
export const DEFAULT_TRR_DAYS = 7;

/** The days to negotiate: the deal's own number when it is a sensible whole number, else the standard 7. */
export function trrDays(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 120 ? n : DEFAULT_TRR_DAYS;
}

/** The last day to negotiate ("YYYY-MM-DD"), or "" when the report has not been received yet. */
export function trrDeadline(received, days) {
  if (!received || !/^\d{4}-\d{2}-\d{2}$/.test(String(received))) return "";
  const [y, m, d] = String(received).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + trrDays(days))).toISOString().slice(0, 10);
}

/** A deal row with its `trr_deadline` filled in, so it can be listed beside the other key dates. */
export const withTrr = (deal) => (deal ? { ...deal, trr_deadline: trrDeadline(deal.trr_received_date, deal.trr_days) } : deal);

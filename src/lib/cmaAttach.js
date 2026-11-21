// A CMA attached to a listing: a frozen note of what the CMA said and what the home was listed at that day, compared later with the list price now and
// what the home sold for. The snapshot is { at, suggested, low, high, list_price, sold_price } (stored on the CMA as `attach`).

import { computeCma, toNumber } from "./cma.js";

/** Freezes the CMA's numbers against the listing's price today. `sold_price` carries over if the agent already entered it. */
export function makeSnapshot(cma, listing, previous = {}) {
  const m = computeCma(cma);
  return {
    at: new Date().toISOString(),
    suggested: m.suggested ?? null,
    low: m.low ?? null,
    high: m.high ?? null,
    list_price: toNumber(listing?.price),
    sold_price: toNumber(previous?.sold_price),
  };
}

/** The sold price the agent typed (a number, or null for blank / nonsense). */
export const cleanSoldPrice = (v) => {
  const n = toNumber(v);
  return n != null && n > 0 && n < 1e10 ? Math.round(n) : null;
};

const pct = (a, b) => (a != null && b ? ((a - b) / b) * 100 : null);

/**
 * What to say about one attached CMA. `listPriceNow` is the listing's price today. Each comparison is a percentage of the second number
 * (positive = the first is higher). Anything missing is left out.
 */
export function compareAttached(snap = {}, listPriceNow = null) {
  const now = toNumber(listPriceNow);
  const rows = [];
  const add = (label, a, b, hint) => {
    const d = pct(a, b);
    if (d != null) rows.push({ label, diff: d, hint });
  };
  add("Listed vs. the CMA", snap.list_price, snap.suggested, "the price it went on the market at, against the suggested price");
  add("List price now vs. the CMA", now, snap.suggested, "after any price changes");
  add("Sold vs. the CMA", snap.sold_price, snap.suggested, "what it sold for, against the suggested price");
  add("Sold vs. final list price", snap.sold_price, now ?? snap.list_price, "what it sold for, against the last list price");
  return rows;
}

/** "+3.2%" / "−1.0%" / "on the number". */
export const diffText = (d) => (Math.abs(d) < 0.05 ? "on the number" : `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)}%`);

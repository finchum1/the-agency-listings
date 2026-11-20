// The arithmetic and wording behind a CMA (comparative market analysis). Everything here is pure, so the editor, the client page and the
// tests all read the same numbers. A comp is { id, address, status: "sold" | "pending" | "active", price, list_price, date, dom, beds, baths, sqft,
// year_built, lot, distance, mls, photo_url, notes, include, adjustments: [{ label, amount }] }.

export const COMP_STATUSES = [
  { value: "sold", label: "Sold", dateLabel: "Sold on" },
  { value: "pending", label: "Pending", dateLabel: "Under contract" },
  { value: "active", label: "Active", dateLabel: "Listed on" },
];

// Quick-add adjustment names. The amount is from the COMP's side: a comp with a pool the subject lacks is a negative number.
export const ADJUSTMENT_PRESETS = ["Square footage", "Condition / updates", "Pool", "Garage", "Lot size", "Age", "Location", "Seller concessions"];

export const newComp = (status = "sold") => ({
  id: crypto.randomUUID(),
  status,
  address: "",
  price: "",
  list_price: "",
  date: "",
  dom: "",
  beds: "",
  baths: "",
  sqft: "",
  year_built: "",
  lot: "",
  distance: "",
  mls: "",
  photo_url: "",
  notes: "",
  include: true,
  adjustments: [],
});

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const toNumber = num;

export const adjustmentTotal = (comp) => (comp.adjustments || []).reduce((sum, a) => sum + (num(a.amount) || 0), 0);
export const adjustedPrice = (comp) => {
  const p = num(comp.price);
  return p == null ? null : p + adjustmentTotal(comp);
};
export const pricePerSqft = (comp, price = num(comp.price)) => {
  const s = num(comp.sqft);
  return price != null && s ? price / s : null;
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const roundTo = (n, step) => Math.round(n / step) * step;

/**
 * The numbers for a whole CMA. The value estimate is built from the included SOLD homes (or, if none are sold yet, the included pending ones);
 * active homes are the competition and only feed the market notes. With four or more homes the range is the middle half of the adjusted prices
 * so one odd sale doesn't stretch it; with fewer it is lowest to highest. The agent can override the range and suggested price.
 */
export function computeCma({ subject = {}, comps = [], price_low, price_high, suggested_price } = {}) {
  const included = comps.filter((c) => c.include !== false && num(c.price) != null);
  const sold = included.filter((c) => c.status === "sold");
  const pending = included.filter((c) => c.status === "pending");
  const active = included.filter((c) => c.status === "active");
  const basis = sold.length ? sold : pending;
  const adj = basis.map(adjustedPrice);

  const subjectSqft = num(subject.sqft);
  const ppsfs = basis.map((c) => pricePerSqft(c, adjustedPrice(c))).filter((v) => v != null);
  const byPpsf = ppsfs.length && subjectSqft ? mean(ppsfs) * subjectSqft : null;

  let low = null;
  let high = null;
  let mid = null;
  if (adj.length) {
    mid = median(adj);
    [low, high] = adj.length >= 4 ? [quantile(adj, 0.25), quantile(adj, 0.75)] : [Math.min(...adj), Math.max(...adj)];
  }
  const step = 1000;
  const calc = { low: low == null ? null : roundTo(low, step), high: high == null ? null : roundTo(high, step), suggested: mid == null ? null : roundTo(mid, step) };
  const over = { low: num(price_low), high: num(price_high), suggested: num(suggested_price) };

  const doms = included.map((c) => num(c.dom)).filter((v) => v != null);
  const ratios = sold.map((c) => (num(c.list_price) && num(c.price) ? num(c.price) / num(c.list_price) : null)).filter((v) => v != null);
  return {
    basisCount: basis.length,
    basisKind: sold.length ? "sold" : pending.length ? "pending" : "none",
    soldCount: sold.length,
    pendingCount: pending.length,
    activeCount: active.length,
    calculated: calc,
    low: over.low ?? calc.low,
    high: over.high ?? calc.high,
    suggested: over.suggested ?? calc.suggested,
    overridden: over.low != null || over.high != null || over.suggested != null,
    averageAdjusted: adj.length ? mean(adj) : null,
    byPricePerSqft: byPpsf == null ? null : roundTo(byPpsf, step),
    averagePpsf: ppsfs.length ? mean(ppsfs) : null,
    averageDom: doms.length ? mean(doms) : null,
    saleToList: ratios.length ? mean(ratios) : null,
    activeLow: active.length ? Math.min(...active.map((c) => num(c.price))) : null,
    activeHigh: active.length ? Math.max(...active.map((c) => num(c.price))) : null,
  };
}

/** A one-line summary of the subject for lists ("3 bd · 2 ba · 1,850 sqft · built 1998"). */
export function factsLine(h = {}) {
  const bits = [];
  if (num(h.beds) != null) bits.push(`${h.beds} bd`);
  if (num(h.baths) != null) bits.push(`${h.baths} ba`);
  if (num(h.sqft) != null) bits.push(`${num(h.sqft).toLocaleString("en-US")} sqft`);
  if (num(h.year_built) != null) bits.push(`built ${h.year_built}`);
  return bits.join(" · ");
}

export const subjectAddress = (s = {}) => [s.address, [s.city, [s.state, s.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");

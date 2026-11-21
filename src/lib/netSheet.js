// A seller's net sheet: what a seller walks away with at each price. Pure arithmetic shared by the CMA editor, the client page and the tests.
// An agent fills in the loan payoff and the usual costs once; every price (the CMA's low, suggested and high, plus up to three of the agent's own)
// then shows the same lines down the page. The sheet is stored on the CMA as `net_sheet`:
//   { show, payoff, listing_pct, buyer_pct, concessions, title_fee, stamps_pct, taxes, warranty, repairs, other: [{ label, amount }], prices: [] }
// Amounts may be typed as "$1,200" or "1200"; blanks count as zero. `show` says whether the client page includes it.

import { toNumber } from "./cma.js";

export const MAX_EXTRA_PRICES = 3;
export const MAX_OTHER_LINES = 8;

// Starting numbers for a new sheet. Every one is editable; the agent's own last-used fees (see saveDefaults) replace these on new sheets.
// Oklahoma's documentary stamp tax is $0.75 per $500 of the price (0.15%), usually paid by the seller. Confirm local custom before sharing.
export const NET_SHEET_DEFAULTS = {
  show: false,
  payoff: "",
  listing_pct: "3",
  buyer_pct: "3",
  concessions: "",
  title_fee: "1500",
  stamps_pct: "0.15",
  taxes: "",
  warranty: "",
  repairs: "",
  other: [],
  prices: [],
};

/** A sheet with every field present, whatever was stored. */
export const withDefaults = (ns) => ({ ...NET_SHEET_DEFAULTS, ...(ns || {}), other: Array.isArray(ns?.other) ? ns.other : [], prices: Array.isArray(ns?.prices) ? ns.prices : [] });

/** True once the agent has started a sheet (the stored object isn't empty). */
export const hasNetSheet = (ns) => Boolean(ns && typeof ns === "object" && Object.keys(ns).length > 0);

const n = (v) => toNumber(v) ?? 0;
const pctOf = (price, pct) => Math.round((price * n(pct)) / 100);

/**
 * One price down the page. `lines` are the costs (zero lines are left out), `costs` their total, `payoff` the loan payoff and `net` what is left:
 * price − costs − payoff.
 */
export function computeNet(ns, price) {
  const s = withDefaults(ns);
  const p = Math.round(n(price));
  const lines = [
    { key: "listing", label: `Your agent's commission (${n(s.listing_pct)}%)`, amount: pctOf(p, s.listing_pct) },
    { key: "buyer", label: `Buyer's agent commission (${n(s.buyer_pct)}%)`, amount: pctOf(p, s.buyer_pct) },
    { key: "concessions", label: "Seller concessions", amount: n(s.concessions) },
    { key: "title", label: "Title, escrow and closing fees", amount: n(s.title_fee) },
    { key: "stamps", label: "Documentary stamps", amount: pctOf(p, s.stamps_pct) },
    { key: "taxes", label: "Property taxes owed at closing", amount: n(s.taxes) },
    { key: "warranty", label: "Home warranty", amount: n(s.warranty) },
    { key: "repairs", label: "Repairs and prep", amount: n(s.repairs) },
    ...s.other.filter((o) => n(o.amount) !== 0).map((o, i) => ({ key: `other${i}`, label: String(o.label || "").trim() || "Other", amount: n(o.amount) })),
  ].filter((l) => l.amount !== 0);
  const costs = lines.reduce((sum, l) => sum + l.amount, 0);
  const payoff = n(s.payoff);
  return { price: p, lines, costs, payoff, net: p - costs - payoff, netPct: p ? (p - costs - payoff) / p : 0 };
}

/** The columns of the sheet: the CMA's low / suggested / high (when it has them) and the agent's own prices, lowest first. */
export function netScenarios(ns, calc) {
  const s = withDefaults(ns);
  const rows = [
    ...(calc?.low != null ? [{ label: "Low", price: calc.low }] : []),
    ...(calc?.suggested != null ? [{ label: "Suggested", price: calc.suggested }] : []),
    ...(calc?.high != null ? [{ label: "High", price: calc.high }] : []),
    ...s.prices.map((p) => toNumber(p)).filter((p) => p != null && p > 0).slice(0, MAX_EXTRA_PRICES).map((p) => ({ label: "Your price", price: p })),
  ];
  return rows.sort((a, b) => a.price - b.price).map((r) => ({ ...r, ...computeNet(s, r.price) }));
}

/** The fee defaults the agent used last time, so the next sheet starts from them (saved in this browser only). */
const KEY = "netSheetFees";
const FEE_FIELDS = ["listing_pct", "buyer_pct", "title_fee", "stamps_pct"];
export function savedFees() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return Object.fromEntries(FEE_FIELDS.filter((k) => raw[k] != null && raw[k] !== "").map((k) => [k, String(raw[k])]));
  } catch {
    return {};
  }
}
export function saveFees(ns) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(FEE_FIELDS.map((k) => [k, ns[k]]))));
  } catch {
    /* private mode: the defaults just don't carry over */
  }
}

/** What is stored: only the fields we know, trimmed, with blank rows dropped. */
export function cleanNetSheet(ns) {
  const s = withDefaults(ns);
  const text = (v, max = 20) => String(v ?? "").slice(0, max);
  return {
    show: Boolean(s.show),
    payoff: text(s.payoff),
    listing_pct: text(s.listing_pct),
    buyer_pct: text(s.buyer_pct),
    concessions: text(s.concessions),
    title_fee: text(s.title_fee),
    stamps_pct: text(s.stamps_pct),
    taxes: text(s.taxes),
    warranty: text(s.warranty),
    repairs: text(s.repairs),
    other: s.other.slice(0, MAX_OTHER_LINES).map((o) => ({ label: text(o.label, 60), amount: text(o.amount) })),
    prices: s.prices.slice(0, MAX_EXTRA_PRICES).map((p) => text(p)),
  };
}

// What can be done to a CMA outside the dashboard's own editor (the AI connection, api/_lib/mcpReviewCmaTools.js, and the Mac app, api/mac-app.js): read it with
// the numbers worked out, fill in the seller net sheet, write the listing presentation, attach it to a listing and record what it sold for. One place, so
// both follow the same rules as the dashboard (src/lib/cma.js, netSheet.js, presentation.js, cmaAttach.js). `db` is any Supabase client that may read and
// change this agent's CMAs (the signed-in client, or the service client with `owner` filtering every query); nothing here deletes or sends anything.
import { HttpError, bad, isUuid } from "./bots/util.js";
import { adjustedPrice, computeCma, factsLine, subjectAddress, toNumber } from "../../src/lib/cma.js";
import { cleanNetSheet, hasNetSheet, netScenarios, withDefaults as netDefaults } from "../../src/lib/netSheet.js";
import { MAX_PLAN_ITEMS, cleanPresentation, withDefaults as presentationDefaults } from "../../src/lib/presentation.js";
import { cleanSoldPrice, compareAttached, diffText, makeSnapshot } from "../../src/lib/cmaAttach.js";
import { GUIDE_THEMES, GUIDE_THEME_KEYS } from "../../src/lib/guides.js";

export const CMA_COLUMNS = "id, title, person_id, subject, comps, price_low, price_high, suggested_price, notes, net_sheet, presentation, listing_id, attach, share_hint, shared_at, view_count, updated_at";
export { GUIDE_THEME_KEYS };

export const cmaName = (c) => subjectAddress(c.subject) || c.title || "Untitled CMA";

export async function loadCma(db, owner, cmaId) {
  if (!isUuid(cmaId)) throw bad("That isn't a valid CMA id.");
  const { data } = await db.from("cmas").select(CMA_COLUMNS).eq("id", cmaId).eq("owner_id", owner).maybeSingle();
  if (!data) throw new HttpError(404, "No CMA with that id.");
  return data;
}

const fail = (error) => {
  throw new HttpError(500, error.message || "Couldn't save it.");
};

// ------------------------------------------------------------------------------------------------ net sheet

export const NET_AMOUNT_FIELDS = ["payoff", "concessions", "title_fee", "taxes", "warranty", "repairs"];
export const NET_PERCENT_FIELDS = ["listing_pct", "buyer_pct", "stamps_pct"];

const amount = (v, name) => {
  if (v === null || v === "") return "";
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1e10) throw bad(`${name} must be a number of dollars (0 or more).`);
  return String(n);
};
const percent = (v, name) => {
  const n = Number(String(v).replace(/[%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 20) throw bad(`${name} must be a percent from 0 to 20.`);
  return String(n);
};

/** Fills in or changes the seller net sheet (only the fields sent change). Returns the CMA row as saved. */
export async function saveNetSheet(db, owner, cmaId, a) {
  const c = await loadCma(db, owner, cmaId);
  const next = netDefaults(c.net_sheet);
  for (const k of NET_AMOUNT_FIELDS) if (a[k] !== undefined) next[k] = amount(a[k], k);
  for (const k of NET_PERCENT_FIELDS) if (a[k] !== undefined) next[k] = percent(a[k], k);
  if (a.show !== undefined) next.show = a.show === true;
  if (a.other_costs !== undefined) {
    if (!Array.isArray(a.other_costs)) throw bad("other_costs must be a list of { label, amount }.");
    next.other = a.other_costs.slice(0, 8).map((o) => ({ label: String(o?.label || "").slice(0, 60), amount: amount(o?.amount, "other cost amount") }));
  }
  if (a.extra_prices !== undefined) {
    if (!Array.isArray(a.extra_prices)) throw bad("extra_prices must be a list of prices.");
    next.prices = a.extra_prices.slice(0, 3).map((p) => amount(p, "extra price"));
  }
  const clean = cleanNetSheet(next);
  const { error } = await db.from("cmas").update({ net_sheet: clean }).eq("id", c.id).eq("owner_id", owner);
  if (error) fail(error);
  return { ...c, net_sheet: clean };
}

// ------------------------------------------------------------------------------------------ presentation

/** Writes the words around a CMA for a listing appointment (only what is sent changes). Returns the CMA row as saved. */
export async function savePresentation(db, owner, cmaId, a) {
  const c = await loadCma(db, owner, cmaId);
  const next = presentationDefaults(c.presentation);
  if (a.intro !== undefined) next.intro = String(a.intro);
  if (a.about !== undefined) next.about = String(a.about);
  if (a.include_net !== undefined) next.include_net = a.include_net === true;
  if (a.theme !== undefined) {
    if (a.theme !== "site" && !GUIDE_THEME_KEYS.includes(a.theme)) throw bad(`theme must be "site" (match the website) or one of: ${GUIDE_THEME_KEYS.join(", ")}.`);
    next.theme = a.theme;
  }
  if (a.marketing_plan !== undefined) {
    if (!Array.isArray(a.marketing_plan) || a.marketing_plan.length > MAX_PLAN_ITEMS) throw bad(`marketing_plan must be a list of up to ${MAX_PLAN_ITEMS} steps, each { title, detail, on }.`);
    next.plan = a.marketing_plan.map((i, n) => ({ id: String(i?.id || `item-${n}-${Date.now().toString(36)}`), title: String(i?.title || ""), detail: String(i?.detail || ""), on: i?.on !== false }));
  }
  const clean = cleanPresentation(next);
  const { error } = await db.from("cmas").update({ presentation: clean }).eq("id", c.id).eq("owner_id", owner);
  if (error) fail(error);
  return { ...c, presentation: clean };
}

// ---------------------------------------------------------------------------------- attach to a listing

async function ownListing(db, owner, listingId) {
  if (!isUuid(listingId)) throw bad("That isn't a valid listing id.");
  const { data } = await db.from("listings").select("id, address_line1, price").eq("id", listingId).eq("agent_id", owner).maybeSingle();
  if (!data) throw new HttpError(404, "No listing of yours with that id.");
  return data;
}

/** Ties a CMA to one of the agent's listings, freezing the CMA's numbers and the listing's price today. Returns the CMA row and the listing. */
export async function attachCma(db, owner, cmaId, listingId) {
  const c = await loadCma(db, owner, cmaId);
  const listing = await ownListing(db, owner, listingId);
  const attach = makeSnapshot(c, listing, c.listing_id === listing.id ? c.attach : {});
  const { error } = await db.from("cmas").update({ listing_id: listing.id, attach }).eq("id", c.id).eq("owner_id", owner);
  if (error) fail(error);
  return { cma: { ...c, listing_id: listing.id, attach }, listing };
}

export async function detachCma(db, owner, cmaId) {
  const c = await loadCma(db, owner, cmaId);
  const { error } = await db.from("cmas").update({ listing_id: null, attach: {} }).eq("id", c.id).eq("owner_id", owner);
  if (error) fail(error);
  return { ...c, listing_id: null, attach: {} };
}

/** What the home finally sold for (null clears it); needs the CMA to be attached. */
export async function setSoldPrice(db, owner, cmaId, soldPrice) {
  const c = await loadCma(db, owner, cmaId);
  if (!c.listing_id) throw bad("Attach the CMA to a listing first.");
  const blank = soldPrice === null || soldPrice === undefined || soldPrice === "";
  const sold = blank ? null : cleanSoldPrice(soldPrice);
  if (!blank && sold == null) throw bad("sold_price must be a number of dollars.");
  const attach = { ...(c.attach || {}), sold_price: sold };
  const { error } = await db.from("cmas").update({ attach }).eq("id", c.id).eq("owner_id", owner);
  if (error) fail(error);
  return { ...c, attach };
}

// -------------------------------------------------------------------------------------------- reading

const num = (v) => (v == null || v === "" ? null : Number(v));

/** One line per CMA, for a list. `listings` maps listing id to its address. */
export function cmaListItem(c, listings = new Map()) {
  const m = computeCma(c);
  return {
    id: c.id,
    title: c.title || "",
    address: cmaName(c),
    suggested: m.suggested,
    low: m.low,
    high: m.high,
    comps: (c.comps || []).length,
    listing_address: c.listing_id ? listings.get(c.listing_id) || "a listing" : "",
    shared: Boolean(c.shared_at),
    updated_at: c.updated_at,
  };
}

/** A CMA with every number worked out, for the Mac app and the AI tools: price opinion, homes, net sheet at each price, listing comparison, presentation. */
export function cmaDetail(c, listing = null, listings = []) {
  const m = computeCma(c);
  const ns = netDefaults(c.net_sheet);
  const comps = (c.comps || []).map((x) => ({
    id: String(x.id || ""),
    status: x.status,
    address: String(x.address || ""),
    price: toNumber(x.price),
    adjusted: x.status === "active" ? null : adjustedPrice(x),
    date: String(x.date || ""),
    dom: toNumber(x.dom),
    include: x.include !== false,
  }));
  const snap = c.attach || {};
  const attached = c.listing_id
    ? {
        listing_id: c.listing_id,
        listing_address: listing?.address_line1 || "",
        price_now: num(listing?.price),
        frozen_at: snap.at || "",
        suggested: num(snap.suggested),
        low: num(snap.low),
        high: num(snap.high),
        list_price: num(snap.list_price),
        sold_price: num(snap.sold_price),
        compare: compareAttached(snap, listing?.price).map((r) => ({ label: r.label, diff: r.diff, text: diffText(r.diff) })),
      }
    : null;
  const p = presentationDefaults(c.presentation);
  return {
    id: c.id,
    title: c.title || "",
    address: cmaName(c),
    facts: factsLine(c.subject),
    price: {
      suggested: m.suggested,
      low: m.low,
      high: m.high,
      overridden: m.overridden,
      basis_count: m.basisCount,
      basis_kind: m.basisKind,
      average_ppsf: m.averagePpsf,
      average_dom: m.averageDom,
      sale_to_list: m.saleToList,
    },
    comps,
    net: {
      started: hasNetSheet(c.net_sheet),
      show: Boolean(ns.show),
      fields: Object.fromEntries([...NET_AMOUNT_FIELDS, ...NET_PERCENT_FIELDS].map((k) => [k, String(ns[k] ?? "")])),
      other: ns.other.map((o) => ({ label: String(o.label || ""), amount: String(o.amount ?? "") })),
      prices: ns.prices.map((x) => String(x)),
      scenarios: netScenarios(ns, m).map((s) => ({ label: s.label, price: s.price, lines: s.lines.map((l) => ({ label: l.label, amount: l.amount })), costs: s.costs, payoff: s.payoff, net: s.net })),
    },
    attached,
    listings: listings.map((l) => ({ id: l.id, address: l.address_line1 || "", price: num(l.price) })),
    presentation: { theme: p.theme, intro: p.intro, about: p.about, include_net: p.include_net, plan: p.plan.map((i) => ({ id: String(i.id || ""), title: i.title, detail: i.detail || "", on: i.on !== false })) },
    themes: GUIDE_THEMES.map((t) => ({ key: t.key, label: t.label })),
    shared: Boolean(c.shared_at),
    views: c.view_count || 0,
    updated_at: c.updated_at,
  };
}

/** The agent's own listings (newest first), for the attach picker. */
export async function myListings(db, owner) {
  const { data } = await db.from("listings").select("id, address_line1, price").eq("agent_id", owner).order("updated_at", { ascending: false }).limit(100);
  return data || [];
}

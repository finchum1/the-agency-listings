// POST /api/cma-comps (signed in): suggested comparable homes for a CMA, from the agent's office's MLS feed (Repliers). Body:
//   { subject: { address, city, beds, sqft, ... }, months, radiusMiles, sqftPct }
// It finds the subject home in the MLS by address to get its coordinates, then looks for homes SOLD within `months` and ACTIVE homes now, within the
// radius, with similar bedrooms and size. Returns them already shaped like a CMA comparable (src/lib/cma.js newComp) so the editor can add them.
// If the address isn't in the MLS (a home that was never listed), the search falls back to the same city with no radius. Pending homes are not
// searched (Repliers documents no pending status). Needs the office's IDX account (a live feed); otherwise { enabled: false }.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { idxConfigForOrgId } from "./_lib/idxConfig.js";
import { repliersImageUrl, searchRepliersListings } from "./_lib/repliers.js";

const KM_PER_MILE = 1.609344;
const MAX_SOLD = 20;
const MAX_ACTIVE = 8;

const num = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
// Repliers sometimes returns a size or year as a range ("1100-1500"); take the first number.
const first = (v) => {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/\d[\d,.]*/);
  return m ? num(m[0]) : null;
};
const day = (v) => (v ? String(v).slice(0, 10) : "");
const toRad = (d) => (d * Math.PI) / 180;
/** Straight-line miles between two coordinates. */
export function milesBetween(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
const pointOf = (raw) => {
  const lat = num(raw?.map?.latitude ?? raw?.map?.lat);
  const lng = num(raw?.map?.longitude ?? raw?.map?.long);
  return lat != null && lng != null ? { lat, lng } : null;
};

/** One MLS listing as a CMA comparable. `center` is the subject's point (for the distance), `status` is "sold" or "active". */
export function shapeComp(raw, center, status) {
  const a = raw.address || {};
  const street = [a.streetNumber, a.streetName, a.streetSuffix].filter(Boolean).join(" ");
  const sold = status === "sold";
  const listDate = day(raw.listDate || raw.details?.listDate);
  const soldDate = day(raw.soldDate || raw.closedDate);
  let dom = num(raw.daysOnMarket ?? raw.details?.daysOnMarket ?? raw.simpleDaysOnMarket);
  if (dom == null && listDate && soldDate) dom = Math.round((new Date(soldDate) - new Date(listDate)) / 86400000);
  const at = pointOf(raw);
  const km = num(raw.distance);
  const miles = milesBetween(center, at) ?? (km != null ? km / KM_PER_MILE : null);
  const lotAcres = num(raw.lot?.acres);
  const lotSqft = num(raw.lot?.squareFeet);
  return {
    mls: String(raw.mlsNumber || ""),
    status,
    address: [street, a.city].filter(Boolean).join(", "),
    price: sold ? num(raw.soldPrice) ?? num(raw.listPrice) : num(raw.listPrice),
    list_price: sold ? num(raw.listPrice) : null,
    date: sold ? soldDate : listDate,
    dom,
    beds: num(raw.details?.numBedrooms),
    baths: num(raw.details?.numBathrooms),
    sqft: first(raw.details?.sqft),
    year_built: first(raw.details?.yearBuilt),
    lot: lotAcres ? `${+lotAcres.toFixed(2)} ac` : lotSqft ? `${Math.round(lotSqft).toLocaleString("en-US")} sqft` : "",
    distance: miles == null ? null : +miles.toFixed(2),
    photo_url: repliersImageUrl(raw.images?.[0]),
    sample: /SAMPLE DATA/i.test(raw.details?.description || "") || /\/sample\//.test(raw.images?.[0] || ""),
  };
}

const byDistance = (a, b) => (a.distance ?? 99) - (b.distance ?? 99);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const subject = body.subject && typeof body.subject === "object" ? body.subject : {};
  const months = Math.min(24, Math.max(1, Number(body.months) || 6));
  const radiusMiles = Math.min(25, Math.max(0.25, Number(body.radiusMiles) || 2));
  const sqftPct = Math.min(60, Math.max(5, Number(body.sqftPct) || 20));

  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const { data: me } = await auth.supabase.from("profiles").select("org_id").eq("id", auth.user.id).maybeSingle();
  const config = me?.org_id ? await idxConfigForOrgId(admin, me.org_id).catch(() => null) : null;
  if (!config) return res.status(200).json({ enabled: false, comps: [] });

  try {
    // 1. Find the subject home in the MLS: its coordinates (and any facts the agent left blank).
    let located = null;
    const address = String(subject.address || "").trim();
    const city = String(subject.city || "").trim();
    if (address) {
      const lookup = { search: address, searchFields: "address.streetName,address.streetNumber", city: city || undefined, resultsPerPage: 1 };
      for (const extra of [{}, { status: "U", lastStatus: "Sld" }]) {
        const found = (await searchRepliersListings(config, { ...lookup, ...extra }))?.listings?.[0];
        if (found && pointOf(found)) {
          located = found;
          break;
        }
      }
    }
    const center = located ? pointOf(located) : null;
    const beds = num(subject.beds) ?? num(located?.details?.numBedrooms);
    const sqft = num(subject.sqft) ?? first(located?.details?.sqft);
    const propertyType = located?.details?.propertyType || "";

    // 2. The same filters for sold and active homes.
    const area = center ? { lat: center.lat, long: center.lng, radius: +(radiusMiles * KM_PER_MILE).toFixed(2) } : { city: city || undefined };
    const like = {
      ...area,
      type: "sale",
      propertyType: propertyType || undefined,
      minBeds: beds != null ? Math.max(0, beds - 1) : undefined,
      maxBeds: beds != null ? beds + 1 : undefined,
      minSqft: sqft ? Math.round(sqft * (1 - sqftPct / 100)) : undefined,
      maxSqft: sqft ? Math.round(sqft * (1 + sqftPct / 100)) : undefined,
    };
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const [soldRes, activeRes] = await Promise.all([
      searchRepliersListings(config, { ...like, status: "U", lastStatus: "Sld", minSoldDate: since.toISOString().slice(0, 10), pageNum: 1, resultsPerPage: 40 }),
      searchRepliersListings(config, { ...like, status: "A", pageNum: 1, resultsPerPage: 20 }),
    ]);
    const self = located ? String(located.mlsNumber) : "";
    const keep = (raw) => raw?.mlsNumber && String(raw.mlsNumber) !== self;
    const sold = (soldRes.listings || []).filter(keep).map((l) => shapeComp(l, center, "sold")).filter((c) => c.price).sort(byDistance).slice(0, MAX_SOLD);
    const active = (activeRes.listings || []).filter(keep).map((l) => shapeComp(l, center, "active")).filter((c) => c.price).sort(byDistance).slice(0, MAX_ACTIVE);
    const comps = [...sold, ...active];
    return res.status(200).json({
      enabled: true,
      located: Boolean(center),
      sample: comps.some((c) => c.sample),
      subject: { beds, sqft, year_built: first(located?.details?.yearBuilt), found: located ? { mls: String(located.mlsNumber) } : null },
      comps,
    });
  } catch (err) {
    console.error("CMA comps error:", err);
    return res.status(502).json({ error: "The MLS feed couldn't run that search. Try a smaller area, or adjust the filters." });
  }
}

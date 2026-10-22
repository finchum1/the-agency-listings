import { resolveIdxConfig } from "../idxConfig.js";
import { getRepliersListing, searchRepliersListings } from "../repliers.js";
import { HttpError, bad, text, url } from "./util.js";
import { requireScope } from "./context.js";
import { createListing } from "./listings.js";

// "Create a listing from a link." Zillow (like most portals) blocks automated page reads with a bot check, and this app
// does not try to get around that. What it can do legitimately: read the street address out of the link itself, then look
// the home up in the office's licensed MLS feed (Repliers) for price, rooms, description and photos. If the home isn't in
// that feed, the response still returns the address parsed from the link plus a list of what is missing, so the bot (or a
// person) can fill the rest in from the listing and send it back to POST /v1/listings.

const SUFFIXES = new Set("alley aly avenue ave boulevard blvd bend bnd circle cir court ct cove cv crossing xing drive dr expressway expy freeway fwy hill hl highway hwy lane ln loop park parkway pkwy place pl plaza plz point pt road rd route rte row square sq street st terrace ter trail trl trace trce way walk".split(" "));
const DIRECTIONS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
const titleCase = (s) => s.replace(/\b([a-z])([a-z']*)/gi, (w, a, b) => (DIRECTIONS.has(w.toLowerCase()) ? w.toUpperCase() : a.toUpperCase() + b.toLowerCase()));

function splitSlug(tokens) {
  // tokens like ["1645","Saratoga","Way","Edmond","OK","73003"]
  const zip = /^\d{5}$/.test(tokens[tokens.length - 1]) ? tokens.pop() : "";
  const state = /^[A-Za-z]{2}$/.test(tokens[tokens.length - 1] || "") ? tokens.pop().toUpperCase() : "";
  let idx = -1;
  for (let i = 1; i < tokens.length; i++) {
    if (SUFFIXES.has(tokens[i].toLowerCase())) {
      idx = i;
      break;
    }
  }
  if (idx === -1) idx = Math.max(1, tokens.length - 2); // no street suffix found: assume the last word is the city
  let end = idx;
  // A unit after the street ("Apt 4", "Unit B", "Ste 200") belongs to the address, not the city.
  if (/^(apt|unit|ste|suite|#.*)$/i.test(tokens[end + 1] || "") && tokens[end + 2]) end += 2;
  if (DIRECTIONS.has((tokens[end + 1] || "").toLowerCase()) && tokens.length - (end + 1) > 1) end += 1; // "Main St NW"
  const street = tokens.slice(0, end + 1).join(" ");
  const city = tokens.slice(end + 1).join(" ");
  return { address_line1: titleCase(street), city: titleCase(city), state, zip };
}

/** Reads the street address out of a Zillow, Redfin or Realtor.com link. Never fetches the page. */
export function parseListingLink(link) {
  let u;
  try {
    u = new URL(link);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host.endsWith("zillow.com")) {
    const i = parts.findIndex((p) => p === "homedetails" || p === "homes");
    const slug = i >= 0 ? parts[i + 1] : null;
    if (!slug || /^\d+_zpid$/.test(slug)) return null;
    const tokens = slug.replace(/_rb$/, "").split("-").filter(Boolean);
    if (!/^\d/.test(tokens[0] || "")) return null; // not a single home's address (a search page, for example)
    const parsed = splitSlug(tokens);
    return parsed.state ? { site: "zillow", ...parsed } : null;
  }
  if (host.endsWith("redfin.com")) {
    // /OK/Edmond/1645-Saratoga-Way-73003/home/12345
    const state = parts[0];
    const city = parts[1];
    const street = parts[2];
    if (!state || !city || !street) return null;
    const tokens = street.split("-");
    const zip = /^\d{5}$/.test(tokens[tokens.length - 1]) ? tokens.pop() : "";
    return { site: "redfin", address_line1: titleCase(tokens.join(" ")), city: titleCase(city.replace(/-/g, " ")), state: state.toUpperCase(), zip };
  }
  if (host.endsWith("realtor.com")) {
    // /realestateandhomes-detail/1645-Saratoga-Way_Edmond_OK_73003_M12345-67890
    const slug = parts[parts.length - 1] || "";
    const [street, city, state, zip] = slug.split("_");
    if (!street || !city || !state) return null;
    return { site: "realtor", address_line1: titleCase(street.replace(/-/g, " ")), city: titleCase(city.replace(/-/g, " ")), state: state.toUpperCase(), zip: /^\d{5}$/.test(zip || "") ? zip : "" };
  }
  return null;
}

export function mapMls(raw) {
  if (!raw) return null;
  const d = raw.details || {};
  const street = [raw.address?.streetNumber, raw.address?.streetName, raw.address?.streetSuffix, raw.address?.streetDirectionSuffix].filter(Boolean).join(" ");
  const full = Number(d.numBathrooms);
  const half = Number(d.numBathroomsPlus);
  const baths = Number.isFinite(full) ? (Number.isFinite(half) && half > 0 ? Number(`${full}.${half}`) : full) : null;
  const acres = raw.lot?.acres ? Number(raw.lot.acres) : null;
  const garageSpaces = Number(d.numGarageSpaces);
  const status = raw.status === "A" ? "for_sale" : raw.status === "U" ? "pending" : "draft";
  const fields = {
    mls_number: raw.mlsNumber ? String(raw.mlsNumber) : undefined,
    address_line1: street || undefined,
    city: raw.address?.city || undefined,
    state: raw.address?.state || undefined,
    zip: raw.address?.zip || undefined,
    price: raw.listPrice ? Number(raw.listPrice) : undefined,
    beds: Number.isFinite(Number(d.numBedrooms)) && d.numBedrooms !== "" ? Number(d.numBedrooms) : undefined,
    baths: baths ?? undefined,
    sqft: d.sqft ? Number(String(d.sqft).replace(/[^\d.]/g, "")) || undefined : undefined,
    lot_size: acres ? `${acres} acres` : undefined,
    year_built: d.yearBuilt ? String(d.yearBuilt) : undefined,
    garage: Number.isFinite(garageSpaces) && garageSpaces > 0 ? `${garageSpaces}-car` : undefined,
    property_type: d.propertyType || raw.class || undefined,
    description: d.description ? String(d.description).trim() : undefined,
    status,
  };
  for (const k of Object.keys(fields)) if (fields[k] === undefined) delete fields[k];
  return { fields, office: raw.office?.brokerageName || "", photos: (raw.images || []).map((p) => `https://cdn.repliers.io/${p}?class=large`) };
}

async function findInMls(config, { mls_number, parsed }) {
  if (mls_number) {
    try {
      return await getRepliersListing(config, mls_number);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }
  if (!parsed?.address_line1) return null;
  const [number, ...rest] = parsed.address_line1.split(" ");
  const nameTokens = rest.filter((t, i) => !(i === rest.length - 1 && SUFFIXES.has(t.toLowerCase())));
  for (const status of ["A", "U"]) { // active first, then everything else (under contract, sold)
    const data = await searchRepliersListings(config, { streetNumber: number, streetName: nameTokens.join(" "), zip: parsed.zip || undefined, city: parsed.zip ? undefined : parsed.city || undefined, status, resultsPerPage: 5 });
    const hit = (data.listings || []).find((l) => String(l.address?.streetNumber) === number) || null;
    if (hit) return hit;
  }
  return null;
}

export async function importListing(ctx, body, req) {
  requireScope(ctx, "listings");
  const link = url(body, "source_url");
  const mls_number = text(body, "mls_number", { max: 40 });
  if (!link && !mls_number && !body.address_line1) throw bad("Send source_url (a Zillow, Redfin or Realtor.com link), or mls_number, or the address fields.");
  const parsed = link ? parseListingLink(link) : body.address_line1 ? { address_line1: text(body, "address_line1", { max: 160 }), city: text(body, "city", { max: 80 }) || "", state: text(body, "state", { max: 30 }) || "", zip: text(body, "zip", { max: 12 }) || "" } : null;
  if (link && !parsed) throw bad("Couldn't read an address from that link. Zillow, Redfin and Realtor.com property links work; or send mls_number or the address fields.");

  // The office's MLS feed, when this organization has one.
  let mls = null;
  let mlsNote = "";
  const { data: org } = await ctx.admin.from("organizations").select("slug").eq("id", ctx.orgId).maybeSingle();
  const config = await resolveIdxConfig({ headers: { host: req.headers.host }, query: { org: org?.slug } }).catch(() => null);
  if (!config) mlsNote = "This organization has no MLS (IDX) feed connected, so only the address from the link is available.";
  else {
    try {
      mls = mapMls(await findInMls(config, { mls_number, parsed }));
      if (!mls) mlsNote = "That home wasn't found in the office's MLS feed.";
    } catch (err) {
      mlsNote = `The MLS lookup failed (${err.message}).`;
    }
  }

  const own = mls ? !config.officeName || mls.office.toLowerCase().includes(config.officeName.toLowerCase()) || config.officeName.toLowerCase().includes(mls.office.toLowerCase()) : null;
  const draft = { ...(parsed ? { address_line1: parsed.address_line1, city: parsed.city, state: parsed.state, zip: parsed.zip } : {}), ...(mls?.fields || {}) };
  const photos = mls?.photos || [];
  const missing = ["price", "beds", "baths", "sqft", "description"].filter((k) => draft[k] === undefined || draft[k] === "");
  if (!photos.length) missing.push("photos");
  for (const k of ["address_line1", "city", "state", "zip"]) if (!draft[k]) missing.push(k);

  const result = {
    matched: Boolean(mls),
    source: mls ? "mls" : parsed ? "link_address_only" : "none",
    ...(mls ? { own_listing: own, listing_office: mls.office } : {}),
    parsed_address: parsed || null,
    draft,
    photos: photos.slice(0, 60),
    missing,
    notes: [
      link && /zillow\.com/i.test(link) ? "Zillow blocks automated page reads, so nothing was read from the Zillow page itself. The address came from the link; everything else comes from the MLS feed when the home is in it." : null,
      mlsNote || null,
      missing.length ? "Fill the missing fields from the listing and send everything to POST /v1/listings (or call this again with create:true plus those fields)." : null,
    ].filter(Boolean),
  };

  if (body.create !== true) return result;

  // Creating: everything in the request body overrides what was found, and the home must be the office's own.
  const agent_id = text(body, "agent_id", { required: true, max: 40 });
  if (mls && own === false && body.confirm_own_listing !== true) {
    throw new HttpError(409, `That home is listed by "${mls.office}", not your office. Send confirm_own_listing: true only if it is your listing.`, { listing_office: mls.office });
  }
  const overrides = { ...body };
  for (const k of ["create", "source_url", "confirm_own_listing", "agent_id"]) delete overrides[k];
  const limit = Math.min(Number(body.photo_limit) || 25, 25);
  // Always a draft unless the request says otherwise: nothing goes public by accident.
  const payload = { ...draft, ...overrides, agent_id, status: body.status ?? "draft" };
  if (payload.photos === undefined && photos.length) payload.photos = photos.slice(0, limit);
  const created = await createListing(ctx, payload, req);
  return { ...result, created: true, ...created, photos_found: photos.length, photos_copied_first: Math.min(photos.length, limit) };
}

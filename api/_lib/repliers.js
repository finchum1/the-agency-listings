// Shared server-only Repliers API client — used by api/repliers-search.js
// and api/repliers-listing.js. Never imported by client code; the API key
// must never reach the browser (see ADR-7/ADR-9 in the IDX roadmap: one
// Repliers vendor relationship per board, billed per board not per site).
//
// Setup (Vercel dashboard > Project > Settings > Environment Variables):
//   REPLIERS_API_KEY  — from repliers.com (required)
//   REPLIERS_BOARD_ID — optional; only needed once the account has more
//     than one MLS board licensed. Omit for a single-board (e.g. sandbox
//     or MLSOK-only) account — Repliers defaults to whatever the account
//     has access to.

const BASE_URL = "https://api.repliers.io";
const IMAGE_CDN = "https://cdn.repliers.io";

function apiKey() {
  const key = process.env.REPLIERS_API_KEY;
  if (!key) throw new Error("REPLIERS_API_KEY is not configured.");
  return key;
}

async function repliersFetch(path, searchParams) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, value);
  }
  if (process.env.REPLIERS_BOARD_ID) {
    url.searchParams.set("boardId", process.env.REPLIERS_BOARD_ID);
  }

  const res = await fetch(url, {
    headers: { "REPLIERS-API-KEY": apiKey() },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Repliers API error ${res.status}: ${detail}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

export function searchRepliersListings(params) {
  return repliersFetch("/listings", params);
}

export function getRepliersListing(mlsNumber) {
  return repliersFetch(`/listings/${encodeURIComponent(mlsNumber)}`);
}

// Repliers' `images` field is an array of CDN-relative paths (e.g.
// "sandbox/IMG-SANDBOX_1.jpg"), not full URLs. `class` controls width:
// small (400px) / medium (800px) / large (1600px).
export function repliersImageUrl(path, size = "medium") {
  if (!path) return "";
  return `${IMAGE_CDN}/${path}?class=${size}`;
}

// Normalizes one Repliers listing object into the shape this app's UI
// already knows how to render (same fields as a `listings` row —
// address_line1/city/state/zip/beds/baths/sqft/price/status/hero_photo_url
// — see src/components/agent-site/FeaturedListings.jsx). Keeping one
// normalized shape means the UI never touches Repliers' raw field names,
// so a future second IDX vendor (Stage 0b's fallback) only needs its own
// normalizer, not new components.
export function normalizeRepliersListing(raw) {
  if (!raw) return null;
  const addressParts = [raw.address?.streetNumber, raw.address?.streetName, raw.address?.streetSuffix]
    .filter(Boolean)
    .join(" ");

  return {
    id: raw.mlsNumber,
    mlsNumber: raw.mlsNumber,
    address_line1: addressParts || raw.address?.streetName || "",
    city: raw.address?.city || "",
    state: raw.address?.state || "",
    zip: raw.address?.zip || "",
    beds: numeric(raw.details?.numBedrooms),
    baths: numeric(raw.details?.numBathrooms),
    sqft: numeric(raw.details?.sqft),
    price: numeric(raw.listPrice),
    status: raw.status === "A" ? "for_sale" : raw.status === "U" ? "off_market" : (raw.status || "").toLowerCase(),
    description: raw.details?.description || "",
    propertyType: raw.details?.propertyType || raw.class || "",
    hero_photo_url: repliersImageUrl(raw.images?.[0]),
    photos: (raw.images || []).map((path) => repliersImageUrl(path, "large")),
    photoCount: raw.photoCount ?? raw.images?.length ?? 0,
    lat: raw.map?.latitude ? Number(raw.map.latitude) : null,
    lng: raw.map?.longitude ? Number(raw.map.longitude) : null,
    // For the "Courtesy of ___" attribution IDX display rules typically
    // require (see the reference screenshot this was built against).
    officeName: raw.office?.brokerageName || "",
  };
}

function numeric(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

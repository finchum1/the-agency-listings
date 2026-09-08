// Vercel serverless function — Brokerage Site IDX. Combines what would
// otherwise be two functions (search + single listing) into one,
// dispatched by whether `mlsNumber` is present — kept to one file
// specifically to stay under Vercel's Hobby-plan 12-Serverless-Functions
// cap (see api/admin/agents.js's header for the matching consolidation
// done on the admin side for the same reason).
//
// GET /api/repliers                 -> search (see useRepliersListings.js)
//   query: city, minPrice, maxPrice, minBeds, minBaths, status, pageNum, resultsPerPage,
//          sortBy (see SORT_OPTIONS below — anything else is ignored),
//          office ("true" scopes to The Agency's own inventory only, via
//          Repliers' `brokerage` filter — see REPLIERS_BROKERAGE_NAME
//          below, and defaults to sortBy=listPriceDesc unless overridden;
//          "false" or omitted searches the whole board, defaulting to
//          Repliers' own newest-first order), map (a drawn-boundary
//          polygon filter — see isValidMapPolygon below and IdxMap.jsx's
//          Draw control, which produces this shape)
// GET /api/repliers?mlsNumber=...    -> single listing (see useRepliersListing.js)
import { searchRepliersListings, getRepliersListing, normalizeRepliersListing } from "./_lib/repliers.js";

// Allowlist, not a passthrough -- a client-supplied sortBy is user
// input, so only ever forward one of Repliers' own documented values.
// See IdxListings.jsx's sort dropdown for the matching labels.
const SORT_OPTIONS = new Set(["createdOnDesc", "listPriceDesc", "listPriceAsc", "sqftDesc"]);

// The exact name to filter by is whatever MLSOK (and each future board)
// has on file for this brokerage's office record, which can differ from
// the site's own display name (see src/lib/brokerage.js's "The Agency").
// Defaulted here as a reasonable guess -- override via the
// REPLIERS_BROKERAGE_NAME Vercel env var once confirmed against real
// (non-sandbox) MLS data, without needing a code change.
const OFFICE_BROKERAGE_NAME = process.env.REPLIERS_BROKERAGE_NAME || "The Agency";

// `map` is user-drawn geometry from the browser (IdxMap.jsx's Draw
// control), so it's validated rather than forwarded blindly: must be an
// array of polygons, each an array of [lng, lat] rings, each ring an
// array of [lng, lat] number pairs (valid coordinate ranges), capped at
// a size no hand-drawn shape would ever legitimately exceed.
const MAX_POLYGON_POINTS = 500;
function isValidMapPolygon(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  let pointCount = 0;
  const isPoint = (p) =>
    Array.isArray(p) &&
    p.length === 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    p[0] >= -180 &&
    p[0] <= 180 &&
    p[1] >= -90 &&
    p[1] <= 90;
  for (const polygon of value) {
    if (!Array.isArray(polygon)) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring)) return false;
      for (const point of ring) {
        if (!isPoint(point)) return false;
        if (++pointCount > MAX_POLYGON_POINTS) return false;
      }
    }
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mlsNumber, city, minPrice, maxPrice, minBeds, minBaths, status, pageNum, resultsPerPage, office, sortBy, map } =
    req.query;

  let mapPolygon;
  if (map) {
    try {
      const parsed = JSON.parse(map);
      if (isValidMapPolygon(parsed)) mapPolygon = parsed;
    } catch {
      // malformed -- ignored below, same as any other invalid filter value
    }
  }

  if (mlsNumber) {
    try {
      const raw = await getRepliersListing(mlsNumber);
      const listing = normalizeRepliersListing(raw);
      res.setHeader("Cache-Control", "private, max-age=60");
      return res.status(200).json({ listing });
    } catch (err) {
      console.error("Repliers listing error:", err);
      if (err.status === 404) {
        return res.status(404).json({ error: "Listing not found." });
      }
      return res.status(err.status && err.status < 500 ? err.status : 502).json({
        error: "Failed to load listing.",
      });
    }
  }

  try {
    const data = await searchRepliersListings({
      city,
      minPrice,
      maxPrice,
      minBedrooms: minBeds,
      minBaths,
      status: status || "A",
      pageNum: pageNum || 1,
      resultsPerPage: resultsPerPage || 24,
      // Only ever set server-side, from a fixed config value -- never
      // pass through a client-supplied brokerage name, so this scoping
      // can't be tampered with from the browser.
      brokerage: office === "true" ? OFFICE_BROKERAGE_NAME : undefined,
      // The Agency's own listings default to most-expensive-first; the
      // open Home Search page defaults to Repliers' own (newest-first)
      // order. Either can be overridden by the sort dropdown.
      sortBy: SORT_OPTIONS.has(sortBy) ? sortBy : office === "true" ? "listPriceDesc" : undefined,
      map: mapPolygon ? JSON.stringify(mapPolygon) : undefined,
    });

    const listings = (data.listings || []).map(normalizeRepliersListing);

    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).json({
      listings,
      count: data.count ?? listings.length,
      page: data.page ?? (Number(pageNum) || 1),
      numPages: data.numPages ?? 1,
    });
  } catch (err) {
    console.error("Repliers search error:", err);
    return res.status(err.status && err.status < 500 ? err.status : 502).json({
      error: "Failed to search listings.",
    });
  }
}

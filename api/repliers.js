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
//          org (platform hosts only: the organization's slug; a registered
//          custom domain always means its own organization — see
//          _lib/idxConfig.js, which also holds each organization's key),
//          office ("true" scopes to the organization's own inventory only, via
//          Repliers' `brokerage` filter — the office name in its IDX settings
//          (REPLIERS_BROKERAGE_NAME for The Agency), and defaults to sortBy=listPriceDesc unless overridden;
//          "false" or omitted searches the whole board, defaulting to
//          Repliers' own newest-first order), map (a drawn-boundary
//          polygon filter — see isValidMapPolygon below and IdxMap.jsx's
//          Draw control, which produces this shape)
// GET /api/repliers?mlsNumber=...    -> single listing (see useRepliersListing.js)
import { searchRepliersListings, getRepliersListing, normalizeRepliersListing } from "./_lib/repliers.js";
import { resolveIdxConfig } from "./_lib/idxConfig.js";

// Allowlist, not a passthrough -- a client-supplied sortBy is user
// input, so only ever forward one of Repliers' own documented values.
// See IdxListings.jsx's sort dropdown for the matching labels.
const SORT_OPTIONS = new Set(["createdOnDesc", "listPriceDesc", "listPriceAsc", "sqftDesc"]);

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

  // Whose Repliers account? An organization without IDX gets a plain 404 / empty result, never another's data.
  const config = await resolveIdxConfig(req).catch((err) => {
    console.error("IDX config error:", err);
    return null;
  });
  if (!config) {
    if (mlsNumber) return res.status(404).json({ error: "Listing not found." });
    return res.status(200).json({ listings: [], count: 0, page: 1, numPages: 1 });
  }

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
      const raw = await getRepliersListing(config, mlsNumber);
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

  // "Our own listings only" with no office name on file would silently widen to the whole board: show nothing instead.
  if (office === "true" && !config.officeName) {
    return res.status(200).json({ listings: [], count: 0, page: 1, numPages: 1 });
  }

  try {
    const data = await searchRepliersListings(config, {
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
      brokerage: office === "true" ? config.officeName : undefined,
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

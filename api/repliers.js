// Vercel serverless function — Brokerage Site IDX. Combines what would
// otherwise be two functions (search + single listing) into one,
// dispatched by whether `mlsNumber` is present — kept to one file
// specifically to stay under Vercel's Hobby-plan 12-Serverless-Functions
// cap (see api/admin/agents.js's header for the matching consolidation
// done on the admin side for the same reason).
//
// GET /api/repliers                 -> search (see useRepliersListings.js)
//   query: city, minPrice, maxPrice, minBeds, minBaths, status, pageNum, resultsPerPage
// GET /api/repliers?mlsNumber=...    -> single listing (see useRepliersListing.js)
import { searchRepliersListings, getRepliersListing, normalizeRepliersListing } from "./_lib/repliers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mlsNumber, city, minPrice, maxPrice, minBeds, minBaths, status, pageNum, resultsPerPage } = req.query;

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

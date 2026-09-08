// Vercel serverless function — Brokerage Site IDX search. Client-side
// fetches this (see src/hooks/useRepliersListings.js) instead of calling
// Repliers directly, so REPLIERS_API_KEY never reaches the browser.
//
// Query params (all optional): city, minPrice, maxPrice, minBeds,
// minBaths, status ("A" active by default), pageNum, resultsPerPage.
import { searchRepliersListings, normalizeRepliersListing } from "./_lib/repliers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { city, minPrice, maxPrice, minBeds, minBaths, status, pageNum, resultsPerPage } = req.query;

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

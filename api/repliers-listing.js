// Vercel serverless function — a single IDX listing by MLS number, for
// the Brokerage Site's listing-detail page. See api/repliers-search.js
// for the search list equivalent.
import { getRepliersListing, normalizeRepliersListing } from "./_lib/repliers.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { mlsNumber } = req.query;
  if (!mlsNumber) {
    return res.status(400).json({ error: "mlsNumber is required." });
  }

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

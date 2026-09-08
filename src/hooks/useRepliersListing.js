import { useEffect, useState } from "react";

// Client-side fetch against api/repliers.js (mlsNumber param selects the
// single-listing branch) for one listing by MLS number. Parallel to
// useRepliersListings.js.
export function useRepliersListing(mlsNumber) {
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!mlsNumber) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError("");

    fetch(`/api/repliers?mlsNumber=${encodeURIComponent(mlsNumber)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return null;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load listing.");
        return body.listing;
      })
      .then((data) => {
        if (!cancelled && data) setListing(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("useRepliersListing:", err);
        setError(err.message || "Failed to load listing.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mlsNumber]);

  return { listing, loading, notFound, error };
}

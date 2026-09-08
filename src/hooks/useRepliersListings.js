import { useEffect, useState } from "react";

// Client-side fetch against api/repliers-search.js (the server-only
// Repliers proxy — see api/_lib/repliers.js). `filters` is a plain object
// of query params (city, minPrice, maxPrice, minBeds, minBaths, pageNum);
// re-fetches whenever its serialized value changes.
export function useRepliersListings(filters) {
  const [listings, setListings] = useState([]);
  const [meta, setMeta] = useState({ count: 0, page: 1, numPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const key = JSON.stringify(filters || {});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters || {})) {
      if (v !== undefined && v !== null && v !== "") params.set(k, v);
    }

    fetch(`/api/repliers-search?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load listings.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setListings(body.listings || []);
        setMeta({ count: body.count, page: body.page, numPages: body.numPages });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("useRepliersListings:", err);
        setError(err.message || "Failed to load listings.");
        setListings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { listings, meta, loading, error };
}

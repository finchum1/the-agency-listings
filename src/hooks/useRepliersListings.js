import { useEffect, useState } from "react";

// Client-side fetch against api/repliers.js (the server-only Repliers
// proxy — see api/_lib/repliers.js). `filters` is a plain object
// of query params (city, minPrice, maxPrice, minBeds, minBaths, pageNum);
// re-fetches whenever its serialized value changes. Pass `null` to skip
// the fetch entirely (e.g. IdxListings.jsx's preview mode when pinned
// listings already cover it) rather than firing a request whose result
// never gets used.
export function useRepliersListings(filters) {
  const [listings, setListings] = useState([]);
  const [meta, setMeta] = useState({ count: 0, page: 1, numPages: 1 });
  const [loading, setLoading] = useState(filters !== null);
  const [error, setError] = useState("");

  const key = filters === null ? "skip" : JSON.stringify(filters);

  useEffect(() => {
    if (filters === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters || {})) {
      if (v !== undefined && v !== null && v !== "") params.set(k, v);
    }

    fetch(`/api/repliers?${params.toString()}`)
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

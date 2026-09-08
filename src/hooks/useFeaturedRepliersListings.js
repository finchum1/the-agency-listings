import { useEffect, useState } from "react";

// Fetches a specific, ordered set of IDX listings by MLS number (see
// BrokerageFeaturedListingsPicker.jsx for how the admin picks them) —
// used instead of useRepliersListings.js when the Brokerage Site has
// pinned listings. A listing that's since sold/delisted is silently
// dropped rather than breaking the page; the data itself always comes
// live from Repliers, this hook just resolves the pinned MLS numbers.
export function useFeaturedRepliersListings(mlsNumbers) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(mlsNumbers.length > 0);

  const key = JSON.stringify(mlsNumbers);

  useEffect(() => {
    if (mlsNumbers.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all(
      mlsNumbers.map((mlsNumber) =>
        fetch(`/api/repliers?mlsNumber=${encodeURIComponent(mlsNumber)}`)
          .then(async (res) => (res.ok ? (await res.json()).listing : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setListings(results.filter(Boolean));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { listings, loading };
}

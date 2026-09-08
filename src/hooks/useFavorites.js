import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "idx-favorite-listings";

// Per-browser favorited MLS numbers for the Home Search / Our Listings
// heart icon — no visitor accounts on the public site, so this is purely
// a local convenience (survives a revisit on the same device/browser,
// nothing more). Safe against private-browsing/storage-blocked contexts:
// every read/write is wrapped, and a failure just means favorites don't
// persist rather than breaking the page.
export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // ignore — e.g. private browsing with storage disabled
    }
  }, [favorites]);

  const toggleFavorite = useCallback((mlsNumber) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(mlsNumber)) next.delete(mlsNumber);
      else next.add(mlsNumber);
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}

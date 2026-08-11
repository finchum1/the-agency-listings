import { createContext, useContext } from "react";

const ListingContext = createContext(null);

// value: { listing, openHouses } — `listing` matches the exact shape the
// old property-site-template/src/data/listing.js static file used to
// export, so the ported site components below need almost no changes.
export function ListingProvider({ value, children }) {
  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}

export function useListingContext() {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error("useListingContext must be used within a ListingProvider");
  return ctx;
}

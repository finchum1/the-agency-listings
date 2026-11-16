/** True for a listing from the Repliers test account: its descriptions start "**** SAMPLE DATA ****" and its photos live under /sample/. */
export function isSampleListing(listing) {
  return /SAMPLE DATA/i.test(listing?.description || "") || /\/sample\//.test(listing?.hero_photo_url || "");
}

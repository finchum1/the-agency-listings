// The "← Back to website" link on a listing's own page. Portfolio links
// (agent-site/FeaturedListings.jsx) add ?from=<the page they came from>;
// only a plain same-site path is accepted, never a full address, so the
// link can't be pointed at another website.
export function safeFromPath(raw) {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.length > 200) return null;
  return raw;
}

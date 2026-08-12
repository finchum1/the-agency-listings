// Accepts "https://1645SaratogaWay.com/" or "1645saratogaway.com" alike —
// strip protocol/path/trailing slash, lowercase, so it matches whatever
// App.jsx reads from window.location.hostname at runtime. Shared by
// ListingForm (listings.custom_domain) and SiteForm (agent_sites.custom_domain).
export function normalizeDomain(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

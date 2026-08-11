// Hostnames where the app's normal routing (login, dashboard, /listings/:slug)
// applies. Any OTHER hostname is treated as a listing's own attached custom
// domain — see App.jsx and pages/CustomDomainListingPage.jsx.
//
// Pure function, deliberately separate from window.location so it's testable
// without a browser (e.g. `node -e` against this file).
const KNOWN_APP_HOSTS = [
  "localhost",
  "the-agency-listings.vercel.app",
  // Add a real custom "app" domain here too, if one is ever attached
  // (e.g. "listings.theagencyre.com") — anything NOT in this list is
  // assumed to be a per-listing custom domain.
];

export function isAppHost(hostname) {
  if (!hostname) return true;
  const bare = hostname.replace(/^www\./i, "").toLowerCase();
  if (KNOWN_APP_HOSTS.includes(bare)) return true;
  // Vercel preview deployments (the-agency-listings-<hash>-<team>.vercel.app)
  if (bare.endsWith(".vercel.app")) return true;
  return false;
}

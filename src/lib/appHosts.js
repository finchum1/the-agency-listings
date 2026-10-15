// Hostnames where the app's normal routing (login, dashboard, /listings/:slug,
// /sites/:slug) applies. Any OTHER hostname is treated as a listing's or an
// agent site's own attached custom domain — see App.jsx and
// pages/CustomDomainSitePage.jsx.
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

// Extra platform app hosts, from the VITE_APP_HOSTS environment variable (comma-separated), so a new app address
// (for example app.latchpointstudios.com) is a Vercel setting plus attaching the domain, not a code change. The same
// variable is read in the browser bundle, the edge middleware and the API functions. A brokerage's OWN dashboard domain
// is not listed here: those live in the org_domains table (kind "app"), see hooks/useHostOrg.js.
function configuredAppHosts() {
  const fromVite = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_APP_HOSTS : "";
  const fromServer = typeof process !== "undefined" && process.env ? process.env.VITE_APP_HOSTS : "";
  return String(fromVite || fromServer || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

// Strips a leading "www." and lowercases, so "www.TerrenceFinchum.com" and
// "terrencefinchum.com" are treated as the same host. custom_domain values
// are saved bare (see lib/normalizeDomain.js, which never adds "www."), but
// a visitor can land on either — Vercel commonly serves an apex domain at
// both, redirecting one to the other — so anything matching a saved
// custom_domain against the browser's actual hostname needs this, not just
// the app-host check below.
export function bareHost(hostname) {
  return (hostname || "").replace(/^www\./i, "").toLowerCase();
}

// Hosts that exist only for the dashboard (the VITE_APP_HOSTS ones, such as app.latchpointstudios.com): their root address
// is the sign-in, never the product marketing page that the older shared address still shows.
export function isDashboardOnlyHost(hostname) {
  return !!hostname && configuredAppHosts().includes(bareHost(hostname));
}

export function isAppHost(hostname) {
  if (!hostname) return true;
  const bare = bareHost(hostname);
  if (KNOWN_APP_HOSTS.includes(bare) || configuredAppHosts().includes(bare)) return true;
  // Vercel preview deployments (the-agency-listings-<hash>-<team>.vercel.app)
  if (bare.endsWith(".vercel.app")) return true;
  return false;
}

// The email signature generator's host (a single static page in
// public/signature-generator/). middleware.js answers every page request on
// it with that page, and api/sitemap.js lists it. Its images are linked from
// every signature agents have pasted, so don't rename this host.
export const SIGNATURE_HOST = "emailsignature.latchpointstudios.com";

// Marketing-only hosts: serve just the standalone product-marketing pages
// (LandingPage + its /agent-websites, /property-websites,
// /brokerage-website, /upcoming deep-dives) — no login/dashboard access,
// no per-site custom-domain resolution. Checked before isAppHost in
// App.jsx, since these hostnames aren't in KNOWN_APP_HOSTS and would
// otherwise fall through to CustomDomainSitePage.
//
// theagency.latchpointstudios.com is a marketing subdomain for Latchpoint
// Studios (Terrence's own dev business) pitching this dashboard as a
// product. Sign-in stays on the main app host for now (see App.jsx and
// components/marketing/*) — the plan is for it to eventually move under
// The Agency's own brokerage domain instead, once that's set up.
const MARKETING_HOSTS = ["theagency.latchpointstudios.com"];

export function isMarketingHost(hostname) {
  return MARKETING_HOSTS.includes(bareHost(hostname));
}

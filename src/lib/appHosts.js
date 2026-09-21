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

export function isAppHost(hostname) {
  if (!hostname) return true;
  const bare = bareHost(hostname);
  if (KNOWN_APP_HOSTS.includes(bare)) return true;
  // Vercel preview deployments (the-agency-listings-<hash>-<team>.vercel.app)
  if (bare.endsWith(".vercel.app")) return true;
  return false;
}

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

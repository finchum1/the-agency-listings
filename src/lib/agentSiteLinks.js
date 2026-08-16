import { isAppHost } from "./appHosts";

// True on the canonical app host (including localhost/previews) — real
// SPA routes live under /sites/:slug/... there. False on any other host,
// which per App.jsx's routing is always a listing's or an agent site's
// own attached custom domain, serving that one site rooted at "/" — see
// CustomDomainSitePage.jsx, which mirrors the same /sites/:slug/*
// sub-pages one level up (no :slug prefix, since the domain itself
// already identifies the site).
export function isAgentSiteAppHost() {
  return isAppHost(window.location.hostname);
}

// Where a given agent-site sub-path should point, from wherever the
// current page happens to be rendering:
// - On the canonical app host: a real SPA route under /sites/:slug/...
// - On the site's own custom domain: the same page, rooted at "/"
//   instead (see CustomDomainSitePage.jsx's routes).
// Either way this is a same-origin path — a site's own chrome (Navbar,
// Footer, Hero, BlogTeaser) only ever links to ITS OWN other pages, never
// another site's, so there's never a need to jump hosts — which is what
// lets SiteLink use plain client-side navigation everywhere.
export function agentSiteHref(slug, path = "") {
  return isAgentSiteAppHost() ? `/sites/${slug}${path}` : path || "/";
}

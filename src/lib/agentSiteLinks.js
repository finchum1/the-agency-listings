import { isAppHost } from "./appHosts";
import { SITE_ORIGIN } from "./seo";

// Where a given agent-site sub-path should point.
//
// On the canonical app host, subpages are real SPA routes under
// /sites/:slug/... . On a site's own custom domain, CustomDomainSitePage
// only ever renders the home page (see its own comment for why) — so
// subpage links there go to the full, working page on the canonical host
// instead of a same-origin path that would just re-render home content.
// No agent site has a custom domain attached yet, so this hasn't come up
// in practice; if one ever does, teaching CustomDomainSitePage to be
// path-aware (mirroring the mapping in App.jsx) is the next step.
export function isAgentSiteAppHost() {
  return isAppHost(window.location.hostname);
}

export function agentSiteHref(slug, path = "") {
  return isAgentSiteAppHost() ? `/sites/${slug}${path}` : `${SITE_ORIGIN}/sites/${slug}${path}`;
}

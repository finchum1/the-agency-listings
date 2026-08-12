import { useListing } from "../hooks/useListing";
import { useAgentSite } from "../hooks/useAgentSite";
import ListingSitePage from "./ListingSitePage";
import AgentSitePage from "./AgentSitePage";
import NotFoundPage from "./NotFoundPage";

// Rendered at "/" whenever the request's hostname isn't a recognized app
// host (see lib/appHosts.js) — i.e. a visitor arrived via a listing's or an
// agent site's own attached custom domain (e.g. 1645SaratogaWay.com or
// TerrenceFinchumRealty.com) rather than /listings/:slug or /sites/:slug.
// Tries a listing first, then an agent site — both looked up by
// custom_domain instead of slug — and renders whichever one owns the
// domain, sharing all normal rendering with the slug-based routes.
export default function CustomDomainSitePage() {
  const hostname = window.location.hostname;
  const listingResult = useListing({ customDomain: hostname });
  const agentSiteResult = useAgentSite({ customDomain: hostname });

  // Wait for the listing lookup, and — only if it comes up empty — the
  // agent-site lookup too, before deciding this domain matches nothing.
  if (listingResult.loading || (listingResult.notFound && agentSiteResult.loading)) {
    return null;
  }
  if (listingResult.listing) return <ListingSitePage {...listingResult} />;
  if (agentSiteResult.site) return <AgentSitePage {...agentSiteResult} />;
  return <NotFoundPage />;
}

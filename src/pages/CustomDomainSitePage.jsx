import { Routes, Route, useParams } from "react-router-dom";
import { bareHost } from "../lib/appHosts";
import { useListing } from "../hooks/useListing";
import { useAgentSite } from "../hooks/useAgentSite";
import { useAgentPost } from "../hooks/useAgentPost";
import { useAgentArea } from "../hooks/useAgentArea";
import { useBrokerageSite } from "../hooks/useBrokerageSite";
import ListingSitePage from "./ListingSitePage";
import AgentSitePage from "./AgentSitePage";
import AgentPostPage from "./AgentPostPage";
import AgentAreaPage from "./AgentAreaPage";
import BrokerageSitePage from "./BrokerageSitePage";
import BrokeragePostPage from "./BrokeragePostPage";
import NotFoundPage from "./NotFoundPage";
import HomeSections from "../components/agent-site/HomeSections";
import Bio from "../components/agent-site/Bio";
import Testimonials from "../components/agent-site/Testimonials";
import FeaturedListings from "../components/agent-site/FeaturedListings";
import ServiceAreas from "../components/agent-site/ServiceAreas";
import BlogTeaser from "../components/agent-site/BlogTeaser";
import Contact from "../components/agent-site/Contact";
import BrokerageHomeSections from "../components/brokerage-site/HomeSections";
import BrokerageAbout from "../components/brokerage-site/About";
import BrokerageAgentRoster from "../components/brokerage-site/AgentRoster";
import BrokerageAreasOfExpertise from "../components/brokerage-site/AreasOfExpertise";
import BrokerageBlogList from "../components/brokerage-site/BlogList";
import BrokerageContactCard from "../components/brokerage-site/ContactCard";
import IdxListings from "../components/brokerage-site/IdxListings";
import IdxListingDetail from "../components/brokerage-site/IdxListingDetail";
import HomeValuation from "../components/brokerage-site/HomeValuation";

// "/" on a custom domain: try a listing first, then an agent site, then
// the brokerage site — all three looked up by custom_domain instead of
// slug — and render whichever one owns the domain. A listing's own
// custom domain has no subpages (a listing site has never been more
// than one page), so only "/" attempts the listing lookup; every other
// path below is agent-site-or-brokerage-site only, same fallback order.
function CustomDomainHomePage() {
  const hostname = bareHost(window.location.hostname);
  const listingResult = useListing({ customDomain: hostname });
  const agentSiteResult = useAgentSite({ customDomain: hostname });

  // Wait for the listing lookup, and — only if it comes up empty — the
  // agent-site lookup too, before falling through to the brokerage site.
  if (listingResult.loading || (listingResult.notFound && agentSiteResult.loading)) {
    return null;
  }
  if (listingResult.listing) return <ListingSitePage {...listingResult} />;
  if (agentSiteResult.site) {
    return (
      <AgentSitePage {...agentSiteResult}>
        <HomeSections />
      </AgentSitePage>
    );
  }
  // Neither a listing nor an agent site claims this domain — try the
  // brokerage site last. BrokerageSitePage does its own fetch/loading/
  // notFound handling (customDomain re-runs the same hostname check),
  // redirecting to /404 itself if that doesn't match either.
  return (
    <BrokerageSitePage customDomain={hostname} path="/">
      <BrokerageHomeSections />
    </BrokerageSitePage>
  );
}

// Shared path shape (/about, /areas, /blog, /listings, /contact): try an
// agent site at this hostname first, and only fall through to the
// brokerage site if none owns it — a domain is only ever attached to one
// or the other (see brokerage_site_custom_domain_idx /
// agent_sites_custom_domain_idx, each a per-table unique index). The
// brokerage-only paths further below (/agents, /search, /home-valuation)
// skip the agent-site lookup entirely since no agent site has ever had
// them.
function SharedCustomDomainPage({ agentPageTitle, agentChildren, brokeragePath, brokeragePageTitle, brokerageChildren }) {
  const hostname = bareHost(window.location.hostname);
  const result = useAgentSite({ customDomain: hostname });

  if (result.loading) return null;
  if (result.site) {
    return (
      <AgentSitePage {...result} pageTitle={agentPageTitle}>
        {agentChildren}
      </AgentSitePage>
    );
  }
  return (
    <BrokerageSitePage customDomain={hostname} path={brokeragePath} pageTitle={brokeragePageTitle}>
      {brokerageChildren}
    </BrokerageSitePage>
  );
}

// /blog/:postSlug's version of the same agent-first-then-brokerage
// fallback, built on useAgentPost/BrokeragePostPage instead of the
// whole-site wrapper above.
function SharedCustomDomainPostPage() {
  const { postSlug } = useParams();
  const hostname = bareHost(window.location.hostname);
  const agentPostResult = useAgentPost({ siteCustomDomain: hostname, postSlug });
  const brokerageSiteResult = useBrokerageSite({ customDomain: hostname });

  if (agentPostResult.loading || (agentPostResult.notFound && brokerageSiteResult.loading)) {
    return null;
  }
  if (agentPostResult.post) return <AgentPostPage {...agentPostResult} />;
  if (brokerageSiteResult.site) return <BrokeragePostPage />;
  return <NotFoundPage />;
}

// /listings/:param's version — an agent-owned listing by slug
// (ListingSitePage, same as PublicListingPage.jsx) vs. any office
// listing by MLS number (IdxListingDetail, which needs the
// BrokerageSiteProvider context BrokerageSitePage supplies). The route
// param can't be named "slug" and "mlsNumber" at once, so it's read
// once here as :param and handed to whichever branch needs it —
// IdxListingDetail takes it as a prop for exactly this reason (see its
// own comment).
function SharedCustomDomainListingDetailPage() {
  const { param } = useParams();
  const hostname = bareHost(window.location.hostname);
  const agentSiteResult = useAgentSite({ customDomain: hostname });
  const listingResult = useListing({ slug: param });

  if (agentSiteResult.loading) return null;
  if (agentSiteResult.site) return <ListingSitePage {...listingResult} />;
  return (
    <BrokerageSitePage customDomain={hostname} path="/listings" pageTitle="Listings">
      <IdxListingDetail mlsNumber={param} />
    </BrokerageSitePage>
  );
}

// /areas/:areaSlug — agent-only (no brokerage fallback like the other
// shared paths): the brokerage site has no per-area detail page today,
// only its own /areas list, so a domain that turns out to be the
// brokerage's just 404s here rather than reaching for content that
// doesn't exist.
function CustomDomainAgentAreaPage() {
  const { areaSlug } = useParams();
  const hostname = bareHost(window.location.hostname);
  const result = useAgentArea({ siteCustomDomain: hostname, areaSlug });
  if (result.notFound) return <NotFoundPage />;
  return <AgentAreaPage {...result} />;
}

// Rendered whenever the request's hostname isn't a recognized app host
// (see lib/appHosts.js) — i.e. a visitor arrived via a listing's, an
// agent site's, or the brokerage site's own attached custom domain
// (e.g. 1645SaratogaWay.com, TerrenceFinchumRealty.com, or the
// brokerage's own domain) rather than /listings/:slug, /sites/:slug, or
// /brokerage.
//
// Mirrors App.jsx's /sites/:slug/* and /brokerage/* route mappings one
// level up, rooted at "/" instead of those prefixes — same pages, same
// components, just resolved by hostname instead of a :slug param or the
// fixed /brokerage prefix (see the wrapper components above).
export default function CustomDomainSitePage() {
  const hostname = bareHost(window.location.hostname);

  return (
    <Routes>
      <Route path="/" element={<CustomDomainHomePage />} />
      <Route
        path="/about"
        element={
          <SharedCustomDomainPage
            agentPageTitle="About"
            agentChildren={
              <>
                <Bio />
                <Testimonials />
              </>
            }
            brokeragePath="/about"
            brokeragePageTitle="About"
            brokerageChildren={<BrokerageAbout isStandalonePage />}
          />
        }
      />
      <Route
        path="/listings"
        element={
          <SharedCustomDomainPage
            agentPageTitle="Listings"
            agentChildren={<FeaturedListings />}
            brokeragePath="/listings"
            brokeragePageTitle="Our Listings"
            brokerageChildren={<IdxListings isStandalonePage officeOnly />}
          />
        }
      />
      <Route path="/listings/:param" element={<SharedCustomDomainListingDetailPage />} />
      <Route
        path="/agents"
        element={
          <BrokerageSitePage customDomain={hostname} path="/agents" pageTitle="Agents">
            <BrokerageAgentRoster isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/areas"
        element={
          <SharedCustomDomainPage
            agentPageTitle="Areas"
            agentChildren={<ServiceAreas />}
            brokeragePath="/areas"
            brokeragePageTitle="Areas of Expertise"
            brokerageChildren={<BrokerageAreasOfExpertise isStandalonePage />}
          />
        }
      />
      <Route path="/areas/:areaSlug" element={<CustomDomainAgentAreaPage />} />
      <Route
        path="/blog"
        element={
          <SharedCustomDomainPage
            agentPageTitle="Blog"
            agentChildren={<BlogTeaser />}
            brokeragePath="/blog"
            brokeragePageTitle="Blog"
            brokerageChildren={<BrokerageBlogList isStandalonePage />}
          />
        }
      />
      <Route path="/blog/:postSlug" element={<SharedCustomDomainPostPage />} />
      <Route
        path="/search"
        element={
          <BrokerageSitePage customDomain={hostname} path="/search" pageTitle="Home Search">
            <IdxListings isStandalonePage officeOnly={false} />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/home-valuation"
        element={
          <BrokerageSitePage customDomain={hostname} path="/home-valuation" pageTitle="Home Valuation">
            <HomeValuation isStandalonePage />
          </BrokerageSitePage>
        }
      />
      <Route
        path="/contact"
        element={
          <SharedCustomDomainPage
            agentPageTitle="Contact"
            agentChildren={<Contact />}
            brokeragePath="/contact"
            brokeragePageTitle="Contact"
            brokerageChildren={<BrokerageContactCard isStandalonePage />}
          />
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

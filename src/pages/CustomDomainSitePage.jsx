import { Routes, Route, useParams } from "react-router-dom";
import { bareHost } from "../lib/appHosts";
import { useListing } from "../hooks/useListing";
import { useAgentSite } from "../hooks/useAgentSite";
import { useAgentPost } from "../hooks/useAgentPost";
import ListingSitePage from "./ListingSitePage";
import AgentSitePage from "./AgentSitePage";
import AgentPostPage from "./AgentPostPage";
import PublicListingPage from "./PublicListingPage";
import NotFoundPage from "./NotFoundPage";
import HomeSections from "../components/agent-site/HomeSections";
import Bio from "../components/agent-site/Bio";
import Testimonials from "../components/agent-site/Testimonials";
import FeaturedListings from "../components/agent-site/FeaturedListings";
import ServiceAreas from "../components/agent-site/ServiceAreas";
import BlogTeaser from "../components/agent-site/BlogTeaser";
import Contact from "../components/agent-site/Contact";

// "/" on a custom domain: try a listing first, then an agent site — both
// looked up by custom_domain instead of slug — and render whichever one
// owns the domain. A listing's own custom domain has no subpages (a
// listing site has never been more than one page), so only "/" attempts
// the listing lookup; every other path below is agent-site-only.
function CustomDomainHomePage() {
  const hostname = bareHost(window.location.hostname);
  const listingResult = useListing({ customDomain: hostname });
  const agentSiteResult = useAgentSite({ customDomain: hostname });

  // Wait for the listing lookup, and — only if it comes up empty — the
  // agent-site lookup too, before deciding this domain matches nothing.
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
  return <NotFoundPage />;
}

// Equivalent of PublicAgentSitePage.jsx, but resolving the site by this
// request's hostname (custom_domain) instead of a :slug route param.
function CustomDomainAgentSitePage({ pageTitle, children }) {
  const hostname = bareHost(window.location.hostname);
  const result = useAgentSite({ customDomain: hostname });
  return (
    <AgentSitePage {...result} pageTitle={pageTitle}>
      {children}
    </AgentSitePage>
  );
}

// Equivalent of PublicAgentPostPage.jsx, but resolving the parent site by
// hostname instead of :slug.
function CustomDomainAgentPostPage() {
  const { postSlug } = useParams();
  const result = useAgentPost({ siteCustomDomain: bareHost(window.location.hostname), postSlug });
  return <AgentPostPage {...result} />;
}

// Rendered whenever the request's hostname isn't a recognized app host
// (see lib/appHosts.js) — i.e. a visitor arrived via a listing's or an
// agent site's own attached custom domain (e.g. 1645SaratogaWay.com or
// TerrenceFinchumRealty.com) rather than /listings/:slug or /sites/:slug.
//
// Mirrors App.jsx's /sites/:slug/* route mapping one level up, rooted at
// "/" instead of "/sites/:slug" — same pages, same components, just
// resolved by hostname instead of a :slug param (see the two wrapper
// components above). /listings/:slug is included too, unchanged, so a
// "Featured Properties" link from an agent's custom domain (which is
// just a same-origin relative href, see FeaturedListings.jsx) lands on a
// real page instead of falling through to the catch-all 404.
export default function CustomDomainSitePage() {
  return (
    <Routes>
      <Route path="/" element={<CustomDomainHomePage />} />
      <Route
        path="/about"
        element={
          <CustomDomainAgentSitePage pageTitle="About">
            <Bio />
            <Testimonials />
          </CustomDomainAgentSitePage>
        }
      />
      <Route
        path="/listings"
        element={
          <CustomDomainAgentSitePage pageTitle="Listings">
            <FeaturedListings />
          </CustomDomainAgentSitePage>
        }
      />
      <Route path="/listings/:slug" element={<PublicListingPage />} />
      <Route
        path="/areas"
        element={
          <CustomDomainAgentSitePage pageTitle="Areas">
            <ServiceAreas />
          </CustomDomainAgentSitePage>
        }
      />
      <Route
        path="/blog"
        element={
          <CustomDomainAgentSitePage pageTitle="Blog">
            <BlogTeaser />
          </CustomDomainAgentSitePage>
        }
      />
      <Route path="/blog/:postSlug" element={<CustomDomainAgentPostPage />} />
      <Route
        path="/contact"
        element={
          <CustomDomainAgentSitePage pageTitle="Contact">
            <Contact />
          </CustomDomainAgentSitePage>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

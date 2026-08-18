import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { buildAgentSitePageMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta, applyStructuredData } from "../lib/pageMeta";
import { buildAgentSchema, buildBreadcrumbSchema } from "../lib/structuredData";
import { trackView } from "../lib/trackView";
import { isAgentSiteAppHost } from "../lib/agentSiteLinks";
import { AgentSiteProvider } from "../context/AgentSiteContext";
import brokerage from "../lib/brokerage";

import Navbar from "../components/agent-site/Navbar";
import Footer from "../components/agent-site/Footer";

// Shared chrome (data loading, theme, Navbar/Footer, meta, view tracking)
// for every page of an agent's public site — home, about, listings,
// areas, blog, contact. Each page passes whichever section(s) it wants to
// render as `children` (see App.jsx's routes) plus an optional
// `pageTitle` used in the browser tab title. Takes the raw shape returned
// by useAgentSite().
export default function AgentSitePage({
  site,
  agent,
  testimonials,
  areas,
  posts,
  listings,
  loading,
  notFound,
  pageTitle,
  children,
}) {
  const adapted = site ? adaptAgentSite({ site, agent, testimonials, areas, posts, listings }) : null;
  const location = useLocation();
  // "about" | "listings" | "areas" | "blog" | "contact" | undefined (Home)
  // — matches buildAgentSitePageMeta's page keys 1:1 since pageTitle is
  // always one of "About"/"Listings"/"Areas"/"Blog"/"Contact" (App.jsx).
  const pageKey = pageTitle?.toLowerCase();

  useEffect(() => {
    if (!site) return;
    const meta = buildAgentSitePageMeta(site, agent, pageKey);
    applyPageMeta({
      ...meta,
      // Self-canonical on the app host too, now — previously this always
      // pointed at the site's home URL regardless of which subpage was
      // actually loaded, which told search engines every About/Listings/
      // Areas/Blog/Contact page was a duplicate of Home and suppressed
      // them from being indexed on their own. On the site's own custom
      // domain this still falls back to the real current URL (undefined
      // here), same as before.
      url: isAgentSiteAppHost() ? `${SITE_ORIGIN}${location.pathname}` : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, agent, pageKey, location.pathname]);

  useEffect(() => {
    if (!site || !adapted) return;
    const url = isAgentSiteAppHost() ? `${SITE_ORIGIN}${location.pathname}` : window.location.href;
    const homeUrl = isAgentSiteAppHost() ? `${SITE_ORIGIN}/sites/${site.slug}` : `${window.location.origin}/`;
    const schemas = [];

    // RealEstateAgent on Home and About — the two pages actually about
    // the agent as a person/business; the other subpages are about their
    // listings/areas/posts instead.
    if (!pageKey || pageKey === "about") {
      schemas.push(
        buildAgentSchema({
          url: homeUrl,
          name: adapted.agent.name,
          image: adapted.agent.photo,
          phone: adapted.agent.phone,
          email: adapted.agent.email,
          jobTitle: adapted.agent.title,
          region: adapted.region,
          license: adapted.agent.license,
          brokerageName: brokerage.name,
          brokerageAddress: brokerage.address,
          sameAs: [adapted.social.instagram, adapted.social.facebook, adapted.social.linkedin].filter(Boolean),
        }),
      );
    }

    if (pageKey) {
      schemas.push(
        buildBreadcrumbSchema([
          { name: adapted.agent.name || "Home", url: homeUrl },
          { name: pageTitle, url },
        ]),
      );
    }

    if (schemas.length) applyStructuredData(schemas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, adapted, pageKey, location.pathname]);

  useEffect(() => {
    if (site?.id) trackView("agent_site", site.id);
  }, [site?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f4ee] font-agent-sans">
        <p className="text-[#14130f]/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted) {
    return <Navigate to="/404" replace />;
  }

  return (
    <AgentSiteProvider value={{ site: adapted, siteId: site.id, isStandalonePage: Boolean(pageKey) }}>
      <div
        className="min-h-screen bg-[var(--as-bg)] font-agent-sans"
        data-theme={adapted.theme}
        data-font={adapted.fontPairing}
        style={adapted.accentColor ? { "--as-accent": adapted.accentColor } : undefined}
      >
        <Navbar />
        {children}
        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

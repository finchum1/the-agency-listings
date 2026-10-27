import { useEffect, useMemo } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { buildAgentSitePageMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta, applyStructuredData } from "../lib/pageMeta";
import { buildAgentSchema, buildBreadcrumbSchema } from "../lib/structuredData";
import { startVisit } from "../lib/trackView";
import { isAgentSiteAppHost } from "../lib/agentSiteLinks";
import { AgentSiteProvider } from "../context/AgentSiteContext";
import { brandFromOrg } from "../lib/brand";
import { getPreviewBase, readPreviewOverrides } from "../lib/sitePreview";

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
  sales,
  loading,
  notFound,
  pageTitle,
  children,
}) {
  const location = useLocation();
  // Previewing another layout or color theme (the Compare Templates page and share links): the site renders with the
  // requested ones, and nothing is saved or counted as a visit.
  const overrides = useMemo(() => (site ? readPreviewOverrides(location.search, getPreviewBase() ? "share" : site.slug) : null), [site, location.search]);
  const previewing = Boolean(overrides) || Boolean(getPreviewBase());
  const shown = site && overrides ? { ...site, ...(overrides.layout ? { layout: overrides.layout } : {}), ...(overrides.theme ? { theme: overrides.theme } : {}) } : site;
  const adapted = shown ? adaptAgentSite({ site: shown, agent, testimonials, areas, posts, listings, sales }) : null;
  // "about" | "listings" | "areas" | "blog" | "contact" | undefined (Home)
  // — matches buildAgentSitePageMeta's page keys 1:1 since pageTitle is
  // always one of "About"/"Listings"/"Areas"/"Blog"/"Contact" (App.jsx).
  const pageKey = pageTitle?.toLowerCase().replace(/\s+/g, "-");

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
          brokerageName: brandFromOrg(site.org).name,
          brokerageAddress: brandFromOrg(site.org).address,
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
    if (!site?.id || previewing) return undefined;
    return startVisit("agent_site", site.id, { page: pageKey || "home" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  // A preview is never something to index.
  useEffect(() => {
    if (!previewing) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, [previewing]);

  // Inside a preview, links that would leave it (a listing page, another site) do nothing. Phone and email links still work.
  const guardLinks = previewing
    ? (e) => {
        const a = e.target.closest?.("a");
        const href = a?.getAttribute("href");
        if (!href || href.startsWith("#") || /^(tel|mailto):/i.test(href)) return;
        const stay = getPreviewBase() ? href.startsWith(getPreviewBase()) : href.startsWith(`/sites/${site.slug}`);
        if (!stay) e.preventDefault();
      }
    : undefined;

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
        data-buttons={adapted.buttonStyle}
        data-font={adapted.fontPairing}
        style={adapted.accentColor ? { "--as-accent": adapted.accentColor } : undefined}
        onClickCapture={guardLinks}
      >
        <Navbar />
        {/* Every inner page (About, Listings, Areas, Blog, Contact) opens with its title right under the fixed header, so
            it gets extra room there. Home starts with its hero and needs none. */}
        {pageKey ? <div className="pt-14">{children}</div> : children}
        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

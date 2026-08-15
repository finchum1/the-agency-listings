import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { buildAgentSiteMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { trackView } from "../lib/trackView";
import { AgentSiteProvider } from "../context/AgentSiteContext";

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

  useEffect(() => {
    if (!site) return;
    const meta = buildAgentSiteMeta(site, agent);
    applyPageMeta({
      ...meta,
      title: pageTitle ? `${pageTitle} | ${meta.title}` : meta.title,
      url: `${SITE_ORIGIN}/sites/${site.slug}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, agent, pageTitle]);

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
    <AgentSiteProvider value={{ site: adapted, siteId: site.id }}>
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

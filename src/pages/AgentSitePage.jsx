import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { buildAgentSiteMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { AgentSiteProvider } from "../context/AgentSiteContext";

import Navbar from "../components/agent-site/Navbar";
import Hero from "../components/agent-site/Hero";
import Bio from "../components/agent-site/Bio";
import Testimonials from "../components/agent-site/Testimonials";
import FeaturedListings from "../components/agent-site/FeaturedListings";
import ServiceAreas from "../components/agent-site/ServiceAreas";
import BlogTeaser from "../components/agent-site/BlogTeaser";
import Contact from "../components/agent-site/Contact";
import Footer from "../components/agent-site/Footer";

// Shared rendering for an agent's public site — takes the raw shape
// returned by useAgentSite().
export default function AgentSitePage({ site, agent, testimonials, areas, posts, listings, loading, notFound }) {
  const adapted = site ? adaptAgentSite({ site, agent, testimonials, areas, posts, listings }) : null;

  useEffect(() => {
    if (!site) return;
    const meta = buildAgentSiteMeta(site, agent);
    applyPageMeta({ ...meta, url: `${SITE_ORIGIN}/sites/${site.slug}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site, agent]);

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
      >
        <Navbar />
        <Hero />
        <Bio />
        <Testimonials />
        <FeaturedListings />
        <ServiceAreas />
        <BlogTeaser />
        <Contact />
        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useBrokerageSite } from "../hooks/useBrokerageSite";
import { adaptBrokerageSite } from "../lib/adaptBrokerageSite";
import { buildBrokerageSiteMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { BrokerageSiteProvider } from "../context/BrokerageSiteContext";

import Navbar from "../components/brokerage-site/Navbar";
import Footer from "../components/brokerage-site/Footer";

// Chrome (data loading, Navbar/Footer, meta) for every page of the
// brokerage site — parallel to AgentSitePage.jsx, and now themed the
// same way (theme/font_pairing/accent_color, set in the dashboard's
// BrokerageSiteForm). `path` (the current route, e.g. "/brokerage/agents")
// drives the canonical URL.
export default function BrokerageSitePage({ path, pageTitle, children }) {
  const { site, posts, agents, areas, loading, notFound } = useBrokerageSite();
  const adapted = site ? adaptBrokerageSite({ site, posts, agents, areas }) : null;

  useEffect(() => {
    if (!site) return;
    const meta = buildBrokerageSiteMeta(site);
    applyPageMeta({
      title: pageTitle ? `${pageTitle} | ${meta.title}` : meta.title,
      description: meta.description,
      image: meta.image,
      url: `${SITE_ORIGIN}${path}`,
    });
  }, [site, pageTitle, path]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14130f] font-agent-sans">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted) {
    return <Navigate to="/404" replace />;
  }

  return (
    <BrokerageSiteProvider value={{ site: adapted }}>
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
    </BrokerageSiteProvider>
  );
}

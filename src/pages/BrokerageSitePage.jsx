import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useBrokerageSite } from "../hooks/useBrokerageSite";
import { adaptBrokerageSite } from "../lib/adaptBrokerageSite";
import { buildBrokerageSiteMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { startVisit } from "../lib/trackView";
import { BrokerageSiteProvider } from "../context/BrokerageSiteContext";

import Navbar from "../components/brokerage-site/Navbar";
import Footer from "../components/brokerage-site/Footer";

// Chrome (data loading, Navbar/Footer, meta) for every page of the
// brokerage site — parallel to AgentSitePage.jsx, and now themed the
// same way (theme/font_pairing/accent_color, set in the dashboard's
// BrokerageSiteForm). `path` (the current route, e.g. "/brokerage/agents")
// drives the canonical URL. `customDomain` (optional) is passed straight
// through to useBrokerageSite — set only by CustomDomainSitePage.jsx's
// brokerage-site routes, which need the hostname gate; the normal
// /brokerage/* app-host routes omit it entirely.
export default function BrokerageSitePage({ path, pageTitle, customDomain, children }) {
  const { site, posts, agents, areas, loading, notFound } = useBrokerageSite({ customDomain });
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

  // "/brokerage/about" or (on the office's own domain) "/about" -> "about"; the home page is "home".
  useEffect(() => startVisit("brokerage_site", site?.id, { page: (path || "/").replace(/^\/brokerage/, "").replace(/^\//, "").split("/")[0] || "home" }), [site?.id]);

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
        className="min-h-screen flex flex-col bg-[var(--as-bg)] font-agent-sans"
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

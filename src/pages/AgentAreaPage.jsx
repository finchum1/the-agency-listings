import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { buildAgentAreaMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { trackView } from "../lib/trackView";
import { isAgentSiteAppHost } from "../lib/agentSiteLinks";
import { AgentSiteProvider } from "../context/AgentSiteContext";
import Navbar from "../components/agent-site/Navbar";
import Footer from "../components/agent-site/Footer";
import SiteLink from "../components/agent-site/SiteLink";
import IdxListings from "../components/brokerage-site/IdxListings";

// Shared rendering for one agent's area-of-expertise page — used both at
// /sites/:slug/areas/:areaSlug (PublicAgentAreaPage.jsx) and when a
// request arrives on the parent site's own attached custom domain.
// Takes the raw shape returned by useAgentArea(). Parallel to
// AgentPostPage.jsx, with two IdxListings sections added below the
// overview: a curated preview of The Agency's own listings in this area,
// and a full open-market search pre-scoped to it — both reuse the
// brokerage site's own MLS search component (see IdxListings.jsx's own
// comment on why that's safe outside a BrokerageSiteProvider).
export default function AgentAreaPage({ site, agent, area, loading, notFound }) {
  const adapted = site
    ? adaptAgentSite({ site, agent, testimonials: [], areas: [], posts: [], listings: [] })
    : null;

  useEffect(() => {
    if (!area || !site) return;
    const meta = buildAgentAreaMeta(area, site, agent);
    applyPageMeta({
      ...meta,
      url: isAgentSiteAppHost() ? `${SITE_ORIGIN}/sites/${site.slug}/areas/${area.slug}` : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, site, agent]);

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

  if (notFound || !adapted || !area) {
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

        {/* Header band — photo + name. Neutral black overlay, not the
            themed --as-dark — see Hero.jsx's own comment for why a photo
            darkening overlay needs to stay theme-independent. */}
        <section className="relative h-[42vh] min-h-[320px] w-full">
          {area.photo_url ? (
            <img src={area.photo_url} alt={area.name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[var(--as-surface)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
          <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-10 max-w-5xl mx-auto w-full">
            <SiteLink
              slug={site.slug}
              path="/areas"
              className="text-xs font-medium tracked-wide uppercase text-white/70 hover:text-white transition-colors mb-4 w-fit"
            >
              ← Areas
            </SiteLink>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold text-white">{area.name}</h1>
          </div>
        </section>

        {area.description && (
          <section className="px-6 lg:px-10 py-16">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Overview</p>
              <div
                className="rich-text space-y-5 text-[15.5px] leading-relaxed text-[var(--as-text)]/80"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(area.description) }}
              />
            </div>
          </section>
        )}

        <IdxListings
          preview
          officeOnly
          initialCity={area.name}
          previewCount={6}
          viewAllHref={null}
          eyebrowOverride="The Agency's Listings"
          titleOverride={`Our Listings in ${area.name}`}
        />

        <IdxListings
          isStandalonePage
          officeOnly={false}
          initialCity={area.name}
          sectionId="area-search"
          eyebrowOverride="Home Search"
          titleOverride={`Search Homes in ${area.name}`}
        />

        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

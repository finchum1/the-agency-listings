import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useBrokerageArea } from "../hooks/useBrokerageArea";
import { adaptBrokerageSite } from "../lib/adaptBrokerageSite";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { buildBrokerageAreaMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { trackView } from "../lib/trackView";
import { BrokerageSiteProvider } from "../context/BrokerageSiteContext";
import Navbar from "../components/brokerage-site/Navbar";
import Footer from "../components/brokerage-site/Footer";
import IdxListings from "../components/brokerage-site/IdxListings";

// One brokerage area-of-expertise page, at /brokerage/areas/:areaSlug —
// parallel to BrokeragePostPage.jsx (self-contained: reads :areaSlug
// itself, no props needed) and to AgentAreaPage.jsx's own layout (photo
// header, overview + stats, curated Agency-listings preview, full MLS
// search) — the brokerage version needs no agent-vs-brokerage fallback
// logic since IdxListings already reads BrokerageSiteContext natively
// here (this page supplies a real BrokerageSiteProvider, unlike the
// agent-site page).
export default function BrokerageAreaPage() {
  const { areaSlug } = useParams();
  const { site, area, loading, notFound } = useBrokerageArea({ areaSlug });
  const adapted = site ? adaptBrokerageSite({ site, posts: [], agents: [], areas: [] }) : null;

  useEffect(() => {
    if (!area || !site) return;
    const meta = buildBrokerageAreaMeta(area, site);
    applyPageMeta({ ...meta, url: `${SITE_ORIGIN}/brokerage/areas/${area.slug}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, site]);

  useEffect(() => {
    if (site?.id) trackView("brokerage_site", site.id);
  }, [site?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14130f] font-agent-sans">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted || !area) {
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
            <Link
              to="/brokerage/areas"
              className="text-xs font-medium tracked-wide uppercase text-white/70 hover:text-white transition-colors mb-4 w-fit"
            >
              ← Areas
            </Link>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold text-white">{area.name}</h1>
          </div>
        </section>

        {(area.description || area.stats?.length > 0) && (
          <section className="px-6 lg:px-10 py-16">
            <div className="mx-auto max-w-3xl">
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Overview</p>
              {area.description && (
                <div
                  className="rich-text space-y-5 text-[15.5px] leading-relaxed text-[var(--as-text)]/80"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(area.description) }}
                />
              )}
              {area.stats?.length > 0 && (
                <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-6 border-t border-[var(--as-text)]/10 pt-6">
                  {area.stats.map((stat, i) => (
                    <div key={i}>
                      <p className="text-2xl font-display font-semibold text-[var(--as-text)]">{stat.value}</p>
                      <p className="text-xs tracked-wide uppercase text-[var(--as-text)]/50 mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
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
    </BrokerageSiteProvider>
  );
}

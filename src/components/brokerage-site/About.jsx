import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

export default function About({ isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  if (!site.aboutHtml && site.stats.length === 0) return null;
  // See agent-site/Bio.jsx's same comment — Home already has an H1 from
  // Hero.jsx, but this section IS the page at standalone /about.
  const Heading = isStandalonePage ? "h1" : "h2";

  const eyebrowAndHeading = (
    <>
      <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">About</p>
      <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-6 text-[var(--as-text)]">
        {site.brokerage.name} — Oklahoma
      </Heading>
    </>
  );

  const bodyText = (
    <div
      className="rich-text space-y-4 text-[15.5px] leading-relaxed text-[var(--as-text)]/75"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.aboutHtml) }}
    />
  );

  const stats = site.stats.length > 0 && (
    <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-[var(--as-text)]/10 pt-8">
      {site.stats.map((stat, i) => (
        <div key={i}>
          <p className="text-2xl font-display font-semibold text-[var(--as-text)]">{stat.value}</p>
          <p className="text-xs tracked-wide uppercase text-[var(--as-text)]/50 mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );

  // With a photo: text and image side by side (photo on the right),
  // stats span the full width below. Without one: the original centered,
  // text-only layout, unchanged.
  if (site.aboutPhoto) {
    return (
      <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="text-left">
              {eyebrowAndHeading}
              {bodyText}
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[var(--as-surface)]">
              <img
                src={site.aboutPhoto}
                alt={`${site.brokerage.name} team`}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          {stats && <div className="max-w-2xl mx-auto">{stats}</div>}
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-4xl text-center">
        {eyebrowAndHeading}
        <div className="max-w-2xl mx-auto text-left">{bodyText}</div>
        {stats && <div className="max-w-2xl mx-auto">{stats}</div>}
      </div>
    </section>
  );
}

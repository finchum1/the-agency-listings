import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

export default function About() {
  const { site } = useBrokerageSiteContext();
  if (!site.aboutHtml && site.stats.length === 0) return null;

  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">About</p>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-6 text-[var(--as-text)]">
          {site.brokerage.name} — Oklahoma
        </h2>
        <div
          className="rich-text space-y-4 text-[15.5px] leading-relaxed text-[var(--as-text)]/75 max-w-2xl mx-auto text-left"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.aboutHtml) }}
        />

        {site.stats.length > 0 && (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 border-t border-[var(--as-text)]/10 pt-8 max-w-2xl mx-auto">
            {site.stats.map((stat, i) => (
              <div key={i}>
                <p className="text-2xl font-display font-semibold text-[var(--as-text)]">{stat.value}</p>
                <p className="text-xs tracked-wide uppercase text-[var(--as-text)]/50 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

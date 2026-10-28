import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import { LAYOUT_SECTIONS } from "./layouts";
import { aboveFooter } from "./landing/Parts";

export default function Testimonials() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const Variant = LAYOUT_SECTIONS[site.layout]?.Testimonials;
  if (Variant) return <Variant />;
  if (site.testimonials.length === 0) return null;

  // On Home the band is dark, between other sections. On the About page it is the last thing above the footer, which is the same dark color in every theme,
  // so there it goes light (the quote and name colors follow).
  const light = isStandalonePage;
  return (
    <section
      className={`px-6 lg:px-10 py-24 ${light ? `bg-[var(--as-bg-alt)] text-[var(--as-text)] border-y border-[var(--as-text)]/10 ${aboveFooter(site)}` : "bg-[var(--as-dark)] text-[var(--as-on-dark)]"}`}
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-10 text-center">
          Testimonials
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {site.testimonials.map((t) => (
            <div key={t.id}>
              <div className={`font-display text-lg leading-snug ${light ? "text-[var(--as-text)]/90" : "text-[var(--as-on-dark)]/90"}`}>
                &ldquo;
                {/* rich-text's <p> tags forced inline here — a testimonial
                    quote is one flowing line, same as the old plain-text
                    rendering, even if the editor produced multiple
                    paragraphs. */}
                <div
                  className="rich-text inline [&>*]:inline"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }}
                />
                &rdquo;
              </div>
              <p className={`text-xs tracked-wide uppercase mt-4 ${light ? "text-[var(--as-text)]/50" : "text-[var(--as-on-dark)]/45"}`}>— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

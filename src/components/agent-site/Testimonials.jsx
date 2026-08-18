import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { sanitizeHtml } from "../../lib/sanitizeHtml";

export default function Testimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;

  return (
    <section className="bg-[var(--as-dark)] text-[var(--as-on-dark)] px-6 lg:px-10 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-10 text-center">
          Testimonials
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {site.testimonials.map((t) => (
            <div key={t.id}>
              <div className="font-display text-lg leading-snug text-[var(--as-on-dark)]/90">
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
              <p className="text-xs tracked-wide uppercase text-[var(--as-on-dark)]/45 mt-4">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

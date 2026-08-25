import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

// A simple "get in touch" card — mailto/tel only, no submission form (no
// per-agent inbox to route a lead to at the brokerage level; a visitor
// wanting a specific agent should go through that agent's own site,
// linked from AgentRoster).
export default function ContactCard({ isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  if (!site.contact.email && !site.contact.phone) return null;
  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section id="contact" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-t border-[var(--as-text)]/10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Let&rsquo;s Connect</p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-6 text-[var(--as-text)]">
          Get In Touch
        </Heading>
        <p className="text-[var(--as-text)]/70 leading-relaxed mb-8">
          Whether you&rsquo;re buying, selling, or just curious about the market, reach out anytime.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {site.contact.phone && (
            <a href={`tel:${site.contact.phone}`} className="inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]">
              {site.contact.phone}
            </a>
          )}
          {site.contact.email && (
            <a href={`mailto:${site.contact.email}`} className="inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 border border-[var(--as-text)]/20 text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]">
              {site.contact.email}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

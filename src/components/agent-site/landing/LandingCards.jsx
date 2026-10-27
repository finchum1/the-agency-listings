import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { agentSiteHref, isAgentSiteAppHost } from "../../../lib/agentSiteLinks";
import { resolveLanding } from "../../../lib/landingPages";
import SiteLink from "../SiteLink";

// The "cards" home section: Sellers, Home Value and Buyers side by side, right under the bio and testimonials (agent_sites.home_sections has
// "cards"; the agent moves it up or down in Site Details, and orders, hides and rewords the cards themselves there too).
export default function LandingCards() {
  const { site } = useAgentSiteContext();
  const first = (site.agent.name || "").split(" ")[0];
  const cards = resolveLanding(site.landing, first).cards.filter((c) => c.on);
  if (cards.length === 0) return null;

  return (
    <section id="cards" className="px-6 lg:px-10 py-20 sm:py-24 bg-[var(--as-bg)] text-[var(--as-text)]">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Make your move</p>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold">Where are you headed next?</h2>
          <p className="mt-4 text-[17px] leading-relaxed opacity-70">
            Whether you&rsquo;re selling, curious what your home is worth, or ready to buy, here&rsquo;s how it works and what to expect, start to finish.
          </p>
        </div>
        <div className="mt-12 grid gap-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))" }}>
          {cards.map((c) => (c.key === "value" ? <ValueCard key={c.key} card={c} /> : <PhotoCard key={c.key} card={c} />))}
        </div>
      </div>
    </section>
  );
}

function PhotoCard({ card }) {
  const { site } = useAgentSiteContext();
  return (
    <SiteLink slug={site.slug} path={card.path} className="group flex flex-col bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-56 bg-[var(--as-surface)] overflow-hidden">
        <img src={card.photo} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="as-btn absolute top-4 left-4 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{card.eyebrow}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-7">
        <p className="font-display text-2xl sm:text-[28px] font-semibold leading-tight">{card.title}</p>
        <p className="flex-1 text-[15.5px] leading-relaxed opacity-70">{card.blurb}</p>
        <p className="mt-2 text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">{card.cta} →</p>
      </div>
    </SiteLink>
  );
}

// The middle card is the one that asks for something: the address goes right on the card and carries over to the Home Value page.
function ValueCard({ card }) {
  const { site } = useAgentSiteContext();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const go = (e) => {
    e.preventDefault();
    const href = `${agentSiteHref(site.slug, card.path)}${address.trim() ? `?address=${encodeURIComponent(address.trim())}` : ""}`;
    if (isAgentSiteAppHost()) navigate(href);
    else window.location.assign(href);
  };
  return (
    <div className="flex flex-col bg-[var(--as-dark)] text-[var(--as-on-dark)] border border-[var(--as-dark)] overflow-hidden">
      <div className="relative h-56 p-6 flex flex-col justify-between">
        <img src={card.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--as-dark)]/40 to-[var(--as-accent)]/40" aria-hidden="true" />
        <span className="as-btn relative self-start bg-[var(--as-accent)] text-white text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{card.eyebrow}</span>
        <form onSubmit={go} className="relative">
          <label htmlFor="card-address" className="block text-[11px] tracked-wide uppercase opacity-70 mb-2">
            Property address
          </label>
          <div className="flex">
            <input
              id="card-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              placeholder="123 Main St, Edmond"
              className="min-w-0 flex-1 bg-[var(--as-bg)] text-[var(--as-text)] px-4 py-3 text-[15px] placeholder:text-[var(--as-text)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--as-accent)]"
            />
            <button type="submit" className="as-btn bg-[var(--as-accent)] text-white px-5 text-sm font-medium">
              Go
            </button>
          </div>
        </form>
      </div>
      <SiteLink slug={site.slug} path={card.path} className="flex flex-1 flex-col gap-2.5 p-7">
        <p className="font-display text-2xl sm:text-[28px] font-semibold leading-tight">{card.title}</p>
        <p className="flex-1 text-[15.5px] leading-relaxed opacity-75">{card.blurb}</p>
        <p className="mt-2 text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/85">{card.cta} →</p>
      </SiteLink>
    </div>
  );
}

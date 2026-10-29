import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { resolveLanding } from "../../../lib/landingPages";
import SiteLink from "../SiteLink";

// The heroes of the three starter templates (agent_sites.layout = 'luxury' | 'warm' | 'guide'; see lib/siteTemplates.js). Only the hero differs from the
// classic layout: every other section uses the classic components, so the photos, bio, listings and the rest of the home page work as they always do.
// The headline is the site's tagline (the agent's name when there is none) and the line under it is the region. In the tagline, a word wrapped in
// asterisks (what *moves* you) gets the accent color on the Warm editorial hero.

// A landing page's path while its card is on (the buyer, seller and home value pages come and go with the "Buyer & seller cards" section), else null.
function landingPath(site, key) {
  if (!site.homeSections.includes("cards")) return null;
  const card = resolveLanding(site.landing).cards.find((c) => c.key === key);
  return card?.on ? card.path : null;
}

// The hero's buttons: each wants a page; one whose page is off is dropped, and there are never fewer than two.
function actions(site, wanted) {
  const list = wanted
    .map(([path, label]) => {
      const p = typeof path === "string" && path.startsWith("/") ? path : landingPath(site, path);
      return p ? { path: p, label } : null;
    })
    .filter(Boolean);
  for (const extra of [{ path: "/contact", label: "Let’s connect" }, { path: "/about", label: "About" }]) {
    if (list.length < 2 && !list.some((a) => a.path === extra.path)) list.push(extra);
  }
  return list;
}

function Headline({ text, accent, className }) {
  const parts = String(text || "").split(/\*([^*]+)\*/);
  return (
    <h1 className={className}>
      {parts.map((part, i) => (i % 2 === 1 ? <span key={i} style={{ color: accent }} className="italic">{part}</span> : part))}
    </h1>
  );
}

function HeroMedia() {
  const { site } = useAgentSiteContext();
  return (
    <>
      {site.heroVideo ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={site.heroVideo} poster={site.heroPhoto} autoPlay muted loop playsInline />
      ) : site.heroPhoto ? (
        <img src={site.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[var(--as-dark)]" />
      )}
    </>
  );
}

// Luxury minimal: a full-screen photo darkened evenly, a small region line, a wide-tracked uppercase headline and outlined buttons to the buyer, seller and home value pages, centered.
export function LuxuryHero() {
  const { site } = useAgentSiteContext();
  const buttons = actions(site, [["buyers", "Buy a home"], ["sellers", "Sell my home"], ["value", "Value my home"]]);
  return (
    <section className="relative h-screen min-h-[640px] w-full">
      <HeroMedia />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pt-24 text-center text-white">
        {site.region && <p className="text-white/80 text-xs tracked-wide uppercase mb-6">{site.region}</p>}
        <h1 className="font-display font-normal uppercase text-3xl sm:text-5xl lg:text-6xl leading-tight max-w-4xl" style={{ letterSpacing: "0.16em" }}>
          {site.tagline || site.agent.name}
        </h1>
        {site.tagline && <p className="mt-6 text-white/80 text-sm tracked-wide uppercase">{site.agent.name}</p>}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {buttons.map((b) => (
            <SiteLink key={b.path} slug={site.slug} path={b.path} className="as-btn text-xs font-medium tracked-wide uppercase px-7 py-3.5 border border-white/85 text-white transition-colors hover:bg-white hover:text-black">
              {b.label}
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

// Warm editorial: a full-screen photo, a large centered headline with one word in color, a quiet line under it and two pill buttons.
export function WarmHero() {
  const { site } = useAgentSiteContext();
  const buttons = actions(site, [["buyers", "Buy a home"], ["value", "Value my home"]]);
  return (
    <section className="relative h-screen min-h-[640px] w-full">
      <HeroMedia />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pt-16 text-center text-white">
        <Headline text={site.tagline || site.agent.name} accent="#ff7a5c" className="font-display font-medium text-5xl sm:text-6xl lg:text-7xl leading-[1.05] max-w-4xl" />
        <p className="mt-5 text-lg sm:text-xl text-white/90">{site.region || site.agent.name}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {buttons.map((b) => (
            <SiteLink key={b.path} slug={site.slug} path={b.path} className="text-xs font-medium tracked-wide uppercase rounded-full px-7 py-3.5 border border-white/85 text-white transition-colors hover:bg-white hover:text-black">
              {b.label}
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

// Guide cards: no photo. A calm headline, the region, and a pair of outlined buttons into the buyer's and seller's guides; the cards follow.
export function GuideHero() {
  const { site } = useAgentSiteContext();
  const buttons = actions(site, [["buyers", "Your guide to buying"], ["sellers", "Your guide to selling"]]);
  return (
    <section className="px-6 lg:px-10 pt-40 sm:pt-48 pb-16 bg-[var(--as-bg)] text-[var(--as-text)]">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl leading-[1.08]">{site.tagline || site.agent.name}</h1>
        <p className="mt-5 text-lg text-[var(--as-text)]/65">{[site.region, site.tagline ? site.agent.name : ""].filter(Boolean).join(" · ")}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {buttons.map((b) => (
            <SiteLink key={b.path} slug={site.slug} path={b.path} className="as-btn text-xs font-medium tracked-wide uppercase px-7 py-3.5 border border-[var(--as-text)] text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]">
              {b.label}
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

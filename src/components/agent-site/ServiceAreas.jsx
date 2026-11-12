import useShowMore from "../../hooks/useShowMore";
import ShowMoreButton from "./ShowMoreButton";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import SiteLink from "./SiteLink";
import { LAYOUT_SECTIONS } from "./layouts";
import { journeyPins, resolveMap } from "../../lib/areaMaps";
import AreasJourney from "./AreasJourney";

export default function ServiceAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const more = useShowMore(site.areas);
  const Variant = LAYOUT_SECTIONS[site.layout]?.Areas;
  if (Variant) return <Variant />;
  if (site.areas.length === 0) return null;
  // See Bio.jsx's comment — Home already has an H1 from Hero.jsx, but
  // this section IS the page at standalone /areas.
  const Heading = isStandalonePage ? "h1" : "h2";

  const header = (
    <>
      <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3 text-center">Areas of Expertise</p>
      <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center text-[var(--as-text)]">Find Your Area</Heading>
    </>
  );
  // `sync` (only given by the animated map, which highlights the card of the area it is showing) adds that hover behavior to the link.
  const card = (area, i, sync = {}) => (
    <SiteLink
      key={area.id}
      slug={site.slug}
      path={`/areas/${area.slug}`}
      className={`${sync.className || ""} group relative block overflow-hidden bg-[var(--as-surface)] aspect-[4/3]`}
      onMouseEnter={sync.onMouseEnter}
      onFocus={sync.onFocus}
    >
      {area.photo_url && <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
      {/* Neutral black overlay + hardcoded white text, not --as-dark/
          --as-on-dark — see Hero.jsx's same fix (this text sits on
          the black overlay, not on --as-dark itself, so it needs
          to stay white even in the Linen template). */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent flex flex-col items-center justify-end p-6 text-center">
        <p className="text-white font-display text-xl font-semibold">{area.name}</p>
        {area.blurb && <p className="text-white/75 text-sm mt-1 max-w-xs">{area.blurb}</p>}
      </div>
    </SiteLink>
  );

  // The animated map (landing.animated, set in Site Details): only when enough of the agent's areas have a place on it.
  const pins = journeyPins(site);
  if (pins) {
    return <AreasJourney pins={pins} base={resolveMap(site.landing.map).base} sectionClass="px-6 lg:px-10 py-24 bg-[var(--as-bg)]" header={header} renderCard={card} />;
  }

  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        {header}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{more.shown.map((area, i) => card(area, i))}</div>
        <ShowMoreButton more={more} />
      </div>
    </section>
  );
}

import { useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";

// Used identically on Home and the standalone /areas page (no preview
// split like the brokerage site's AreasOfExpertise.jsx has) — used to
// dump every area into one grid everywhere; now caps to the top
// FULL_LIST_COUNT with a "Show All"/"Show Fewer" toggle for the rest.
const FULL_LIST_COUNT = 4;

export default function ServiceAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const [showAll, setShowAll] = useState(false);
  if (site.areas.length === 0) return null;
  const areas = showAll ? site.areas : site.areas.slice(0, FULL_LIST_COUNT);
  const hasMore = site.areas.length > FULL_LIST_COUNT;
  // See Bio.jsx's comment — Home already has an H1 from Hero.jsx, but
  // this section IS the page at standalone /areas.
  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3 text-center">
          Areas of Expertise
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center text-[var(--as-text)]">
          Find Your Area
        </Heading>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map((area) => (
            <div key={area.id} className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
              {area.photo_url && (
                <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--as-dark)]/85 to-transparent flex flex-col items-center justify-end p-6 text-center">
                <p className="text-[var(--as-on-dark)] font-display text-xl font-semibold">{area.name}</p>
                {area.blurb && <p className="text-[var(--as-on-dark)]/75 text-sm mt-1 max-w-xs">{area.blurb}</p>}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="mt-14 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
            >
              {showAll ? "Show Fewer" : `Show All ${site.areas.length}`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

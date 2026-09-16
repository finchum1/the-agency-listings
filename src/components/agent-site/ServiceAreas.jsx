import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function ServiceAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.areas.length === 0) return null;
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
          {site.areas.map((area) => (
            <div key={area.id} className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
              {area.photo_url && (
                <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover" />
              )}
              {/* Neutral black overlay + hardcoded white text, not --as-dark/
                  --as-on-dark — see Hero.jsx's same fix (this text sits on
                  the black overlay, not on --as-dark itself, so it needs
                  to stay white even in the Linen template). */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent flex flex-col items-center justify-end p-6 text-center">
                <p className="text-white font-display text-xl font-semibold">{area.name}</p>
                {area.blurb && <p className="text-white/75 text-sm mt-1 max-w-xs">{area.blurb}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

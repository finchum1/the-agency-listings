import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

// Mirrors agent-site/ServiceAreas.jsx (same copy, same card layout) —
// styled after theagencyoklahoma.com/neighborhoods, the reference for
// this section. `preview` caps the grid to the top 3 with a "View All"
// link below (used on Home, matching AgentRoster/BlogList's own preview
// convention); the standalone /brokerage/areas page shows every area.
export default function AreasOfExpertise({ preview = false, isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  if (site.areas.length === 0) return null;
  const areas = preview ? site.areas.slice(0, 3) : site.areas;
  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3 text-center">
          Areas of Expertise
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center text-[var(--as-text)]">
          Neighborhood Guide
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

        {preview && site.areas.length > areas.length && (
          <div className="mt-14 flex justify-center">
            <a
              href="/brokerage/areas"
              className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
            >
              View All
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

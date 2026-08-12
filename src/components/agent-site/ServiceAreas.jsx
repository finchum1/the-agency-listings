import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function ServiceAreas() {
  const { site } = useAgentSiteContext();
  if (site.areas.length === 0) return null;

  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[#f7f4ee]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[#8a1c2b] mb-3 text-center">
          Areas of Expertise
        </p>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center text-[#14130f]">
          Find Your Area
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.areas.map((area) => (
            <div key={area.id} className="relative overflow-hidden bg-[#e7e2d6] aspect-[4/3]">
              {area.photo_url && (
                <img src={area.photo_url} alt="" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#14130f]/85 to-transparent flex flex-col items-center justify-end p-6 text-center">
                <p className="text-[#f7f4ee] font-display text-xl font-semibold">{area.name}</p>
                {area.blurb && <p className="text-[#f7f4ee]/75 text-sm mt-1 max-w-xs">{area.blurb}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

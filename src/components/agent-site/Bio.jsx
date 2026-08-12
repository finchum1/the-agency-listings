import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Bio() {
  const { site } = useAgentSiteContext();
  if (site.bio.length === 0 && site.stats.length === 0) return null;

  return (
    <section id="bio" className="px-6 lg:px-10 py-24 bg-[#f7f4ee]">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-[0.85fr_1.15fr] gap-14 items-start">
        <div className="overflow-hidden bg-[#e7e2d6] aspect-[4/5]">
          {site.agent.photo && (
            <img src={site.agent.photo} alt={site.agent.name} className="h-full w-full object-cover" />
          )}
        </div>

        <div>
          <p className="text-xs font-medium tracked-wide uppercase text-[#8a1c2b] mb-3">
            About {site.agent.name.split(" ")[0]}
          </p>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-6 text-[#14130f]">
            {site.brokerage.name}
            {site.region ? ` — ${site.region}` : ""}
          </h2>

          <div className="space-y-4 text-[15.5px] leading-relaxed text-[#14130f]/75 max-w-xl">
            {site.bio.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {site.stats.length > 0 && (
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-6 border-t border-[#14130f]/10 pt-6 max-w-xl">
              {site.stats.map((stat, i) => (
                <div key={i}>
                  <p className="text-2xl font-display font-semibold text-[#14130f]">{stat.value}</p>
                  <p className="text-xs tracked-wide uppercase text-[#14130f]/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

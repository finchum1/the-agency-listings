import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Hero() {
  const { site } = useAgentSiteContext();

  return (
    <section className="relative h-screen min-h-[640px] w-full">
      {site.heroVideo ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={site.heroVideo}
          poster={site.heroPhoto}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : site.heroPhoto ? (
        <img src={site.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[#14130f]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#14130f]/90 via-[#14130f]/35 to-[#14130f]/20" />

      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-24 max-w-7xl mx-auto">
        {site.region && (
          <p className="text-[#f7f4ee]/75 text-xs tracked-wide uppercase mb-4">{site.region}</p>
        )}
        <h1 className="text-[#f7f4ee] text-4xl sm:text-5xl lg:text-6xl font-display font-semibold leading-tight max-w-3xl">
          {site.agent.name}
        </h1>
        {site.tagline && (
          <p className="text-[#f7f4ee]/85 text-lg sm:text-xl mt-4 tracked max-w-xl">{site.tagline}</p>
        )}

        <div className="mt-9">
          <a
            href="#contact"
            className="inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[#8a1c2b] text-white transition duration-150 hover:bg-[#8a1c2b]/90 active:scale-[0.98]"
          >
            Let&rsquo;s Connect
          </a>
        </div>
      </div>
    </section>
  );
}

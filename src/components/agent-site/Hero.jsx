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
        <div className="absolute inset-0 bg-[#1c1a17]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />

      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-20 max-w-7xl mx-auto">
        {site.region && (
          <p className="text-white/80 text-xs tracking-wider-plus uppercase mb-4">{site.region}</p>
        )}
        <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-display font-semibold leading-tight max-w-3xl">
          {site.agent.name}
        </h1>
        {site.tagline && (
          <p className="text-white/85 text-lg sm:text-xl mt-4 tracking-wide max-w-xl">{site.tagline}</p>
        )}

        <div className="mt-8">
          <a
            href="#contact"
            className="text-sm font-semibold px-6 py-3 rounded-full bg-white text-[#1c1a17] hover:bg-white/90 transition-colors inline-block"
          >
            Let&rsquo;s Connect
          </a>
        </div>
      </div>
    </section>
  );
}

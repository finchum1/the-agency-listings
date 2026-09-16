import { useAgentSiteContext } from "../../context/AgentSiteContext";
import SiteLink from "./SiteLink";

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
        <div className="absolute inset-0 bg-[var(--as-dark)]" />
      )}
      {/* Neutral black, not the themed --as-dark -- a photo overlay
          tinted with a saturated brand color (e.g. the Red template's
          literal Agency Red) reads as an odd colored glow rather than
          the plain darkening every other template already gets away
          with since its own --as-dark happens to be near-black anyway.
          Matches listing-site/Hero.jsx's already-established convention. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20" />

      {/* Also hardcoded white rather than --as-on-dark: that token means
          "text on --as-dark" (a solid band like the footer/nav), which
          for most templates happens to be light anyway -- but the Linen
          template flips --as-on-dark to dark ink, and this text always
          sits on the black photo overlay above, not on --as-dark itself,
          so it needs to stay white regardless of theme. */}
      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-24 max-w-7xl mx-auto">
        {site.region && (
          <p className="text-white/75 text-xs tracked-wide uppercase mb-4">{site.region}</p>
        )}
        <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-display font-semibold leading-tight max-w-3xl">
          {site.agent.name}
        </h1>
        {site.tagline && (
          <p className="text-white/85 text-lg sm:text-xl mt-4 tracked max-w-xl">{site.tagline}</p>
        )}

        <div className="mt-9">
          <SiteLink
            slug={site.slug}
            path="/contact"
            className="inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            Let&rsquo;s Connect
          </SiteLink>
        </div>
      </div>
    </section>
  );
}

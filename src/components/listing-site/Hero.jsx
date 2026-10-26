import { useListingContext } from "../../context/ListingContext";
import { formatPrice } from "../../lib/format";
import { embedUrl } from "../../lib/videoEmbed";

// The classic property-site hero is two layers (see ListingSitePage.jsx): the photo or video is pinned in place behind
// the page (HeroBackdrop), and the text (status, MLS number, address, price, tour button) is the page's first block of
// content, so it scrolls up over the pinned media together with everything after it.
const HERO_HEIGHT = "max(100vh, 640px)";

export function HeroBackdrop() {
  const { listing } = useListingContext();
  const hero = listing.images[0];
  const video = listing.heroVideo;
  const embed = listing.heroEmbed;

  return (
    <div className="sticky top-0 z-0 w-full overflow-hidden" style={{ height: HERO_HEIGHT }}>
      {embed ? (
        // A YouTube or Vimeo video, silent and looping, scaled up to fill the hero like a photo would (the player is 16:9, so it
        // is made at least as wide as the hero and as tall as it, and centered). The photo shows until the video starts.
        <>
          {hero?.url && <img src={hero.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <iframe
            src={embedUrl(embed, { background: true })}
            title=""
            aria-hidden="true"
            tabIndex={-1}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
            style={{ width: `max(100%, calc(${HERO_HEIGHT} * 16 / 9))`, aspectRatio: "16 / 9" }}
          />
        </>
      ) : video ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={video} poster={hero?.url} autoPlay muted loop playsInline />
      ) : (
        <img src={hero?.url} alt={hero?.alt} className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />
    </div>
  );
}

// The layer that sits on top of HeroBackdrop: pulled up by the backdrop's own height so the two overlap exactly.
export const HERO_OVERLAP_STYLE = { marginTop: `calc(${HERO_HEIGHT} * -1)` };

export default function Hero() {
  const { listing } = useListingContext();

  return (
    <section id="overview" className="relative w-full" style={{ height: HERO_HEIGHT }}>
      {/* Hardcoded white, not --ls-on-dark: that token means "text on
          --ls-dark" (a solid band), which for most templates happens to
          be light anyway -- but the Linen template flips --ls-on-dark to
          dark ink, and this text always sits on the black photo overlay
          above, not on --ls-dark itself, so it needs to stay white
          regardless of theme. The status pill below keeps --ls-bg-alt/
          --ls-text since it's a solid-fill badge, self-consistent in
          every theme. */}
      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex items-center rounded-full bg-[var(--ls-bg-alt)]/95 px-4 py-1.5 text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-text)]">
            {listing.status}
          </span>
          <span className="text-white/80 text-xs tracking-wider-plus uppercase">
            {listing.mlsNumber}
          </span>
        </div>

        <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight max-w-3xl">
          {listing.address.line1}
        </h1>
        <p className="text-white/85 text-lg sm:text-xl mt-3 tracking-wide">
          {listing.address.city}, {listing.address.state} {listing.address.zip}
        </p>

        <div className="mt-8 flex flex-wrap items-end gap-8">
          <span className="text-white text-3xl sm:text-4xl font-display font-semibold">
            {formatPrice(listing.price)}
          </span>
          <a
            href="#contact"
            className="text-sm font-semibold px-6 py-3 rounded-full bg-[var(--ls-bg-alt)] text-[var(--ls-text)] hover:opacity-90 transition-opacity"
          >
            Schedule a Private Tour
          </a>
        </div>
      </div>

      <a
        href="#facts"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/70 hover:text-white transition-colors animate-bounce"
        aria-label="Scroll down"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 4v15M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </section>
  );
}

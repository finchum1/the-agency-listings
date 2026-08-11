import { useListingContext } from "../../context/ListingContext";
import { formatPrice } from "../../lib/format";

export default function Hero() {
  const { listing } = useListingContext();
  const hero = listing.images[0];
  const video = listing.heroVideo;

  return (
    <section id="overview" className="relative h-screen min-h-[640px] w-full">
      {video ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={video}
          poster={hero?.url}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          src={hero?.url}
          alt={hero?.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/40" />

      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex items-center rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]">
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
            className="text-sm font-semibold px-6 py-3 rounded-full bg-white text-[#1c1a17] hover:bg-white/90 transition-colors"
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

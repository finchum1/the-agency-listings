import { useCallback, useEffect, useState } from "react";
import { useListingContext } from "../../context/ListingContext";
import { trackListingEvent } from "../../lib/trackView";
import { embedUrl } from "../../lib/videoEmbed";

// The video above the photo gallery: an uploaded file plays in a normal player; a YouTube or Vimeo link shows the photo with a
// play button and only loads the player when pressed (faster page, no tracking cookies until someone chooses to watch). Either way,
// the first press of play is counted in the listing's analytics.
function GalleryVideo({ file, embed, poster, spaced }) {
  const [playing, setPlaying] = useState(false);
  const frame = `overflow-hidden rounded-2xl bg-black shadow-lg shadow-black/10 aspect-video ${spaced ? "mb-3" : ""}`;
  if (embed && playing) {
    return (
      <div className={frame}>
        <iframe
          className="h-full w-full"
          src={embedUrl(embed, { autoplay: true })}
          title="Video tour"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (embed) {
    return (
      <button
        type="button"
        onClick={() => {
          trackListingEvent("video_play", "gallery");
          setPlaying(true);
        }}
        aria-label="Play the video tour"
        className={`group relative block w-full ${frame}`}
      >
        {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />}
        <span className="absolute inset-0 bg-black/20" />
        <span className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-black shadow-xl transition-transform group-hover:scale-105">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
        </span>
        <span className="absolute bottom-4 left-5 text-sm font-semibold uppercase tracking-wider-plus text-white drop-shadow">Video tour</span>
      </button>
    );
  }
  return (
    <div className={frame}>
      <video className="h-full w-full object-contain" src={file} poster={poster} controls playsInline preload="metadata" aria-label="Video tour" onPlay={() => trackListingEvent("video_play", "gallery")} />
    </div>
  );
}

export default function Gallery() {
  const { listing } = useListingContext();
  const [activeIndex, setActiveIndex] = useState(null);
  const images = listing.images;

  const close = useCallback(() => setActiveIndex(null), []);
  const prev = useCallback(
    () => setActiveIndex((i) => (i - 1 + images.length) % images.length),
    [images.length]
  );
  const next = useCallback(
    () => setActiveIndex((i) => (i + 1) % images.length),
    [images.length]
  );

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, close, prev, next]);

  useEffect(() => {
    if (activeIndex === null) return;
    trackListingEvent("gallery_open");
    trackListingEvent("photo_view", activeIndex + 1);
  }, [activeIndex]);

  const video = listing.galleryVideo;
  const embed = listing.galleryEmbed;
  if (images.length === 0 && !video && !embed) return null;

  return (
    <section id="gallery" className="px-6 lg:px-10 py-24 bg-[var(--ls-bg-alt)]">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-accent)] mb-3">
          Gallery
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold mb-10 text-[var(--ls-text)]">Take a look inside</h2>

        {(video || embed) && <GalleryVideo file={video} embed={embed} poster={images[0]?.url} spaced={images.length > 0} />}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-[160px] sm:auto-rows-[200px]">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setActiveIndex(i)}
              className={`relative overflow-hidden rounded-xl group ${
                i === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <img
                src={img.url}
                alt={img.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <span className="absolute bottom-2 left-2 text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
                {img.caption}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center px-4"
          onClick={close}
        >
          <button
            className="absolute top-5 right-5 text-white/80 hover:text-white"
            onClick={close}
            aria-label="Close"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>

          <button
            className="absolute left-4 sm:left-8 text-white/70 hover:text-white p-2"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <figure onClick={(e) => e.stopPropagation()} className="max-w-4xl w-full">
            <img
              src={images[activeIndex].url}
              alt={images[activeIndex].alt}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
            <figcaption className="text-white/80 text-sm text-center mt-4">
              {images[activeIndex].caption ? `${images[activeIndex].caption} — ` : ""}{activeIndex + 1} / {images.length}
            </figcaption>
          </figure>

          <button
            className="absolute right-4 sm:right-8 text-white/70 hover:text-white p-2"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}

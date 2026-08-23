import { useEffect, useRef, useState } from "react";
import { useListingContext } from "../../context/ListingContext";
import { formatPrice } from "../../lib/format";

// How much scroll distance (in viewport heights) drives the video from
// its first frame to its last. Taller = slower/more deliberate scrub;
// shorter = faster. 3.5x the viewport reads as a deliberate, cinematic
// pace without asking for an excessive amount of scrolling.
const SCROLL_HEIGHT_VH = 350;

// Luxury template's hero: a tall pinned section where scrolling scrubs
// the hero video's playback position instead of just playing it. Classic
// Hero.jsx's video (see its own comment) autoplays/loops normally —
// this is a deliberately different, more involved effect for the luxury
// template specifically.
//
// Technique: a tall wrapper (SCROLL_HEIGHT_VH) with a `position: sticky`
// video pinned inside it. As the wrapper scrolls past the viewport, the
// scroll progress through it (0 to 1) is mapped directly onto
// video.currentTime. This is the same core technique behind most
// "Apple-style" scroll-driven product reveals.
//
// Two real limits worth knowing:
// - video.currentTime seeking isn't frame-accurate in every browser —
//   smoothness depends on the video being short and cut with frequent
//   keyframes (see supabase/... no, see the ffmpeg command used to
//   prepare the source file: -g 8, i.e. a keyframe at least every 8
//   frames, specifically so scrubbing doesn't have to decode far from
//   the last keyframe on every seek).
// - On touch devices, fast/jerky native momentum scrolling fights
//   precise seeking and tends to feel worse, not better — so touch
//   devices get a plain autoplay/loop instead, same graceful fallback
//   the classic template's own hero video already uses. prefers-
//   reduced-motion gets the same fallback, for the same reason motion
//   is skipped anywhere else in this app.
export default function LuxuryHero() {
  const { listing } = useListingContext();
  const video = listing.heroVideo;
  const poster = listing.images[0]?.url;
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [scrubbing, setScrubbing] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (reducedMotion || isTouch) {
      v.autoplay = true;
      v.loop = true;
      v.play().catch(() => {});
      return;
    }

    let rafId = null;
    let duration = 0;

    const onLoadedMetadata = () => {
      duration = v.duration || 0;
      setScrubbing(true);
      onScroll();
    };

    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const wrapper = wrapperRef.current;
        if (!wrapper || !duration) return;
        const rect = wrapper.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
        v.currentTime = progress * duration;
      });
    };

    v.addEventListener("loadedmetadata", onLoadedMetadata);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  return (
    <div ref={wrapperRef} style={{ height: video ? `${SCROLL_HEIGHT_VH}vh` : "100vh" }} className="relative">
      <section className="sticky top-0 h-screen w-full overflow-hidden">
        {video ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={video}
            poster={poster}
            muted
            playsInline
            preload="auto"
          />
        ) : (
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/55" />

        <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-24 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center rounded-full bg-[var(--ls-bg-alt)]/95 px-4 py-1.5 text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-text)]">
              {listing.status}
            </span>
            <span className="text-[var(--ls-on-dark)]/80 text-xs tracking-wider-plus uppercase">
              {listing.mlsNumber}
            </span>
          </div>

          <h1 className="text-[var(--ls-on-dark)] text-4xl sm:text-6xl lg:text-7xl font-semibold leading-[1.05] max-w-4xl">
            {listing.address.line1}
          </h1>
          <p className="text-[var(--ls-on-dark)]/85 text-lg sm:text-xl mt-4 tracking-wide">
            {listing.address.city}, {listing.address.state} {listing.address.zip}
          </p>

          <div className="mt-10 flex flex-wrap items-end gap-8">
            <span className="text-[var(--ls-on-dark)] text-3xl sm:text-5xl font-display font-semibold">
              {formatPrice(listing.price)}
            </span>
            <a
              href="#contact"
              className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[var(--ls-accent)] text-white hover:opacity-90 transition-opacity"
            >
              Schedule a Private Tour
            </a>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 text-[var(--ls-on-dark)]/70">
          <span className="text-[10px] tracking-wider-plus uppercase">
            {video && scrubbing ? "Scroll to explore" : "Scroll"}
          </span>
          <span className="h-8 w-px bg-[var(--ls-on-dark)]/40" />
        </div>
      </section>
    </div>
  );
}

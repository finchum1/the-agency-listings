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
// video pinned inside it. Scroll progress through the wrapper (0 to 1)
// drives video.currentTime — the same core technique behind most
// "Apple-style" scroll-driven product reveals, and the one
// github.com/oso95/scroll-world's own scrub-engine.js is built around
// (see its `raf()`/`loadClip()`). What's borrowed from there, adapted to
// a single real hero video instead of a multi-scene generated "world":
//
// - The video loads as a Blob (fetch → URL.createObjectURL), not a plain
//   `src`. A Blob is always instantly seekable end-to-end regardless of
//   whether the host serves byte-range requests, and — the part that
//   actually matters here — it removes any "seek ahead of what's been
//   buffered over the network" stall, which is exactly what made fast/
//   jerky touch scrolling feel bad before. Trade-off: the whole file
//   downloads before scrubbing can start (no progressive playback) — a
//   deliberate one, since this video is muted/never autoplaying, so
//   there's nothing progressive playback would have bought us anyway.
// - Scroll tracking and the actual seek are decoupled: the scroll
//   listener only records a 0–1 `target`; a persistent rAF loop lerps
//   toward it every frame (`cur += (target - cur) * 0.18`) and skips
//   entirely while `video.seeking` is still true, so a fast flick can't
//   queue up seeks faster than the decoder resolves them and freeze the
//   picture. That guard is what makes scrubbing on touch viable at all —
//   it no longer needs the plain autoplay/loop fallback touch devices
//   used to get here.
// - The seek epsilon is coarser on touch (20ms vs 8ms of video time) —
//   fewer redundant decodes per scroll tick, same reasoning scroll-
//   world's own isMobile() branch uses.
// - iOS needs a user gesture before a muted video will reliably paint a
//   seeked frame, so the first touch/pointer event "primes" it (a muted
//   play → immediate pause) — otherwise the first scrub can show a blank
//   frame.
//
// prefers-reduced-motion still gets the simple autoplay/loop fallback —
// the video never loads as a Blob at all in that case, so there's no
// scroll-driven motion or extra decode cost.
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
    if (reducedMotion) {
      v.src = video;
      v.autoplay = true;
      v.loop = true;
      v.play().catch(() => {});
      return;
    }

    const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    let objectUrl = null;
    let cancelled = false;
    let duration = 0;
    let target = 0;
    let cur = 0;
    let rafId = null;
    let userReady = false;

    const primeVideo = () => {
      if (!coarse || userReady) return;
      userReady = true;
      const p = v.play();
      if (p?.then) p.then(() => v.pause()).catch(() => {});
    };
    window.addEventListener("pointerdown", primeVideo, { once: true, passive: true });
    window.addEventListener("touchstart", primeVideo, { once: true, passive: true });

    const readScroll = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper || !duration) return;
      const rect = wrapper.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      target = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
    };

    const onLoadedMetadata = () => {
      duration = v.duration || 0;
      setScrubbing(true);
      readScroll();
    };

    // A persistent rAF loop, decoupled from the scroll event itself —
    // same shape as scroll-world's own raf(). eps is real video seconds,
    // not a fraction of duration.
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!duration || v.seeking) return;
      cur += (target - cur) * 0.18;
      const eps = coarse ? 0.02 : 0.008;
      const t = Math.min(0.999, Math.max(0, cur)) * duration;
      if (Math.abs(v.currentTime - t) > eps) {
        try {
          v.currentTime = t;
        } catch {
          /* seek rejected mid-decode — next tick will retry */
        }
      }
    };

    fetch(video)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("video fetch failed"))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        v.src = objectUrl;
      })
      .catch(() => {
        // CORS/network hiccup — fall back to the plain URL so the hero
        // still shows something playable, just without the Blob's
        // always-seekable guarantee.
        if (!cancelled) v.src = video;
      });

    v.addEventListener("loadedmetadata", onLoadedMetadata);
    window.addEventListener("scroll", readScroll, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      v.removeEventListener("loadedmetadata", onLoadedMetadata);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("pointerdown", primeVideo);
      window.removeEventListener("touchstart", primeVideo);
      if (rafId != null) cancelAnimationFrame(rafId);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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

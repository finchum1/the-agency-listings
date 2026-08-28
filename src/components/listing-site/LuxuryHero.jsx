import { useEffect, useRef, useState } from "react";
import { useListingContext } from "../../context/ListingContext";
import { formatPrice } from "../../lib/format";

// How much scroll distance (in viewport heights) drives the video from
// its first frame to its last. Taller = slower/more deliberate scrub;
// shorter = faster. 3.5x the viewport reads as a deliberate, cinematic
// pace without asking for an excessive amount of scrolling.
const SCROLL_HEIGHT_VH = 350;

// No-video fallback: how much scroll (in viewport heights) each curated
// photo gets before crossfading into the next — see
// HeroScrollPhotosManager.jsx. Independent of SCROLL_HEIGHT_VH so the
// total scroll distance scales naturally with how many photos are
// picked, rather than cramming more photos into a fixed budget.
const PHOTO_SCROLL_VH = 130;
const PHOTO_CROSSFADE_VH = 18;

// Luxury template's hero: a tall pinned section where scrolling scrubs
// through the property instead of just showing a static image. Three
// modes, in priority order:
//   1. A real hero video (listing.heroVideo) — scroll scrubs
//      video.currentTime. See the technique note further down.
//   2. No video, but a curated photo sequence (listing.heroScrollPhotos,
//      picked in HeroScrollPhotosManager.jsx) — scroll drives a Ken
//      Burns zoom through each photo in turn, crossfading at the seams.
//      Not every listing has a real walkthrough video, but every
//      listing already has photos — this gives those listings a real
//      scroll-driven hero too, just a shade less cinematic than video.
//   3. Neither — a single static photo, no scroll effect (today's
//      original fallback, unchanged).
//
// VIDEO MODE TECHNIQUE (mode 1)
// A tall wrapper (SCROLL_HEIGHT_VH) with a `position: sticky` video
// pinned inside it. Scroll progress through the wrapper (0 to 1) drives
// video.currentTime — the same core technique behind most "Apple-style"
// scroll-driven product reveals, and the one
// github.com/oso95/scroll-world's own scrub-engine.js is built around
// (see its `raf()`/`loadClip()`). What's borrowed from there:
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
//   picture. That guard is what makes scrubbing on touch viable — it no
//   longer needs a plain autoplay/loop fallback there.
// - The seek epsilon is coarser on touch (20ms vs 8ms of video time) —
//   fewer redundant decodes per scroll tick.
// - iOS needs a user gesture before a muted video will reliably paint a
//   seeked frame, so the first touch/pointer event "primes" it (a muted
//   play → immediate pause).
//
// PHOTO-SEQUENCE MODE TECHNIQUE (mode 2)
// Same segmented-scroll idea, simplified: each photo occupies its own
// PHOTO_SCROLL_VH slice of the wrapper. Per photo: opacity crossfades in
// over PHOTO_CROSSFADE_VH near its segment's edges (so consecutive
// photos dissolve into each other, not cut), and a subtle scale (1.0 →
// 1.12) drives a Ken Burns zoom across the segment's local progress.
// Plain CSS transform/opacity, no decode contention to guard against, so
// this stays a simple rAF-throttled scroll handler rather than the
// video path's lerp-and-seek-coalescing dance.
//
// prefers-reduced-motion skips motion in both modes 1 and 2 — video
// falls back to a plain autoplay/loop (no scroll-driven seeking, no
// Blob load), and the photo sequence just shows its first photo
// statically with no scroll-driven transform.
export default function LuxuryHero() {
  const { listing } = useListingContext();
  const video = listing.heroVideo;
  const sequencePhotos = !video && listing.heroScrollPhotos?.length > 1 ? listing.heroScrollPhotos : null;
  const poster = sequencePhotos ? sequencePhotos[0].url : listing.images[0]?.url;
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const sceneRefs = useRef([]);
  const [scrubbing, setScrubbing] = useState(false);

  // ---- mode 1: video scrub ----
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

  // ---- mode 2: photo-sequence scrub ----
  useEffect(() => {
    if (!sequencePhotos) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return; // first photo stays statically shown, no listeners needed

    let rafId = null;

    const read = () => {
      rafId = null;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const vh = window.innerHeight;
      const y = -wrapper.getBoundingClientRect().top;
      const segVh = (PHOTO_SCROLL_VH / 100) * vh;
      const fade = (PHOTO_CROSSFADE_VH / 100) * vh;

      sequencePhotos.forEach((_, i) => {
        const el = sceneRefs.current[i];
        if (!el) return;
        const start = i * segVh;
        const end = start + segVh;
        const local = Math.min(1, Math.max(0, (y - start) / segVh));
        let outside = 0;
        if (y < start) outside = start - y;
        else if (y > end) outside = y - end;
        const op = Math.min(1, Math.max(0, 1 - outside / fade));
        el.style.opacity = op;
        el.style.zIndex = op > 0.5 ? "20" : "10";
        el.style.transform = `scale(${(1 + local * 0.12).toFixed(3)})`;
      });

      setScrubbing(true);
    };

    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequencePhotos]);

  const wrapperHeightVh = video ? SCROLL_HEIGHT_VH : sequencePhotos ? sequencePhotos.length * PHOTO_SCROLL_VH : 100;

  return (
    <div ref={wrapperRef} style={{ height: `${wrapperHeightVh}vh` }} className="relative">
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
        ) : sequencePhotos ? (
          // `isolate` gives this stack its own stacking context, so the
          // scene images' own z-index juggling (which one's "on top"
          // during the crossfade) stays contained here and can never
          // leak out to paint over the gradient/text below, regardless
          // of the actual numbers used.
          <div className="absolute inset-0 isolate">
            {sequencePhotos.map((photo, i) => (
              <img
                key={photo.url}
                ref={(el) => (sceneRefs.current[i] = el)}
                src={photo.url}
                alt={photo.alt || ""}
                className="absolute inset-0 h-full w-full object-cover will-change-transform"
                style={{ opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 20 : 10 }}
              />
            ))}
          </div>
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
            {(video || sequencePhotos) && scrubbing ? "Scroll to explore" : "Scroll"}
          </span>
          <span className="h-8 w-px bg-[var(--ls-on-dark)]/40" />
        </div>
      </section>
    </div>
  );
}

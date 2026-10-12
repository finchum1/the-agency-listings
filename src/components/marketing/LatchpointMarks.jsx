// Latchpoint Studios' mark and wordmark, ported from that project's own
// src/components/logomark.tsx -- same paths, with var(--accent) swapped for
// the literal ember (#e8623f) since that CSS variable doesn't exist here.
// Used only by the Latchpoint-branded header/footer on
// theagency.latchpointstudios.com (see MarketingNav / MarketingFooter).

import { useId } from "react";
import "./logo-anim.css";

const EMBER = "#e8623f";

const RING =
  "M14.5 3.5 A6 6 0 0 1 20.5 9.5 V14.5 A6 6 0 0 1 14.5 20.5 H9.5 A6 6 0 0 1 3.5 14.5 V9.5 A6 6 0 0 1 9.5 3.5 H14.5";

// Plays the same full sequence as Latchpoint's own logo (chip flies off, outline
// redraws with a spark, chip swoops back and lands, glow, shockwaves, glint).
// Pure CSS keyframes from logo-anim.css, copied from the studio site's generated
// file; off under prefers-reduced-motion, where the mark just sits at rest.
export function LatchpointLogomark({ className = "" }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="2.5 1.2 20.3 20.3" fill="none" className={`${className} lp-logo-anim overflow-visible`} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor={EMBER} stopOpacity="0.85" />
          <stop offset="0.6" stopColor={EMBER} stopOpacity="0.3" />
          <stop offset="1" stopColor={EMBER} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-glint`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="-6" y="-6" width="36" height="36">
          <path d={RING} stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          <rect x="14.8" y="1.2" width="8" height="8" rx="2.7" fill="#fff" />
        </mask>
      </defs>
      <circle className="lp-glow" cx="18.8" cy="5.2" r="10" fill={`url(#${uid}-glow)`} />
      <rect className="lp-shock lp-shock-1" x="14.7" y="1.1" width="8.2" height="8.2" rx="1.4" stroke={EMBER} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <rect className="lp-shock lp-shock-2" x="14.7" y="1.1" width="8.2" height="8.2" rx="1.4" stroke={EMBER} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path className="lp-ring" d={RING} pathLength={1} strokeDasharray={1} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect className="lp-chip" x="14.8" y="1.2" width="8" height="8" rx="2.7" fill={EMBER} />
      <circle className="lp-spark" cx="0" cy="0" r="1.5" fill={EMBER} />
      <g mask={`url(#${uid}-mask)`}>
        <g transform="rotate(45 12 12)">
          <rect className="lp-glint" x="8.5" y="-12" width="7" height="48" fill={`url(#${uid}-glint)`} />
        </g>
      </g>
    </svg>
  );
}

// The "Studios" word steps aside on very narrow screens (below 440px) so the
// context tag next to it still fits inside the header pill.
export function LatchpointWordmark({ tag, inverse = false }) {
  const text = inverse ? "text-[#f5f5f4]" : "text-(--lp-text)";
  const muted = inverse ? "text-[#a4a5ac]" : "text-(--lp-text-muted)";
  return (
    <span className="inline-flex items-center gap-2 font-geist sm:gap-2.5">
      <LatchpointLogomark className={`size-6 ${text}`} />
      <span className={`font-medium tracking-tight ${text}`}>
        Latchpoint
        <span className={`hidden min-[440px]:inline ${muted}`}> Studios</span>
      </span>
      {tag && (
        <span
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 font-geist-mono text-[10px] uppercase tracking-[0.08em] min-[400px]:tracking-[0.12em] ${muted} ${
            inverse ? "border-white/16" : "border-(--lp-border-strong)"
          }`}
        >
          {tag}
        </span>
      )}
    </span>
  );
}

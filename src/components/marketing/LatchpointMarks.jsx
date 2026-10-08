// Latchpoint Studios' mark and wordmark, ported from that project's own
// src/components/logomark.tsx -- same paths, with var(--accent) swapped for
// the literal ember (#e8623f) since that CSS variable doesn't exist here.
// Used only by the Latchpoint-branded header/footer on
// theagency.latchpointstudios.com (see MarketingNav / MarketingFooter).

export function LatchpointLogomark({ className = "" }) {
  return (
    <svg viewBox="2.5 1.2 20.3 20.3" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="6" stroke="currentColor" strokeWidth="2" />
      <rect x="14.8" y="1.2" width="8" height="8" rx="2.7" fill="#e8623f" />
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

import { useEffect, useRef, useState } from "react";

// THE AGENCY, huge, resting on the very bottom of the footer (landing.footer_wordmark: "red" or "soft", set in Site Details; The Agency offices only).
// The letters are The Agency's own 2026 wordmark as vector shapes, so they stay sharp at any size. It runs edge to edge (it cancels the footer's side
// padding) and rises out of the bottom edge and fades in the first time it scrolls into view, then stays. Visitors who ask for less motion get it
// in place straight away.
const VIEW = "0 0 1649.4 219.3";
// The letters of The Agency's 2026 wordmark (the brand guide's own artwork: public/brand/the-agency-wordmark-red.svg), as its shapes.
const SHAPES = [["polygon", "1617 3.5 1564.5 97.3 1511.5 3.5 1473 3.5 1544.8 122.4 1544.8 215.5 1577.9 215.5 1577.9 122.4 1649.4 3.5 1617 3.5"], ["polygon", "1249.1 184.1 1161.9 3.5 1116.7 3.5 1116.7 215.5 1143.9 215.5 1143.9 36.6 1231.2 215.5 1276.3 215.5 1276.3 3.5 1249.1 3.5 1249.1 184.1"], ["polygon", "0 22.6 61.8 22.6 61.8 215.5 87.2 215.5 87.2 22.6 149 22.6 149 3.5 0 3.5 0 22.6"], ["polygon", "310.4 94.4 208.7 94.4 208.7 3.5 183.3 3.5 183.3 215.5 208.7 215.5 208.7 113.5 310.4 113.5 310.4 215.5 335.9 215.5 335.9 3.5 310.4 3.5 310.4 94.4"], ["polygon", "980.9 116.4 1073.4 116.4 1073.4 92.8 980.9 92.8 980.9 27.3 1076.2 27.3 1076.2 3.5 947.8 3.5 947.8 215.5 1077.5 215.5 1077.5 191.7 980.9 191.7 980.9 116.4"], ["path", "M1396.9,192c-34.6,0-53.4-29.6-53.4-84.6s18.1-80.4,58.2-80.4,28,1.6,48.6,6l5.4-23.8c-22.9-6.4-41.3-9.2-57.9-9.2-56.9,0-89.3,39.4-89.3,110.3s31.2,109,82.3,109,42.6-4.8,69.9-15.6l-7.3-22.9c-27.3,8-43.9,11.1-56.6,11.1Z"], ["path", "M873.6,186.6c-11.8,3.5-26.7,6.4-40.7,6.4s-30.5-5.7-39.7-18.5c-9.9-14-15.3-37.2-15.3-65.5,0-55.3,18.8-82,58.2-82s33.4,2.9,57.6,8.3l5.1-23.2c-28.6-8.6-48.6-11.8-65.8-11.8-57.5,0-90,38.8-90,109.7s30.8,109.4,83.6,109.4,45.5-5.1,78.5-18.4v-85.5h-31.5v71.2Z"], ["polygon", "406.3 113.8 500.4 113.8 500.4 94.7 406.3 94.7 406.3 22.6 502.9 22.6 502.9 3.5 380.8 3.5 380.8 215.5 504.5 215.5 504.5 196.4 406.3 196.4 406.3 113.8"], ["path", "M618.1,3.5l-74.7,212h29.9l18.4-53.7h87.4l18.8,53.7h35L655.9,3.5h-37.8ZM599.3,138.6l35.3-108.1,36.2,108.1h-71.5Z"]];

const TONES = {
  red: "#D8091B", // the logo's own red
  soft: "color-mix(in srgb, var(--as-on-dark) 12%, transparent)", // a ghosted watermark in the footer's text color
};

// `flush`: the wordmark sits outside any padded container (the marketing footer's), so it skips the negative side margins
// that cancel an agent-site footer's padding. `color` overrides the tone's fill.
export default function AgencyWordmark({ tone = "red", flush = false, color }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // overflow hidden: the name comes up out of the bottom edge of the page rather than sliding over the footer above it
    <div ref={ref} className={`${flush ? "" : "-mx-6 lg:-mx-10 "}mt-10 sm:mt-14 overflow-hidden`} style={{ paddingInline: "clamp(10px, 1.6vw, 28px)", lineHeight: 0 }} aria-hidden="true">
      <div
        style={{
          transform: shown ? "none" : "translateY(34%)",
          opacity: shown ? 1 : 0,
          transition: "transform 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <svg viewBox={VIEW} style={{ display: "block", width: "100%", height: "auto" }}>
          <g fill={color || TONES[tone] || TONES.red}>
            {SHAPES.map(([tag, d], i) => (tag === "polygon" ? <polygon key={i} points={d} /> : <path key={i} d={d} />))}
          </g>
        </svg>
      </div>
    </div>
  );
}

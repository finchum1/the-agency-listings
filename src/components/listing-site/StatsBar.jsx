import { useEffect, useRef, useState } from "react";
import { useListingContext } from "../../context/ListingContext";
import { formatNumber } from "../../lib/format";

const icons = {
  beds: (
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V9a2 2 0 0 1 2-2h3v5M9 7h6" />
  ),
  baths: (
    <path d="M4 12h16M6 12V6a2 2 0 0 1 2-2h1M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M9 18v2M15 18v2" />
  ),
  sqft: <path d="M4 4h7v7H4zM13 13h7v7h-7zM4 20h4M20 4h-4" />,
  lot: <path d="M4 20 20 4M4 4h6M4 4v6M14 20h6M20 20v-6" />,
  year: (
    <path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
  ),
  garage: <path d="M4 21V10l8-6 8 6v11M4 21h16M8 21v-6h8v6" />,
};

const stats = [
  { key: "beds", label: "Beds", value: (f) => f.beds ?? "—" },
  { key: "baths", label: "Baths", value: (f) => f.baths ?? "—" },
  { key: "sqft", label: "Sq Ft", value: (f) => formatNumber(f.sqft) },
  { key: "lot", label: "Lot Size", value: (f) => f.lotSize },
  { key: "year", label: "Year Built", value: (f) => f.yearBuilt },
  { key: "garage", label: "Garage", value: (f) => f.garage },
];

// Counts a number up to its value the first time it scrolls into view. The stat text is split into a leading part, the
// first number, and a trailing part ("0.75+ acres" -> "", 0.75, "+ acres"; "4-car" -> "", 4, "-car"), so the words and
// punctuation stay put and only the number moves. Text with no number in it (a dash) is shown as is. A year counts up
// from a few decades earlier instead of from zero. Reduced-motion visitors, and browsers without IntersectionObserver,
// just see the final value.
const COUNT_MS = 1200;
// A gentle ease-out (squared, not cubed) so the numbers climb steadily instead of racing up and then crawling.
const easeOut = (t) => 1 - Math.pow(1 - t, 2);

function CountUp({ text, year }) {
  const ref = useRef(null);
  const match = /^(\D*)(\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(String(text ?? ""));
  const [shown, setShown] = useState(null); // null = show the final text

  useEffect(() => {
    if (!match || !ref.current || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const target = parseFloat(match[2].replace(/,/g, ""));
    const decimals = (match[2].split(".")[1] || "").length;
    const commas = match[2].includes(",");
    const from = year ? target - 40 : 0;
    const fmt = (n) => (commas ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));
    let frame = 0;
    setShown(`${match[1]}${fmt(from)}${match[3]}`);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / COUNT_MS);
          setShown(t >= 1 ? null : `${match[1]}${fmt(from + (target - from) * easeOut(t))}${match[3]}`);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown ?? text}</span>
    </span>
  );
}

export default function StatsBar() {
  const { listing } = useListingContext();
  const f = listing.quickFacts;

  return (
    <section id="facts" className="relative z-20 -mt-14 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl bg-[var(--ls-bg-alt)] rounded-2xl shadow-xl shadow-black/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-black/5">
        {stats.map((s) => (
          <div key={s.key} className="flex flex-col items-center justify-center gap-2 py-7 px-4 text-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ls-accent)" strokeWidth="1.6">
              {icons[s.key]}
            </svg>
            <span className="text-lg font-semibold text-[var(--ls-text)]"><CountUp text={s.value(f)} year={s.key === "year"} /></span>
            <span className="text-[11px] uppercase tracking-wider-plus text-[var(--ls-text)]/50">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

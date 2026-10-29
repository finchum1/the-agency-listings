import { useEffect, useRef, useState } from "react";
import { FOOTER_OPTIONS, HEADER_OPTIONS, LAYOUT_OPTIONS, THEME_OPTIONS } from "../lib/sitePreview";

const FRAME_W = 1280; // the width each preview is laid out at, then scaled down to fit its card
const FRAME_H = 800;

// One live, scaled-down preview of the site. It only starts loading when it scrolls near the screen, and the page inside
// is the real site with ?preview_layout / ?preview_theme, so nothing is saved by looking.
function Frame({ src, title }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / FRAME_W));
    ro.observe(el);
    setScale(el.clientWidth / FRAME_W);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px" });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={box} className="relative w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/15 bg-[#f4f2ee]" style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}` }}>
      {near && <iframe title={title} src={src} loading="lazy" className="absolute left-0 top-0 border-0 bg-white" style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})`, transformOrigin: "top left" }} />}
    </div>
  );
}

// A labeled row of choices (header, footer), styled like the color row.
function ChipRow({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label={label}>
      <span className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mr-1 w-14">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            value === o.value ? "border-[#1c1a17] dark:border-[#faf9f7] bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]" : "border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Shows the same site in every layout (and in the chosen color theme) so someone can pick the one they like.
//   buildUrl(layout, theme, header, footer)  the address of that preview
//   current                  { layout, theme, header, footer } the site uses today (marked "Current")
//   action                   { label, onPick(layout, theme, header, footer), busy?, pickedLayout? }  the button on each card
// The header and footer start as the site's own and can be changed above the previews, like the colors.
export default function TemplateCompare({ buildUrl, current, action, intro }) {
  const [theme, setTheme] = useState(current?.theme || "classic");
  useEffect(() => setTheme(current?.theme || "classic"), [current?.theme]);
  const [header, setHeader] = useState(current?.header || "classic");
  useEffect(() => setHeader(current?.header || "classic"), [current?.header]);
  const [footer, setFooter] = useState(current?.footer || "classic");
  useEffect(() => setFooter(current?.footer || "classic"), [current?.footer]);

  return (
    <div>
      {intro}
      <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Color theme">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mr-1 w-14">Colors</span>
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            aria-pressed={theme === t.value}
            className={`flex items-center gap-2 rounded-full border pl-2 pr-3.5 py-1.5 text-sm font-medium transition-colors ${theme === t.value ? "border-[#1c1a17] dark:border-[#faf9f7] bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]" : "border-black/10 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30"}`}
          >
            <span className="flex">
              {t.swatches.map((c, i) => (
                <span key={i} className="h-4 w-4 rounded-full border border-black/10 -ml-1 first:ml-0" style={{ background: c }} />
              ))}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <ChipRow label="Header" options={HEADER_OPTIONS} value={header} onChange={setHeader} />
      <div className="mb-2"><ChipRow label="Footer" options={FOOTER_OPTIONS} value={footer} onChange={setFooter} /></div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {LAYOUT_OPTIONS.map((l) => {
          const isCurrent = current?.layout === l.value && current?.theme === theme && (current?.header || "classic") === header && (current?.footer || "classic") === footer;
          const picked = action?.pickedLayout === l.value;
          return (
            <section key={l.value} className={`rounded-2xl border p-4 bg-white dark:bg-[#1a1a1a] ${picked ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/25" : "border-black/10 dark:border-white/10"}`} aria-label={l.label}>
              <Frame src={buildUrl(l.value, theme, header, footer)} title={`${l.label} layout`} />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold">
                    {l.label}
                    {isCurrent && <span className="ml-2 align-middle rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Current</span>}
                  </h3>
                  <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55 mt-0.5 leading-snug">{l.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => action.onPick(l.value, theme, header, footer)}
                  disabled={action.busy || isCurrent}
                  className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2 disabled:opacity-50"
                >
                  {picked ? "Picked ✓" : isCurrent ? "In use" : action.label}
                </button>
                <a href={buildUrl(l.value, theme, header, footer)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  Open full size ↗
                </a>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

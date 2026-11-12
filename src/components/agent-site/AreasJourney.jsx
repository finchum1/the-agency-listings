import { useEffect, useMemo, useRef, useState } from "react";
import "./journey.css";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import useShowMore from "../../hooks/useShowMore";
import { MAP_HEIGHT, MAP_WIDTH } from "../../lib/areaMaps";
import ShowMoreButton from "./ShowMoreButton";
import SiteLink from "./SiteLink";

// The animated "Find Your Area" (landing.animated on, and at least three of the agent's areas have a place on the map: see lib/areaMaps.js).
// A picture of the metro with a pin for each area: the roads draw in and the pins drop when it scrolls into view, and pointing at a pin (or at an
// area's photo below) shows that area beside the map. It tours the areas by itself until the visitor touches it. The cards underneath are the same
// links the plain section has, so every area stays one click (and one crawl) away.
const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function AreasJourney({ pins, Heading }) {
  const { site } = useAgentSiteContext();
  const more = useShowMore(site.areas);
  const [active, setActive] = useState(pins[0].area.id);
  const [on, setOn] = useState(false);
  const [inView, setInView] = useState(false);
  const touched = useRef(false);
  const mapRef = useRef(null);
  const reduce = useMemo(prefersLessMotion, []);

  // Roads need their length to draw themselves in.
  useEffect(() => {
    mapRef.current?.querySelectorAll(".jn-draw").forEach((p) => p.style.setProperty("--len", p.getTotalLength()));
  }, []);

  // The map comes alive the first time it is mostly on screen; the tour only runs while it is on screen.
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return undefined;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setOn(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setOn(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  useEffect(() => {
    if (reduce || !on || !inView || touched.current) return undefined;
    const t = setInterval(() => {
      if (touched.current) return;
      setActive((cur) => {
        const i = pins.findIndex((p) => p.area.id === cur);
        return pins[(i + 1) % pins.length].area.id;
      });
    }, 3600);
    return () => clearInterval(t);
  }, [reduce, on, inView, pins]);

  const pick = (id) => {
    touched.current = true;
    setActive(id);
  };
  const hasPin = (id) => pins.some((p) => p.area.id === id);
  const current = pins.find((p) => p.area.id === active) || pins[0];
  const anchor = pins.find((p) => p.area.slug === "oklahoma-city") || pins[0];

  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3 text-center">Areas of Expertise</p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-center text-[var(--as-text)]">Find Your Area</Heading>

        <div className="jn-areas-grid">
          <div className="jn-feature text-[var(--as-text)]" aria-live="polite">
            <div className="jn-feature-ph">
              {pins.map((p) =>
                p.area.photo_url ? <img key={p.area.id} src={p.area.photo_url} alt="" loading="lazy" className={p.area.id === current.area.id ? "jn-show" : ""} /> : null,
              )}
            </div>
            <div className="flex flex-1 flex-col p-6 pb-7">
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-2">Area</p>
              <p className="font-display text-[28px] font-semibold leading-tight">{current.area.name}</p>
              {current.area.blurb && <p className="mt-2.5 text-[15.5px] leading-relaxed opacity-70 min-h-[4.8em]">{current.area.blurb}</p>}
              <div className="jn-dots" aria-hidden="true">
                {pins.map((p) => (
                  <i key={p.area.id} className={p.area.id === current.area.id ? "jn-on" : ""} />
                ))}
              </div>
              <SiteLink slug={site.slug} path={`/areas/${current.area.slug}`} className="mt-auto pt-5 text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">
                Explore {current.area.name} →
              </SiteLink>
            </div>
          </div>

          <div ref={mapRef} className={`jn-map ${on ? "jn-on" : ""}`}>
            <OkcBasemap />
            {pins.map((p) => {
              const d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
              return (
                <button
                  key={p.area.id}
                  type="button"
                  className={`jn-mp ${p.area.id === current.area.id ? "jn-active" : ""}`}
                  style={{ left: `${(p.x / MAP_WIDTH) * 100}%`, top: `${(p.y / MAP_HEIGHT) * 100}%`, "--d": `${(0.15 + (d / 900) * 0.9).toFixed(2)}s` }}
                  onMouseEnter={() => pick(p.area.id)}
                  onFocus={() => pick(p.area.id)}
                  onClick={() => pick(p.area.id)}
                  aria-label={p.area.name}
                  aria-pressed={p.area.id === current.area.id}
                >
                  <svg viewBox="0 0 24 30" aria-hidden="true">
                    <path d="M12 29C12 29 2 18.6 2 11.5a10 10 0 1 1 20 0C22 18.6 12 29 12 29z" style={{ fill: "var(--as-accent)" }} stroke="#fff" strokeWidth="2" />
                    <circle cx="12" cy="11.5" r="3.6" fill="#fff" />
                  </svg>
                  <span>{p.area.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {more.shown.map((area) => (
            <SiteLink
              key={area.id}
              slug={site.slug}
              path={`/areas/${area.slug}`}
              className={`jn-acard group relative block overflow-hidden bg-[var(--as-surface)] aspect-[4/3] ${area.id === current.area.id ? "jn-active" : ""}`}
              onMouseEnter={() => hasPin(area.id) && pick(area.id)}
              onFocus={() => hasPin(area.id) && pick(area.id)}
            >
              {area.photo_url && <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent flex flex-col items-center justify-end p-6 text-center">
                <p className="text-white font-display text-xl font-semibold">{area.name}</p>
                {area.blurb && <p className="text-white/75 text-sm mt-1 max-w-xs">{area.blurb}</p>}
              </div>
            </SiteLink>
          ))}
        </div>
        <ShowMoreButton more={more} />
      </div>
    </section>
  );
}

/** The Oklahoma City metro, drawn: the three interstates, Route 66 through Edmond, two lakes and the Canadian River. Illustrative, not to scale. */
function OkcBasemap() {
  return (
    <svg className="jn-base" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="jn-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path className="jn-grid-line" d="M50 0H0V50" />
        </pattern>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#jn-grid)" />
      <ellipse className="jn-water" cx="392" cy="392" rx="40" ry="20" transform="rotate(-18 392 392)" />
      <ellipse className="jn-water" cx="318" cy="470" rx="24" ry="12" transform="rotate(10 318 470)" />
      <path className="jn-water" d="M0 628 C120 600 220 650 340 626 S560 600 700 632 S900 640 1000 610 L1000 660 C900 690 780 676 680 676 S470 650 340 676 S110 690 0 670Z" />
      {[
        "M548 720 L538 500 L525 452 L548 300 L572 150 L586 0",
        "M0 506 L520 470 L1000 440",
        "M170 660 L360 540 L525 452 L720 330 L1000 190",
      ].map((d) => (
        <g key={d}>
          <path className="jn-rd jn-case jn-draw" d={d} />
          <path className="jn-rd jn-core jn-draw" d={d} />
        </g>
      ))}
      <path className="jn-rd jn-r66 jn-draw" d="M330 268 L470 252 L560 214 L660 190 L760 200 L1000 230" />
      <text className="jn-lbl" x="598" y="64">I-35</text>
      <text className="jn-lbl" x="880" y="428">I-40</text>
      <text className="jn-lbl" x="820" y="236" transform="rotate(-24 820 236)">I-44</text>
      <text className="jn-lbl" x="790" y="188" style={{ fill: "var(--as-accent)", opacity: 0.7 }}>Route 66</text>
      <text className="jn-lbl" x="400" y="642" style={{ fill: "#8fb0b5" }}>Canadian River</text>
      <g transform="translate(940 60)">
        <circle r="20" style={{ fill: "var(--as-bg-alt)" }} stroke="rgba(0,0,0,.1)" />
        <path d="M0 -13 L5 4 L0 1 L-5 4Z" style={{ fill: "var(--as-text)" }} />
      </g>
    </svg>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import "./journey.css";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import useShowMore from "../../hooks/useShowMore";
import { MAP_HEIGHT, MAP_WIDTH, anchorPin } from "../../lib/areaMaps";
import Basemap, { PinIcon } from "./AreaBasemaps";
import ShowMoreButton from "./ShowMoreButton";
import SiteLink from "./SiteLink";

// The animated "Find Your Area" (landing.animated on, and at least three of the agent's areas have a place on the map: see lib/areaMaps.js).
// A picture of the metro with a pin for each area: the roads draw in and the pins drop when it scrolls into view, and pointing at a pin (or at an
// area's photo below) shows that area beside the map. It tours the areas by itself until the visitor touches it, and the visitor can move through them with
// the arrows (wide screens) or by swiping a row of area cards under the map (phones, where the photo panel and the map wouldn't fit on screen together). The
// cards underneath are the same links the plain section has, so every area stays one click (and one crawl) away.
const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// `pins`: [{ area, x, y }] (lib/areaMaps.js). The section's own look comes from the template that renders it: `header` (its eyebrow and heading),
// `sectionClass` / `innerClass` / `gridClass` (its spacing, background and card grid) and `renderCard(area, index, sync)` (its area card, which spreads `sync`
// onto the link so hovering a card shows that area on the map). `base` picks the drawing under the pins.
export default function AreasJourney({ pins, base = "okc", header, sectionClass, innerClass = "mx-auto max-w-7xl", gridClass = "mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6", renderCard }) {
  const { site } = useAgentSiteContext();
  const more = useShowMore(site.areas);
  const [active, setActive] = useState(pins[0].area.id);
  const [on, setOn] = useState(false);
  const [inView, setInView] = useState(false);
  const touched = useRef(false);
  const mapRef = useRef(null);
  const secRef = useRef(null);
  const railRef = useRef(null);
  const railTimer = useRef(0);
  const fromRail = useRef(false);
  const programmatic = useRef(false);
  const reduce = useMemo(prefersLessMotion, []);

  // Roads need their length to draw themselves in.
  useEffect(() => {
    mapRef.current?.querySelectorAll(".jn-draw").forEach((p) => p.style.setProperty("--len", p.getTotalLength()));
  }, []);

  // The connector: when this section sits directly under the animated cards, the route carries on from the last card's pin, down the margin and into
  // the map, drawn as the visitor scrolls (and only once the cards' own route has finished). Where it lands, the map comes alive.
  const anchorSlug = anchorPin(pins).area.slug;
  useEffect(() => {
    const sec = secRef.current;
    const mapEl = mapRef.current;
    const row = sec?.previousElementSibling?.querySelector(".jn-row");
    if (!sec || !mapEl || !row) return undefined;
    const a = pins.find((p) => p.area.slug === anchorSlug);
    const ghosts = sec.querySelector(".jn-link .jn-ghosts");
    const lives = sec.querySelector(".jn-link .jn-lives");
    const head = sec.querySelector(".jn-link .jn-head");
    const svg = sec.querySelector(".jn-link");
    const NS = "http://www.w3.org/2000/svg";
    let segs = [];
    let cum = [0];
    let total = 0;
    let topY = 0;
    let botY = 0;
    const build = () => {
      const sr = sec.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      const mr = mapEl.getBoundingClientRect();
      const items = row.querySelectorAll(".jn-item");
      const last = items[items.length - 1];
      const wide = row.classList.contains("jn-wide");
      const P = wide
        ? { x: rr.left - sr.left + last.offsetLeft + last.offsetWidth / 2, y: rr.top - sr.top + last.offsetTop - 43 }
        : { x: rr.left - sr.left + last.offsetLeft - 25, y: rr.top - sr.top + last.offsetTop + 41 };
      const A = { x: mr.left - sr.left + (a.x / MAP_WIDTH) * mr.width, y: mr.top - sr.top + (a.y / MAP_HEIGHT) * mr.height - 24 };
      const mapTop = mr.top - sr.top;
      const d = [];
      let from = P;
      if (wide) {
        const rx = Math.min(sr.width - 22, rr.right - sr.left + 46);
        const E1 = { x: rx, y: P.y + 50 };
        d.push(`M${P.x} ${P.y} C${P.x + (E1.x - P.x) * 0.55} ${P.y} ${E1.x} ${P.y + 10} ${E1.x} ${E1.y}`);
        from = { x: rx, y: mapTop - 30 };
        d.push(`M${E1.x} ${E1.y} L${from.x} ${from.y}`);
      } else {
        // On a phone the cards' route runs down the left margin, where this section's content starts: cross over in the gap between the two and
        // carry on down the right margin instead, so it never runs along the edge of the photo or the map.
        const rx = sr.width - 12;
        const E0 = { x: P.x, y: 36 };
        const E1 = { x: rx, y: 120 };
        d.push(`M${P.x} ${P.y} L${E0.x} ${E0.y}`);
        d.push(`M${E0.x} ${E0.y} C${E0.x} ${E0.y + 45} ${E1.x} ${E1.y - 45} ${E1.x} ${E1.y}`);
        from = { x: rx, y: mapTop - 20 };
        d.push(`M${E1.x} ${E1.y} L${from.x} ${from.y}`);
      }
      const dy = A.y - from.y;
      d.push(`M${from.x} ${from.y} C${from.x} ${from.y + dy * 0.5} ${A.x} ${A.y - dy * 0.5} ${A.x} ${A.y}`);
      svg.setAttribute("viewBox", `0 0 ${sr.width} ${sr.height}`);
      ghosts.innerHTML = "";
      lives.innerHTML = "";
      segs = [];
      cum = [0];
      total = 0;
      for (const path of d) {
        const g = document.createElementNS(NS, "path");
        g.setAttribute("d", path);
        g.setAttribute("class", "jn-ghost");
        ghosts.appendChild(g);
        const l = document.createElementNS(NS, "path");
        l.setAttribute("d", path);
        l.setAttribute("class", "jn-live");
        lives.appendChild(l);
        const len = l.getTotalLength();
        l.style.strokeDasharray = len;
        l.style.strokeDashoffset = len;
        segs.push({ el: l, len });
        total += len;
        cum.push(total);
      }
      const base = window.scrollY + sr.top;
      topY = base + P.y;
      botY = base + A.y;
      update();
    };
    const update = () => {
      let p = 1;
      if (!reduce) {
        p = (window.scrollY + window.innerHeight * 0.72 - topY) / Math.max(1, botY - topY);
        p = row.classList.contains("jn-done") ? Math.max(0, Math.min(1, p)) : 0;
      }
      const drawn = p * total;
      segs.forEach((s, k) => {
        s.el.style.strokeDashoffset = s.len - Math.max(0, Math.min(s.len, drawn - cum[k]));
      });
      let k = segs.findIndex((_, i) => drawn <= cum[i + 1]);
      if (k < 0) k = segs.length - 1;
      const pt = segs[k].el.getPointAtLength(Math.max(0, Math.min(segs[k].len, drawn - cum[k])));
      head.setAttribute("cx", pt.x);
      head.setAttribute("cy", pt.y);
      head.style.opacity = p > 0 && p < 1 ? 1 : 0;
      if (p >= 0.985) setOn(true);
    };
    build();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("jn-route", update);
    const ro = new ResizeObserver(build);
    ro.observe(sec);
    ro.observe(row);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("jn-route", update);
      ro.disconnect();
    };
  }, [reduce, anchorSlug, pins]);

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
  const index = Math.max(0, pins.findIndex((p) => p.area.id === active));
  const step = (d) => pick(pins[(index + d + pins.length) % pins.length].area.id);
  const hasPin = (id) => pins.some((p) => p.area.id === id);

  // Phones: the swipeable row under the map follows the highlighted area (a pin tap, the tour), and swiping it changes the highlighted pin.
  useEffect(() => {
    if (fromRail.current) {
      fromRail.current = false;
      return;
    }
    const rail = railRef.current;
    const card = rail?.children[index];
    if (!rail || !card || rail.offsetParent === null) return;
    programmatic.current = true;
    rail.scrollTo({ left: card.offsetLeft - rail.firstElementChild.offsetLeft, behavior: reduce ? "auto" : "smooth" });
    clearTimeout(railTimer.current);
    railTimer.current = setTimeout(() => (programmatic.current = false), 700);
  }, [index, reduce]);
  useEffect(() => () => clearTimeout(railTimer.current), []);
  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    if (programmatic.current) {
      clearTimeout(railTimer.current);
      railTimer.current = setTimeout(() => (programmatic.current = false), 150);
      return;
    }
    touched.current = true;
    const first = rail.firstElementChild;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 12;
    const i = Math.max(0, Math.min(pins.length - 1, Math.round(rail.scrollLeft / (first.offsetWidth + gap))));
    if (pins[i].area.id !== active) {
      fromRail.current = true;
      setActive(pins[i].area.id);
    }
  };
  const onRailTouch = () => {
    touched.current = true;
    programmatic.current = false;
  };
  const current = pins.find((p) => p.area.id === active) || pins[0];
  const anchor = anchorPin(pins);
  const allPinned = site.areas.every((a) => hasPin(a.id));
  const sync = (area) => ({
    className: `jn-acard ${hasPin(area.id) ? "jn-pinned" : ""} ${area.id === current.area.id ? "jn-active" : ""}`,
    onMouseEnter: () => hasPin(area.id) && pick(area.id),
    onFocus: () => hasPin(area.id) && pick(area.id),
  });

  return (
    <section ref={secRef} id="areas" className={`relative ${sectionClass}`}>
      <svg className="jn-route jn-link" aria-hidden="true">
        <g className="jn-ghosts" />
        <g className="jn-lives" />
        <circle className="jn-head" r="6" cx="-20" cy="-20" style={{ opacity: 0 }} />
      </svg>
      <div className={innerClass}>
        {header}

        <div
          className="jn-areas-grid"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              if (e.target.closest?.(".jn-rail")) return;
              e.preventDefault();
              step(e.key === "ArrowRight" ? 1 : -1);
            }
          }}
        >
          <div className="jn-feature text-[var(--as-text)]" aria-live="polite">
            <div className="jn-feature-ph">
              {pins.map((p) =>
                p.area.photo_url ? <img key={p.area.id} src={p.area.photo_url} alt="" loading="lazy" className={p.area.id === current.area.id ? "jn-show" : ""} /> : null,
              )}
              <div className="jn-arrows">
                <button type="button" onClick={() => step(-1)} aria-label="Previous area">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Next area">
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6 pb-7">
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-2">Area</p>
              <p className="font-display text-[28px] font-semibold leading-tight">{current.area.name}</p>
              {current.area.blurb && <p className="mt-2.5 text-[15.5px] leading-relaxed opacity-70 min-h-[4.8em]">{current.area.blurb}</p>}
              <div className="jn-dots">
                {pins.map((p) => (
                  <button key={p.area.id} type="button" onClick={() => pick(p.area.id)} aria-label={`Show ${p.area.name}`} className={p.area.id === current.area.id ? "jn-on" : ""} />
                ))}
              </div>
              <SiteLink slug={site.slug} path={`/areas/${current.area.slug}`} className="mt-auto pt-5 text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">
                Explore {current.area.name} →
              </SiteLink>
            </div>
          </div>

          <div ref={mapRef} className={`jn-map ${on ? "jn-on" : ""}`}>
            <Basemap base={base} />
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
                  <PinIcon />
                  <span>{p.area.name}</span>
                </button>
              );
            })}
          </div>

          <div className="jn-rail-wrap">
            <div ref={railRef} className="jn-rail" onScroll={onRailScroll} onTouchStart={onRailTouch} onPointerDown={onRailTouch}>
              {pins.map((p) => (
                <SiteLink
                  key={p.area.id}
                  slug={site.slug}
                  path={`/areas/${p.area.slug}`}
                  className={`jn-rail-card text-[var(--as-text)] ${p.area.id === current.area.id ? "jn-active" : ""}`}
                >
                  <span className="jn-rail-ph">{p.area.photo_url && <img src={p.area.photo_url} alt="" loading="lazy" />}</span>
                  <span className="jn-rail-tx">
                    <span className="jn-rail-name font-display">{p.area.name}</span>
                    {p.area.blurb && <span className="jn-rail-blurb">{p.area.blurb}</span>}
                    <span className="jn-rail-go">Explore →</span>
                  </span>
                </SiteLink>
              ))}
            </div>
            <p className="jn-rail-hint" aria-live="polite">
              Swipe to browse · {index + 1} of {pins.length}
            </p>
          </div>
        </div>

        <div className={`${gridClass} ${allPinned ? "jn-narrow-hide" : ""}`}>{more.shown.map((area, i) => renderCard(area, i, sync(area)))}</div>
        <div className={allPinned ? "jn-narrow-hide" : ""}>
          <ShowMoreButton more={more} />
        </div>
      </div>
    </section>
  );
}

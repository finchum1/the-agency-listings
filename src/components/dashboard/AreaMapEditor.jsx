import { useEffect, useRef, useState } from "react";
import "../agent-site/journey.css";
import Basemap, { PinIcon } from "../agent-site/AreaBasemaps";
import { MAP_HEIGHT, MAP_WIDTH, areaPosition, resolveMap } from "../../lib/areaMaps";

const selectClass =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const clamp = (n, max) => Math.max(0, Math.min(max, Math.round(n)));

// Where each area sits on the animated "Find Your Area" map (agent_sites.landing.map, see lib/areaMaps.js): pick the drawing, drag a pin to where the area is,
// and add or take off pins. `value` is landing.map; `onChange` gets the whole new map settings. The map only shows on the site with at least three pins.
export default function AreaMapEditor({ areas, value, onChange }) {
  const { base, pins } = resolveMap(value);
  const boxRef = useRef(null);
  const drag = useRef(null);
  const [selected, setSelected] = useState(null);
  const save = (next) => onChange({ base, pins, ...next });
  const place = (slug, x, y) => save({ pins: { ...pins, [slug]: { x: clamp(x, MAP_WIDTH), y: clamp(y, MAP_HEIGHT) } } });

  // The roads in the drawing draw themselves in on the site; here they just need to be there.
  useEffect(() => {
    boxRef.current?.querySelectorAll(".jn-draw").forEach((p) => p.style.setProperty("--len", p.getTotalLength()));
  }, [base]);

  const placed = areas.map((area) => ({ area, pos: areaPosition(area, { base, pins }) })).filter((p) => p.pos);
  const unplaced = areas.filter((area) => !areaPosition(area, { base, pins }));

  const toMap = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * MAP_WIDTH, y: ((e.clientY - r.top) / r.height) * MAP_HEIGHT };
  };
  const onDown = (e, slug) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = slug;
    setSelected(slug);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const { x, y } = toMap(e);
    place(drag.current, x, y);
  };
  const onUp = () => {
    drag.current = null;
  };
  const nudge = (e, slug, pos) => {
    const step = e.shiftKey ? 40 : 10;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    place(slug, pos.x + d[0], pos.y + d[1]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Area map</span>
        <select value={base} onChange={(e) => save({ base: e.target.value })} className={selectClass} aria-label="Map drawing">
          <option value="okc">Oklahoma City metro</option>
          <option value="plain">Plain map (any other city)</option>
        </select>
        {base === "okc" && Object.keys(pins).length > 0 && (
          <button type="button" onClick={() => onChange({ base, pins: {} })} className="text-xs text-[#ed2127] dark:text-[#f2454b] hover:underline">
            Reset pins to the defaults
          </button>
        )}
      </div>
      <p className={`text-xs ${muted}`}>
        Drag a pin to where the area is (arrow keys nudge a selected pin). The drawing is an illustration, so close is good enough. The map shows on your site once at
        least three areas are on it.
      </p>

      <div
        ref={boxRef}
        className="jn-map jn-on !overflow-hidden select-none"
        style={{ "--as-bg-alt": "#ffffff", "--as-bg": "#faf9f7", "--as-text": "#1c1a17", "--as-accent": "#ed2127", touchAction: "none" }}
      >
        <Basemap base={base} />
        {placed.map(({ area, pos }) => (
          <button
            key={area.id}
            type="button"
            className={`jn-mp ${selected === area.slug ? "jn-active" : ""}`}
            style={{ left: `${(pos.x / MAP_WIDTH) * 100}%`, top: `${(pos.y / MAP_HEIGHT) * 100}%`, cursor: "grab", touchAction: "none" }}
            onPointerDown={(e) => onDown(e, area.slug)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onFocus={() => setSelected(area.slug)}
            onKeyDown={(e) => nudge(e, area.slug, pos)}
            aria-label={`${area.name} on the map. Drag, or use the arrow keys.`}
          >
            <PinIcon />
            <span>{area.name}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {selected && placed.some((p) => p.area.slug === selected) && (
          <button type="button" onClick={() => { save({ pins: { ...pins, [selected]: false } }); setSelected(null); }} className="rounded-full border border-black/15 dark:border-white/20 px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10">
            Take {placed.find((p) => p.area.slug === selected)?.area.name} off the map
          </button>
        )}
        {unplaced.length > 0 && <span className={muted}>Not on the map:</span>}
        {unplaced.map((area) => (
          <button
            key={area.id}
            type="button"
            onClick={() => {
              place(area.slug, MAP_WIDTH / 2, MAP_HEIGHT / 2);
              setSelected(area.slug);
            }}
            className="rounded-full border border-dashed border-black/25 dark:border-white/30 px-3 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            + {area.name}
          </button>
        ))}
        {placed.length < 3 && <span className="text-[#ed2127] dark:text-[#f2454b]">Only {placed.length} on the map. Add at least {3 - placed.length} more for it to show on your site.</span>}
      </div>
    </div>
  );
}

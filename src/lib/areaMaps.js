// Where each area sits on the illustrative metro map shown above an agent's areas (the animated "Find Your Area", see AreasJourney.jsx).
// Positions are in a 1000 x 720 drawing, matched to an area by its slug. The map is a picture of the metro, not a survey: close enough that an
// out-of-town buyer can see which way is north of downtown, not exact. An area with no entry here simply has no pin (it still shows as a card).
// Only the Oklahoma City metro exists so far; another metro adds its own entry and its own drawing.

export const OKC_AREAS = {
  "oklahoma-city": { x: 520, y: 452 },
  edmond: { x: 560, y: 214 },
  arcadia: { x: 668, y: 190 },
  "deer-creek": { x: 432, y: 262 },
  piedmont: { x: 296, y: 236 },
  jones: { x: 776, y: 352 },
  "nichols-hills": { x: 470, y: 392 },
  yukon: { x: 278, y: 384 },
  mustang: { x: 262, y: 540 },
  moore: { x: 520, y: 590 },
  bethany: { x: 380, y: 440 },
  "warr-acres": { x: 410, y: 420 },
  "the-village": { x: 450, y: 356 },
  "midwest-city": { x: 650, y: 470 },
  "del-city": { x: 600, y: 505 },
  choctaw: { x: 790, y: 462 },
  guthrie: { x: 600, y: 70 },
  "el-reno": { x: 130, y: 440 },
  newcastle: { x: 410, y: 640 },
};

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 720;

// The agent's own map settings (agent_sites.landing.map): { base: "okc" | "plain", pins: { [areaSlug]: { x, y } | false } }.
//   base "okc"   the Oklahoma City metro drawing, with the default positions above (the agent can move any pin, or take one off with `false`)
//   base "plain" a neutral map for any other city: only the pins the agent has placed
export function resolveMap(config) {
  const c = config && typeof config === "object" ? config : {};
  const pins = c.pins && typeof c.pins === "object" ? c.pins : {};
  return { base: c.base === "plain" ? "plain" : "okc", pins };
}

const inRange = (n, max) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;

/** Where one area sits on the map, or null when it has no pin. */
export function areaPosition(area, config) {
  const { base, pins } = resolveMap(config);
  const own = pins[area.slug];
  if (own === false) return null;
  if (own && inRange(own.x, MAP_WIDTH) && inRange(own.y, MAP_HEIGHT)) return { x: own.x, y: own.y };
  return base === "okc" ? OKC_AREAS[area.slug] || null : null;
}

/** The areas that have a place on the map: [{ area, x, y }], or null when fewer than three do (a map of one or two dots isn't worth drawing). */
export function mapPins(areas, config) {
  const pins = (areas || []).map((area) => ({ area, pos: areaPosition(area, config) })).filter((p) => p.pos).map((p) => ({ area: p.area, x: p.pos.x, y: p.pos.y }));
  return pins.length >= 3 ? pins : null;
}

/** The pins for a site's animated areas map, or null when the animation is off or there aren't enough pins. */
export function journeyPins(site) {
  return site?.landing?.animated === true ? mapPins(site.areas, site.landing.map) : null;
}

/** The pin that anchors the route into the map: Oklahoma City on the OKC map, otherwise the pin nearest the middle of all of them. */
export function anchorPin(pins) {
  const okc = pins.find((p) => p.area.slug === "oklahoma-city");
  if (okc) return okc;
  const cx = pins.reduce((n, p) => n + p.x, 0) / pins.length;
  const cy = pins.reduce((n, p) => n + p.y, 0) / pins.length;
  return pins.reduce((best, p) => (Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best), pins[0]);
}

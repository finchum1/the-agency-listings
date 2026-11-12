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

/** The areas that have a place on the map: [{ area, x, y }], or null when fewer than three do (a map of one or two dots isn't worth drawing). */
export function mapPins(areas) {
  const pins = (areas || []).map((area) => ({ area, ...(OKC_AREAS[area.slug] || {}) })).filter((p) => typeof p.x === "number");
  return pins.length >= 3 ? pins : null;
}

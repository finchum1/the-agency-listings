import "./scope.css";
import "./orbit.css";

// A node that travels around the border of the card it sits in, with the border lighting up behind it like an outline
// being drawn: the same node as the hero map. Put it inside an element that is `relative` with the class `orbit-wrap`
// (not inside one with `overflow: hidden`, so the glow isn't clipped at the edge), as a sibling of the card.
// `radius` matches the card's corner radius in px; `duration` is seconds per lap (give wider cards longer laps so every
// node moves at about the same speed); `delay` (negative) offsets the start so the cards never move in step.

/** Lengths (percent of the border) of the stacked trail dashes, longest first. */
const TRAIL = [44, 33, 23, 14, 7];

export default function OrbitNode({ radius = 16, duration = 12, delay = 0 }) {
  return (
    <svg className="orbit" style={{ "--dur": `${duration}s`, "--delay": `${delay}s` }} aria-hidden="true">
      {TRAIL.map((len) => (
        <rect key={len} className="orbit-trail" rx={radius} pathLength={100} strokeDasharray={`0 ${100 - len} ${len} 0`} />
      ))}
      <rect className="orbit-near" rx={radius} pathLength={100} />
      <rect className="orbit-head" rx={radius} pathLength={100} />
    </svg>
  );
}

import { MAP_HEIGHT, MAP_WIDTH } from "../../lib/areaMaps";

// The drawings under the area pins. Colors come from the site theme (--as-*), so they follow whichever template the agent chose. Illustrative, not to scale.

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 30" aria-hidden="true">
      <path d="M12 29C12 29 2 18.6 2 11.5a10 10 0 1 1 20 0C22 18.6 12 29 12 29z" style={{ fill: "var(--as-accent)" }} stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="11.5" r="3.6" fill="#fff" />
    </svg>
  );
}

export default function Basemap({ base }) {
  return base === "plain" ? <PlainBasemap /> : <OkcBasemap />;
}

function Frame({ children }) {
  return (
    <svg className="jn-base" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="jn-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path className="jn-grid-line" d="M50 0H0V50" />
        </pattern>
      </defs>
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#jn-grid)" />
      {children}
      <g transform="translate(940 60)">
        <circle r="20" style={{ fill: "var(--as-bg-alt)" }} stroke="rgba(0,0,0,.1)" />
        <path d="M0 -13 L5 4 L0 1 L-5 4Z" style={{ fill: "var(--as-text)" }} />
      </g>
    </svg>
  );
}

function Roads({ paths, r66 }) {
  return (
    <>
      {paths.map((d) => (
        <g key={d}>
          <path className="jn-rd jn-case jn-draw" d={d} />
          <path className="jn-rd jn-core jn-draw" d={d} />
        </g>
      ))}
      {r66 && <path className="jn-rd jn-r66 jn-draw" d={r66} />}
    </>
  );
}

/** The Oklahoma City metro: the three interstates, Route 66 through Edmond, two lakes and the Canadian River. */
export function OkcBasemap() {
  return (
    <Frame>
      <ellipse className="jn-water" cx="392" cy="392" rx="40" ry="20" transform="rotate(-18 392 392)" />
      <ellipse className="jn-water" cx="318" cy="470" rx="24" ry="12" transform="rotate(10 318 470)" />
      <path className="jn-water" d="M0 628 C120 600 220 650 340 626 S560 600 700 632 S900 640 1000 610 L1000 660 C900 690 780 676 680 676 S470 650 340 676 S110 690 0 670Z" />
      <Roads
        paths={["M548 720 L538 500 L525 452 L548 300 L572 150 L586 0", "M0 506 L520 470 L1000 440", "M170 660 L360 540 L525 452 L720 330 L1000 190"]}
        r66="M330 268 L470 252 L560 214 L660 190 L760 200 L1000 230"
      />
      <text className="jn-lbl" x="598" y="64">I-35</text>
      <text className="jn-lbl" x="880" y="428">I-40</text>
      <text className="jn-lbl" x="820" y="236" transform="rotate(-24 820 236)">I-44</text>
      <text className="jn-lbl" x="790" y="188" style={{ fill: "var(--as-accent)", opacity: 0.7 }}>Route 66</text>
      <text className="jn-lbl" x="400" y="642" style={{ fill: "#8fb0b5" }}>Canadian River</text>
    </Frame>
  );
}

/** A neutral map for any other city: a couple of crossing roads, a river and a lake, so the pins read as places on a map without claiming to be a real one. */
export function PlainBasemap() {
  return (
    <Frame>
      <path className="jn-water" d="M0 560 C140 520 230 600 380 570 S600 500 740 540 S920 600 1000 560 L1000 610 C900 650 780 590 700 590 S470 640 360 620 S120 570 0 610Z" />
      <ellipse className="jn-water" cx="760" cy="200" rx="64" ry="32" transform="rotate(-14 760 200)" />
      <Roads paths={["M0 380 C240 360 420 400 1000 340", "M300 0 C320 200 280 420 340 720", "M80 720 C300 520 520 400 1000 120"]} />
    </Frame>
  );
}

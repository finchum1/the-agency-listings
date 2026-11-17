import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import "./scope.css";
import "./brain.css";

// A second-brain map: a centre, a ring of discs (the parts of the product) and an outer ring of pills (what you get out
// of them), joined by lines that carry pulses. Hover or focus a node and the nodes it connects to light up, with one
// caption explaining it. Ported from the Latchpoint Studios site, where it is the homepage hero; all of the content is
// passed in (see AgencyBrain.jsx). Must sit inside an element with the `ag-fx` class, which supplies the colours.
//
// config: {
//   ariaLabel, centre: { label, mark, info },
//   caps:  [{ id, label, blurb, at: [x, y], Icon, above? }],
//   items: [{ id, label, title?, blurb, at: [x, y], uses: [capId], href?, external? }],
//   capTag(cap, itemsUsingIt), itemTag, itemCta?(item),
//   idea?: { at, label, ariaLabel, href, info },
//   defaultInfo,
// }   info = { title, blurb, tag?, href?, cta? }

const W = 600;
const H = 560;
const CENTER = [300, 280];

const pct = (v, total) => `${(v / total) * 100}%`;

// A little scatter of drifting dust behind everything. Rounded so the server and the browser agree on every digit.
const dust = Array.from({ length: 22 }, (_, i) => {
  const s = (n) => Math.round(Math.abs(Math.sin(i * 12.9898 + n * 78.233)) * 1000) / 1000;
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    x: r2(20 + s(1) * 560),
    y: r2(20 + s(2) * 520),
    r: r2(1 + s(3) * 1.6),
    dx: r2((s(4) - 0.5) * 36),
    dy: r2((s(5) - 0.5) * 36),
    dur: r2(10 + s(6) * 10),
    delay: r2(-s(7) * 10),
  };
});

/** In-app paths use the router; anchors, mailto links and other sites use a plain anchor. */
function Anchor({ href, external, children, ...rest }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  if (href.startsWith("/") && !href.startsWith("/#")) {
    return (
      <Link to={href} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export default function BrainMap({ config }) {
  const { caps, items, idea } = config;
  const reduce = useReducedMotion();
  const stage = useRef(null);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const active = hover ?? pinned;

  const { pos, edges, captionIds } = useMemo(() => {
    const pos = new Map([
      ["core", CENTER],
      ...(idea ? [["idea", idea.at]] : []),
      ...caps.map((c) => [c.id, c.at]),
      ...items.map((p) => [p.id, p.at]),
    ]);
    const edges = [
      ...caps.map((c) => ({ id: `core-${c.id}`, a: "core", b: c.id, from: CENTER, to: c.at })),
      ...items.flatMap((p) => p.uses.map((u) => ({ id: `${u}-${p.id}`, a: u, b: p.id, from: pos.get(u), to: p.at }))),
      ...(idea ? [{ id: "core-idea", a: "core", b: "idea", from: CENTER, to: idea.at, ghost: true }] : []),
    ];
    const captionIds = [null, "core", ...(idea ? ["idea"] : []), ...caps.map((c) => c.id), ...items.map((p) => p.id)];
    return { pos, edges, captionIds };
  }, [caps, items, idea]);

  const related = new Set();
  if (active) {
    related.add(active);
    for (const e of edges) {
      if (e.a === active) related.add(e.b);
      if (e.b === active) related.add(e.a);
    }
  }
  const nodeState = (id) => (!active ? undefined : related.has(id) || id === "core" ? "on" : "off");
  const edgeState = (e) => (!active ? undefined : e.a === active || e.b === active ? "on" : "off");

  function info(id) {
    if (!id) return config.defaultInfo;
    if (id === "core") return config.centre.info;
    if (id === "idea" && idea) return idea.info;
    const cap = caps.find((c) => c.id === id);
    if (cap) return { title: cap.label, blurb: cap.blurb, tag: config.capTag(cap, items.filter((p) => p.uses.includes(cap.id))) };
    const p = items.find((x) => x.id === id);
    return { title: p.title ?? p.label, blurb: p.blurb, tag: config.itemTag, href: p.href, cta: config.itemCta?.(p) };
  }

  // Pointer parallax: two CSS variables, no animation loop.
  function onMove(e) {
    if (reduce || e.pointerType === "touch" || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    stage.current.style.setProperty("--px", String(((e.clientX - r.left) / r.width - 0.5) * 2));
    stage.current.style.setProperty("--py", String(((e.clientY - r.top) / r.height - 0.5) * 2));
  }
  function onLeave() {
    stage.current?.style.setProperty("--px", "0");
    stage.current?.style.setProperty("--py", "0");
    setHover(null);
  }

  const bind = (id) => ({
    onPointerEnter: (e) => e.pointerType !== "touch" && setHover(id),
    onPointerLeave: (e) => e.pointerType !== "touch" && setHover((h) => (h === id ? null : h)),
    onFocus: () => setHover(id),
    onBlur: () => setHover((h) => (h === id ? null : h)),
  });

  // Touch: the first tap reveals a node, a second tap on a link follows it.
  const tap = (id) => (e) => {
    if (window.matchMedia("(hover: hover)").matches) return;
    if (pinned !== id) {
      e.preventDefault();
      setPinned(id);
    }
  };

  const at = (id) => ({ left: pct(pos.get(id)[0], W), top: pct(pos.get(id)[1], H) });

  return (
    <div className="brain" data-active={active ?? undefined} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div ref={stage} className="brain-stage" role="group" aria-label={config.ariaLabel}>
        {/* depth 1: backdrop, moves against the pointer */}
        <div className="brain-layer brain-layer-back" aria-hidden="true">
          <div className="brain-glow" />
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
            <circle className="brain-ring" cx={CENTER[0]} cy={CENTER[1]} r={128} />
            <circle className="brain-ring brain-ring-b" cx={CENTER[0]} cy={CENTER[1]} r={238} />
            {dust.map((d, i) => (
              <circle
                key={i}
                className="brain-dust"
                cx={d.x}
                cy={d.y}
                r={d.r}
                style={{ "--dx": `${d.dx}px`, "--dy": `${d.dy}px`, "--dur": `${d.dur}s`, "--delay": `${d.delay}s` }}
              />
            ))}
          </svg>
        </div>

        {/* depth 2: the graph itself, moves with the pointer */}
        <div className="brain-layer brain-layer-mid">
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {edges.map((e, i) => (
              <g key={e.id}>
                <line
                  className={`brain-edge${e.ghost ? " brain-edge-ghost" : ""}`}
                  x1={e.from[0]}
                  y1={e.from[1]}
                  x2={e.to[0]}
                  y2={e.to[1]}
                  pathLength={e.ghost ? undefined : 1}
                  data-state={edgeState(e)}
                  style={{ "--delay": `${0.25 + i * 0.045}s` }}
                />
                {!reduce && !e.ghost && (
                  <circle className="brain-pulse" r={e.a === "core" ? 2.6 : 2} visibility="hidden" data-state={edgeState(e)}>
                    <set attributeName="visibility" to="visible" begin={`${1.6 + (i % 7) * 0.7}s`} />
                    <animateMotion
                      dur={`${3.4 + (i % 5) * 0.55}s`}
                      begin={`${1.6 + (i % 7) * 0.7}s`}
                      repeatCount="indefinite"
                      path={`M${e.from[0]} ${e.from[1]} L${e.to[0]} ${e.to[1]}`}
                    />
                    <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.15;0.8;1" dur={`${3.4 + (i % 5) * 0.55}s`} begin={`${1.6 + (i % 7) * 0.7}s`} repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            ))}
          </svg>

          {/* the centre */}
          <div className="brain-node" data-kind="core" data-state={nodeState("core")} style={at("core")}>
            <button type="button" className="brain-hit" aria-label={config.centre.label} style={{ "--delay": "0.1s" }} {...bind("core")} onClick={() => setPinned((p) => (p === "core" ? null : "core"))}>
              <span className="brain-core">{config.centre.mark}</span>
            </button>
          </div>

          {/* the parts of the product */}
          {caps.map((c, i) => (
            <div key={c.id} className="brain-node" data-kind="cap" data-state={nodeState(c.id)} style={at(c.id)}>
              <button
                type="button"
                className="brain-hit"
                aria-label={`${c.label}: ${c.blurb}`}
                style={{ "--delay": `${0.35 + i * 0.08}s`, "--fire": `${-i * 1.1}s` }}
                {...bind(c.id)}
                onClick={() => setPinned((p) => (p === c.id ? null : c.id))}
              >
                <span className={`brain-cap${c.above ? " brain-cap-above" : ""}`}>
                  <span className="brain-disc">
                    <c.Icon weight="regular" aria-hidden="true" />
                  </span>
                  <span className="brain-cap-label">{c.label}</span>
                </span>
              </button>
            </div>
          ))}

          {/* what you get out of them */}
          {items.map((p, i) => {
            const inner = (
              <span className="brain-pill">
                <span className="brain-dot" style={{ "--fire": `${-i * 0.9}s` }} />
                {p.label}
              </span>
            );
            const common = {
              className: "brain-hit",
              style: { "--delay": `${0.8 + i * 0.09}s` },
              "aria-label": `${p.label}: ${p.blurb}`,
              ...bind(p.id),
            };
            return (
              <div key={p.id} className="brain-node" data-kind="product" data-state={nodeState(p.id)} style={at(p.id)}>
                {p.href ? (
                  <Anchor href={p.href} external={p.external} onClick={tap(p.id)} {...common}>
                    {inner}
                  </Anchor>
                ) : (
                  <button type="button" onClick={() => setPinned((x) => (x === p.id ? null : p.id))} {...common}>
                    {inner}
                  </button>
                )}
              </div>
            );
          })}

          {/* the empty slot */}
          {idea && (
            <div className="brain-node" data-kind="idea" data-state={nodeState("idea")} style={at("idea")}>
              <Anchor href={idea.href} className="brain-hit" aria-label={idea.ariaLabel} style={{ "--delay": "1.5s" }} onClick={tap("idea")} {...bind("idea")}>
                <span className="brain-pill brain-ghost">
                  <span className="brain-dot" />
                  {idea.label}
                </span>
              </Anchor>
            </div>
          )}
        </div>
      </div>

      {/* What the highlighted node means. Every caption sits in the same grid cell and only the active one is shown, so the box
          is always as tall as the longest caption and the page below never moves when the pointer changes node. */}
      <div className="brain-caption" aria-live="polite">
        {captionIds.map((id) => {
          const c = info(id);
          const on = (active ?? null) === id;
          return (
            <div key={id ?? "default"} className="brain-caption-item" data-on={on} aria-hidden={!on}>
              {c.tag && <p className="brain-tag">{c.tag}</p>}
              <p className="brain-title">{c.title}</p>
              <p className="brain-blurb">{c.blurb}</p>
              {c.href && c.cta && <p className="brain-cta">{c.cta} &rarr;</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

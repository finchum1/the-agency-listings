import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { agentSiteHref, isAgentSiteAppHost } from "../../../lib/agentSiteLinks";
import { resolveLanding } from "../../../lib/landingPages";
import SiteLink from "../SiteLink";
import "../journey.css";

// The "cards" home section: Sellers, Home Value and Buyers side by side, right under the bio and testimonials (agent_sites.home_sections has
// "cards"; the agent moves it up or down in Site Details, and orders, hides and rewords the cards themselves there too).
export default function LandingCards() {
  const { site } = useAgentSiteContext();
  const first = site.agent.first;
  const landing = resolveLanding(site.landing, first);
  const cards = landing.cards.filter((c) => c.on);
  if (cards.length === 0) return null;

  return (
    <section id="cards" className="px-6 lg:px-10 py-20 sm:py-24 bg-[var(--as-bg)] text-[var(--as-text)]">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Make your move</p>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold">Where are you headed next?</h2>
          <p className="mt-4 text-[17px] leading-relaxed opacity-70">
            Whether you&rsquo;re selling, curious what your home is worth, or ready to buy, here&rsquo;s how it works and what to expect, start to finish.
          </p>
        </div>
        {landing.animated ? (
          <JourneyCards cards={cards} />
        ) : (
          <div className="mt-12 grid gap-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))" }}>
            {cards.map((c) => (c.key === "value" ? <ValueCard key={c.key} card={c} /> : <PhotoCard key={c.key} card={c} />))}
          </div>
        )}
      </div>
    </section>
  );
}

function PhotoCard({ card, steps }) {
  const { site } = useAgentSiteContext();
  return (
    <SiteLink slug={site.slug} path={card.path} className="group flex flex-col bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-56 bg-[var(--as-surface)] overflow-hidden">
        <img src={card.photo} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className="as-btn absolute top-4 left-4 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{card.eyebrow}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-7">
        <p className="font-display text-2xl sm:text-[28px] font-semibold leading-tight">{card.title}</p>
        <p className="flex-1 text-[15.5px] leading-relaxed opacity-70">{card.blurb}</p>
        {steps && (
          <div className="jn-steps" aria-hidden="true">
            <i />
            {steps.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">{card.cta} →</p>
      </div>
    </SiteLink>
  );
}

// The middle card is the one that asks for something: the address goes right on the card and carries over to the Home Value page.
function ValueCard({ card, radar }) {
  const { site } = useAgentSiteContext();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const go = (e) => {
    e.preventDefault();
    const href = `${agentSiteHref(site.slug, card.path)}${address.trim() ? `?address=${encodeURIComponent(address.trim())}` : ""}`;
    if (isAgentSiteAppHost()) navigate(href);
    else window.location.assign(href);
  };
  return (
    <div className="flex flex-col bg-[var(--as-dark)] text-[var(--as-on-dark)] border border-[var(--as-dark)] overflow-hidden">
      <div className="relative h-56 p-6 flex flex-col justify-between">
        <img src={card.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--as-dark)]/40 to-[var(--as-accent)]/40" aria-hidden="true" />
        {radar && (
          <span aria-hidden="true">
            <i className="jn-subject" />
            {COMPS.map(([x, y], i) => (
              <i key={i} className="jn-comp" style={{ "--i": i, left: `${x}%`, top: `${y}%` }} />
            ))}
          </span>
        )}
        <span className="as-btn relative self-start bg-[var(--as-accent)] text-white text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{card.eyebrow}</span>
        <form onSubmit={go} className="relative">
          <label htmlFor="card-address" className="block text-[11px] tracked-wide uppercase opacity-70 mb-2">
            Property address
          </label>
          <div className="flex">
            <input
              id="card-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              placeholder="123 Main St, Edmond"
              className="min-w-0 flex-1 bg-[var(--as-bg)] text-[var(--as-text)] px-4 py-3 text-[15px] placeholder:text-[var(--as-text)]/45 focus:outline-none focus:ring-2 focus:ring-[var(--as-accent)]"
            />
            <button type="submit" className="as-btn bg-[var(--as-accent)] text-white px-5 text-sm font-medium">
              Go
            </button>
          </div>
        </form>
      </div>
      <SiteLink slug={site.slug} path={card.path} className="flex flex-1 flex-col gap-2.5 p-7">
        <p className="font-display text-2xl sm:text-[28px] font-semibold leading-tight">{card.title}</p>
        <p className="flex-1 text-[15.5px] leading-relaxed opacity-75">{card.blurb}</p>
        <p className="mt-2 text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/85">{card.cta} →</p>
      </SiteLink>
    </div>
  );
}

/* ------------------------------ the animated version ------------------------------ */

// Where the "comparables" appear around the property on the Home Value card (percent of the photo).
const COMPS = [[22, 20], [76, 16], [86, 46], [12, 50], [62, 58], [34, 62]];

// The steps each card's hover shows (decorative: the guide pages carry the real detail).
const STEPS = {
  sellers: ["Prep", "Price", "Show", "Offer", "Close"],
  buyers: ["Loan", "Search", "Offer", "Keys"],
  relocation: ["Ask", "Visit", "Offer", "Home"],
};

const PIN_ICONS = {
  sellers: <path d="M9 16l6-5 6 5v5H9z" fill="#fff" />,
  value: <text x="15" y="20" textAnchor="middle" fontWeight="700" fontSize="14" fill="#fff">$</text>,
  buyers: <path d="M15 15h7v3m-3-3v3M12 12a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8z" fill="none" stroke="#fff" strokeWidth="2" />,
  relocation: <path d="M15 8l2 5 5 .5-4 3.5 1.3 5L15 19.3 10.7 22l1.3-5-4-3.5 5-.5z" fill="#fff" />,
};

const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const NS = "http://www.w3.org/2000/svg";

// A red route links the cards like stops on a trip: it draws itself as the row comes into view (across the row on a wide screen, down the left margin on
// a narrow one, scrubbed by scrolling), each stop drops a pin, and the card rises as the line reaches it.
function JourneyCards({ cards }) {
  const rowRef = useRef(null);
  const reduce = useMemo(prefersLessMotion, []);
  const needed = cards.length >= 4 ? 1180 : 1000;
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(`(min-width: ${needed}px)`).matches);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${needed}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [needed]);

  // Cards start hidden only once this has run, so nothing flashes and nothing stays hidden if the route can't be drawn.
  useLayoutEffect(() => {
    if (!reduce) setArmed(true);
  }, [reduce]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || reduce) return undefined;
    const ghosts = row.querySelector(".jn-ghosts");
    const lives = row.querySelector(".jn-lives");
    const head = row.querySelector(".jn-head");
    const svg = row.querySelector(".jn-route");
    const items = [...row.querySelectorAll(".jn-item")];
    let segs = [];
    let cum = [0];
    let total = 0;
    let pts = [];
    let played = false;
    let raf = 0;
    let progress = 0;

    const pinCenter = (item) => (wide ? { x: item.offsetLeft + item.offsetWidth / 2, y: item.offsetTop - 58 + 15 } : { x: item.offsetLeft - 40 + 15, y: item.offsetTop + 26 + 15 });
    const segPath = (a, b, k) => {
      if (wide) {
        const dx = b.x - a.x;
        const dir = k % 2 ? 1 : -1;
        return `M${a.x} ${a.y} C${a.x + dx * 0.33} ${a.y - 30 * dir} ${a.x + dx * 0.66} ${b.y + 30 * dir} ${b.x} ${b.y}`;
      }
      const dy = b.y - a.y;
      const sway = k % 2 ? 7 : -7;
      return `M${a.x} ${a.y} C${a.x + sway} ${a.y + dy * 0.5} ${b.x - sway} ${b.y - dy * 0.5} ${b.x} ${b.y}`;
    };
    const build = () => {
      const r = row.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
      pts = items.map(pinCenter);
      ghosts.innerHTML = "";
      lives.innerHTML = "";
      segs = [];
      cum = [0];
      total = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const d = segPath(pts[k], pts[k + 1], k);
        const g = document.createElementNS(NS, "path");
        g.setAttribute("d", d);
        g.setAttribute("class", "jn-ghost");
        ghosts.appendChild(g);
        const l = document.createElementNS(NS, "path");
        l.setAttribute("d", d);
        l.setAttribute("class", "jn-live");
        lives.appendChild(l);
        const len = l.getTotalLength();
        l.style.strokeDasharray = len;
        l.style.strokeDashoffset = len;
        segs.push({ el: l, len });
        total += len;
        cum.push(total);
      }
      apply(progress);
    };
    const apply = (p) => {
      progress = p;
      const drawn = p * total;
      segs.forEach((s, k) => {
        s.el.style.strokeDashoffset = s.len - Math.max(0, Math.min(s.len, drawn - cum[k]));
      });
      let k = segs.findIndex((_, i) => drawn <= cum[i + 1]);
      if (k < 0) k = segs.length - 1;
      if (segs[k]) {
        const pt = segs[k].el.getPointAtLength(Math.max(0, Math.min(segs[k].len, drawn - cum[k])));
        head.setAttribute("cx", pt.x);
        head.setAttribute("cy", pt.y);
        head.style.opacity = p > 0 && p < 1 ? 1 : 0;
      }
      items.forEach((item, i) => {
        const on = p > 0 && drawn >= cum[i] - 2;
        item.classList.toggle("jn-in", on);
        item.querySelector(".jn-pin").classList.toggle("jn-on", on);
      });
    };

    // Wide: the line draws itself once, when the row is mostly on screen. Narrow: it follows the scroll, front to back and back again.
    const play = () => {
      if (played) return;
      played = true;
      const start = performance.now();
      const dur = 2100;
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        apply(ease(t));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const onScroll = () => {
      const top = pts[0].y + row.getBoundingClientRect().top + window.scrollY;
      const bottom = pts[pts.length - 1].y + row.getBoundingClientRect().top + window.scrollY;
      apply(Math.max(0, Math.min(1, (window.scrollY + window.innerHeight * 0.7 - top) / Math.max(1, bottom - top))));
    };

    build();
    let io = null;
    if (wide) {
      if (typeof IntersectionObserver === "undefined") apply(1);
      else {
        io = new IntersectionObserver(([e]) => e.isIntersecting && (play(), io.disconnect()), { threshold: 0.4 });
        io.observe(row);
        if (played) apply(1);
      }
    } else {
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
    const ro = new ResizeObserver(() => {
      build();
      if (!wide) onScroll();
      else if (played && !raf) apply(1);
    });
    ro.observe(row);
    return () => {
      io?.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [wide, reduce, cards.length]);

  return (
    <div ref={rowRef} className={`jn-row ${wide ? "jn-wide" : "jn-narrow"} ${armed ? "jn-armed" : ""}`} style={{ "--jn-cols": cards.length }}>
      <svg className="jn-route" aria-hidden="true">
        <g className="jn-ghosts" />
        <g className="jn-lives" />
        <circle className="jn-head" r="6" cx="-20" cy="-20" style={{ opacity: 0 }} />
      </svg>
      <div className="jn-grid">
        {cards.map((c) => (
          <div key={c.key} className="jn-item">
            <span className={`jn-pin ${reduce ? "jn-on" : ""}`} aria-hidden="true">
              <svg viewBox="0 0 30 30">
                <circle cx="15" cy="15" r="13" style={{ fill: "var(--as-accent)" }} stroke="#fff" strokeWidth="3" />
                {PIN_ICONS[c.key]}
              </svg>
            </span>
            {c.key === "value" ? <ValueCard card={c} radar /> : <PhotoCard card={c} steps={STEPS[c.key]} />}
          </div>
        ))}
      </div>
    </div>
  );
}

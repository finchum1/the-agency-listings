import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import SiteLink from "../SiteLink";

// Shared pieces of the Sellers, Buyers and Home Value pages. Everything is painted with the site's own --as-* tokens, so every layout, color
// theme and font pairing works with it.

export const sectionPad = "px-6 lg:px-10 py-20 sm:py-24";
export const buttonClass =
  "as-btn inline-block text-center text-xs font-medium tracked-wide uppercase px-7 py-4 transition duration-150 hover:opacity-90 active:scale-[0.98]";
export const primaryButton = `${buttonClass} bg-[var(--as-accent)] text-white`;
export const outlineButton = `${buttonClass} border border-current`;

const TONES = {
  bg: "bg-[var(--as-bg)] text-[var(--as-text)]",
  alt: "bg-[var(--as-bg-alt)] text-[var(--as-text)] border-y border-[var(--as-text)]/10",
  dark: "bg-[var(--as-dark)] text-[var(--as-on-dark)]",
};

export function Section({ tone = "bg", id, children, className = "" }) {
  return (
    <section id={id} className={`${sectionPad} ${TONES[tone]} ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, onDark }) {
  return <p className={`text-xs font-medium tracked-wide uppercase mb-3 ${onDark ? "text-[var(--as-on-dark)]/70" : "text-[var(--as-accent)]"}`}>{children}</p>;
}

export function Heading({ children, as: H = "h2", className = "" }) {
  return <H className={`text-3xl sm:text-4xl font-display font-semibold leading-tight ${className}`}>{children}</H>;
}

export function Lead({ children, className = "" }) {
  return <p className={`mt-4 text-[17px] leading-relaxed opacity-75 max-w-2xl ${className}`}>{children}</p>;
}

/** The page's opening: a photo under a dark wash, the title, a lead paragraph and buttons (children). */
export function PageHero({ eyebrow, title, lead, photo, children, below }) {
  return (
    <section className="relative -mt-14 overflow-hidden bg-[var(--as-dark)] text-[var(--as-on-dark)]">
      {photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />}
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--as-dark)] via-[var(--as-dark)]/80 to-[var(--as-dark)]/20" aria-hidden="true" />
      {/* A page leaves 56px of plain background under its fixed header; -mt-14 above pulls the hero up over it so the photo runs right to the top, and the padding here keeps the text clear of the header. */}
      <div className="relative mx-auto max-w-6xl px-6 lg:px-10 pt-[10.75rem] pb-24 sm:pt-[12.75rem] sm:pb-32">
        <Eyebrow onDark>{eyebrow}</Eyebrow>
        <Heading as="h1" className="!text-4xl sm:!text-6xl max-w-3xl">
          {title}
        </Heading>
        {lead && <p className="mt-5 text-lg sm:text-xl leading-relaxed opacity-80 max-w-xl">{lead}</p>}
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        {below && <div className="mt-12">{below}</div>}
      </div>
    </section>
  );
}

/** A numbered, step-by-step journey: the open step shows its detail. `steps`: [{ title, tag, body }]. */
export function Journey({ steps }) {
  const [open, setOpen] = useState(0);
  return (
    <ol className="mt-12 max-w-3xl">
      {steps.map((s, i) => {
        const on = open === i;
        const last = i === steps.length - 1;
        return (
          <li key={s.title} className="flex gap-5 sm:gap-7">
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => setOpen(on ? -1 : i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-expanded={on}
                aria-controls={`step-${i}`}
                className={`h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full text-sm font-semibold transition-colors ${on ? "bg-[var(--as-accent)] text-white" : "bg-[var(--as-text)] text-[var(--as-bg)]"}`}
              >
                {i + 1}
              </button>
              {!last && <div className="my-1.5 w-0.5 flex-1 min-h-6 bg-[var(--as-text)]/15" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1 pb-7">
              <button type="button" onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} className="w-full text-left pt-1.5">
                <span className="block font-display text-xl sm:text-2xl font-semibold">{s.title}</span>
                <span className="block mt-0.5 text-sm opacity-55">{s.tag}</span>
              </button>
              {on && (
                <div id={`step-${i}`} className="mt-3 bg-[var(--as-bg-alt)] border border-[var(--as-accent)]/40 p-5 sm:p-6 text-[15.5px] leading-relaxed text-[var(--as-text)]/85">
                  {s.body}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** "What do we do differently": a row of short, titled cards. */
export function Pillars({ items }) {
  return (
    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {items.map((p) => (
        <div key={p.title} className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-6">
          <div className="h-1 w-10 bg-[var(--as-accent)]" />
          <p className="mt-4 font-display text-xl font-semibold">{p.title}</p>
          <p className="mt-2 text-sm leading-relaxed opacity-70">{p.body}</p>
        </div>
      ))}
    </div>
  );
}

/** The agent, as a name, photo and ways to reach them. */
export function AgentCard({ onDark = true }) {
  const { site } = useAgentSiteContext();
  const { agent } = site;
  return (
    <div className="flex items-center gap-5">
      {agent.photo && <img src={agent.photo} alt={agent.name} className="h-20 w-20 rounded-full object-cover bg-[var(--as-surface)] shrink-0" />}
      <div className="min-w-0">
        <p className="font-display text-2xl font-semibold">{agent.name}</p>
        <p className={`text-sm ${onDark ? "opacity-70" : "opacity-60"}`}>
          {[agent.title, site.brokerage.name].filter(Boolean).join(" · ")}
          {agent.license ? ` · ${agent.license}` : ""}
        </p>
        <div className="mt-1 flex flex-col text-sm gap-0.5">
          {agent.phone && (
            <a href={`tel:${agent.phone}`} className="hover:underline">
              {agent.phone}
            </a>
          )}
          {agent.email && (
            <a href={`mailto:${agent.email}`} className="hover:underline break-all">
              {agent.email}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function Disclaimer({ children }) {
  return <p className="mt-12 pt-6 border-t border-current/15 text-[11px] leading-relaxed opacity-55 max-w-4xl">{children}</p>;
}

export function ContactLink({ children, className = outlineButton }) {
  const { site } = useAgentSiteContext();
  return (
    <SiteLink slug={site.slug} path="/contact" className={className}>
      {children}
    </SiteLink>
  );
}

// ---- form pieces ---------------------------------------------------------------------------------------------------------------------

export const inputClass =
  "w-full border border-[var(--as-text)]/20 px-4 py-3 text-[15px] bg-[var(--as-bg-alt)] text-[var(--as-text)] focus:outline-none focus:border-[var(--as-accent)] focus:ring-2 focus:ring-[var(--as-accent)]/25 transition";

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium tracked-wide uppercase mb-1.5 opacity-65">{label}</span>
      {children}
    </label>
  );
}

/** Pick-one or pick-several pills. `value` is a string (single) or an array (multiple). */
export function Chips({ options, value, onChange, multiple = false, label }) {
  const has = (o) => (multiple ? value.includes(o) : value === o);
  const toggle = (o) => onChange(multiple ? (value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : value === o ? "" : o);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          aria-pressed={has(o)}
          className={`rounded-full border px-4 py-2 text-sm transition-colors ${has(o) ? "bg-[var(--as-text)] text-[var(--as-bg)] border-[var(--as-text)]" : "bg-[var(--as-bg-alt)] border-[var(--as-text)]/25 hover:border-[var(--as-text)]/60"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

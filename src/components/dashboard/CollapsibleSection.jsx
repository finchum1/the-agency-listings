import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Reusable accordion section for long dashboard forms (SiteForm.jsx,
// BrokerageSiteForm.jsx) — each section owns its own open/closed state,
// collapsed by default so a long form reads as a list of named sections
// instead of one continuous scroll. Purely presentational: fields inside
// keep whatever value/state they already had while collapsed, nothing
// unmounts.
// When a form sets this (the id of one section), only that section shows, open and without the accordion header: each page of the agent-site editor
// is one section; a list of ids shows those sections one after another (a page of the editor that scrolls). Left undefined, the sections are an accordion, as an agent sees them on their own My Site page.
export const SectionFocus = createContext(undefined);

export default function CollapsibleSection({ id, title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const { hash, key } = useLocation();
  const focus = useContext(SectionFocus);
  const box = useRef(null);
  // A link to this section's address (…/details#design) opens it and brings it into view, each time the link is used.
  useEffect(() => {
    if (focus !== undefined || !id || hash !== `#${id}`) return undefined;
    setOpen(true);
    const t = setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [hash, key, id]);

  if (focus !== undefined) {
    if (Array.isArray(focus) ? !focus.includes(id) : focus !== id) return null;
    return (
      <div id={id} className="scroll-mt-40">
        <div className="mb-5">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {description && <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{description}</p>}
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    );
  }

  return (
    <div ref={box} id={id} className="scroll-mt-24 border border-black/10 dark:border-white/15 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="font-display text-sm font-semibold block">{title}</span>
          {description && (
            <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 block leading-snug">
              {description}
            </span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-[#1c1a17]/40 dark:text-[#faf9f7]/40 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 space-y-5 border-t border-black/10 dark:border-white/15">{children}</div>
      )}
    </div>
  );
}

import { useState } from "react";

// Reusable accordion section for long dashboard forms (SiteForm.jsx,
// BrokerageSiteForm.jsx) — each section owns its own open/closed state,
// collapsed by default so a long form reads as a list of named sections
// instead of one continuous scroll. Purely presentational: fields inside
// keep whatever value/state they already had while collapsed, nothing
// unmounts.
export default function CollapsibleSection({ title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-black/10 dark:border-white/15 rounded-xl overflow-hidden">
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

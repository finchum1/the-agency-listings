import { DEAL_COMPLIANCE, DEAL_SIGNING } from "../../../lib/dealFeatures";

// The row of tabs at the top of a deal. `tabs`: [{ key, label, icon?, badge?, hint?, tone? }]. With an `icon` each tab is a small picture over a
// short label and the tabs share the row evenly, so a narrow panel never needs a sideways scroll; without one they are plain text tabs (the
// contact panel). `badge` is a short count ("3"), `hint` its meaning for a tooltip and screen readers ("3 overdue"); `tone` "alert" makes the
// badge red, "info" blue, otherwise grey.
const TONES = {
  alert: "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300",
  info: "bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300",
  none: "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70",
};

// 20px outline pictures, drawn on a 24px grid.
const ICONS = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  documents: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></>,
  messages: <path d="M4 5h16v11H9l-5 4z" />,
  details: <><rect x="3" y="4" width="4" height="4" rx="1" /><rect x="3" y="14" width="4" height="4" rx="1" /><path d="M11 6h10M11 16h10" /></>,
};

export default function DealTabs({ tabs, active, onChange }) {
  const withIcons = tabs.every((t) => ICONS[t.icon]);
  return (
    <div role="tablist" aria-label="Deal sections" className={`flex border-b border-black/5 dark:border-white/10 ${withIcons ? "px-3" : "gap-5 overflow-x-auto px-6 [scrollbar-width:none]"}`}>
      {tabs.map((t) => {
        const on = active === t.key;
        return withIcons ? (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={t.hint ? `${t.label}, ${t.hint}` : undefined}
            title={t.hint || undefined}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex min-w-0 flex-1 flex-col items-center gap-0.5 border-b-2 px-1 pb-2 pt-2.5 text-[11px] ${
              on ? "border-[#1c1a17] dark:border-[#faf9f7] font-semibold" : "border-transparent text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            }`}
          >
            <span className="relative">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[t.icon]}
              </svg>
              {t.badge && <span className={`absolute -right-3 -top-1.5 rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${TONES[t.tone || "none"]}`}>{t.badge}</span>}
            </span>
            <span className="max-w-full truncate">{t.label}</span>
          </button>
        ) : (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm ${
              on ? "border-[#1c1a17] dark:border-[#faf9f7] font-semibold" : "border-transparent text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            }`}
          >
            {t.label}
            {t.badge && <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${TONES[t.tone || "none"]}`}>{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The tabs for a deal, with their badges, from its summary (useDealSummary) and review status. Messages (the review conversation) comes back with compliance. */
export function dealTabs(summary, person) {
  const sentBack = DEAL_COMPLIANCE && person.compliance_status === "needs_changes";
  const overdue = summary.overdue.length;
  const flagged = summary.flagged.length;
  const out = summary.signaturesOut.length;
  const tabs = [
    { key: "overview", label: "Overview", icon: "overview" },
    { key: "tasks", label: "Tasks", icon: "tasks", badge: overdue ? String(overdue) : null, hint: overdue ? `${overdue} overdue` : "", tone: "alert" },
    {
      key: "documents",
      label: "Docs",
      icon: "documents",
      badge: flagged ? String(flagged) : out && DEAL_SIGNING ? String(out) : null,
      hint: flagged ? `${flagged} flagged` : out && DEAL_SIGNING ? `${out} out for signature` : "",
      tone: flagged ? "alert" : "none",
    },
  ];
  if (DEAL_COMPLIANCE) {
    tabs.push({ key: "messages", label: "Messages", icon: "messages", badge: sentBack ? "!" : summary.unread ? String(summary.unread) : null, hint: sentBack ? "sent back" : summary.unread ? `${summary.unread} new` : "", tone: sentBack ? "alert" : "info" });
  }
  tabs.push({ key: "details", label: "Details", icon: "details" });
  return tabs;
}

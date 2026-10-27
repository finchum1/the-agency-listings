// The row of tabs at the top of a deal. `tabs`: [{ key, label, badge?, tone? }] where badge is a short note ("1 overdue", "2 new") and tone
// "alert" makes it red, "info" blue, otherwise grey.
const TONES = {
  alert: "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300",
  info: "bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300",
  none: "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70",
};

export default function DealTabs({ tabs, active, onChange }) {
  return (
    <div role="tablist" aria-label="Deal sections" className="flex gap-5 overflow-x-auto border-b border-black/5 dark:border-white/10 px-6 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm ${
            active === t.key ? "border-[#1c1a17] dark:border-[#faf9f7] font-semibold" : "border-transparent text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
          }`}
        >
          {t.label}
          {t.badge && <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${TONES[t.tone || "none"]}`}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/** The badges for a deal's tabs, from its summary (useDealSummary) and review status. */
export function dealTabs(summary, person) {
  const sentBack = person.compliance_status === "needs_changes";
  return [
    { key: "overview", label: "Overview" },
    { key: "checklists", label: "Checklists", badge: summary.overdue.length ? `${summary.overdue.length} overdue` : null, tone: "alert" },
    { key: "signatures", label: "Signatures", badge: summary.signaturesOut.length ? `${summary.signaturesOut.length} out` : null },
    { key: "messages", label: "Messages", badge: sentBack ? "sent back" : summary.unread ? `${summary.unread} new` : null, tone: sentBack ? "alert" : "info" },
    { key: "details", label: "Details" },
  ];
}

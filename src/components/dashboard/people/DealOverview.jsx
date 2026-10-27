import { dayLabel, daysBetween, toKey } from "../../../lib/homeDates";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing"],
  ["closing_date", "Closing"],
];

const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Row({ onClick, title, note, tone }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
        <span className="min-w-0 truncate text-sm">{title}</span>
        <span className={`shrink-0 text-xs ${tone === "alert" ? "font-semibold text-red-600 dark:text-red-400" : muted}`}>{note}</span>
      </button>
    </li>
  );
}

// The deal's Overview tab: what needs you, what's coming up, and the key dates as a line you can click to change. Notes and drafts are added
// by the panel around it (`children`).
//   summary   from useDealSummary          onTab(tab) jumps to another tab
//   dates     the deal's live key dates    onDate(key, value) changes one (omit for read-only)
export default function DealOverview({ person, summary, dates, onTab, onDate, children }) {
  const today = toKey(new Date());
  const needs = [];
  if (person.compliance_status === "needs_changes") needs.push({ key: "sb", title: "Compliance sent this deal back", note: "Read the note", tone: "alert", tab: "messages" });
  for (const t of summary.overdue.slice(0, 3)) needs.push({ key: `t${t.id}`, title: t.text, note: `due ${dayLabel(t.due, today)}`, tone: "alert", tab: "tasks" });
  if (summary.overdue.length > 3) needs.push({ key: "more", title: `${summary.overdue.length - 3} more overdue tasks`, note: "See all", tone: "alert", tab: "tasks" });
  for (const s of summary.signaturesOut) {
    const waiting = (s.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.name || r.email);
    needs.push({ key: `s${s.id}`, title: s.title, note: waiting.length ? `waiting on ${waiting.slice(0, 2).join(", ")}${waiting.length > 2 ? "…" : ""}` : "out for signature", tab: "documents" });
  }
  if (summary.unread > 0) needs.push({ key: "msg", title: `${summary.unread} new message${summary.unread === 1 ? "" : "s"}`, note: "Read", tab: "messages" });

  // Where "today" falls along the five dates: before the first one still to come (or at the end when they're all past); nowhere when none are set.
  const setDates = DATES.map(([key]) => dates[key] || "");
  const nextIdx = setDates.findIndex((d) => d && d >= today);
  const todayAt = setDates.some(Boolean) ? (nextIdx >= 0 ? nextIdx : 5) : -1;

  return (
    <div className="space-y-6">
      {children?.top}
      <section aria-label="Needs you" className="space-y-2">
        <h3 className="font-display text-base font-semibold">Needs you</h3>
        {needs.length === 0 ? (
          <p className={`rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-300`}>{summary.loaded ? "Nothing needs you right now." : "Checking…"}</p>
        ) : (
          <ul className="space-y-1.5">
            {needs.map((n) => (
              <Row key={n.key} onClick={() => onTab(n.tab)} title={n.title} note={n.note} tone={n.tone} />
            ))}
          </ul>
        )}
        {summary.soon.length > 0 && (
          <div className="pt-2">
            <p className={`mb-1.5 text-xs font-medium ${muted}`}>Coming up</p>
            <ul className="space-y-1.5">
              {summary.soon.map((t) => (
                <Row key={t.id} onClick={() => onTab("tasks")} title={t.text} note={dayLabel(t.due, today)} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Key dates" className="space-y-2">
        <h3 className="font-display text-base font-semibold">Key dates</h3>
        {todayAt >= 0 && (
          <div className="relative h-4" aria-hidden="true">
            <span className="absolute -translate-x-1/2 text-[10px] font-semibold text-[#ed2127] dark:text-[#f2454b]" style={{ left: `${(todayAt / 5) * 100}%` }}>
              Today ▾
            </span>
          </div>
        )}
        <div className="grid grid-cols-5 gap-1.5">
          {DATES.map(([key, label]) => {
            const value = dates[key] || "";
            const past = value && value < today;
            const diff = value ? daysBetween(today, value) : null;
            return (
              <div key={key} className="min-w-0">
                <div className={`h-1.5 rounded-full ${value ? (past ? "bg-[#1c1a17] dark:bg-[#faf9f7]" : "bg-[#1c1a17]/25 dark:bg-[#faf9f7]/30") : "border border-dashed border-black/25 dark:border-white/30"}`} />
                <label className={`relative mt-1.5 block ${onDate ? "cursor-pointer" : ""}`}>
                  <span className={`block truncate text-[11px] font-medium ${muted}`}>{label}</span>
                  <span className={`block truncate text-xs font-semibold ${value ? "" : muted}`}>{value ? shortDate(value) : onDate ? "Add" : "–"}</span>
                  {value && <span className={`block truncate text-[10px] ${muted}`}>{diff === 0 ? "today" : diff > 0 ? `in ${diff}d` : `${-diff}d ago`}</span>}
                  {onDate && (
                    <input
                      type="date"
                      value={value}
                      aria-label={`${label} date`}
                      onChange={(e) => onDate(key, e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {
                          /* the native control still opens */
                        }
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </section>
      {children?.bottom}
    </div>
  );
}

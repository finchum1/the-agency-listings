import { dayLabel, daysBetween, toKey } from "../../../lib/homeDates";
import { clockLabel, markerPosition } from "../../../lib/timeline";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["inspection_period_end", "Inspection period ends"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing"],
  ["closing_date", "Closing"],
];

const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Row({ onClick, title, note, tone, onCheck }) {
  return (
    <li className={onCheck ? "flex items-center gap-2.5" : undefined}>
      {onCheck && <input type="checkbox" checked={false} onChange={onCheck} aria-label={`Mark done: ${title}`} className="h-4 w-4 shrink-0 accent-[#ed2127] cursor-pointer" />}
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
//   onCheckTask(task)  ticks a task off right here, from the overdue and coming-up lists (omit for read-only)
export default function DealOverview({ person, summary, dates, onTab, onDate, onCheckTask, children }) {
  const today = toKey(new Date());
  const needs = [];
  if (person.compliance_status === "needs_changes") needs.push({ key: "sb", title: "Compliance sent this deal back", note: "Read the note", tone: "alert", tab: "messages" });
  for (const t of summary.overdue.slice(0, 3)) needs.push({ key: `t${t.id}`, title: t.text, note: `due ${dayLabel(t.due, today)}`, tone: "alert", tab: "tasks", task: t });
  if (summary.overdue.length > 3) needs.push({ key: "more", title: `${summary.overdue.length - 3} more overdue tasks`, note: "See all", tone: "alert", tab: "tasks" });
  for (const s of summary.signaturesOut) {
    const waiting = (s.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.name || r.email);
    needs.push({ key: `s${s.id}`, title: s.title, note: waiting.length ? `waiting on ${waiting.slice(0, 2).join(", ")}${waiting.length > 2 ? "…" : ""}` : "out for signature", tab: "documents" });
  }
  if (summary.unread > 0) needs.push({ key: "msg", title: `${summary.unread} new message${summary.unread === 1 ? "" : "s"}`, note: "Read", tab: "messages" });

  // Where "today" falls along the five dates, in proportion to the real days between the dates on either side of it (null when none are set).
  const todayAt = markerPosition(DATES.map(([key]) => dates[key] || ""), today);

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
              <Row key={n.key} onClick={() => onTab(n.tab)} title={n.title} note={n.note} tone={n.tone} onCheck={n.task && onCheckTask ? () => onCheckTask(n.task) : undefined} />
            ))}
          </ul>
        )}
        {summary.soon.length > 0 && (
          <div className="pt-2">
            <p className={`mb-1.5 text-xs font-medium ${muted}`}>Coming up</p>
            <ul className="space-y-1.5">
              {summary.soon.map((t) => (
                <Row key={t.id} onClick={() => onTab("tasks")} title={t.text} note={dayLabel(t.due, today)} onCheck={onCheckTask ? () => onCheckTask(t) : undefined} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-label="Key dates" className="space-y-2">
        <h3 className="font-display text-base font-semibold">Key dates</h3>
        {todayAt != null && (
          <div className="relative h-7 -mb-1" aria-hidden="true">
            {/* The label sits centered on the spot, with the arrow centered right under it, pointing at the bars. */}
            <span className="absolute flex -translate-x-1/2 flex-col items-center text-[#ed2127] dark:text-[#f2454b]" style={{ left: `${Math.min(Math.max(todayAt, 0.03), 0.97) * 100}%` }}>
              <span className="text-[10px] font-semibold leading-none">Today</span>
              <span className="text-[11px] leading-none">▾</span>
            </span>
          </div>
        )}
        <div className="grid grid-cols-6 gap-1.5">
          {DATES.map(([key, label]) => {
            const value = dates[key] || "";
            const past = value && value < today;
            const diff = value ? daysBetween(today, value) : null;
            return (
              <div key={key} className="min-w-0">
                <div className={`h-1.5 rounded-full ${value ? (past ? "bg-[#1c1a17] dark:bg-[#faf9f7]" : "bg-[#1c1a17]/25 dark:bg-[#faf9f7]/30") : "border border-dashed border-black/25 dark:border-white/30"}`} />
                <label className={`relative mt-1.5 block ${onDate ? "cursor-pointer" : ""}`}>
                  <span className={`block text-[11px] font-medium leading-tight ${muted}`} style={{ overflowWrap: "anywhere" }}>{label}</span>
                  <span className={`block truncate text-xs font-semibold ${value ? "" : muted}`}>{value ? shortDate(value) : onDate ? "Add" : "–"}</span>
                  {value && key === "inspection_date" && dates.inspection_time && <span className="block truncate text-[10px] font-medium">{clockLabel(dates.inspection_time)}</span>}
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
        {onDate && dates.inspection_date && (
          <div className="flex items-center gap-2 pt-1">
            <label htmlFor="inspection-time" className={`text-xs ${muted}`}>Inspection time</label>
            <input
              id="inspection-time"
              type="time"
              value={(dates.inspection_time || "").slice(0, 5)}
              onChange={(e) => onDate("inspection_time", e.target.value)}
              className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
            />
            {dates.inspection_time && (
              <button type="button" onClick={() => onDate("inspection_time", "")} className={`text-xs underline underline-offset-2 ${muted} hover:opacity-80`}>
                Clear
              </button>
            )}
          </div>
        )}
      </section>
      {children?.bottom}
    </div>
  );
}

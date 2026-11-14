import { useState } from "react";
import { dayLabel, daysBetween, toKey } from "../../../lib/homeDates";
import { chicagoDay, clockLabel, markerPosition } from "../../../lib/timeline";
import { money } from "./DealDetailList";
import { DEFAULT_TRR_DAYS, trrDays, trrDeadline } from "../../../lib/trr";
import { DEAL_COMPLIANCE, DEAL_SIGNING } from "../../../lib/dealFeatures";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["inspection_period_end", "Inspection period ends"],
  ["trr_deadline", "TRR ends"],
  ["appraisal_date", "Appraisal"],
  ["closing_date", "Closing"],
];

// A cash purchase has no loan: no appraisal.
const CASH_SKIPS = ["appraisal_date"];
const shortDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// `indent` keeps a row without a checkbox in line with the rows that have one (the box's width and gap), so a list's rows share both edges.
function Row({ onClick, title, note, tone, onCheck, indent = false }) {
  return (
    <li className={onCheck || indent ? "flex items-center gap-2.5" : undefined}>
      {onCheck && <input type="checkbox" checked={false} onChange={onCheck} aria-label={`Mark done: ${title}`} className="h-4 w-4 shrink-0 accent-[#ed2127] cursor-pointer" />}
      {!onCheck && indent && <span className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <button type="button" onClick={onClick} className="flex w-full min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
        <span className="min-w-0 truncate text-sm">{title}</span>
        <span className={`shrink-0 text-xs ${tone === "alert" ? "font-semibold text-red-600 dark:text-red-400" : muted}`}>{note}</span>
      </button>
    </li>
  );
}

// One line to add a task without leaving the Overview: what it is, the day it is due (today unless changed), Enter or Add.
function QuickAddTask({ onAdd, today }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    const err = await onAdd(text.trim(), due || today);
    setBusy(false);
    if (err) setError(err);
    else {
      setText("");
      setDue(today);
    }
  };
  const field = "rounded-xl border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  return (
    <form onSubmit={submit} className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a task…" aria-label="New task" maxLength={300} className={`${field} min-w-0 flex-1 basis-48`} />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={field} />
        <button type="submit" disabled={!text.trim() || busy} className="shrink-0 rounded-xl bg-[#1c1a17] dark:bg-[#faf9f7] px-4 py-2 text-sm font-semibold text-white dark:text-[#1c1a17] disabled:opacity-40">
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

// The deal's Overview tab: what needs you, what's coming up, and the key dates as a line you can click to change. Notes and drafts are added
// by the panel around it (`children`).
//   summary   from useDealSummary          onTab(tab) jumps to another tab
//   dates     the deal's live key dates    onDate(key, value) changes one (omit for read-only)
//   cash       a cash purchase: the appraisal tile goes away      onCash(bool) flips it (omit for read-only)
//   earnest    { amount, delivered, at }: the earnest money, checked off here when it reaches the title company     onEarnest(bool) ticks it (omit for read-only)
//   onCheckTask(task)  ticks a task off right here, from the overdue and coming-up lists (omit for read-only)
//   onAddTask(text, due)  adds a task from the line under "Needs you"; resolves to an error message or null (omit for read-only)
export default function DealOverview({ person, summary, dates, cash = false, onCash, earnest, onEarnest, onTab, onDate, onCheckTask, onAddTask, children }) {
  const today = toKey(new Date());
  const needs = [];
  if (DEAL_COMPLIANCE && person.compliance_status === "needs_changes") needs.push({ key: "sb", title: "Compliance sent this deal back", note: "Read the note", tone: "alert", tab: "messages" });
  for (const t of summary.dueNow.slice(0, 3)) needs.push({ key: `t${t.id}`, title: t.text, note: `due ${dayLabel(t.due, today)}`, tone: t.due < today ? "alert" : undefined, tab: "tasks", task: t });
  if (summary.dueNow.length > 3) needs.push({ key: "more", title: `${summary.dueNow.length - 3} more tasks overdue or due today`, note: "See all", tone: "alert", tab: "tasks" });
  for (const s of DEAL_SIGNING ? summary.signaturesOut : []) {
    const waiting = (s.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.name || r.email);
    needs.push({ key: `s${s.id}`, title: s.title, note: waiting.length ? `waiting on ${waiting.slice(0, 2).join(", ")}${waiting.length > 2 ? "…" : ""}` : "out for signature", tab: "documents" });
  }
  if (DEAL_COMPLIANCE && summary.unread > 0) needs.push({ key: "msg", title: `${summary.unread} new message${summary.unread === 1 ? "" : "s"}`, note: "Read", tab: "messages" });

  // The TRR window: received + the deal's days to negotiate. Close to its end it asks for attention here.
  const trrEnd = trrDeadline(dates.trr_received_date, dates.trr_days);
  const trrLeft = trrEnd ? daysBetween(today, trrEnd) : null;
  if (trrLeft != null && trrLeft >= 0 && trrLeft <= 2) needs.push({ key: "trr", title: "TRR negotiation ends", note: trrLeft === 0 ? "today" : trrLeft === 1 ? "tomorrow" : `in ${trrLeft} days`, tone: trrLeft === 0 ? "alert" : undefined, tab: "overview" });

  // Where "today" falls along the five dates, in proportion to the real days between the dates on either side of it (null when none are set).
  const tiles = cash ? DATES.filter(([key]) => !CASH_SKIPS.includes(key)) : DATES;
  // The TRR tile shows the deadline, which is worked out from the day the report was received and the days to negotiate (the TRR block below edits those).
  const dateOf = (key) => (key === "trr_deadline" ? trrEnd : dates[key] || "");
  const todayAt = markerPosition(tiles.map(([key]) => dateOf(key)), today);

  return (
    <div className="space-y-6">
      {children?.top}
      <section aria-label="Needs you" className="space-y-2">
        <h3 className="font-display text-base font-semibold">Needs you</h3>
        {onAddTask && <QuickAddTask onAdd={onAddTask} today={today} />}
        {needs.length === 0 ? (
          <p className={`rounded-xl bg-emerald-50 dark:bg-emerald-400/10 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-300`}>{summary.loaded ? "Nothing needs you right now." : "Checking…"}</p>
        ) : (
          <ul className="space-y-1.5">
            {needs.map((n) => (
              <Row key={n.key} onClick={() => onTab(n.tab)} title={n.title} note={n.note} tone={n.tone} onCheck={n.task && onCheckTask ? () => onCheckTask(n.task) : undefined} indent={Boolean(onCheckTask)} />
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-base font-semibold">Key dates</h3>
          {onCash ? (
            <label className={`flex cursor-pointer items-center gap-2 text-xs ${muted}`} title="No loan, so no appraisal">
              <input type="checkbox" checked={cash} onChange={(e) => onCash(e.target.checked)} className="h-3.5 w-3.5 accent-[#ed2127]" />
              Cash purchase
            </label>
          ) : (
            cash && <span className={`text-xs ${muted}`}>Cash purchase</span>
          )}
        </div>
        {todayAt != null && (
          <div className="relative h-7 -mb-1" aria-hidden="true">
            {/* The label sits centered on the spot, with the arrow centered right under it, pointing at the bars. */}
            <span className="absolute flex -translate-x-1/2 flex-col items-center text-[#ed2127] dark:text-[#f2454b]" style={{ left: `${Math.min(Math.max(todayAt, 0.03), 0.97) * 100}%` }}>
              <span className="text-[10px] font-semibold leading-none">Today</span>
              <span className="text-[11px] leading-none">▾</span>
            </span>
          </div>
        )}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
          {tiles.map(([key, label]) => {
            const value = dateOf(key);
            const past = value && value < today;
            const diff = value ? daysBetween(today, value) : null;
            return (
              <div key={key} className="min-w-0">
                <div className={`h-1.5 rounded-full ${value ? (past ? "bg-[#1c1a17] dark:bg-[#faf9f7]" : "bg-[#1c1a17]/25 dark:bg-[#faf9f7]/30") : "border border-dashed border-black/25 dark:border-white/30"}`} />
                <label className={`relative mt-1.5 block ${onDate ? "cursor-pointer" : ""}`}>
                  <span className={`block text-[11px] font-medium leading-tight ${muted}`} style={{ overflowWrap: "anywhere" }}>{label}</span>
                  <span className={`block truncate text-xs font-semibold ${value ? "" : muted}`}>{value ? shortDate(value) : onDate ? "Add" : "–"}</span>
                  {value && key === "inspection_date" && dates.inspection_time && <span className="block truncate text-[10px] font-medium">{clockLabel(dates.inspection_time)}</span>}
                  {value && key === "closing_date" && dates.closing_time && <span className="block truncate text-[10px] font-medium">{clockLabel(dates.closing_time)}</span>}
                  {value && <span className={`block truncate text-[10px] ${muted}`}>{diff === 0 ? "today" : diff > 0 ? `in ${diff}d` : `${-diff}d ago`}</span>}
                  {key === "trr_deadline" && onDate && (
                    <button
                      type="button"
                      aria-label="Set the day the TRR report was received"
                      onClick={() => {
                        const input = document.getElementById("trr-received");
                        input?.focus();
                        try {
                          input?.showPicker();
                        } catch {
                          /* the field still takes focus */
                        }
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  )}
                  {key !== "trr_deadline" && onDate && (
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
        {onDate && (dates.inspection_date || dates.closing_date) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1">
            {[["inspection_date", "inspection_time", "Inspection time"], ["closing_date", "closing_time", "Closing time"]].map(([dateKey, timeKey, label]) =>
              dates[dateKey] ? (
                <div key={timeKey} className="flex items-center gap-2">
                  <label htmlFor={timeKey.replace("_", "-")} className={`text-xs ${muted}`}>{label}</label>
                  <input
                    id={timeKey.replace("_", "-")}
                    type="time"
                    value={(dates[timeKey] || "").slice(0, 5)}
                    onChange={(e) => onDate(timeKey, e.target.value)}
                    className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
                  />
                  {dates[timeKey] && (
                    <button type="button" onClick={() => onDate(timeKey, "")} className={`text-xs underline underline-offset-2 ${muted} hover:opacity-80`}>
                      Clear
                    </button>
                  )}
                </div>
              ) : null,
            )}
          </div>
        )}
      </section>
      {(onDate || dates.trr_received_date) && (
        <section aria-label="TRR" className="space-y-2">
          <h3 className="font-display text-base font-semibold">TRR</h3>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-black/10 dark:border-white/15 px-3.5 py-3 text-sm">
            <label className="flex items-center gap-2">
              <span className={`text-xs ${muted}`}>Report received</span>
              <input
                id="trr-received"
                type="date"
                value={dates.trr_received_date || ""}
                disabled={!onDate}
                onChange={(e) => onDate?.("trr_received_date", e.target.value)}
                aria-label="TRR report received"
                className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className={`text-xs ${muted}`}>Days to negotiate</span>
              <input
                type="number"
                min="1"
                max="120"
                value={dates.trr_days === "" || dates.trr_days == null ? DEFAULT_TRR_DAYS : dates.trr_days}
                disabled={!onDate}
                onChange={(e) => onDate?.("trr_days", e.target.value)}
                aria-label="Days to negotiate the TRR"
                className="w-16 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
              />
            </label>
            {trrEnd ? (
              <span className={trrLeft != null && trrLeft <= 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold"}>
                Negotiate by {shortDate(trrEnd)} <span className={`font-normal ${muted}`}>{trrLeft === 0 ? "· today" : trrLeft > 0 ? `· in ${trrLeft} day${trrLeft === 1 ? "" : "s"}` : `· ended ${-trrLeft} day${trrLeft === -1 ? "" : "s"} ago`}</span>
              </span>
            ) : (
              <span className={`text-xs ${muted}`}>Enter the day the report arrives to see the deadline. The standard is {DEFAULT_TRR_DAYS} days; change it if the contract says otherwise.</span>
            )}
            {onDate && dates.trr_received_date && (
              <button type="button" onClick={() => { onDate("trr_received_date", ""); }} className={`text-xs underline underline-offset-2 ${muted} hover:opacity-80`}>
                Clear
              </button>
            )}
          </div>
        </section>
      )}
      {earnest && (
        <section aria-label="Earnest money" className="space-y-2">
          <h3 className="font-display text-base font-semibold">Earnest money</h3>
          <label className={`flex items-center gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3.5 py-3 ${onEarnest ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : ""}`}>
            <input
              type="checkbox"
              checked={!!earnest.delivered}
              disabled={!onEarnest}
              onChange={(e) => onEarnest?.(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-[#ed2127]"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Delivered to the title company</span>
              <span className={`block text-xs ${muted}`}>
                {earnest.delivered ? `Checked off${earnest.at ? ` ${shortDate(chicagoDay(earnest.at))}` : ""}. It shows on the client's and the agent's timelines.` : "Check it off when it reaches the title company."}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold">{money(earnest.amount) || <span className={`font-normal ${muted}`}>No amount yet</span>}</span>
          </label>
        </section>
      )}
      {children?.bottom}
    </div>
  );
}

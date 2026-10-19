import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { browserTimeZone, useCalendarEvents } from "../../../hooks/useCalendarEvents";
import { addDays, dayLabel, fromKey, monthGrid, startOfWeek, timeLabel, toKey } from "../../../lib/homeDates";
import { DAY_MIN, fromMin, toMin } from "../../../lib/timeGrid";
import { CalendarsPanel, EventModal } from "./CalendarPanels";
import TimeBlockModal from "./TimeBlockModal";
import TimeGrid from "./TimeGrid";
import { card, muted } from "./styles";

const DEAL_COLOR = "#0f766e";
const TASK_COLOR = "#b45309";
const DEAL_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
// Open deals' key dates (contract, inspection, appraisal, financing deadline, closing) for the schedule. Only runs when
// the agent has People on.
function useDealDates(enabled) {
  const { closedStage } = usePeopleStages();
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    supabase
      .from("people")
      .select("id, name, property_address, stage, contract_date, inspection_date, appraisal_date, financing_deadline, closing_date")
      .eq("stage_group", "transaction")
      .eq("archived", false)
      .then(({ data }) => active && setDeals((data || []).filter((p) => p.stage !== closedStage)));
    return () => {
      active = false;
    };
  }, [enabled, closedStage]);
  return enabled ? deals : [];
}

function rangeFor(view, cursorKey) {
  const c = fromKey(cursorKey);
  if (view === "day") return { start: c, end: addDays(c, 1) };
  if (view === "week") {
    const s = startOfWeek(c);
    return { start: s, end: addDays(s, 7) };
  }
  const grid = monthGrid(c.getFullYear(), c.getMonth());
  return { start: fromKey(grid[0].key), end: addDays(fromKey(grid[grid.length - 1].key), 1) };
}

function titleFor(view, cursorKey) {
  const c = fromKey(cursorKey);
  if (view === "day") return c.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  if (view === "month") return c.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const s = startOfWeek(c);
  const e = addDays(s, 6);
  const sameMonth = s.getMonth() === e.getMonth();
  const a = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  // A day-and-year-only format renders as "2026 (day: 17)" in some browsers, so the day is formatted on its own.
  const b = sameMonth ? String(e.getDate()) : e.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${a} – ${b}, ${e.getFullYear()}`;
}

function step(view, cursorKey, dir) {
  const c = fromKey(cursorKey);
  if (view === "day") return toKey(addDays(c, dir));
  if (view === "week") return toKey(addDays(c, 7 * dir));
  return toKey(new Date(c.getFullYear(), c.getMonth() + dir, 1));
}

const dot = (color) => <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />;

const sortItems = (a, b) => (a.allDay === b.allDay ? (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title) : a.allDay ? -1 : 1);

// Month cells have room for three lines, so appointments come before deal dates and tasks there.
const KIND_RANK = { calendar: 0, deal: 1, task: 2 };
const sortForMonth = (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || sortItems(a, b);

// ---- the schedule --------------------------------------------------------------------------------------------------

// Day, Week and Month views of the agent's linked calendars (read-only, by private iCal address), plus the key dates on
// their open deals and their own tasks, each switchable.
export default function ScheduleCard({ userId, wantsPeople, tasksApi, span }) {
  const tasks = tasksApi.tasks;
  const [view, setView] = useState("day");
  const [cursor, setCursor] = useState(toKey(new Date()));
  const [show, setShow] = useState({ calendar: true, deals: true, tasks: true });
  const [managing, setManaging] = useState(false);
  const [eventModal, setEventModal] = useState(null); // { event } to edit / view, or { event: null, defaults? } to add
  const [block, setBlock] = useState(null); // { range } to block time for a new task, { task } to schedule or edit one
  const [moved, setMoved] = useState({}); // Google events dragged to a new time, shown there until Google's answer arrives
  const [moveError, setMoveError] = useState("");
  const [params, setParams] = useSearchParams();
  const [googleNotice, setGoogleNotice] = useState({ message: "", connectionId: null });
  const today = toKey(new Date());

  const { start, end } = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const cal = useCalendarEvents(userId, start, end);

  // Coming back from Google's sign-in: /dashboard?google=connected&connection=<id> (or error / cancelled).
  useEffect(() => {
    const g = params.get("google");
    if (!g) return;
    if (g === "connected") {
      setGoogleNotice({ message: "Google account connected. Choose which of its calendars to show.", connectionId: params.get("connection") });
      setManaging(true);
      cal.refresh();
    } else if (g === "error") {
      setGoogleNotice({ message: params.get("message") || "Couldn't connect Google.", connectionId: null, error: true });
      setManaging(true);
    }
    setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const deals = useDealDates(wantsPeople);

  const byDay = useMemo(() => {
    const map = new Map();
    const add = (key, item) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    const colors = Object.fromEntries(cal.calendars.map((c) => [c.id, c.color]));
    const names = Object.fromEntries(cal.calendars.map((c) => [c.id, c.name]));
    if (show.calendar) {
      for (const e of cal.events) {
        const base = { id: `${e.calendarId}-${e.uid}-${e.start || e.startDate}`, kind: "calendar", title: e.title, sub: [e.location, names[e.calendarId]].filter(Boolean).join(" · "), color: colors[e.calendarId] || "#525252", allDay: e.allDay, raw: e };
        if (e.allDay) {
          for (let d = fromKey(e.startDate), n = 0; toKey(d) < e.endDate && n < 31; d = addDays(d, 1), n++) add(toKey(d), { ...base, id: `${base.id}-${toKey(d)}` });
        } else {
          // A timed event becomes one block per day it touches (most are one).
          const s = new Date(e.start);
          const en = new Date(e.end || e.start);
          const first = new Date(s.getFullYear(), s.getMonth(), s.getDate());
          const single = en <= addDays(first, 1);
          for (let d = first, n = 0; n < 8; d = addDays(d, 1), n++) {
            if (n > 0 && en <= d) break;
            const key = toKey(d);
            const startMin = n === 0 ? s.getHours() * 60 + s.getMinutes() : 0;
            const endMin = en >= addDays(d, 1) ? DAY_MIN : en.getHours() * 60 + en.getMinutes();
            const item = { ...base, id: `${base.id}-${key}`, start: n === 0 ? e.start : d.toISOString(), date: key, startMin, endMin: Math.max(endMin, startMin + 15), editable: Boolean(e.canWrite) && single };
            const ov = moved[item.id];
            if (ov) add(ov.date, { ...item, date: ov.date, startMin: ov.startMin, endMin: ov.endMin });
            else add(key, item);
          }
        }
      }
    }
    if (show.deals) {
      for (const p of deals) {
        for (const [field, label] of DEAL_DATES) {
          if (p[field]) add(p[field], { id: `deal-${p.id}-${field}`, kind: "deal", title: label, sub: [p.name, p.property_address].filter(Boolean).join(" · "), color: DEAL_COLOR, allDay: true });
        }
      }
    }
    if (show.tasks) {
      for (const t of tasks) {
        if (t.done || !t.due_date) continue;
        const base = { id: `task-${t.id}`, kind: "task", title: t.title, sub: "Task", color: TASK_COLOR, task: t, date: t.due_date };
        if (t.start_time) {
          const startMin = toMin(t.start_time);
          add(t.due_date, { ...base, allDay: false, start: new Date(`${t.due_date}T${t.start_time.slice(0, 5)}:00`).toISOString(), startMin, endMin: Math.min(DAY_MIN, startMin + (t.duration_min || 60)), editable: true });
        } else add(t.due_date, { ...base, allDay: true });
      }
    }
    for (const list of map.values()) list.sort(sortItems);
    return map;
  }, [cal.events, cal.calendars, deals, tasks, show, moved]);

  // Google answered (or the range changed): the events on screen are the real ones again.
  useEffect(() => setMoved({}), [cal.events]);

  const itemsOn = (key) => byDay.get(key) || [];
  const itemsFor = (key) => {
    const list = itemsOn(key);
    return { allDay: list.filter((i) => i.allDay), timed: list.filter((i) => !i.allDay) };
  };
  const canAddEvent = cal.calendars.some((c) => c.source === "google" && c.can_write);
  const untimed = tasks.filter((t) => !t.done && !(t.start_time && t.due_date));
  const tray = untimed
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || a.created_at.localeCompare(b.created_at))
    .map((t) => ({ ...t, dueLabel: t.due_date ? dayLabel(t.due_date, today) : "No date", overdue: Boolean(t.due_date && t.due_date < today) }));

  const openItem = (item) => {
    if (item.raw) setEventModal({ event: item.raw });
    else if (item.task) setBlock({ task: item.task });
  };
  const toLocalIso = (date, min) => (min >= DAY_MIN ? `${toKey(addDays(fromKey(date), 1))}T00:00:00` : `${date}T${fromMin(min)}:00`);
  const moveItem = async (item, p) => {
    setMoveError("");
    if (item.kind === "task") {
      const t = item.task;
      const changes = { start_time: fromMin(p.startMin), duration_min: Math.max(5, p.endMin - p.startMin) };
      if (p.date !== t.due_date) changes.due_date = p.date;
      tasksApi.update(t, changes);
      return;
    }
    const e = item.raw;
    setMoved((m) => ({ ...m, [item.id]: p }));
    try {
      await cal.saveEvent({
        calendarRowId: e.calendarId,
        eventId: e.eventId,
        event: { title: e.title, start: toLocalIso(p.date, p.startMin), end: toLocalIso(p.date, p.endMin), timeZone: browserTimeZone(), location: e.location || "", description: e.description || "" },
      });
    } catch (err) {
      setMoved({});
      setMoveError(`Couldn't move “${e.title}”: ${err.message}`);
    }
  };
  const nextSlot = () => {
    const n = new Date();
    const key = cursor === today ? today : cursor;
    const start = cursor === today ? Math.min(DAY_MIN - 60, Math.ceil((n.getHours() * 60 + n.getMinutes()) / 30) * 30) : 9 * 60;
    return { date: key, startMin: start, endMin: start + 60 };
  };
  const noCalendars = !cal.loading && cal.calendars.length === 0;
  const grid = view === "month" ? monthGrid(fromKey(cursor).getFullYear(), fromKey(cursor).getMonth()) : [];
  const weekDays = view === "week" ? Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i))) : [];

  const segment = (v, label) => (
    <button
      key={v}
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${view === v ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`}
    >
      {label}
    </button>
  );
  const filter = (key, label, color) => (
    <label key={key} className={`inline-flex items-center gap-1.5 text-xs cursor-pointer ${show[key] ? "" : "opacity-50"}`}>
      <input type="checkbox" checked={show[key]} onChange={(e) => setShow((s) => ({ ...s, [key]: e.target.checked }))} className="sr-only" />
      {dot(color)}
      {label}
    </label>
  );

  return (
    <section className={`${card} ${span ? "lg:col-span-3" : "lg:col-span-2"} flex flex-col`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Schedule</h2>
        <div className="flex items-center gap-1 rounded-full border border-black/10 dark:border-white/15 p-0.5" role="group" aria-label="View">
          {segment("day", "Day")}
          {segment("week", "Week")}
          {segment("month", "Month")}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setCursor(step(view, cursor, -1))} aria-label="Previous" className="h-8 w-8 rounded-full border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
          ‹
        </button>
        <button type="button" onClick={() => setCursor(step(view, cursor, 1))} aria-label="Next" className="h-8 w-8 rounded-full border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
          ›
        </button>
        <button type="button" onClick={() => setCursor(today)} className="rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-3.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">
          Today
        </button>
        <p className="text-sm font-semibold ml-1" aria-live="polite">
          {titleFor(view, cursor)}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          {filter("calendar", "Calendar", "#1a5fb4")}
          {wantsPeople && filter("deals", "Deal dates", DEAL_COLOR)}
          {filter("tasks", "Tasks", TASK_COLOR)}
          <button type="button" onClick={() => setManaging((m) => !m)} aria-expanded={managing} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            Calendars
          </button>
          {view !== "month" && (
            <button type="button" onClick={() => setBlock({ range: nextSlot() })} className="rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-3.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10">
              + Block time
            </button>
          )}
          {canAddEvent && (
            <button type="button" onClick={() => setEventModal({ event: null })} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-3.5 py-1.5">
              + Event
            </button>
          )}
        </div>
      </div>

      {managing && <CalendarsPanel cal={cal} onClose={() => setManaging(false)} notice={googleNotice.error ? "" : googleNotice.message} openConnectionId={googleNotice.connectionId} />}
      {googleNotice.error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{googleNotice.message}</p>}
      {noCalendars && !managing && (
        <p className={`mt-3 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2 ${muted}`}>
          Connect your Google Calendar to see and add appointments here.{" "}
          <button type="button" onClick={() => setManaging(true)} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            Connect a calendar
          </button>
        </p>
      )}
      {cal.errors.map((e) => (
        <p key={`${e.calendarId}-${e.message}`} className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Couldn't read “{e.name}”: {e.message}
        </p>
      ))}

      <div className={`mt-4 ${cal.loading && view === "month" ? "opacity-60 transition-opacity" : ""}`}>
        {(view === "day" || view === "week") && (
          <TimeGrid
            days={view === "day" ? [cursor] : weekDays}
            today={today}
            itemsFor={itemsFor}
            tray={tray}
            onOpen={openItem}
            onCreate={(range) => setBlock({ range })}
            onMove={moveItem}
            onToggleTask={tasksApi.complete}
            onPickTask={(task) => setBlock({ task })}
            onScheduleTask={(task, p) => tasksApi.update(task, { ...(p.date !== task.due_date ? { due_date: p.date } : {}), start_time: fromMin(p.startMin), duration_min: p.endMin - p.startMin })}
            onDayClick={(key) => {
              setCursor(key);
              setView("day");
            }}
          />
        )}

        {view === "month" && (
          <div>
            <div className="grid grid-cols-7 gap-px text-center pb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span key={d} className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10">
              {grid.map(({ key, inMonth }) => {
                const list = [...itemsOn(key)].sort(sortForMonth);
                const isToday = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setCursor(key);
                      setView("day");
                    }}
                    aria-label={`${dayLabel(key, today)}, ${list.length} item${list.length === 1 ? "" : "s"}`}
                    className={`flex flex-col items-start justify-start text-left p-1.5 min-h-[3.25rem] sm:min-h-[6.5rem] min-w-0 bg-white dark:bg-[#1a1a1a] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${inMonth ? "" : "opacity-40"}`}
                  >
                    <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${isToday ? "bg-[#ed2127] dark:bg-[#f2454b] text-white" : ""}`}>{fromKey(key).getDate()}</span>
                    <span className="hidden sm:block mt-1 space-y-0.5 w-full min-w-0">
                      {list.slice(0, 3).map((it) => (
                        <span key={it.id} className="flex items-center gap-1 min-w-0 text-[11px] leading-tight">
                          {dot(it.color)}
                          <span className="truncate">
                            {!it.allDay && <span className={muted}>{timeLabel(it.start).replace(/:00/, "").replace(" ", "").toLowerCase()} </span>}
                            {it.title}
                          </span>
                        </span>
                      ))}
                      {list.length > 3 && <span className={`block text-[10px] ${muted}`}>+{list.length - 3} more</span>}
                    </span>
                    <span className="sm:hidden mt-1 flex flex-wrap gap-0.5">
                      {list.slice(0, 4).map((it) => (
                        <span key={it.id}>{dot(it.color)}</span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {moveError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{moveError}</p>}
      {eventModal && <EventModal key={eventModal.event?.eventId || "new"} cal={cal} event={eventModal.event} defaultDate={cursor} defaults={eventModal.defaults} onClose={() => setEventModal(null)} />}
      {block && (
        <TimeBlockModal
          key={block.task?.id || "new"}
          range={block.range}
          task={block.task}
          openTasks={untimed}
          canAddEvent={canAddEvent}
          tasksApi={tasksApi}
          fallbackDate={cursor}
          onEvent={(r) => {
            setBlock(null);
            setEventModal({ event: null, defaults: { date: r.date, start: fromMin(r.startMin), end: fromMin(r.endMin) } });
          }}
          onClose={() => setBlock(null)}
        />
      )}
    </section>
  );
}

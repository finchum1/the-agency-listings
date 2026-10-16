import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { checkCalendarAddress, useCalendarEvents } from "../../../hooks/useCalendarEvents";
import { addDays, dayLabel, fromKey, monthGrid, startOfWeek, timeLabel, toKey } from "../../../lib/homeDates";
import { card, muted } from "./styles";

const DEAL_COLOR = "#0f766e";
const TASK_COLOR = "#b45309";
const PALETTE = ["#ed2127", "#1a5fb4", "#1c7c4d", "#7c3aed", "#0e7490", "#be185d", "#525252"];
const DEAL_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

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
  const b = e.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  return `${a} – ${b}`;
}

function step(view, cursorKey, dir) {
  const c = fromKey(cursorKey);
  if (view === "day") return toKey(addDays(c, dir));
  if (view === "week") return toKey(addDays(c, 7 * dir));
  return toKey(new Date(c.getFullYear(), c.getMonth() + dir, 1));
}

const dot = (color) => <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />;

function ItemRow({ item }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`shrink-0 w-16 text-xs pt-0.5 ${muted}`}>{item.allDay ? "All day" : timeLabel(item.start)}</span>
      <span className="mt-1.5">{dot(item.color)}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug break-words">{item.title}</span>
        {item.sub && <span className={`block text-xs truncate ${muted}`}>{item.sub}</span>}
      </span>
    </li>
  );
}

const sortItems = (a, b) => (a.allDay === b.allDay ? (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title) : a.allDay ? -1 : 1);

// Month cells have room for three lines, so appointments come before deal dates and tasks there.
const KIND_RANK = { calendar: 0, deal: 1, task: 2 };
const sortForMonth = (a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || sortItems(a, b);

// ---- linking calendars ---------------------------------------------------------------------------------------------

function CalendarsPanel({ cal, onClose }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[(cal.calendars.length + 1) % PALETTE.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const add = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const found = await checkCalendarAddress(address);
      await cal.addCalendar({ name: name.trim() || found.name || "My calendar", address: found.address, color });
      setNotice(`Linked. Found ${found.upcoming} event${found.upcoming === 1 ? "" : "s"} in the next 60 days.`);
      setAddress("");
      setName("");
      setColor(PALETTE[(cal.calendars.length + 2) % PALETTE.length]);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="mt-4 rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Your calendars</h3>
        <button type="button" onClick={onClose} className={`text-xs ${muted} hover:text-[#1c1a17] dark:hover:text-[#faf9f7]`}>
          Close
        </button>
      </div>

      {cal.calendars.length > 0 && (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {cal.calendars.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={c.enabled}
                onChange={(e) => cal.updateCalendar(c.id, { enabled: e.target.checked })}
                aria-label={`Show ${c.name}`}
                className="h-4 w-4 accent-[#ed2127]"
              />
              {dot(c.color)}
              <span className="min-w-0 flex-1 text-sm truncate">{c.name}</span>
              <button type="button" onClick={() => confirm(`Remove “${c.name}” from your schedule? Nothing changes in the calendar itself.`) && cal.removeCalendar(c.id)} className={`text-xs ${muted} hover:text-red-600 dark:hover:text-red-400`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="space-y-3">
        <p className="text-sm font-semibold">Link a Google Calendar</p>
        <ol className={`text-xs leading-relaxed list-decimal pl-4 space-y-0.5 ${muted}`}>
          <li>
            In Google Calendar on a computer, hover the calendar in the left list, click <strong>⋮</strong> → <strong>Settings and sharing</strong>.
          </li>
          <li>
            Scroll to <strong>Integrate calendar</strong> and copy the <strong>Secret address in iCal format</strong>.
          </li>
          <li>Paste it below. This works for Outlook and Apple calendars too (their “subscribe” / “published” iCal address).</li>
        </ol>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="Calendar address" className={inputClass} />
        <div className="flex flex-wrap items-center gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Calendar name" maxLength={80} className={`${inputClass} !w-48`} />
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
            {PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={color === p}
                aria-label={p}
                onClick={() => setColor(p)}
                className={`h-5 w-5 rounded-full border-2 ${color === p ? "border-[#1c1a17] dark:border-[#faf9f7]" : "border-transparent"}`}
                style={{ background: p }}
              />
            ))}
          </div>
          <button type="submit" disabled={busy || !address.trim()} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-5 py-2 disabled:opacity-50">
            {busy ? "Checking…" : "Link calendar"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {notice && <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p>}
        <p className={`text-[11px] leading-snug ${muted}`}>
          The address is private to you and only used to read events (the schedule can't change your calendar). Google refreshes these addresses every few hours, so a brand-new event can take a while to appear.
        </p>
      </form>
    </div>
  );
}

// ---- the schedule --------------------------------------------------------------------------------------------------

// Day, Week and Month views of the agent's linked calendars (read-only, by private iCal address), plus the key dates on
// their open deals and their own tasks, each switchable.
export default function ScheduleCard({ userId, wantsPeople, tasks, span }) {
  const [view, setView] = useState("day");
  const [cursor, setCursor] = useState(toKey(new Date()));
  const [show, setShow] = useState({ calendar: true, deals: true, tasks: true });
  const [managing, setManaging] = useState(false);
  const today = toKey(new Date());

  const { start, end } = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const cal = useCalendarEvents(userId, start, end);
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
        const base = { id: `${e.calendarId}-${e.uid}-${e.start || e.startDate}`, kind: "calendar", title: e.title, sub: [e.location, names[e.calendarId]].filter(Boolean).join(" · "), color: colors[e.calendarId] || "#525252", allDay: e.allDay };
        if (e.allDay) {
          for (let d = fromKey(e.startDate), n = 0; toKey(d) < e.endDate && n < 31; d = addDays(d, 1), n++) add(toKey(d), { ...base, id: `${base.id}-${toKey(d)}` });
        } else add(toKey(new Date(e.start)), { ...base, start: e.start });
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
        if (!t.done && t.due_date) add(t.due_date, { id: `task-${t.id}`, kind: "task", title: t.title, sub: "Task", color: TASK_COLOR, allDay: true });
      }
    }
    for (const list of map.values()) list.sort(sortItems);
    return map;
  }, [cal.events, cal.calendars, deals, tasks, show]);

  const itemsOn = (key) => byDay.get(key) || [];
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
        </div>
      </div>

      {managing && <CalendarsPanel cal={cal} onClose={() => setManaging(false)} />}
      {noCalendars && !managing && (
        <p className={`mt-3 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2 ${muted}`}>
          Link your Google Calendar to see your appointments here.{" "}
          <button type="button" onClick={() => setManaging(true)} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            Link a calendar
          </button>
        </p>
      )}
      {cal.errors.map((e) => (
        <p key={`${e.calendarId}-${e.message}`} className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Couldn't read “{e.name}”: {e.message}
        </p>
      ))}

      <div className={`mt-4 ${cal.loading ? "opacity-60 transition-opacity" : ""}`}>
        {view === "day" && (
          <div>
            {itemsOn(cursor).length === 0 ? (
              <p className={`text-sm py-6 text-center ${muted}`}>Nothing scheduled{cursor === today ? " today" : ""}.</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {itemsOn(cursor).map((it) => (
                  <ItemRow key={it.id} item={it} />
                ))}
              </ul>
            )}
          </div>
        )}

        {view === "week" && (
          <div className="grid gap-3 grid-cols-[minmax(0,1fr)] lg:grid-cols-7">
            {weekDays.map((key) => {
              const list = itemsOn(key);
              const isToday = key === today;
              return (
                <div key={key} className={`rounded-xl border p-2.5 min-w-0 ${isToday ? "border-[#ed2127]/40 dark:border-[#f2454b]/50 bg-[#ed2127]/[0.03]" : "border-black/10 dark:border-white/15"}`}>
                  <button type="button" onClick={() => { setCursor(key); setView("day"); }} className="block w-full text-left">
                    <span className={`block text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#ed2127] dark:text-[#f2454b]" : muted}`}>
                      {fromKey(key).toLocaleDateString(undefined, { weekday: "short" })} {fromKey(key).getDate()}
                    </span>
                  </button>
                  <ul className="mt-1.5 space-y-1.5">
                    {list.length === 0 && <li className={`text-[11px] ${muted}`}>—</li>}
                    {list.map((it) => (
                      <li key={it.id} className="flex items-start gap-1.5 min-w-0" title={`${it.allDay ? "All day" : timeLabel(it.start)} · ${it.title}${it.sub ? ` · ${it.sub}` : ""}`}>
                        <span className="mt-1.5">{dot(it.color)}</span>
                        <span className="min-w-0 text-xs leading-snug">
                          {!it.allDay && <span className={`block ${muted}`}>{timeLabel(it.start)}</span>}
                          <span className="block font-medium break-words">{it.title}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
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
    </section>
  );
}

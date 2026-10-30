import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { announceDealWork, onDealWork } from "../../../lib/dealEvents";
import { effectiveDue } from "../../../lib/checklists";
import { addDays, dayLabel, toKey } from "../../../lib/homeDates";
import { clockLabel } from "../../../lib/timeline";
import { ComplianceChip } from "./DealCompliance";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const KEY_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["inspection_period_end", "Inspection period ends"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
const UPCOMING_DAYS = 14;
const SHOW = 5;

const sum = (list, key) => list.reduce((t, p) => t + (Number(p[key]) || 0), 0);
const title = (p) => p.property_address || p.name;

function Tile({ label, value, sub, tone }) {
  return (
    <div className={`${card} p-4`}>
      <p className={`text-xs font-medium ${muted}`}>{label}</p>
      <p className={`mt-1 truncate text-xl @2xl:text-2xl font-semibold ${tone === "alert" ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${muted}`}>{sub}</p>}
    </div>
  );
}

// A row that opens its deal. With `onCheck` it has a checkbox in front, to tick the task off without opening the deal.
function Row({ onClick, primary, secondary, right, urgent, onCheck }) {
  return (
    <li className={onCheck ? "flex items-center gap-2.5" : undefined}>
      {onCheck && <input type="checkbox" checked={false} onChange={onCheck} aria-label={`Mark done: ${primary}`} className="h-4 w-4 shrink-0 accent-[#ed2127] cursor-pointer" />}
      <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{primary}</span>
          <span className={`block truncate text-xs ${urgent ? "text-red-600 dark:text-red-400" : muted}`}>{secondary}</span>
        </span>
        {right}
      </button>
    </li>
  );
}

// The home spot of Deals: where everything stands, what needs you, and what's coming up. It is the Overview page (`lineOnly` shrinks it to just the
// "needs you" link, for the board page), and every
// row opens that deal in the side panel (`openDeal`). `deals` are the agent's live (not archived) deals; the board already has them, so nothing here is
// fetched twice except the open tasks and waiting drafts.
export default function DealsHome({ deals, closedStage, stages = [], progress = {}, openDeal, selectedId, lineOnly = false }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [more, setMore] = useState({});
  const [justDone, setJustDone] = useState(null); // the task just ticked off, kept a few seconds so it can be undone
  const [taskError, setTaskError] = useState("");
  const undoTimer = useRef(null);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const load = useCallback(async () => {
    const [{ data: t }, { data: d }] = await Promise.all([
      supabase.from("transaction_tasks").select("*").eq("done", false),
      supabase.from("people_outreach").select("id, person_id, channel, subject, body").eq("status", "draft").limit(100),
    ]);
    setTasks(t || []);
    setDrafts(d || []);
  }, []);
  // Loads on arrival, and again each time a deal's panel closes (ticking tasks or sending drafts in there changes what is overdue).
  useEffect(() => {
    if (!selectedId) load();
  }, [load, selectedId]);
  // The side panel stays open beside this overview, so work done in it (a task ticked, a draft sent) reloads the list right away.
  useEffect(() => onDealWork(load), [load]);

  // Ticking a task off here is the same write the deal's own checklist makes. It leaves the list at once; a miss puts it back.
  const completeTask = async (task) => {
    setTaskError("");
    setTasks((list) => list.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("transaction_tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", task.id);
    if (error) {
      setTasks((list) => [...list, task]);
      setTaskError(error.message);
      return;
    }
    setJustDone(task);
    announceDealWork(); // the Deals bubble in the menu counts one fewer
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setJustDone(null), 8000);
  };
  const undoTask = async () => {
    const task = justDone;
    if (!task) return;
    clearTimeout(undoTimer.current);
    setJustDone(null);
    setTasks((list) => [...list, task]);
    const { error } = await supabase.from("transaction_tasks").update({ done: false, done_at: null }).eq("id", task.id);
    if (error) {
      setTasks((list) => list.filter((t) => t.id !== task.id));
      setTaskError(error.message);
    } else announceDealWork();
  };

  const now = new Date();
  const today = toKey(now);
  const horizon = toKey(addDays(now, UPCOMING_DAYS));
  const soon = toKey(addDays(now, 30));
  const year = now.getFullYear();

  // Where a deal sits on this board: a deal you coordinate sits where you put it.
  const colOf = (p) => (p._foreign ? p._column || p.stage : p.stage);
  const openDeals = deals.filter((p) => colOf(p) !== closedStage);
  // Commission is the agent's money: only deals that are yours count toward it, even when the numbers above include deals you coordinate.
  const ownOpen = openDeals.filter((p) => !p._foreign);
  const hasForeign = deals.some((p) => p._foreign);
  const closed = deals.filter((p) => colOf(p) === closedStage && Number((p.closing_date || p.updated_at || "").slice(0, 4)) === year);
  const byId = new Map(deals.map((p) => [p.id, p]));
  const where = (p) => (p._foreign ? ` · ${p._agent || "another agent"}` : "");
  const closingSoon = openDeals.filter((p) => p.closing_date && p.closing_date >= today && p.closing_date <= soon).sort((a, b) => a.closing_date.localeCompare(b.closing_date));

  const sentBack = openDeals.filter((p) => p.compliance_status === "needs_changes");
  const overdue = tasks
    .map((t) => {
      const p = openDeals.find((d) => d.id === t.person_id);
      const due = p && effectiveDue(t, p);
      return p && due && due <= today ? { task: t, person: p, due } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.due.localeCompare(b.due));
  const waitingDrafts = drafts.filter((d) => byId.has(d.person_id));
  const attention = sentBack.length + overdue.length + waitingDrafts.length;

  const upcoming = [];
  for (const p of openDeals) for (const [key, label] of KEY_DATES) if (p[key] && !(p.is_cash && (key === "appraisal_date" || key === "financing_deadline")) && p[key] >= today && p[key] <= horizon) upcoming.push({ person: p, date: p[key], label });
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const needs = [
    ...sentBack.map((p) => ({ key: `sb-${p.id}`, person: p, primary: title(p), secondary: `Sent back by compliance${where(p)}. Fix it and resubmit.`, right: <ComplianceChip status="needs_changes" />, urgent: true })),
    ...overdue.map((o) => ({ key: `t-${o.task.id}`, person: o.person, primary: o.task.text, secondary: `${title(o.person)}${where(o.person)} · due ${dayLabel(o.due, today)}`, urgent: o.due < today, onCheck: () => completeTask(o.task) })),
    ...waitingDrafts.map((d) => ({ key: `d-${d.id}`, person: byId.get(d.person_id), primary: `Draft ${d.channel === "email" ? "email" : d.channel === "text" ? "text" : "call"} waiting`, secondary: `${title(byId.get(d.person_id))}${d.subject ? ` · ${d.subject}` : ""}` })),
  ];

  // On the board page the overview is just this one line, so what needs you stays in view without taking the board's room.
  if (lineOnly) {
    if (attention === 0) return null;
    return (
      <Link to="/dashboard/deals" className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:underline">
        {attention} need{attention === 1 ? "s" : ""} you
        <span aria-hidden="true">→</span>
        <span className="sr-only">Open the overview</span>
      </Link>
    );
  }

  const list = (key, items) => {
    const expanded = !!more[key];
    return (
      <>
        <ul className="space-y-1.5">
          {(expanded ? items : items.slice(0, SHOW)).map((it) => (
            <Row key={it.key} onClick={() => openDeal(it.person.id)} primary={it.primary} secondary={it.secondary} right={it.right} urgent={it.urgent} onCheck={it.onCheck} />
          ))}
        </ul>
        {items.length > SHOW && (
          <button type="button" onClick={() => setMore((m) => ({ ...m, [key]: !expanded }))} className="mt-1.5 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            {expanded ? "Show fewer" : `${items.length - SHOW} more`}
          </button>
        )}
      </>
    );
  };

  // Where the pipeline stands: every open stage in the order of the board, then what has closed this year. Each segment opens the board.
  const stageSegs = (stages || [])
    .filter((name) => name !== closedStage)
    .map((name) => {
      const inStage = openDeals.filter((p) => colOf(p) === name);
      return { name, n: inStage.length, volume: sum(inStage, "price") };
    })
    .filter((seg) => seg.n > 0);

  // The next two weeks, in two lists: the key dates of the open deals, and the tasks that fall due (tasks already due or overdue are under "Needs your attention").
  const dateAgenda = new Map();
  const taskAgenda = new Map();
  const put = (map, date, entry) => map.set(date, [...(map.get(date) || []), entry]);
  for (const u of upcoming) {
    const time = u.label === "Inspection" && u.person.inspection_time ? clockLabel(u.person.inspection_time) : "";
    put(dateAgenda, u.date, { key: `${u.person.id}-${u.label}`, person: u.person, primary: `${u.label} · ${title(u.person)}`, secondary: `${u.person.property_address ? u.person.name : ""}${where(u.person)}`.replace(/^ · /, ""), time });
  }
  for (const t of tasks) {
    const p = openDeals.find((d) => d.id === t.person_id);
    const due = p && effectiveDue(t, p);
    if (p && due && due > today && due <= horizon) put(taskAgenda, due, { key: `t-${t.id}`, person: p, primary: t.text, secondary: `${title(p)}${where(p)}`, task: t });
  }
  const dateDays = [...dateAgenda.keys()].sort();
  const taskDays = [...taskAgenda.keys()].sort();
  // A long list of tasks is cut to the first few, so the column stays about as tall as the one beside it.
  const TASK_SHOW = 8;
  const taskCount = [...taskAgenda.values()].reduce((n, list) => n + list.length, 0);
  const shownTasks = new Map();
  let room = more.tasks ? Infinity : TASK_SHOW;
  for (const d of taskDays) {
    if (room <= 0) break;
    const take = taskAgenda.get(d).slice(0, room);
    shownTasks.set(d, take);
    room -= take.length;
  }
  const shownTaskDays = [...shownTasks.keys()];

  // A list of days, each with its heading and rows.
  const dayList = (days, agenda, { checks = false, columns = false } = {}) => (
    <div className={columns ? "grid grid-cols-1 gap-x-8 gap-y-5 @3xl:grid-cols-2" : "space-y-5"}>
      {days.map((date) => (
        <section key={date} aria-label={dayLabel(date, today)}>
          <h4 className={`mb-1.5 text-sm font-semibold ${date === today ? "text-amber-700 dark:text-amber-400" : ""}`}>{dayLabel(date, today)}</h4>
          <ul className="space-y-1.5">
            {agenda.get(date).map((a) => (
              <Row
                key={a.key}
                onClick={() => openDeal(a.person.id)}
                primary={a.primary}
                secondary={a.secondary}
                right={a.time ? <span className={`shrink-0 text-xs font-medium ${muted}`}>{a.time}</span> : null}
                onCheck={checks ? () => completeTask(a.task) : undefined}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  return (
    <section className="@container space-y-4" aria-label="Deals overview">
      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Tile label="Open deals" value={openDeals.length} sub={`${money.format(sum(openDeals, "price"))} volume${hasForeign ? ` · ${openDeals.length - ownOpen.length} coordinated` : ""}`} />
        <Tile label="Expected commission" value={hasForeign && ownOpen.length === 0 ? "–" : money.format(sum(ownOpen, "commission"))} sub={hasForeign ? "Your own deals only" : "From open deals"} />
        <Tile label="Closing in 30 days" value={closingSoon.length} sub={closingSoon[0] ? `Next: ${title(closingSoon[0])}, ${dayLabel(closingSoon[0].closing_date, today)}` : "Nothing scheduled"} />
        <Tile label="Needs you" value={attention} tone={attention ? "alert" : undefined} sub={attention ? [sentBack.length && `${sentBack.length} sent back`, overdue.length && `${overdue.length} overdue or due today`, waitingDrafts.length && `${waitingDrafts.length} draft${waitingDrafts.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ") : "All caught up"} />
      </div>

      <div className={`${card} p-4`}>
        <h3 className="font-display text-base font-semibold">Pipeline</h3>
        {stageSegs.length === 0 && closed.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>No deals yet.</p>
        ) : (
          <div className="mt-3 flex gap-2">
            {stageSegs.map((seg, i) => (
              <button
                key={seg.name}
                type="button"
                onClick={() => navigate("/dashboard/deals/board")}
                style={{ flex: `${seg.n} 1 0` }}
                className="min-w-[5.5rem] rounded-xl p-1 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                title={`${seg.name}: ${seg.n} deal${seg.n === 1 ? "" : "s"}, ${money.format(seg.volume)}. Open the board.`}
              >
                <span className="block h-2 rounded-full bg-[#1c1a17] dark:bg-[#faf9f7]" style={{ opacity: 0.2 + (0.7 * (i + 1)) / stageSegs.length }} aria-hidden="true" />
                <span className={`mt-2 block truncate text-xs font-medium ${muted}`}>{seg.name}</span>
                <span className="block text-xl font-semibold leading-tight">{seg.n}</span>
                <span className={`block truncate text-xs ${muted}`}>{compact.format(seg.volume)}</span>
              </button>
            ))}
            {closed.length > 0 && (
              <button
                type="button"
                onClick={() => navigate("/dashboard/deals/board")}
                style={{ flex: `${closed.length} 1 0` }}
                className="min-w-[5.5rem] rounded-xl p-1 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                title={`Closed in ${year}: ${closed.length}. Open the board.`}
              >
                <span className="block h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                <span className={`mt-2 block truncate text-xs font-medium ${muted}`}>Closed in {year}</span>
                <span className="block text-xl font-semibold leading-tight">{closed.length}</span>
                <span className={`block truncate text-xs ${muted}`}>{compact.format(sum(closed, "price"))}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Two columns that each take only the height they need: what needs you and the key dates on the left, the coming tasks on the right. */}
      <div className="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-2">
        <div className="space-y-4">
          <div className={`${card} p-4 space-y-2.5`}>
            <h3 className="font-display text-base font-semibold">Needs your attention</h3>
            {needs.length === 0 ? <p className={`text-sm ${muted}`}>Nothing is overdue, due today, sent back or waiting on you.</p> : list("needs", needs)}
            {justDone && (
              <p role="status" className="flex items-center justify-between gap-3 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-xs">
                <span className="min-w-0 truncate">Checked off "{justDone.text}"</span>
                <button type="button" onClick={undoTask} className="shrink-0 font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  Undo
                </button>
              </p>
            )}
            {taskError && <p className="text-xs text-red-600 dark:text-red-400">{taskError}</p>}
          </div>
          <div className={`${card} p-4 space-y-2.5`}>
            <h3 className="font-display text-base font-semibold">Key dates · next {UPCOMING_DAYS} days</h3>
            {dateDays.length === 0 ? <p className={`text-sm ${muted}`}>No contract, inspection, appraisal, financing or closing dates coming up.</p> : dayList(dateDays, dateAgenda)}
          </div>
        </div>
        <div className={`${card} p-4 space-y-2.5`}>
          <h3 className="font-display text-base font-semibold">Tasks · next {UPCOMING_DAYS} days</h3>
          {taskDays.length === 0 ? <p className={`text-sm ${muted}`}>No tasks fall due in the next {UPCOMING_DAYS} days.</p> : dayList(shownTaskDays, shownTasks, { checks: true })}
          {taskCount > TASK_SHOW && (
            <button type="button" onClick={() => setMore((m) => ({ ...m, tasks: !m.tasks }))} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
              {more.tasks ? "Show fewer" : `${taskCount - TASK_SHOW} more`}
            </button>
          )}
        </div>
      </div>

      <p className={`text-xs ${muted}`}>
        Closed in {year}: <span className="font-semibold text-[#1c1a17] dark:text-[#faf9f7]">{closed.length}</span> · {money.format(sum(closed, "price"))} volume · {money.format(sum(closed.filter((p) => !p._foreign), "commission"))} commission earned{hasForeign ? " on your own deals" : ""}
      </p>
    </section>
  );
}

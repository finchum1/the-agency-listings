import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { onDealWork } from "../../../lib/dealEvents";
import { effectiveDue } from "../../../lib/checklists";
import { addDays, dayLabel, daysBetween, toKey } from "../../../lib/homeDates";
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
    }
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

  // Open deals with something that could go wrong soon. A deal sent back by compliance is already under "Needs your attention", so it is not repeated.
  const SOON = 5;
  // "today" and "tomorrow" read mid-sentence in lower case; a date ("Thu, Nov 5") stays as it is.
  const soonLabel = (date) => {
    const l = dayLabel(date, today);
    return /^(Today|Tomorrow)$/.test(l) ? l.toLowerCase() : l;
  };
  const risks = [];
  for (const p of openDeals) {
    const why = [];
    let urgent = false;
    let when = "9999";
    const flag = (text, date, isUrgent = false) => {
      why.push(text);
      if (isUrgent) urgent = true;
      if (date && date < when) when = date;
    };
    const within = (date, days) => date && date >= today && date <= toKey(addDays(now, days));
    if (within(p.inspection_period_end, 3)) flag(`Inspection period ends ${soonLabel(p.inspection_period_end)}`, p.inspection_period_end);
    if (!p.is_cash && p.financing_deadline) {
      if (p.financing_deadline < today) flag(`Financing deadline passed ${daysBetween(p.financing_deadline, today)} day${daysBetween(p.financing_deadline, today) === 1 ? "" : "s"} ago`, p.financing_deadline, true);
      else if (within(p.financing_deadline, SOON)) flag(`Financing deadline ${soonLabel(p.financing_deadline)}`, p.financing_deadline);
    }
    if (Number(p.earnest_money) > 0 && !p.earnest_money_delivered && p.contract_date && daysBetween(p.contract_date, today) >= 3) flag(`Earnest money not delivered (${daysBetween(p.contract_date, today)} days since contract)`, today, true);
    if (p.closing_date && p.closing_date < today) flag(`Closing date passed ${daysBetween(p.closing_date, today)} day${daysBetween(p.closing_date, today) === 1 ? "" : "s"} ago`, p.closing_date, true);
    else if (within(p.closing_date, 7)) {
      const pr = progress[p.id]?.tasks;
      if (pr && pr.total > 0 && pr.done < pr.total) flag(`Closes ${soonLabel(p.closing_date)}, ${pr.done} of ${pr.total} tasks done`, p.closing_date);
      if (p.compliance_status !== "approved" && p.compliance_status !== "needs_changes") flag(`Closes ${soonLabel(p.closing_date)}, compliance not approved`, p.closing_date);
    }
    if (why.length) risks.push({ person: p, why, urgent, when });
  }
  risks.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.when.localeCompare(b.when));
  const riskItems = risks.map((r) => ({ key: `r-${r.person.id}`, person: r.person, primary: title(r.person), secondary: `${r.why.join(" · ")}${where(r.person)}`, urgent: r.urgent }));

  // The next two weeks as an agenda: key dates and tasks, grouped by day (tasks already due or overdue are under "Needs your attention").
  const agenda = new Map();
  const put = (date, entry) => agenda.set(date, [...(agenda.get(date) || []), entry]);
  for (const u of upcoming) {
    const time = u.label === "Inspection" && u.person.inspection_time ? clockLabel(u.person.inspection_time) : "";
    put(u.date, { key: `${u.person.id}-${u.label}`, kind: "date", person: u.person, primary: `${u.label} · ${title(u.person)}`, secondary: `${u.person.property_address ? u.person.name : ""}${where(u.person)}`.replace(/^ · /, ""), time });
  }
  for (const t of tasks) {
    const p = openDeals.find((d) => d.id === t.person_id);
    const due = p && effectiveDue(t, p);
    if (p && due && due > today && due <= horizon) put(due, { key: `t-${t.id}`, kind: "task", person: p, primary: t.text, secondary: `${title(p)}${where(p)}`, task: t });
  }
  const days = [...agenda.keys()].sort();

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

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
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
          <h3 className="font-display text-base font-semibold">At risk</h3>
          {riskItems.length === 0 ? <p className={`text-sm ${muted}`}>No deadlines are close or overdue, and nothing is missing before a closing.</p> : list("risks", riskItems)}
        </div>
      </div>

      <div className={`${card} p-4`}>
        <h3 className="font-display text-base font-semibold">Next {UPCOMING_DAYS} days</h3>
        {days.length === 0 ? (
          <p className={`mt-2 text-sm ${muted}`}>No contract, inspection, appraisal, financing or closing dates, or tasks, coming up.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-5 @3xl:grid-cols-2">
            {days.map((date) => (
              <section key={date} aria-label={dayLabel(date, today)}>
                <h4 className="mb-1.5">
                  <span className={`text-sm font-semibold ${date === today ? "text-amber-700 dark:text-amber-400" : ""}`}>{dayLabel(date, today)}</span>
                </h4>
                <ul className="space-y-1.5">
                  {agenda.get(date).map((a) => (
                    <Row
                      key={a.key}
                      onClick={() => openDeal(a.person.id)}
                      primary={a.primary}
                      secondary={a.secondary}
                      right={a.time ? <span className={`shrink-0 text-xs font-medium ${muted}`}>{a.time}</span> : a.kind === "task" ? <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Task</span> : null}
                      onCheck={a.kind === "task" ? () => completeTask(a.task) : undefined}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <p className={`text-xs ${muted}`}>
        Closed in {year}: <span className="font-semibold text-[#1c1a17] dark:text-[#faf9f7]">{closed.length}</span> · {money.format(sum(closed, "price"))} volume · {money.format(sum(closed.filter((p) => !p._foreign), "commission"))} commission earned{hasForeign ? " on your own deals" : ""}
      </p>
    </section>
  );
}

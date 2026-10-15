import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { effectiveDue } from "../../../lib/checklists";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { addDays, dayLabel, daysBetween, toKey } from "../../../lib/homeDates";
import ContactButtons from "../people/ContactButtons";
import PersonPanel from "../people/PersonPanel";
import { card, linkClass, muted } from "./styles";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const KEY_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
const BOARD_ROUTES = { lead: "leads", pipeline: "pipeline", transaction: "transactions" };
const SHOW = 5;

function Tile({ label, value, sub, to, alert }) {
  const body = (
    <>
      <p className={`text-xs font-medium ${muted}`}>{label}</p>
      <p className={`text-3xl font-semibold mt-1.5 leading-none ${alert ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
      {sub && <p className={`text-xs mt-2 truncate ${muted}`}>{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className={`${card} !p-5 block hover:shadow-sm transition-shadow`}>
      {body}
    </Link>
  ) : (
    <div className={`${card} !p-5`}>{body}</div>
  );
}

// The People half of the home page: counts that matter, who to call today, and what is coming up on deals.
// Mirrors the full Overview (which stays one click away) but only shows the top few of each list.
export default function PeopleHighlights({ onSummary }) {
  const { people, loading, refresh } = usePeople();
  const { stages, closedStage } = usePeopleStages();
  const [openTasks, setOpenTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from("transaction_tasks").select("*").eq("done", false);
    setOpenTasks(data || []);
  }, []);
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const completeTask = async (id) => {
    setOpenTasks((list) => list.filter((t) => t.id !== id));
    const { error } = await supabase.from("transaction_tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", id);
    if (error) loadTasks();
  };

  const now = new Date();
  const today = toKey(now);
  const weekAgo = toKey(addDays(now, -7));
  const in7 = toKey(addDays(now, 7));
  const in30 = toKey(addDays(now, 30));

  const data = useMemo(() => {
    const live = people.filter((p) => !p.archived);
    const openDeals = live.filter((p) => p.stage_group === "transaction" && p.stage !== closedStage);
    const dueNow = live.filter((p) => p.next_follow_up && p.next_follow_up <= today).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up));
    const newThisWeek = live.filter((p) => (p.created_at || "").slice(0, 10) >= weekAgo);
    const closings = openDeals.filter((p) => p.closing_date && p.closing_date >= today && p.closing_date <= in30).sort((a, b) => a.closing_date.localeCompare(b.closing_date));
    const keyDates = [];
    for (const p of openDeals) {
      for (const [key, label] of KEY_DATES) {
        const date = p[key];
        if (date && date >= today && date <= in7) keyDates.push({ person: p, date, label });
      }
    }
    keyDates.sort((a, b) => a.date.localeCompare(b.date));
    const tasks = openTasks
      .map((t) => {
        const person = openDeals.find((p) => p.id === t.person_id);
        return person ? { task: t, person, due: effectiveDue(t, person) } : null;
      })
      .filter((x) => x && x.due && x.due <= in7)
      .sort((a, b) => a.due.localeCompare(b.due));
    return { live, openDeals, dueNow, newThisWeek, closings, keyDates, tasks, overdueTasks: tasks.filter((t) => t.due < today) };
  }, [people, openTasks, closedStage, today, weekAgo, in7, in30]);

  useEffect(() => {
    if (!loading) onSummary?.({ dueNow: data.dueNow.length, overdueTasks: data.overdueTasks.length });
  }, [loading, data.dueNow.length, data.overdueTasks.length, onSummary]);

  if (loading) return <p className={`text-sm ${muted}`}>Loading your people…</p>;

  const volume = data.openDeals.reduce((t, p) => t + (Number(p.price) || 0), 0);
  const boardCount = (g) => data.live.filter((p) => p.stage_group === g).length;
  const selected = people.find((p) => p.id === selectedId) || null;
  const nextClosing = data.closings[0];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-xl font-semibold">People</h2>
        <div className="flex items-center gap-4 text-sm">
          {["lead", "pipeline", "transaction"].map((g) => (
            <Link key={g} to={`/dashboard/people/${BOARD_ROUTES[g]}`} className={`${muted} hover:text-[#1c1a17] dark:hover:text-[#faf9f7]`}>
              {BOARDS[g].title} <strong className="text-[#1c1a17] dark:text-[#faf9f7]">{boardCount(g)}</strong>
            </Link>
          ))}
          <Link to="/dashboard/people/overview" className={linkClass}>
            Full overview →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        <Tile label="New this week" value={data.newThisWeek.length} sub="Leads and contacts added" to="/dashboard/people/leads" />
        <Tile
          label="Follow-ups due"
          value={data.dueNow.length}
          sub={data.dueNow.length ? "Today and overdue" : "Nobody waiting"}
          to="/dashboard/people/overview"
          alert={data.dueNow.some((p) => p.next_follow_up < today)}
        />
        <Tile label="Open deals" value={data.openDeals.length} sub={`${money.format(volume)} volume`} to="/dashboard/people/transactions" />
        <Tile
          label="Closing in 30 days"
          value={data.closings.length}
          sub={nextClosing ? `Next: ${nextClosing.name} · ${dayLabel(nextClosing.closing_date, today)}` : "Nothing scheduled"}
          to="/dashboard/people/transactions"
        />
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
        <div className={`${card} space-y-3`}>
          <h3 className="font-display text-base font-semibold">Follow up now</h3>
          {data.dueNow.length === 0 ? (
            <p className={`text-sm ${muted}`}>No one is due for a follow-up. Nice work.</p>
          ) : (
            <ul className="space-y-2">
              {data.dueNow.slice(0, SHOW).map((p) => (
                <li key={p.id} className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 space-y-2">
                  <button type="button" onClick={() => setSelectedId(p.id)} className="block w-full text-left">
                    <span className="block text-sm font-medium truncate">{p.name}</span>
                    <span className={`block text-xs truncate ${p.next_follow_up < today ? "text-red-600 dark:text-red-400" : muted}`}>
                      {BOARDS[p.stage_group].title} · {p.stage} · {dayLabel(p.next_follow_up, today)}
                    </span>
                  </button>
                  <ContactButtons person={p} size="sm" />
                </li>
              ))}
            </ul>
          )}
          {data.dueNow.length > SHOW && (
            <Link to="/dashboard/people/overview" className={linkClass}>
              {data.dueNow.length - SHOW} more →
            </Link>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${card} space-y-3`}>
            <h3 className="font-display text-base font-semibold">Coming up · next 7 days</h3>
            {data.keyDates.length === 0 ? (
              <p className={`text-sm ${muted}`}>No inspections, appraisals or closings this week.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.keyDates.slice(0, SHOW + 1).map((it) => (
                  <li key={`${it.person.id}-${it.label}`}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(it.person.id)}
                      className="w-full text-left flex items-baseline gap-3 rounded-lg px-1 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    >
                      <span className={`shrink-0 w-24 text-xs font-semibold ${daysBetween(today, it.date) <= 1 ? "text-[#ed2127] dark:text-[#f2454b]" : muted}`}>
                        {dayLabel(it.date, today)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{it.label}</span>
                        <span className={`block text-xs truncate ${muted}`}>
                          {it.person.name}
                          {it.person.property_address ? ` · ${it.person.property_address}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={`${card} space-y-3`}>
            <h3 className="font-display text-base font-semibold">
              Tasks due
              {data.overdueTasks.length > 0 && <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">{data.overdueTasks.length} overdue</span>}
            </h3>
            {data.tasks.length === 0 ? (
              <p className={`text-sm ${muted}`}>No transaction tasks due this week.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.tasks.slice(0, SHOW).map(({ task, person, due }) => (
                  <li key={task.id} className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => completeTask(task.id)}
                      aria-label="Mark done"
                      className="mt-1 h-4 w-4 shrink-0 accent-[#ed2127]"
                    />
                    <button type="button" onClick={() => setSelectedId(person.id)} className="min-w-0 flex-1 text-left">
                      <span className="block text-sm leading-snug">{task.text}</span>
                      <span className={`block text-xs mt-0.5 truncate ${due < today ? "text-red-600 dark:text-red-400" : muted}`}>
                        {person.name} · {dayLabel(due, today)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {data.tasks.length > SHOW && (
              <Link to="/dashboard/people/overview" className={linkClass}>
                {data.tasks.length - SHOW} more →
              </Link>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <PersonPanel
          key={selected.id}
          person={selected}
          stageNames={stages[selected.stage_group]}
          nextStageNames={BOARDS[selected.stage_group].next ? stages[BOARDS[selected.stage_group].next.group] : null}
          prevStageNames={BOARDS[selected.stage_group].prev ? stages[BOARDS[selected.stage_group].prev.group] : null}
          position={0}
          total={0}
          onClose={() => {
            setSelectedId(null);
            loadTasks();
          }}
          onChanged={refresh}
        />
      )}
    </section>
  );
}

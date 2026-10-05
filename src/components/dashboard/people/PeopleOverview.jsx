import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { effectiveDue } from "../../../lib/checklists";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import ContactButtons from "./ContactButtons";
import PersonPanel from "./PersonPanel";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const BOARD_ROUTES = { lead: "leads", pipeline: "pipeline", transaction: "transactions" };

const KEY_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];

const UPCOMING_DAYS = 14;
const FOLLOW_UP_DAYS = 7;

function toKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d, n) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dayLabel(key, todayKeyStr) {
  const d = fromKey(key);
  const diff = Math.round((d - fromKey(todayKeyStr)) / 86400000);
  const base = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  if (diff < 0) return `${base} · ${-diff} day${diff === -1 ? "" : "s"} ago`;
  return base;
}

const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

function BoardTile({ group, people, stages }) {
  const board = BOARDS[group];
  const rows = people.filter((p) => p.stage_group === group && !p.archived);
  return (
    <Link to={`/dashboard/people/${BOARD_ROUTES[group]}`} className={`${card} block hover:shadow-sm transition-shadow`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">{board.title}</h2>
        <span className="text-2xl font-semibold">{rows.length}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {stages.map((s) => (
          <li key={s} className="flex items-center justify-between text-sm">
            <span className={muted}>{s}</span>
            <span className="font-medium">{rows.filter((p) => p.stage === s).length}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function ValueTile({ label, value, sub }) {
  return (
    <div className={card}>
      <p className={`text-xs font-medium ${muted}`}>{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${muted}`}>{sub}</p>}
    </div>
  );
}

export default function PeopleOverview() {
  const { people, loading, error, refresh } = usePeople();
  const { stages, closedStage } = usePeopleStages();
  const [selectedId, setSelectedId] = useState(null);
  const [openTasks, setOpenTasks] = useState([]);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from("transaction_tasks").select("*").eq("done", false);
    setOpenTasks(data || []);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const completeTask = async (id) => {
    setOpenTasks((list) => list.filter((t) => t.id !== id));
    const { error: err } = await supabase
      .from("transaction_tasks")
      .update({ done: true, done_at: new Date().toISOString() })
      .eq("id", id);
    if (err) loadTasks();
  };

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  const now = new Date();
  const today = toKey(now);
  const horizon = toKey(addDays(now, UPCOMING_DAYS));
  const followHorizon = toKey(addDays(now, FOLLOW_UP_DAYS));
  const year = now.getFullYear();

  const live = people.filter((p) => !p.archived);
  const transactions = live.filter((p) => p.stage_group === "transaction");
  const openDeals = transactions.filter((p) => p.stage !== closedStage);
  const closedThisYear = transactions.filter(
    (p) => p.stage === closedStage && Number((p.closing_date || p.updated_at || "").slice(0, 4)) === year,
  );
  const sum = (list, key) => list.reduce((t, p) => t + (Number(p[key]) || 0), 0);

  const upcoming = [];
  for (const p of openDeals) {
    for (const [key, label] of KEY_DATES) {
      const date = p[key];
      if (date && date >= today && date <= horizon) upcoming.push({ person: p, date, label });
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  const upcomingByDay = [];
  for (const item of upcoming) {
    const last = upcomingByDay[upcomingByDay.length - 1];
    if (last && last.date === item.date) last.items.push(item);
    else upcomingByDay.push({ date: item.date, items: [item] });
  }

  const followUps = live
    .filter((p) => p.next_follow_up && p.next_follow_up <= followHorizon)
    .sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up));
  const dueNow = followUps.filter((p) => p.next_follow_up <= today);
  const dueSoon = followUps.filter((p) => p.next_follow_up > today);

  const dueTasks = openTasks
    .map((t) => {
      const person = openDeals.find((p) => p.id === t.person_id);
      return person ? { task: t, person, due: effectiveDue(t, person) } : null;
    })
    .filter((x) => x && x.due && x.due <= followHorizon)
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdueTasks = dueTasks.filter((x) => x.due < today);
  const upcomingTasks = dueTasks.filter((x) => x.due >= today);

  const selected = people.find((p) => p.id === selectedId) || null;

  const personRow = (p, right) => (
    <li key={p.id + (right || "")}>
      <button
        type="button"
        onClick={() => setSelectedId(p.id)}
        className="w-full text-left rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      >
        <span className="block text-sm font-medium truncate">{p.name}</span>
        <span className={`block text-xs truncate ${muted}`}>
          {right}
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Overview</h1>
        <p className="text-sm mt-1 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Where your people, pipeline and deals stand right now.</p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        {["lead", "pipeline", "transaction"].map((g) => (
          <BoardTile key={g} group={g} people={people} stages={stages[g]} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ValueTile label="Open deals" value={openDeals.length} sub={`${money.format(sum(openDeals, "price"))} volume`} />
        <ValueTile label="Expected commission" value={money.format(sum(openDeals, "commission"))} sub="From open transactions" />
        <ValueTile
          label={`Closed in ${year}`}
          value={closedThisYear.length}
          sub={`${money.format(sum(closedThisYear, "price"))} volume`}
        />
        <ValueTile label={`Commission earned ${year}`} value={money.format(sum(closedThisYear, "commission"))} sub={`Deals in "${closedStage}"`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} space-y-3`}>
          <h2 className="font-display text-base font-semibold">Key dates · next {UPCOMING_DAYS} days</h2>
          {upcomingByDay.length === 0 ? (
            <p className={`text-sm ${muted}`}>No contract, inspection, appraisal, financing or closing dates coming up.</p>
          ) : (
            <div className="space-y-4">
              {upcomingByDay.map((day) => (
                <div key={day.date} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                    {dayLabel(day.date, today)}
                  </p>
                  <ul className="space-y-1.5">
                    {day.items.map((it) =>
                      personRow(it.person, `${it.label}${it.person.property_address ? ` · ${it.person.property_address}` : ""}`),
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-display text-base font-semibold">Follow-ups</h2>
          {followUps.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nobody is due for a follow-up in the next {FOLLOW_UP_DAYS} days.</p>
          ) : (
            <div className="space-y-4">
              {[
                ["Due today & overdue", dueNow],
                [`Next ${FOLLOW_UP_DAYS} days`, dueSoon],
              ]
                .filter(([, list]) => list.length > 0)
                .map(([title, list]) => (
                  <div key={title} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                      {title} ({list.length})
                    </p>
                    <ul className="space-y-1.5">
                      {list.map((p) => (
                        <li key={p.id} className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 space-y-2">
                          <button type="button" onClick={() => setSelectedId(p.id)} className="block w-full text-left">
                            <span className="block text-sm font-medium truncate">{p.name}</span>
                            <span
                              className={`block text-xs truncate ${
                                p.next_follow_up < today ? "text-red-600 dark:text-red-400" : muted
                              }`}
                            >
                              {BOARDS[p.stage_group].title} · {p.stage} · {dayLabel(p.next_follow_up, today)}
                            </span>
                          </button>
                          <ContactButtons person={p} size="sm" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      <section className={`${card} space-y-3`}>
        <h2 className="font-display text-base font-semibold">Checklist tasks due</h2>
        {dueTasks.length === 0 ? (
          <p className={`text-sm ${muted}`}>No checklist tasks are overdue or due in the next {FOLLOW_UP_DAYS} days.</p>
        ) : (
          <div className="space-y-4">
            {[
              ["Overdue", overdueTasks],
              [`Next ${FOLLOW_UP_DAYS} days`, upcomingTasks],
            ]
              .filter(([, list]) => list.length > 0)
              .map(([title, list]) => (
                <div key={title} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                    {title} ({list.length})
                  </p>
                  <ul className="space-y-1.5">
                    {list.map(({ task, person, due }) => (
                      <li key={task.id} className="flex items-start gap-2.5 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => completeTask(task.id)}
                          aria-label="Mark done"
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#ed2127]"
                        />
                        <button type="button" onClick={() => setSelectedId(person.id)} className="min-w-0 flex-1 text-left">
                          <span className="block text-sm leading-snug">{task.text}</span>
                          <span className={`block text-xs mt-0.5 truncate ${due < today ? "text-red-600 dark:text-red-400" : muted}`}>
                            {person.name}
                            {person.property_address ? ` · ${person.property_address}` : ""} · {dayLabel(due, today)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

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
    </div>
  );
}

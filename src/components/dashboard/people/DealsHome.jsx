import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { effectiveDue } from "../../../lib/checklists";
import { addDays, dayLabel, toKey } from "../../../lib/homeDates";
import { ComplianceChip } from "./DealCompliance";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const KEY_DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
const UPCOMING_DAYS = 14;
const SHOW = 5;
const OPEN_KEY = "dealsOverviewOpen";

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

function Row({ onClick, primary, secondary, right, urgent }) {
  return (
    <li>
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

// The home spot of Deals: where everything stands, what needs you, and what's coming up. It sits above the board, can be folded away, and every
// row opens that deal in the side panel (`openDeal`). `deals` are the agent's live (not archived) deals; the board already has them, so nothing here is
// fetched twice except the open tasks and waiting drafts.
export default function DealsHome({ deals, closedStage, openDeal, selectedId }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [tasks, setTasks] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [more, setMore] = useState({});

  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? "0" : "1");
      } catch {
        /* a remembered fold is a convenience */
      }
      return !v;
    });

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
      return p && due && due < today ? { task: t, person: p, due } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.due.localeCompare(b.due));
  const waitingDrafts = drafts.filter((d) => byId.has(d.person_id));
  const attention = sentBack.length + overdue.length + waitingDrafts.length;

  const upcoming = [];
  for (const p of openDeals) for (const [key, label] of KEY_DATES) if (p[key] && p[key] >= today && p[key] <= horizon) upcoming.push({ person: p, date: p[key], label });
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

  const needs = [
    ...sentBack.map((p) => ({ key: `sb-${p.id}`, person: p, primary: title(p), secondary: `Sent back by compliance${where(p)}. Fix it and resubmit.`, right: <ComplianceChip status="needs_changes" />, urgent: true })),
    ...overdue.map((o) => ({ key: `t-${o.task.id}`, person: o.person, primary: o.task.text, secondary: `${title(o.person)}${where(o.person)} · due ${dayLabel(o.due, today)}`, urgent: true })),
    ...waitingDrafts.map((d) => ({ key: `d-${d.id}`, person: byId.get(d.person_id), primary: `Draft ${d.channel === "email" ? "email" : d.channel === "text" ? "text" : "call"} waiting`, secondary: `${title(byId.get(d.person_id))}${d.subject ? ` · ${d.subject}` : ""}` })),
  ];

  if (!open) {
    return (
      <div className={`${card} flex flex-wrap items-center justify-between gap-3 px-4 py-3`}>
        <p className="text-sm">
          <span className="font-semibold">{openDeals.length}</span> <span className={muted}>open · </span>
          <span className="font-semibold">{compact.format(sum(ownOpen, "commission"))}</span> <span className={muted}>expected commission</span>
          {attention > 0 && <span className="font-semibold text-red-600 dark:text-red-400"> · {attention} need{attention === 1 ? "s" : ""} you</span>}
        </p>
        <button type="button" onClick={toggle} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          Show overview
        </button>
      </div>
    );
  }

  const list = (key, items) => {
    const expanded = !!more[key];
    return (
      <>
        <ul className="space-y-1.5">
          {(expanded ? items : items.slice(0, SHOW)).map((it) => (
            <Row key={it.key} onClick={() => openDeal(it.person.id)} primary={it.primary} secondary={it.secondary} right={it.right} urgent={it.urgent} />
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

  // Key dates grouped by day, flattened to rows that show the day beside each item.
  const dateItems = upcoming.map((u, i) => ({ key: `${u.person.id}-${u.label}-${i}`, person: u.person, primary: `${u.label} · ${title(u.person)}`, secondary: `${u.person.property_address ? u.person.name : ""}${where(u.person)}`.replace(/^ · /, ""), right: <span className={`shrink-0 text-xs font-medium ${u.date === today ? "text-amber-700 dark:text-amber-400" : muted}`}>{dayLabel(u.date, today)}</span> }));

  return (
    <section className="@container space-y-4" aria-label="Deals overview">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Overview</h2>
        <button type="button" onClick={toggle} className="text-xs font-semibold text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:underline">
          Hide overview
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        <Tile label="Open deals" value={openDeals.length} sub={`${money.format(sum(openDeals, "price"))} volume${hasForeign ? ` · ${openDeals.length - ownOpen.length} coordinated` : ""}`} />
        <Tile label="Expected commission" value={hasForeign && ownOpen.length === 0 ? "–" : money.format(sum(ownOpen, "commission"))} sub={hasForeign ? "Your own deals only" : "From open deals"} />
        <Tile label="Closing in 30 days" value={closingSoon.length} sub={closingSoon[0] ? `Next: ${title(closingSoon[0])}, ${dayLabel(closingSoon[0].closing_date, today)}` : "Nothing scheduled"} />
        <Tile label="Needs you" value={attention} tone={attention ? "alert" : undefined} sub={attention ? [sentBack.length && `${sentBack.length} sent back`, overdue.length && `${overdue.length} overdue`, waitingDrafts.length && `${waitingDrafts.length} draft${waitingDrafts.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ") : "All caught up"} />
      </div>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
        <div className={`${card} p-4 space-y-2.5`}>
          <h3 className="font-display text-base font-semibold">Needs your attention</h3>
          {needs.length === 0 ? <p className={`text-sm ${muted}`}>Nothing is overdue, sent back or waiting on you.</p> : list("needs", needs)}
        </div>
        <div className={`${card} p-4 space-y-2.5`}>
          <h3 className="font-display text-base font-semibold">Coming up · next {UPCOMING_DAYS} days</h3>
          {dateItems.length === 0 ? <p className={`text-sm ${muted}`}>No contract, inspection, appraisal, financing or closing dates coming up.</p> : list("dates", dateItems)}
        </div>
      </div>

      <p className={`text-xs ${muted}`}>
        Closed in {year}: <span className="font-semibold text-[#1c1a17] dark:text-[#faf9f7]">{closed.length}</span> · {money.format(sum(closed, "price"))} volume · {money.format(sum(closed.filter((p) => !p._foreign), "commission"))} commission earned{hasForeign ? " on your own deals" : ""}
      </p>
    </section>
  );
}

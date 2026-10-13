import { useState } from "react";
import TransactionChecklist from "./TransactionChecklist";
import TransactionDocuments from "./TransactionDocuments";

// Small circular progress indicator with the percentage in the middle; turns
// green once everything is done.
function ProgressRing({ done, total, size = 44 }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const complete = total > 0 && done === total;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-black/10 dark:stroke-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`transition-[stroke-dashoffset] duration-500 ${complete ? "stroke-emerald-500" : "stroke-[#ed2127] dark:stroke-[#f2454b]"}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

function Module({ title, summary, unit, children }) {
  const { done = 0, total = 0 } = summary || {};
  return (
    <section className="min-w-0 rounded-2xl border border-black/10 dark:border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {total > 0 ? `${done} of ${total} ${unit}` : "Nothing added yet"}
          </p>
        </div>
        {total > 0 && <ProgressRing done={done} total={total} />}
      </div>
      {children}
    </section>
  );
}

// The deal's Tasks and Documents, side by side under the contact info and
// Details. Each reports its done/total up here for the progress ring and bar.
export default function TransactionModules({ person, side, dates }) {
  const [summary, setSummary] = useState({});
  const report = (key) => (s) =>
    setSummary((prev) => (prev[key]?.done === s.done && prev[key]?.total === s.total ? prev : { ...prev, [key]: s }));

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Module title="Tasks" unit="done" summary={summary.tasks}>
        <TransactionChecklist person={person} side={side} dates={dates} onSummary={report("tasks")} />
      </Module>
      <Module title="Documents" unit="collected" summary={summary.documents}>
        <TransactionDocuments person={person} side={side} onSummary={report("documents")} />
      </Module>
    </div>
  );
}

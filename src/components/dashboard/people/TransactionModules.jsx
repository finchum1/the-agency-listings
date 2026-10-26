import { useState } from "react";
import TransactionChecklist from "./TransactionChecklist";
import TransactionDocuments from "./TransactionDocuments";
import ProgressRing from "./ProgressRing";

// Clicking the header folds the whole card down to its title, count and
// ring. The body stays mounted (just hidden) so the counts keep updating.
function Module({ title, summary, unit, children }) {
  const { done = 0, total = 0 } = summary || {};
  const [open, setOpen] = useState(true);
  return (
    <section className="min-w-0 rounded-2xl border border-black/10 dark:border-white/10 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0">
            <span className="block font-display text-base font-semibold">{title}</span>
            <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              {total > 0 ? `${done} of ${total} ${unit}` : "Nothing added yet"}
            </span>
          </span>
        </span>
        {total > 0 && <ProgressRing done={done} total={total} />}
      </button>
      <div hidden={!open} className="pt-4">
        {children}
      </div>
    </section>
  );
}

// The deal's Tasks and Documents, side by side under the contact info and
// Details. Each reports its done/total up here for the progress ring and bar.
export default function TransactionModules({ person, side, dates, viewer = "owner" }) {
  const [summary, setSummary] = useState({});
  const report = (key) => (s) =>
    setSummary((prev) => (prev[key]?.done === s.done && prev[key]?.total === s.total ? prev : { ...prev, [key]: s }));

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      <Module title="Tasks" unit="done" summary={summary.tasks}>
        <TransactionChecklist person={person} side={side} dates={dates} onSummary={report("tasks")} viewer={viewer} />
      </Module>
      <Module title="Documents" unit="collected" summary={summary.documents}>
        <TransactionDocuments person={person} side={side} onSummary={report("documents")} viewer={viewer} />
      </Module>
    </div>
  );
}

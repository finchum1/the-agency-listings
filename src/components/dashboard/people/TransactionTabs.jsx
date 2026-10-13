import { useState } from "react";
import TransactionChecklist from "./TransactionChecklist";
import TransactionDocuments from "./TransactionDocuments";

const TABS = [
  { key: "transaction", label: "Transaction" },
  { key: "tasks", label: "Tasks" },
  { key: "documents", label: "Documents" },
];

// Deal details, Tasks and Documents share one slot so each is a tap away
// instead of stacked in one long scroll. All stay mounted (the inactive
// ones are just hidden) so the Tasks/Documents tabs can show their counts.
// A deal with no side picked yet opens on the details, since that's the
// first thing to fill in; otherwise it opens on the task checklist.
export default function TransactionTabs({ person, side, dates, details }) {
  const [tab, setTab] = useState(side ? "tasks" : "transaction");
  const [summary, setSummary] = useState({});
  const report = (key) => (s) =>
    setSummary((prev) => (prev[key]?.done === s.done && prev[key]?.total === s.total ? prev : { ...prev, [key]: s }));

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 border-b border-black/10 dark:border-white/10">
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          const s = summary[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`-mb-px px-3.5 py-2 text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? "border-[#ed2127] dark:border-[#f2454b] text-[#1c1a17] dark:text-[#faf9f7]"
                  : "border-transparent text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              }`}
            >
              {label}
              {s && s.total > 0 && (
                <span className="ml-1.5 text-xs font-medium text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
                  {s.done}/{s.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" hidden={tab !== "transaction"}>
        {details}
      </div>
      <div role="tabpanel" hidden={tab !== "tasks"}>
        <TransactionChecklist person={person} side={side} dates={dates} onSummary={report("tasks")} />
      </div>
      <div role="tabpanel" hidden={tab !== "documents"}>
        <TransactionDocuments person={person} side={side} onSummary={report("documents")} />
      </div>
    </div>
  );
}

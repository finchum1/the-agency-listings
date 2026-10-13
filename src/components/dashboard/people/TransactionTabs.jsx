import { useState } from "react";
import TransactionChecklist from "./TransactionChecklist";
import TransactionDocuments from "./TransactionDocuments";

const TABS = [
  { key: "tasks", label: "Tasks" },
  { key: "documents", label: "Documents" },
];

// Tasks and Documents share one slot on the deal so the paperwork is a tap
// away instead of buried under the task checklist. Both stay mounted (the
// inactive one is just hidden) so each tab can show its done/total count.
export default function TransactionTabs({ person, side, dates }) {
  const [tab, setTab] = useState("tasks");
  const [summary, setSummary] = useState({});
  const report = (key) => (s) =>
    setSummary((prev) => (prev[key]?.done === s.done && prev[key]?.total === s.total ? prev : { ...prev, [key]: s }));

  return (
    <div className="space-y-3 pt-4 mt-1 border-t border-black/5 dark:border-white/10">
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
      <div role="tabpanel" hidden={tab !== "tasks"}>
        <TransactionChecklist person={person} side={side} dates={dates} onSummary={report("tasks")} />
      </div>
      <div role="tabpanel" hidden={tab !== "documents"}>
        <TransactionDocuments person={person} side={side} onSummary={report("documents")} />
      </div>
    </div>
  );
}

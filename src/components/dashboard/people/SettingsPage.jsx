import { useState } from "react";
import { Link } from "react-router-dom";
import { SIDE_LABELS } from "../../../lib/checklists";
import ChecklistTemplateEditor from "./ChecklistTemplateEditor";

export default function SettingsPage() {
  const [side, setSide] = useState("buyer");
  const [kind, setKind] = useState("tasks");
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/dashboard/profile" className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
          ← My Profile
        </Link>
        <h1 className="text-2xl font-display font-semibold mt-2">Transactions Checklist</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          Your buyer and seller task and document lists. When you add one to a deal, it copies the list for that side —
          editing it here never changes deals already in progress.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
      <div className="inline-flex rounded-full border border-black/10 dark:border-white/15 p-0.5 text-sm font-medium">
        {[
          ["tasks", "Tasks"],
          ["documents", "Documents"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setKind(key)}
            className={`px-4 py-1.5 rounded-full transition-colors ${
              kind === key ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-full border border-black/10 dark:border-white/15 p-0.5 text-sm font-medium">
        {Object.entries(SIDE_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSide(key)}
            className={`px-4 py-1.5 rounded-full transition-colors ${
              side === key ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>

      <ChecklistTemplateEditor key={`${kind}-${side}`} side={side} kind={kind} />
    </div>
  );
}

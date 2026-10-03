import { useState } from "react";
import { SIDE_LABELS } from "../../../lib/checklists";
import ChecklistTemplateEditor from "./ChecklistTemplateEditor";

export default function SettingsPage() {
  const [side, setSide] = useState("buyer");
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Settings</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          Your transaction checklist templates. When you add a checklist to a deal, it copies the template for that side —
          editing a template here never changes deals already in progress.
        </p>
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
            {label} checklist
          </button>
        ))}
      </div>

      <ChecklistTemplateEditor key={side} side={side} />
    </div>
  );
}

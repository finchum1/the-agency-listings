import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { startPlan } from "../../../lib/plansApi";
import { isOccasion, startText, stepSummary } from "../../../lib/plans";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const control = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

// "Start a plan" for a group: everyone in a board column, the rows ticked in a list, or the contacts ticked in Contacts. The plan's first steps run
// straight away, like starting it from one card.
export default function StartPlanModal({ personIds = [], contactIds = [], label, onClose, onDone }) {
  const [plans, setPlans] = useState(null);
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const count = personIds.length + contactIds.length;

  useEffect(() => {
    supabase
      .from("plans")
      .select("id, name, steps, starts_when, active")
      .order("created_at")
      .then(({ data }) => setPlans((data || []).filter((p) => !isOccasion(p.starts_when))));
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const plan = plans?.find((p) => p.id === planId);
  const hasMove = plan?.steps.some((s) => s.type === "move");
  const go = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const r = await startPlan(plan, { personIds, contactIds });
      setResult(r);
      onDone?.(r);
    } catch (e) {
      setError(e.message || "Couldn't start the plan.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Start a plan" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 p-5 space-y-4 shadow-xl">
        <div>
          <h2 className="text-lg font-display font-semibold">Start a plan</h2>
          <p className={`text-sm ${muted}`}>
            For {count} {count === 1 ? "person" : "people"}{label ? ` (${label})` : ""}. Its first steps happen right away; nothing is sent.
          </p>
        </div>
        {result ? (
          <div className="space-y-3">
            <p className="text-sm" role="status">
              Started for {result.started}.{result.already ? ` ${result.already} already on it.` : ""}
              {result.skipped.length ? ` Left out ${result.skipped.length} (${[...new Set(result.skipped)].join(", ")}).` : ""}
            </p>
            <button type="button" onClick={onClose} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2 text-sm font-semibold text-white">Done</button>
          </div>
        ) : plans === null ? (
          <p className={`text-sm ${muted}`}>Loading…</p>
        ) : plans.length === 0 ? (
          <p className={`text-sm ${muted}`}>You don't have any plans yet. Make one under People → Plans.</p>
        ) : (
          <>
            <label className="block text-sm">
              <span className={`mb-1 block text-xs font-medium ${muted}`}>Plan</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={control} autoFocus>
                <option value="">Choose a plan…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            {plan && (
              <div className="rounded-xl bg-black/[0.03] dark:bg-white/5 p-3 text-xs space-y-1">
                <p className={muted}>{startText(plan.starts_when)}</p>
                {plan.steps.slice(0, 6).map((s, i) => (
                  <p key={i}><span className={muted}>Day {s.day}:</span> {stepSummary(s)}</p>
                ))}
                {plan.steps.length > 6 && <p className={muted}>and {plan.steps.length - 6} more…</p>}
              </div>
            )}
            {plan && contactIds.length > 0 && (
              <p className={`text-xs ${muted}`}>
                A contact with a Leads or Pipeline card goes on the plan through the card. One without a card gets the steps as to-dos on their contact{hasMove ? " (the plan's move step is skipped for them)" : ""}.
              </p>
            )}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={go} disabled={!plan || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? "Starting…" : `Start for ${count}`}
              </button>
              <button type="button" onClick={onClose} className={`text-sm ${muted} hover:underline`}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

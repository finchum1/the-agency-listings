import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { runMyPlans } from "../../../lib/plansApi";
import { dayLabel, toKey } from "../../../lib/homeDates";
import { stepSummary } from "../../../lib/plans";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const ghost = "rounded-full border border-black/15 dark:border-white/20 px-3 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10";
const plusDays = (key, n) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

// The plans a person is on, on their card: where each one is, what comes next, and pause / skip / stop. Also a way to start one.
export default function PlanSection({ person }) {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = toKey(new Date());

  const load = useCallback(async () => {
    const [{ data: e }, { data: p }] = await Promise.all([
      supabase.from("plan_enrollments").select("*, plan:plans(id, name, steps)").eq("person_id", person.id).order("created_at"),
      supabase.from("plans").select("id, name, steps").order("created_at"),
    ]);
    setRows(e || []);
    setPlans(p || []);
  }, [person.id]);
  useEffect(() => {
    load();
  }, [load]);

  const update = async (row, changes) => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("plan_enrollments").update(changes).eq("id", row.id);
    if (err) setError(err.message);
    await load();
    setBusy(false);
  };
  const skip = (row) => {
    const steps = row.plan.steps;
    const next = row.next_step + 1;
    return update(row, next >= steps.length ? { next_step: next, next_due: null, status: "done" } : { next_step: next, next_due: plusDays(row.started_on, steps[next].day) });
  };
  const start = async (planId) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setBusy(true);
    setError("");
    const existing = rows.find((r) => r.plan_id === planId);
    const fresh = { started_on: today, next_step: 0, next_due: plusDays(today, plan.steps[0].day), status: "active", stop_reason: "", log: [] };
    const { error: err } = existing ? await supabase.from("plan_enrollments").update(fresh).eq("id", existing.id) : await supabase.from("plan_enrollments").insert({ plan_id: planId, person_id: person.id, ...fresh });
    if (err) setError(err.message);
    else await runMyPlans();
    await load();
    setBusy(false);
  };

  const available = plans.filter((p) => !rows.some((r) => r.plan_id === p.id && (r.status === "active" || r.status === "paused")));
  if (rows.length === 0 && plans.length === 0) return null;

  return (
    <section aria-label="Plans" className="rounded-2xl border border-black/10 dark:border-white/15 p-4 space-y-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Plans</p>
      {rows.map((r) => {
        const steps = r.plan?.steps || [];
        const live = r.status === "active" || r.status === "paused";
        const next = live ? steps[r.next_step] : null;
        return (
          <div key={r.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{r.plan?.name}</p>
              <span className={`text-xs font-medium ${r.status === "active" ? "text-emerald-700 dark:text-emerald-400" : muted}`}>
                {r.status === "active" ? `Step ${Math.min(r.next_step + 1, steps.length)} of ${steps.length}` : r.status === "paused" ? "Paused" : r.status === "done" ? "Finished" : `Stopped${r.stop_reason ? `: ${r.stop_reason}` : ""}`}
              </span>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {steps.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full ${i < r.next_step || r.status === "done" ? "bg-emerald-600" : i === r.next_step && live ? "bg-[#ed2127] dark:bg-[#f2454b]" : "bg-black/10 dark:bg-white/15"}`} />
              ))}
            </div>
            {next && (
              <p className={`text-xs ${muted}`}>
                Next: Day {next.day}, {stepSummary(next)}
                {r.next_due ? ` (${dayLabel(r.next_due, today)})` : ""}
              </p>
            )}
            {live && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {r.status === "active" ? (
                  <button type="button" disabled={busy} onClick={() => update(r, { status: "paused" })} className={ghost}>Pause</button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => update(r, { status: "active" })} className={ghost}>Resume</button>
                )}
                <button type="button" disabled={busy} onClick={() => skip(r)} className={ghost}>Skip step</button>
                <button type="button" disabled={busy} onClick={() => update(r, { status: "stopped", stop_reason: "They replied" })} className={ghost}>They replied</button>
                <button type="button" disabled={busy} onClick={() => update(r, { status: "stopped", stop_reason: "Stopped by you" })} className={ghost}>Stop</button>
              </div>
            )}
          </div>
        );
      })}
      {available.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className={muted}>Start a plan</span>
          <select value="" disabled={busy} onChange={(e) => e.target.value && start(e.target.value)} className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-sm">
            <option value="">Choose…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

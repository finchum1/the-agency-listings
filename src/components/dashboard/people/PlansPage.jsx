import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SOURCES } from "../../../lib/peopleStages";
import { CHANNELS, MERGE_FIELDS, STARTER_PLANS, STEP_TYPES, cleanPlan, startText, stepSummary } from "../../../lib/plans";
import { usePeopleStages } from "../../../hooks/usePeopleStages";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-5";
const control = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const ghost = "rounded-full border border-black/15 dark:border-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10";
const solid = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";

const startValue = (sw) => (sw?.type === "source" ? `source:${sw.value}` : sw?.type === "column" ? `column:${sw.group}:${sw.stage}` : "manual");
const startFrom = (v) => {
  if (v.startsWith("source:")) return { type: "source", value: v.slice(7) };
  if (v.startsWith("column:")) {
    const [, group, ...rest] = v.split(":");
    return { type: "column", group, stage: rest.join(":") };
  }
  return { type: "manual" };
};
const newStep = (type, last) => ({ day: last, type, ...(type === "task" ? { title: "" } : type === "draft" ? { channel: "text", body: "" } : { group: "lead", stage: "" }) });

// One plan: its name, what starts it, and its steps. Saved only when it passes the same checks the AI tools use (cleanPlan).
function PlanEditor({ plan, stages, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => structuredClone({ name: plan?.name || "", starts_when: plan?.starts_when || { type: "manual" }, steps: plan?.steps || [{ day: 0, type: "task", title: "" }] }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setStep = (i, patch) => setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const changeType = (i, type) => setDraft((d) => ({ ...d, steps: d.steps.map((s, j) => (j === i ? newStep(type, s.day) : s)) }));
  const move = (i, dir) =>
    setDraft((d) => {
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const save = async () => {
    setError("");
    let clean;
    try {
      clean = cleanPlan(draft);
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy(true);
    const err = await onSave(clean);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className={`${card} space-y-5`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className={`mb-1 block text-xs font-medium ${muted}`}>Plan name</span>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} className={control} placeholder="New web lead" />
        </label>
        <label className="block text-sm">
          <span className={`mb-1 block text-xs font-medium ${muted}`}>Starts</span>
          <select value={startValue(draft.starts_when)} onChange={(e) => setDraft({ ...draft, starts_when: startFrom(e.target.value) })} className={control}>
            <option value="manual">When I start it myself</option>
            <optgroup label="When someone is added from…">
              {SOURCES.map((s) => (
                <option key={s} value={`source:${s}`}>{s}</option>
              ))}
            </optgroup>
            {["lead", "pipeline"].map((g) => (
              <optgroup key={g} label={`When someone enters a ${g === "lead" ? "Leads" : "Pipeline"} column…`}>
                {stages[g].map((c) => (
                  <option key={c} value={`column:${g}:${c}`}>{g === "lead" ? "Leads" : "Pipeline"} › {c}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-3">
        <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Steps (days count from when they start the plan)</p>
        {draft.steps.map((s, i) => (
          <div key={i} className="rounded-xl border border-black/10 dark:border-white/15 p-3 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm">
                <span className={muted}>Day</span>
                <input type="number" min={0} max={730} value={s.day} onChange={(e) => setStep(i, { day: e.target.value === "" ? "" : Number(e.target.value) })} className={`${control} !w-20`} aria-label={`Step ${i + 1} day`} />
              </label>
              <select value={s.type} onChange={(e) => changeType(i, e.target.value)} className={`${control} !w-auto`} aria-label={`Step ${i + 1} type`}>
                {STEP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {s.type === "draft" && (
                <select value={s.channel} onChange={(e) => setStep(i, { channel: e.target.value })} className={`${control} !w-auto`} aria-label={`Step ${i + 1} channel`}>
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              )}
              <span className="ml-auto flex items-center gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move step up" className={`${ghost} !px-2.5 disabled:opacity-30`}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === draft.steps.length - 1} aria-label="Move step down" className={`${ghost} !px-2.5 disabled:opacity-30`}>↓</button>
                <button type="button" onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((_, j) => j !== i) }))} disabled={draft.steps.length === 1} aria-label="Remove step" className={`${ghost} !px-2.5 disabled:opacity-30`}>✕</button>
              </span>
            </div>
            {s.type === "task" && <input value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} maxLength={200} placeholder="Call {first_name} within 5 minutes" className={control} aria-label={`Step ${i + 1} to-do`} />}
            {s.type === "draft" && (
              <>
                {s.channel === "email" && <input value={s.subject || ""} onChange={(e) => setStep(i, { subject: e.target.value })} maxLength={150} placeholder="Subject" className={control} aria-label={`Step ${i + 1} subject`} />}
                <textarea value={s.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={s.channel === "email" ? 5 : 3} maxLength={2000} placeholder="Hi {first_name}, it's {agent_first_name}…" className={control} aria-label={`Step ${i + 1} message`} />
              </>
            )}
            {s.type === "move" && (
              <select value={`${s.group}:${s.stage}`} onChange={(e) => setStep(i, { group: e.target.value.split(":")[0], stage: e.target.value.split(":").slice(1).join(":") })} className={control} aria-label={`Step ${i + 1} column`}>
                <option value="lead:">Choose a column…</option>
                {["lead", "pipeline"].map((g) => (
                  <optgroup key={g} label={g === "lead" ? "Leads" : "Pipeline"}>
                    {stages[g].map((c) => (
                      <option key={c} value={`${g}:${c}`}>{c}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {STEP_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, newStep(t.value, d.steps[d.steps.length - 1]?.day ?? 0)] }))} disabled={draft.steps.length >= 20} className={ghost}>
              + {t.label}
            </button>
          ))}
        </div>
        <p className={`text-xs ${muted}`}>
          You can use {MERGE_FIELDS.map(([k]) => `{${k}}`).join(", ")} in a title or message. Drafts are never sent: they wait on the person's card for you to send. A plan stops by itself when you move the person to another column or archive them.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className={solid}>{busy ? "Saving…" : "Save plan"}</button>
        <button type="button" onClick={onCancel} className={`text-sm ${muted} hover:underline`}>Cancel</button>
      </div>
    </div>
  );
}

// People > Plans: the follow-up plans an agent has, switched on or off, with how many people are on each.
export default function PlansPage() {
  const { stages } = usePeopleStages();
  const [plans, setPlans] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // plan id, "new", or null
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [{ data: p, error: e1 }, { data: en }] = await Promise.all([supabase.from("plans").select("*").order("created_at"), supabase.from("plan_enrollments").select("plan_id, status")]);
    if (e1) setError(e1.message);
    setPlans(p || []);
    const c = {};
    for (const r of en || []) {
      c[r.plan_id] ||= { active: 0, done: 0 };
      if (r.status === "active" || r.status === "paused") c[r.plan_id].active += 1;
      else if (r.status === "done") c[r.plan_id].done += 1;
    }
    setCounts(c);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (id, clean) => {
    const { error: err } = id === "new" ? await supabase.from("plans").insert(clean) : await supabase.from("plans").update(clean).eq("id", id);
    if (err) return err.message;
    setEditing(null);
    load();
    return "";
  };
  const toggle = async (p) => {
    setPlans((list) => list.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    const { error: err } = await supabase.from("plans").update({ active: !p.active }).eq("id", p.id);
    if (err) {
      setError(err.message);
      load();
    }
  };
  const remove = async (p) => {
    if (!confirm(`Delete “${p.name}”? People on it stop getting its steps. Tasks and drafts it already made stay.`)) return;
    await supabase.from("plans").delete().eq("id", p.id);
    load();
  };
  const missingStarters = STARTER_PLANS.filter((s) => !plans.some((p) => p.name === s.name));
  const addStarters = async () => {
    const { error: err } = await supabase.from("plans").insert(missingStarters.map(({ name, starts_when, steps }) => ({ name, starts_when, steps, active: false })));
    if (err) setError(err.message);
    load();
  };

  if (loading) return <p className={`text-sm ${muted}`}>Loading…</p>;
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Plans</h1>
          <p className={`mt-1 text-sm ${muted}`}>Follow-up that runs itself: timed to-dos and drafted messages for new leads, so no one is forgotten. Nothing is sent for you.</p>
        </div>
        {editing === null && (
          <div className="flex gap-2">
            {missingStarters.length > 0 && <button type="button" onClick={addStarters} className={ghost}>Add starter plans</button>}
            <button type="button" onClick={() => setEditing("new")} className={solid}>New plan</button>
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {editing === "new" && <PlanEditor stages={stages} onSave={(c) => save("new", c)} onCancel={() => setEditing(null)} />}
      {plans.length === 0 && editing === null && (
        <div className={`${card} text-sm`}>
          <p className="font-semibold">No plans yet</p>
          <p className={`mt-1 ${muted}`}>Start with the starter plans (new web lead, open house follow-up, slow-burn check-in), then change the wording to sound like you.</p>
        </div>
      )}
      {plans.map((p) =>
        editing === p.id ? (
          <PlanEditor key={p.id} plan={p} stages={stages} onSave={(c) => save(p.id, c)} onCancel={() => setEditing(null)} />
        ) : (
          <div key={p.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold">{p.name}</p>
                <p className={`text-sm ${muted}`}>{startText(p.starts_when)}</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={p.active} onChange={() => toggle(p)} className="h-4 w-4 accent-[#ed2127]" />
                {p.active ? "On" : "Off"}
              </label>
            </div>
            <ol className="mt-3 space-y-1">
              {p.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`w-14 shrink-0 text-xs ${muted}`}>Day {s.day}</span>
                  <span className="min-w-0 truncate">{stepSummary(s)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`text-xs ${muted}`}>{counts[p.id]?.active || 0} on it now · {counts[p.id]?.done || 0} finished</span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => setEditing(p.id)} className={ghost}>Edit</button>
                <button type="button" onClick={() => remove(p)} className={`${ghost} hover:!text-red-600`}>Delete</button>
              </span>
            </div>
            {!p.active && p.starts_when?.type !== "manual" && <p className={`mt-2 text-xs ${muted}`}>It's off, so people won't start it automatically. Turn it on to begin with the next new person.</p>}
          </div>
        ),
      )}
    </div>
  );
}

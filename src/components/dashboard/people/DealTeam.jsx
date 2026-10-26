import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const select =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

// Who is coordinating this deal. The agent picks one or more coordinators from the office's TCs; a coordinator then sees (and can
// work on) this deal only, not the agent's others. Coordinators an admin assigned to the agent for every deal show as "all deals".
export default function DealTeam({ person }) {
  const { profile } = useAuth();
  const [assigned, setAssigned] = useState([]); // { tc_id, name }
  const [always, setAlways] = useState([]); // names of agent-wide coordinators
  const [options, setOptions] = useState([]); // every TC in the office
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [{ data: rows }, { data: all }, { data: wide }] = await Promise.all([
      supabase.from("deal_tcs").select("tc_id").eq("person_id", person.id),
      profile?.org_id ? supabase.from("profiles").select("id, full_name").eq("org_id", profile.org_id).eq("deals_role", "tc").order("full_name") : { data: [] },
      supabase.from("deal_team").select("tc_id").eq("agent_id", person.owner_id),
    ]);
    const names = Object.fromEntries((all || []).map((p) => [p.id, p.full_name]));
    setOptions(all || []);
    setAssigned((rows || []).map((r) => ({ tc_id: r.tc_id, name: names[r.tc_id] || "Coordinator" })));
    setAlways((wide || []).map((r) => names[r.tc_id]).filter(Boolean));
  }, [person.id, person.owner_id, profile?.org_id]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async (tcId) => {
    if (!tcId) return;
    setError("");
    const { error: err } = await supabase.from("deal_tcs").insert({ person_id: person.id, tc_id: tcId });
    if (err) setError(err.message);
    load();
  };
  const remove = async (tcId) => {
    setError("");
    const { error: err } = await supabase.from("deal_tcs").delete().eq("person_id", person.id).eq("tc_id", tcId);
    if (err) setError(err.message);
    load();
  };

  const taken = new Set(assigned.map((a) => a.tc_id));
  const available = options.filter((o) => !taken.has(o.id));
  return (
    <section className="min-w-0 space-y-2" aria-label="Transaction coordinator">
      <h3 className="font-display text-base font-semibold">Transaction coordinator</h3>
      <div className="flex flex-wrap items-center gap-2">
        {assigned.map((a) => (
          <span key={a.tc_id} className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 pl-3 pr-1.5 py-1 text-sm font-medium">
            {a.name}
            <button type="button" onClick={() => remove(a.tc_id)} aria-label={`Remove ${a.name}`} className="grid h-5 w-5 place-items-center rounded-full text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:bg-black/10 dark:hover:bg-white/15">
              ×
            </button>
          </span>
        ))}
        {always.map((n) => (
          <span key={`all-${n}`} title="Set up by an admin to coordinate all of your deals" className={`rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-sm ${muted}`}>
            {n} · all deals
          </span>
        ))}
        {available.length > 0 && (
          <select value="" onChange={(e) => add(e.target.value)} aria-label="Add a transaction coordinator" className={select}>
            <option value="">{assigned.length || always.length ? "Add another…" : "Choose a coordinator…"}</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>{o.full_name}</option>
            ))}
          </select>
        )}
      </div>
      {options.length === 0 && <p className={`text-sm ${muted}`}>Your office has no transaction coordinators set up yet. An admin can add one on the Agents page.</p>}
      {assigned.length === 0 && always.length === 0 && options.length > 0 && <p className={`text-xs ${muted}`}>Doing this one yourself? Leave it empty. A coordinator you pick sees and works on this deal only.</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

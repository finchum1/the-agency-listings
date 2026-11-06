import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Teams (supabase/agent-teams.sql) on the Agents page: create a team, name it, and pick who is on it. Everyone on a team shows together on the
// property sites, flyers, social posts and inquiry emails of each other's listings. Only an admin can change this (the database enforces it).
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const pillClass =
  "rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-3.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50";

function TeamCard({ team, agents, onChanged, onError }) {
  const [name, setName] = useState(team.name);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const members = agents.filter((a) => a.team_id === team.id);
  const others = agents.filter((a) => a.team_id !== team.id);

  useEffect(() => setName(team.name), [team.name]);

  const run = async (fn) => {
    setBusy(true);
    onError("");
    const { error } = await fn();
    setBusy(false);
    if (error) onError(error.message);
    else onChanged();
  };

  const rename = () => {
    const next = name.trim();
    if (!next) return setName(team.name);
    if (next !== team.name) run(() => supabase.from("teams").update({ name: next }).eq("id", team.id));
  };
  const add = () => {
    if (!adding) return;
    const id = adding;
    setAdding("");
    run(() => supabase.from("profiles").update({ team_id: team.id }).eq("id", id));
  };
  const remove = (id) => run(() => supabase.from("profiles").update({ team_id: null }).eq("id", id));
  const del = () => {
    if (!window.confirm(`Delete "${team.name}"? The agents stay, they just won't be on a team any more.`)) return;
    run(() => supabase.from("teams").delete().eq("id", team.id));
  };

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} maxLength={80} aria-label="Team name" className={`${inputClass} font-semibold`} />
        <button type="button" onClick={del} disabled={busy} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
          Delete
        </button>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">No one on this team yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-black/5 dark:bg-white/10 pl-3 pr-1.5 py-1 text-sm">
              {m.full_name || m.email}
              <button type="button" onClick={() => remove(m.id)} disabled={busy} aria-label={`Take ${m.full_name || m.email} off ${team.name}`} className="grid h-5 w-5 place-items-center rounded-full text-xs hover:bg-black/10 dark:hover:bg-white/15 disabled:opacity-50">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label={`Add an agent to ${team.name}`} className={inputClass}>
          <option value="">Add an agent…</option>
          {others.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} disabled={!adding || busy} className={`${pillClass} shrink-0`}>
          Add
        </button>
      </div>
    </div>
  );
}

export default function TeamsManager({ orgId, agents, onChanged }) {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return setTeams([]);
    const { data } = await supabase.from("teams").select("id, name").eq("org_id", orgId).order("name");
    setTeams(data || []);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged();
  };

  const create = async (e) => {
    e.preventDefault();
    const next = name.trim();
    if (!next) return;
    setCreating(true);
    setError("");
    const { error: err } = await supabase.from("teams").insert({ org_id: orgId, name: next });
    setCreating(false);
    if (err) return setError(err.message);
    setName("");
    changed();
  };

  return (
    <div>
      <h2 className="text-lg font-display font-semibold mb-1 mt-1">Teams</h2>
      <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mb-4">
        Agents on a team show together on each other's property sites, flyers and social posts, and an inquiry goes to all of them. Each agent still has their own login, listings and site.
      </p>
      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} agents={agents} onChanged={changed} onError={setError} />
        ))}
        {teams.length === 0 && <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">No teams yet.</p>}
        <form onSubmit={create} className="flex items-center gap-2 pt-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name, e.g. Petry Signature Team" maxLength={80} aria-label="New team name" className={inputClass} />
          <button type="submit" disabled={creating || !name.trim()} className="shrink-0 rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 transition-colors disabled:opacity-60">
            Create
          </button>
        </form>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

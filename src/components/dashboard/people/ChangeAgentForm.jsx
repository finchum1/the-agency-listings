import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const selectClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

// Hand a deal to a different agent in the office (deal_change_agent, supabase/deal-change-agent.sql): the agent's own panel and a coordinator's
// both use it. The deal, checklist, documents and notes move to the new agent's board; a coordinator stays on it. Nobody is emailed.
// `onDone` runs after the move so the host can refresh its board and close the panel.
export default function ChangeAgentForm({ dealId, ownerId, viewer, onDone }) {
  const { profile } = useAuth();
  const [agents, setAgents] = useState(null);
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [moved, setMoved] = useState(null);

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("org_id", profile.org_id)
      .eq("people_enabled", true)
      .neq("id", ownerId)
      .order("full_name")
      .then(({ data }) => setAgents(data || []));
  }, [profile?.org_id, ownerId]);

  const move = async () => {
    if (!agentId) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("deal_change_agent", { p_person: dealId, p_agent: agentId });
    setBusy(false);
    if (err) return setError(err.message);
    setMoved(data);
  };

  if (moved) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          <strong>{moved.to}</strong> now has this deal{moved.column_changed ? `, in their “${moved.stage}” column` : ""}.
          {viewer === "tc" ? " You're still on it as the coordinator." : ""}
        </p>
        <button type="button" onClick={onDone} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5">
          Done
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {agents === null ? (
        <p className={`text-sm ${muted}`}>Loading agents…</p>
      ) : agents.length === 0 ? (
        <p className={`text-sm ${muted}`}>There are no other agents in your office using Deals.</p>
      ) : (
        <>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="New agent" className={selectClass}>
            <option value="">Choose an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
          <p className={`text-xs ${muted}`}>
            The deal moves to their Deals board with its checklist, documents and notes. {viewer === "tc" ? "You stay on it as the coordinator." : "It leaves your board unless you coordinate it."} Nobody is emailed.
          </p>
          <button type="button" onClick={move} disabled={!agentId || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50">
            {busy ? "Moving…" : "Change agent"}
          </button>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

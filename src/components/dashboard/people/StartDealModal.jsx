import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";

const LAST_AGENT = "dealsLastAgent";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

// A transaction coordinator starts a deal for one of the agents. The deal lands on that agent's board with the coordinator already on it,
// and the agent gets an email. (deal_start_for_agent in the database does the work and checks who may.)
export default function StartDealModal({ onClose, onStarted }) {
  const { profile } = useAuth();
  const [agents, setAgents] = useState(null);
  const [columns, setColumns] = useState([]); // the chosen agent's own Deals columns
  const [f, setF] = useState(() => {
    let agent = "";
    try {
      agent = localStorage.getItem(LAST_AGENT) || "";
    } catch {
      /* the remembered agent is a convenience */
    }
    return { agent, stage: "", name: "", side: "", property_address: "", phone: "", email: "", price: "", contract_date: "", closing_date: "" };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.org_id) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("org_id", profile.org_id)
      .eq("people_enabled", true)
      .neq("id", profile.id)
      .order("full_name")
      .then(({ data }) => {
        setAgents(data || []);
        setF((cur) => (data?.some((a) => a.id === cur.agent) ? cur : { ...cur, agent: "" }));
      });
  }, [profile?.org_id, profile?.id]);

  // Which columns this agent has, so the deal can be put in the right one (for example Listings while a listing is being put together).
  useEffect(() => {
    if (!f.agent) {
      setColumns([]);
      return;
    }
    let active = true;
    supabase.rpc("agent_deal_stages", { p_agent: f.agent }).then(({ data }) => {
      if (!active) return;
      setColumns(data || []);
      setF((cur) => (cur.agent === f.agent ? { ...cur, stage: data?.includes(cur.stage) ? cur.stage : "" } : cur));
    });
    return () => {
      active = false;
    };
  }, [f.agent]);

  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const ready = f.agent && f.name.trim() && f.side;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const { data: id, error: err } = await supabase.rpc("deal_start_for_agent", {
      p_agent: f.agent,
      p_name: f.name,
      p_side: f.side,
      p_property_address: f.property_address,
      p_phone: f.phone,
      p_email: f.email,
      p_price: f.price === "" ? null : Number(f.price),
      p_contract_date: f.contract_date || null,
      p_closing_date: f.closing_date || null,
      p_stage: f.stage || null,
    });
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    try {
      localStorage.setItem(LAST_AGENT, f.agent);
    } catch {
      /* ignore */
    }
    // The deal is made. Telling the agent is a courtesy, so a failure only shows as a note.
    let note = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/deal-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ personId: id, action: "deal_started" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) note = `The deal is on ${agents.find((a) => a.id === f.agent)?.full_name || "the agent"}'s board, but the email didn't go out: ${json.error || "unknown error"}`;
    } catch {
      note = "The deal was started, but the email to the agent didn't go out.";
    }
    setBusy(false);
    onStarted(id, note);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={submit} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl space-y-4" role="dialog" aria-label="Start a deal">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Start a deal</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>

        <div>
          <label className={labelClass} htmlFor="sd-agent">Which agent is this for?</label>
          <select id="sd-agent" value={f.agent} onChange={set("agent")} className={inputClass} disabled={!agents}>
            <option value="">{agents ? "Choose an agent…" : "Loading…"}</option>
            {(agents || []).map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>
          {agents && agents.length === 0 && <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">No agents in your office have Deals turned on yet.</p>}
          <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">It goes on their Deals board, with you as the coordinator. They get an email.</p>
        </div>

        {columns.length > 0 && (
          <div>
            <label className={labelClass} htmlFor="sd-stage">Which column?</label>
            <select id="sd-stage" value={f.stage} onChange={set("stage")} className={inputClass}>
              <option value="">{columns[0]} (their first column)</option>
              {columns.slice(1).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">For example, keep it in Listings while you help put the listing together.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="sd-name">Client name</label>
            <input id="sd-name" value={f.name} onChange={set("name")} className={inputClass} placeholder="Jordan & Kim Park" />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-side">Buyer or seller (listing)</label>
            <select id="sd-side" value={f.side} onChange={set("side")} className={inputClass}>
              <option value="">Choose…</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller (listing)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="sd-address">Property address</label>
            <input id="sd-address" value={f.property_address} onChange={set("property_address")} className={inputClass} placeholder="1907 Cedar Hollow Ln" />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-phone">Client phone</label>
            <input id="sd-phone" type="tel" value={f.phone} onChange={set("phone")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-email">Client email</label>
            <input id="sd-email" type="email" value={f.email} onChange={set("email")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-contract">Contract date</label>
            <input id="sd-contract" type="date" value={f.contract_date} onChange={set("contract_date")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-closing">Closing date</label>
            <input id="sd-closing" type="date" value={f.closing_date} onChange={set("closing_date")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="sd-price">Price ($)</label>
            <input id="sd-price" type="number" min="0" step="any" inputMode="decimal" value={f.price} onChange={set("price")} className={inputClass} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={!ready || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {busy ? "Starting…" : "Start the deal"}
        </button>
      </form>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const btn = "text-[#1c1a17] dark:text-[#faf9f7] rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

// Share a private closing timeline with the buyer or seller (/timeline/<token>, see src/pages/TransactionTimelinePage.jsx). It
// shows the deal's key dates, what's coming and who's helping, never the price, commission or the agent's checklist. A coordinator can make one
// for a deal they coordinate (`agentName` set): the page and the link's address are still the deal's agent's, not theirs.
export default function ClientTimelineCard({ person, dates, agentName }) {
  const [links, setLinks] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  // The agent's own website address, if they have one: the link can come from it instead of the dashboard's.
  const [siteDomain, setSiteDomain] = useState("");
  const [useSite, setUseSite] = useState(true);

  const hasDates = Boolean(dates.contract_date || dates.closing_date || dates.inspection_date);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("transaction_timeline_links")
      .select("id, token_hint, created_at, expires_at, view_count, last_viewed_at")
      .eq("person_id", person.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLinks(data || []);
  }, [person.id]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    supabase
      .from("agent_sites")
      .select("custom_domain")
      .eq("agent_id", person.owner_id)
      .not("custom_domain", "is", null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSiteDomain(data?.custom_domain || ""));
  }, [person.owner_id]);

  const create = async () => {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_timeline_link", { p_person_id: person.id, p_message: note });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const origin = siteDomain && useSite ? `https://${siteDomain}` : window.location.origin;
    const url = `${origin}/timeline/${data}`;
    setFresh(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is shown below to copy by hand */
    }
    load();
  };
  const revoke = async (l) => {
    if (!confirm("Turn this link off? Anyone who has it will see an expired page.")) return;
    await supabase.rpc("revoke_timeline_link", { p_id: l.id });
    setFresh("");
    load();
  };
  const first = (person.name || "").split(/[ &]/)[0];
  const mail = fresh
    ? `mailto:${person.email || ""}?subject=${encodeURIComponent(`Your closing timeline${person.property_address ? ` for ${person.property_address}` : ""}`)}&body=${encodeURIComponent(`Hi ${first},\n\nHere's a page that shows where your purchase stands and what's coming next. It updates as we hit each step:\n\n${fresh}\n\nCall me any time with questions.`)}`
    : "";

  return (
    <div className="space-y-3">
      <h3 className="font-display text-base font-semibold">Client timeline</h3>
      <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">A private page for {first || "your client"} with the key dates, what's still coming, and who's helping. {agentName ? `Branded with ${agentName}'s photo and contact info, since it's their client.` : "Branded with your photo and contact info."} It never shows price, commission or the checklist.</p>
      {!hasDates && <p className="text-xs rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 px-3 py-2">Add the contract, inspection and closing dates above and the timeline fills in on its own.</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={600}
        placeholder="Optional note to show at the top, like “We're right on track. Next up is the appraisal on Tuesday.”"
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40"
      />
      {siteDomain && (
        <label className="flex items-center gap-2 text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
          <input type="checkbox" checked={useSite} onChange={(e) => setUseSite(e.target.checked)} className="h-3.5 w-3.5 accent-[#ed2127]" />
          Send the link from {siteDomain}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={create} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-60">
          {busy ? "Making…" : "Create client link"}
        </button>
        {fresh && (
          <>
            <span className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{copied ? "Copied ✓" : ""}</span>
            <a href={mail} className={btn}>Email to client</a>
            <a href={fresh} target="_blank" rel="noreferrer" className={btn}>Preview</a>
          </>
        )}
      </div>
      {fresh && <p className="text-xs break-all font-mono select-all">{fresh}</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {links.length > 0 && (
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {links.map((l) => (
            <li key={l.id} className="py-2 flex items-center justify-between gap-3 text-xs text-[#1c1a17]/65 dark:text-[#faf9f7]/65">
              <span>
                Link …{l.token_hint} · made {new Date(l.created_at).toLocaleDateString()} · opened {l.view_count} time{l.view_count === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={() => revoke(l)} className="shrink-0 font-semibold text-red-600 dark:text-red-400 hover:underline">
                Turn off
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

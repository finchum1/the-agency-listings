import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { homeLine, matchMessage, mailtoWithBody } from "../../lib/clientMatches";
import ClientPicker from "./ClientPicker";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const k = (n) => (n >= 1000000 ? `$${+(n / 1000000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);

/** "Edmond · 3+ bd · up to $400k": a name for a search from its filters. */
export function describeSearch(p = {}) {
  const min = Number(p.minPrice) || 0;
  const max = Number(p.maxPrice) || 0;
  const price = min && max ? `${k(min)} – ${k(max)}` : min ? `${k(min)}+` : max ? `up to ${k(max)}` : "";
  return [p.city, p.minBeds && `${p.minBeds}+ bd`, p.minBaths && `${p.minBaths}+ ba`, price, p.map && "drawn area"].filter(Boolean).join(" · ") || "All homes";
}

/** The address of the public Home Search with this search's filters (it reads them from the link). Drawn areas don't travel in a link. */
export function clientLink(p = {}) {
  const q = new URLSearchParams();
  for (const key of ["city", "minPrice", "maxPrice", "minBeds", "minBaths", "sortBy"]) if (p[key]) q.set(key, p[key]);
  return `${window.location.origin}/brokerage/search${q.toString() ? `?${q}` : ""}`;
}

// Home Search filters saved for a client: name it, attach it to one of your people, put it back on the page later, or copy a link that opens the
// public Home Search already filtered. Private to the agent.
export default function ClientSearches({ current, narrowed, onRun, forClient = null }) {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [emails, setEmails] = useState({});
  const [batches, setBatches] = useState([]); // new matches the morning run found, waiting for the agent
  const [saving, setSaving] = useState(Boolean(forClient)); // opened from a person: the save form starts open, for them
  const [name, setName] = useState("");
  const [person, setPerson] = useState(forClient || { id: null, name: "" });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [open, setOpen] = useState(params.get("matches") === "1");

  const load = useCallback(async () => {
    const [{ data, error: err }, { data: found }] = await Promise.all([
      supabase.from("client_searches").select("id, person_id, name, params, alerts, last_checked_at, created_at").order("created_at", { ascending: false }),
      supabase.from("client_search_matches").select("id, search_id, listings, total, found_at").eq("status", "new").order("found_at", { ascending: false }).limit(50),
    ]);
    if (err) return setError(err.message);
    setRows(data || []);
    setBatches(found || []);
    const ids = [...new Set((data || []).map((r) => r.person_id).filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from("people").select("id, name, email").in("id", ids);
      setNames(Object.fromEntries((ps || []).map((p) => [p.id, p.name])));
      setEmails(Object.fromEntries((ps || []).map((p) => [p.id, p.email])));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    const params = Object.fromEntries(Object.entries(current).filter(([, v]) => v !== "" && v != null && v !== false));
    const { error: err } = await supabase.from("client_searches").insert({ name: (name || describeSearch(params)).trim().slice(0, 120), person_id: person.id, params });
    if (err) return setError(err.message);
    setSaving(false);
    setName("");
    setPerson({ id: null, name: "" });
    setOpen(true);
    load();
  };
  const remove = async (row) => {
    if (!window.confirm(`Delete the saved search "${row.name}"?`)) return;
    const { error: err } = await supabase.from("client_searches").delete().eq("id", row.id);
    if (err) return setError(err.message);
    setRows((r) => r.filter((x) => x.id !== row.id));
  };
  const setAlerts = async (row, on) => {
    setRows((all) => all.map((x) => (x.id === row.id ? { ...x, alerts: on } : x)));
    const { error: err } = await supabase.from("client_searches").update({ alerts: on }).eq("id", row.id);
    if (err) {
      setError(err.message);
      setRows((all) => all.map((x) => (x.id === row.id ? { ...x, alerts: !on } : x)));
    }
  };
  const settle = async (batch, status) => {
    const { error: err } = await supabase.from("client_search_matches").update({ status, handled_at: new Date().toISOString() }).eq("id", batch.id);
    if (err) return setError(err.message);
    setBatches((all) => all.filter((b) => b.id !== batch.id));
  };
  const messageFor = (batch) => {
    const search = rows.find((x) => x.id === batch.search_id);
    return { search, msg: matchMessage({ clientName: names[search?.person_id] || "", searchName: search?.name || "", homes: batch.listings, total: batch.total, agentName: profile?.full_name || "", origin: window.location.origin }) };
  };
  const copyMessage = async (batch) => {
    const { msg } = messageFor(batch);
    await navigator.clipboard.writeText(`${msg.subject}\n\n${msg.body}`);
    setCopied(`m${batch.id}`);
    setTimeout(() => setCopied((c) => (c === `m${batch.id}` ? "" : c)), 1800);
  };
  const emailClient = (batch) => {
    const { search, msg } = messageFor(batch);
    window.location.href = mailtoWithBody(emails[search?.person_id], msg);
    settle(batch, "sent");
  };
  const copy = async (row) => {
    await navigator.clipboard.writeText(clientLink(row.params));
    setCopied(row.id);
    setTimeout(() => setCopied((c) => (c === row.id ? "" : c)), 1800);
  };

  return (
    <div className="mb-4 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-semibold">
          Saved searches <span className={`font-normal ${muted}`}>{rows.length}</span>
          {batches.length > 0 && <span className="ml-2 rounded-full bg-[#D8091B] px-2 py-0.5 text-[11px] font-semibold text-white">{batches.length} new</span>}{" "}
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        <button type="button" disabled={!narrowed} onClick={() => { setSaving((v) => !v); setName(describeSearch(current)); }} className={`${quiet} ml-auto disabled:opacity-40`} title={narrowed ? "" : "Pick a city, price or other filter first"}>
          Save this search for a client
        </button>
      </div>

      {saving && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs font-medium">
            Name {person.id && <span className={`font-normal ${muted}`}>(they see it if they sign in on your site)</span>}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${input} mt-1 w-full`} />
          </label>
          <div className="text-xs font-medium">
            Client <span className={`font-normal ${muted}`}>(optional)</span>
            <div className="mt-1">
              <ClientPicker personId={person.id} name={person.name} onPick={(id, n) => setPerson({ id, name: n })} />
            </div>
          </div>
          <button type="submit" disabled={!narrowed} title={narrowed ? "" : "Set the filters first"} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {open && batches.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className={`text-xs ${muted}`}>Found this morning. Nothing has been sent to your clients: look them over, then send or dismiss.</p>
          {batches.map((b) => {
            const search = rows.find((x) => x.id === b.search_id);
            const who = names[search?.person_id];
            return (
              <div key={b.id} className="rounded-xl border border-[#D8091B]/30 dark:border-[#f2454b]/40 p-3">
                <p className="text-sm font-semibold">
                  {[who, search?.name].filter(Boolean).join(": ") || "Client search"} <span className={`font-normal ${muted}`}>{b.total} new</span>
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {b.listings.slice(0, 6).map((h) => (
                    <li key={h.mlsNumber} className="flex gap-2.5 text-xs">
                      <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/[0.05] dark:bg-white/[0.06]">{h.hero_photo_url && <img src={h.hero_photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                      <a href={`/brokerage/listings/${encodeURIComponent(h.mlsNumber)}`} target="_blank" rel="noreferrer" className="min-w-0 underline-offset-2 hover:underline">
                        {homeLine(h)}
                      </a>
                    </li>
                  ))}
                </ul>
                {b.total > 6 && <p className={`mt-1 text-xs ${muted}`}>…and {b.total - 6} more.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => emailClient(b)} disabled={!emails[search?.person_id]} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40" title={emails[search?.person_id] ? "" : "Attach a client with an email address to this search first"}>
                    Email the client
                  </button>
                  <button type="button" onClick={() => copyMessage(b)} className={quiet}>{copied === `m${b.id}` ? "Copied" : "Copy message"}</button>
                  <button type="button" onClick={() => settle(b, "dismissed")} className={quiet}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-3">
          {rows.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nothing saved yet. Set the filters a client wants, then save the search.</p>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.name}</p>
                    <p className={`truncate text-xs ${muted}`}>{[r.person_id && (names[r.person_id] || "Client"), describeSearch(r.params)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs" title="Each morning, check for new homes that fit this search and tell you. Nothing is sent to the client.">
                    <input type="checkbox" checked={Boolean(r.alerts)} onChange={(e) => setAlerts(r, e.target.checked)} />
                    New matches daily
                  </label>
                  <button type="button" onClick={() => onRun(r.params)} className={quiet}>Run</button>
                  <button type="button" onClick={() => copy(r)} className={quiet} title="A link to the public Home Search with these filters. Drawn areas and 1–2 bed filters don't carry over.">
                    {copied === r.id ? "Copied" : "Copy client link"}
                  </button>
                  <button type="button" onClick={() => remove(r)} className="text-xs font-semibold text-red-600 dark:text-red-400 underline">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

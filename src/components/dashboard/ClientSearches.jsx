import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
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
export default function ClientSearches({ current, narrowed, onRun }) {
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [person, setPerson] = useState({ id: null, name: "" });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("client_searches").select("id, person_id, name, params, created_at").order("created_at", { ascending: false });
    if (err) return setError(err.message);
    setRows(data || []);
    const ids = [...new Set((data || []).map((r) => r.person_id).filter(Boolean))];
    if (ids.length) {
      const { data: ps } = await supabase.from("people").select("id, name").in("id", ids);
      setNames(Object.fromEntries((ps || []).map((p) => [p.id, p.name])));
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
  const copy = async (row) => {
    await navigator.clipboard.writeText(clientLink(row.params));
    setCopied(row.id);
    setTimeout(() => setCopied((c) => (c === row.id ? "" : c)), 1800);
  };

  return (
    <div className="mb-4 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-semibold">
          Saved searches <span className={`font-normal ${muted}`}>{rows.length}</span> <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        <button type="button" disabled={!narrowed} onClick={() => { setSaving((v) => !v); setName(describeSearch(current)); }} className={`${quiet} ml-auto disabled:opacity-40`} title={narrowed ? "" : "Pick a city, price or other filter first"}>
          Save this search for a client
        </button>
      </div>

      {saving && (
        <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs font-medium">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={`${input} mt-1 w-full`} />
          </label>
          <div className="text-xs font-medium">
            Client <span className={`font-normal ${muted}`}>(optional)</span>
            <div className="mt-1">
              <ClientPicker personId={person.id} name={person.name} onPick={(id, n) => setPerson({ id, name: n })} />
            </div>
          </div>
          <button type="submit" className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white">Save</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

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

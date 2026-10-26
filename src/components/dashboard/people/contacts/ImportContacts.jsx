import { useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { IMPORT_FIELDS, RELATIONSHIPS, digits, guessMapping, parseCsv, rowToContact } from "../../../../lib/contacts";

const input = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm";

// Bring in a CSV (a Google Contacts, Outlook, phone or spreadsheet export): pick which column is which, review, import. People
// already in your contacts (same email) are skipped, never doubled up.
export default function ImportContacts({ existing, tags, ensureTag, onClose, onDone }) {
  const [rows, setRows] = useState(null);
  const [map, setMap] = useState({});
  const [relationship, setRelationship] = useState("sphere");
  const [extraTag, setExtraTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const headers = rows?.[0] || [];
  const body = rows?.slice(1) || [];

  const onFile = async (file) => {
    if (!file) return;
    setError("");
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) return setError("That file doesn't have any rows. Export your contacts as a CSV with a header row.");
    setRows(parsed);
    setMap(guessMapping(parsed[0]));
  };

  const defaults = { relationship, source: "" };
  const parsedRows = useMemo(() => body.map((r) => rowToContact(r, map, defaults)), [body, map, relationship]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = useMemo(() => new Set(existing.filter((c) => c.email).map((c) => c.email.toLowerCase())), [existing]);
  const knownPhones = useMemo(() => new Set(existing.filter((c) => digits(c.phone).length >= 7).map((c) => digits(c.phone))), [existing]);
  const usable = parsedRows.filter(Boolean);
  const seen = new Set();
  const fresh = usable.filter((c) => {
    if (c.email && (known.has(c.email) || seen.has(c.email))) return false;
    if (!c.email && digits(c.phone).length >= 7 && knownPhones.has(digits(c.phone))) return false;
    if (c.email) seen.add(c.email);
    return true;
  });
  const needsName = map.first_name < 0 && map.last_name < 0 && map.full_name < 0 && map.company < 0;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      // Every tag named in the file, plus the one for this import, made once.
      const names = new Set(fresh.flatMap((c) => c.tagNames));
      if (extraTag.trim()) names.add(extraTag.trim());
      const tagIdByName = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
      for (const n of names) {
        if (!tagIdByName.has(n.toLowerCase())) {
          const t = await ensureTag(n);
          if (t) tagIdByName.set(n.toLowerCase(), t.id);
        }
      }
      let done = 0;
      for (let i = 0; i < fresh.length; i += 200) {
        const chunk = fresh.slice(i, i + 200);
        const { data, error: err } = await supabase.from("contacts").insert(chunk.map(({ tagNames: _t, ...c }) => c)).select("id");
        if (err) throw err;
        const links = [];
        data.forEach((row, idx) => {
          const mine = new Set([...chunk[idx].tagNames, ...(extraTag.trim() ? [extraTag.trim()] : [])].map((n) => tagIdByName.get(n.toLowerCase())).filter(Boolean));
          mine.forEach((tag_id) => links.push({ contact_id: row.id, tag_id }));
        });
        if (links.length) {
          const { error: e2 } = await supabase.from("contact_tag_links").insert(links);
          if (e2) throw e2;
        }
        done += chunk.length;
        setProgress(`${done} of ${fresh.length} imported…`);
      }
      setResult({ added: fresh.length, skipped: usable.length - fresh.length, unnamed: parsedRows.length - usable.length });
      onDone();
    } catch (e) {
      setError(e.message || "The import stopped. What was already imported is saved; run it again and those people are skipped.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl" role="dialog" aria-label="Import contacts">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Import contacts</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>

        {result ? (
          <div className="mt-5 space-y-3">
            <p className="text-lg font-semibold">{result.added} contact{result.added === 1 ? "" : "s"} imported.</p>
            {result.skipped > 0 && <p className="text-sm text-[#1c1a17]/65 dark:text-[#faf9f7]/65">{result.skipped} skipped because they're already in your contacts.</p>}
            {result.unnamed > 0 && <p className="text-sm text-[#1c1a17]/65 dark:text-[#faf9f7]/65">{result.unnamed} row{result.unnamed === 1 ? " had" : "s had"} no name and {result.unnamed === 1 ? "was" : "were"} left out.</p>}
            <button type="button" onClick={onClose} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5">Done</button>
          </div>
        ) : !rows ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-[#1c1a17]/65 dark:text-[#faf9f7]/65">Choose a CSV file with a header row. Google Contacts, Outlook, Apple and most spreadsheets can export one.</p>
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className="block text-sm" aria-label="CSV file" />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold mb-2">Which column is which?</h3>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
                {IMPORT_FIELDS.map((f) => (
                  <label key={f.key} className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                    {f.label}
                    <select value={map[f.key] ?? -1} onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))} className={`${input} mt-1 font-normal`}>
                      <option value={-1}>Don't import</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                Mark everyone as
                <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={`${input} mt-1 font-normal`}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                Add a tag to all of them (optional)
                <input value={extraTag} onChange={(e) => setExtraTag(e.target.value)} placeholder="e.g. Imported Oct 2026" className={`${input} mt-1 font-normal`} />
              </label>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Preview</h3>
              {needsName ? (
                <p className="text-sm text-red-600 dark:text-red-400">Pick a name column (first and last name, or full name) to continue.</p>
              ) : (
                <>
                  <ul className="rounded-xl border border-black/10 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10 text-sm">
                    {fresh.slice(0, 5).map((c, i) => (
                      <li key={i} className="px-3 py-2">
                        <span className="font-medium">{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.company}</span>
                        <span className="text-[#1c1a17]/55 dark:text-[#faf9f7]/55"> · {[c.email, c.phone, c.city].filter(Boolean).join(" · ") || "no contact details"}</span>
                      </li>
                    ))}
                    {fresh.length === 0 && <li className="px-3 py-3 text-[#1c1a17]/55 dark:text-[#faf9f7]/55">Nobody new to import.</li>}
                  </ul>
                  <p className="mt-2 text-sm text-[#1c1a17]/65 dark:text-[#faf9f7]/65">
                    <b>{fresh.length}</b> to import
                    {usable.length - fresh.length > 0 ? `, ${usable.length - fresh.length} already in your contacts (skipped)` : ""}
                    {parsedRows.length - usable.length > 0 ? `, ${parsedRows.length - usable.length} with no name (left out)` : ""}.
                  </p>
                </>
              )}
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="button" onClick={run} disabled={busy || needsName || fresh.length === 0} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
                {busy ? "Importing…" : `Import ${fresh.length} contact${fresh.length === 1 ? "" : "s"}`}
              </button>
              {progress && busy && <span className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{progress}</span>}
              <button type="button" onClick={() => { setRows(null); setError(""); }} disabled={busy} className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">Choose a different file</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

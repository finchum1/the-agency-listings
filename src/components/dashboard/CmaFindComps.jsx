import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { newComp } from "../../lib/cma";
import { formatPrice } from "../../lib/format";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const s = (v) => (v == null ? "" : String(v));

/** A result from /api/cma-comps as a comparable the CMA editor holds (all fields as text, like the form inputs). */
export function compFromResult(r) {
  return {
    ...newComp(r.status),
    address: r.address || "",
    price: s(r.price),
    list_price: s(r.list_price),
    date: r.date || "",
    dom: s(r.dom),
    beds: s(r.beds),
    baths: s(r.baths),
    sqft: s(r.sqft),
    year_built: s(r.year_built),
    lot: r.lot || "",
    distance: s(r.distance),
    mls: r.mls || "",
    photo_url: r.photo_url || "",
  };
}

// "Find comps": looks up sold and active homes around the CMA's home in the office's MLS feed, lets the agent tick the ones to use, and hands them
// to the editor as ordinary comparables (still editable, still adjustable by hand). Server side: api/cma-comps.js.
export default function CmaFindComps({ subject, haveMls, onAdd, onClose }) {
  const [months, setMonths] = useState(6);
  const [radiusMiles, setRadiusMiles] = useState(2);
  const [sqftPct, setSqftPct] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(new Set());

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/cma-comps", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ subject, months, radiusMiles, sqftPct }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't search the MLS.");
      setResult(body);
      // Sold homes start ticked, active ones not: the price is built from what sold.
      setPicked(new Set((body.comps || []).filter((c) => c.status === "sold" && !haveMls.has(c.mls)).map((c) => c.mls)));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const toggle = (mls) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(mls) ? n.delete(mls) : n.add(mls);
      return n;
    });
  const add = () => {
    const chosen = (result?.comps || []).filter((c) => picked.has(c.mls));
    onAdd(chosen.map(compFromResult), result?.subject || {});
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Find comps" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white dark:bg-[#1a1a1a] p-5 sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Find comps in the MLS</h2>
            <p className={`mt-1 text-sm ${muted}`}>Looks around {subject.address || "the home"} for homes that sold and homes for sale now with similar bedrooms and size. You pick which to add.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-xl leading-none">×</button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium">
            Sold within
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={`${input} mt-1 block`}>
              {[3, 6, 9, 12, 18, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
            </select>
          </label>
          <label className="text-xs font-medium">
            Within
            <select value={radiusMiles} onChange={(e) => setRadiusMiles(Number(e.target.value))} className={`${input} mt-1 block`}>
              {[0.5, 1, 2, 3, 5, 10].map((m) => <option key={m} value={m}>{m} mile{m === 1 ? "" : "s"}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium">
            Size within
            <select value={sqftPct} onChange={(e) => setSqftPct(Number(e.target.value))} className={`${input} mt-1 block`}>
              {[10, 20, 30, 40].map((p) => <option key={p} value={p}>{p}%</option>)}
            </select>
          </label>
          <button type="button" onClick={run} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Searching…" : result ? "Search again" : "Find comps"}
          </button>
        </div>

        {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {result && !result.enabled && (
          <p className={`mt-4 rounded-xl border border-dashed border-black/15 dark:border-white/20 p-4 text-sm ${muted}`}>
            Your office's MLS connection isn't set up yet, so there is nothing to search. Add comps by hand for now; this button will fill them in once the feed is live.
          </p>
        )}
        {result?.enabled && (
          <div className="mt-4">
            {result.sample && (
              <p role="status" className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">These are sample homes from the test account, not real sales. Don't use them in a CMA.</p>
            )}
            {!result.located && <p className={`mb-3 text-xs ${muted}`}>That address wasn't found in the MLS, so this searched the whole city instead of a radius.</p>}
            {result.comps.length === 0 ? (
              <p className={`text-sm ${muted}`}>No matches. Try a wider area, a longer time, or a looser size range.</p>
            ) : (
              <ul className="divide-y divide-black/10 dark:divide-white/10">
                {result.comps.map((c) => {
                  const have = haveMls.has(c.mls);
                  return (
                    <li key={c.mls} className="flex items-center gap-3 py-2.5">
                      <input type="checkbox" checked={picked.has(c.mls)} disabled={have} onChange={() => toggle(c.mls)} aria-label={`Use ${c.address}`} />
                      <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-black/[0.05] dark:bg-white/[0.06]">{c.photo_url && <img src={c.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold">{c.address || `MLS# ${c.mls}`}</span>
                        <span className={`block truncate text-xs ${muted}`}>
                          {[c.status === "sold" ? "Sold" : "For sale", c.date, c.beds != null && `${c.beds} bd`, c.baths != null && `${c.baths} ba`, c.sqft && `${Number(c.sqft).toLocaleString("en-US")} sqft`, c.distance != null && `${Number(c.distance).toFixed(1)} mi`].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="text-right text-sm font-semibold">{formatPrice(c.price)}{have && <span className={`block text-[11px] font-normal ${muted}`}>already added</span>}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className={quiet}>Cancel</button>
              <button type="button" onClick={add} disabled={picked.size === 0} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                Add {picked.size || ""} selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

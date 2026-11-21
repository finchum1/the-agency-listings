import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { cleanSoldPrice, compareAttached, diffText, makeSnapshot } from "../../lib/cmaAttach";
import { subjectAddress } from "../../lib/cma";
import { formatPrice } from "../../lib/format";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a]";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const COLS = "id, title, subject, comps, price_low, price_high, suggested_price, listing_id, attach, updated_at";

function Attached({ cma, listing, onChanged }) {
  const snap = cma.attach || {};
  const [sold, setSold] = useState(snap.sold_price ?? "");
  const [error, setError] = useState("");
  const save = async (patch) => {
    const { error: err } = await supabase.from("cmas").update(patch).eq("id", cma.id);
    if (err) return setError(err.message);
    setError("");
    onChanged();
  };
  const rows = compareAttached({ ...snap, sold_price: cleanSoldPrice(sold) }, listing.price);
  return (
    <li className={`${card} p-4 space-y-3`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/dashboard/cmas/${cma.id}`} className="font-medium underline decoration-black/20 dark:decoration-white/30 underline-offset-2">{cma.title || subjectAddress(cma.subject) || "CMA"}</Link>
        <span className={`text-xs ${muted}`}>{snap.at ? `frozen ${new Date(snap.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><dt className={`text-xs ${muted}`}>CMA suggested</dt><dd className="font-semibold">{snap.suggested != null ? formatPrice(snap.suggested) : "—"}</dd>{snap.low != null && snap.high != null && <dd className={`text-xs ${muted}`}>{formatPrice(snap.low)} to {formatPrice(snap.high)}</dd>}</div>
        <div><dt className={`text-xs ${muted}`}>Listed at</dt><dd className="font-semibold">{snap.list_price != null ? formatPrice(snap.list_price) : "—"}</dd></div>
        <div><dt className={`text-xs ${muted}`}>List price now</dt><dd className="font-semibold">{listing.price != null ? formatPrice(listing.price) : "—"}</dd></div>
        <div>
          <dt className={`text-xs ${muted}`}>Sold for</dt>
          <dd>
            <input inputMode="decimal" value={sold} onChange={(e) => setSold(e.target.value)} onBlur={() => cleanSoldPrice(sold) !== (snap.sold_price ?? null) && save({ attach: { ...snap, sold_price: cleanSoldPrice(sold) } })} placeholder="When it closes" aria-label="Sold price" className={input} />
          </dd>
        </div>
      </dl>
      {rows.length > 0 && (
        <ul className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-3" title={r.hint}>
              <span className={muted}>{r.label}</span>
              <span className="font-semibold tabular-nums">{diffText(r.diff)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => save({ attach: makeSnapshot(cma, listing, { sold_price: cleanSoldPrice(sold) }) })} className={quiet}>Refreeze with today's CMA</button>
        <button type="button" onClick={() => save({ listing_id: null, attach: {} })} className={quiet}>Detach</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </li>
  );
}

// On a listing's edit page: the CMAs attached to it, each frozen at the day it was attached and compared with the list price now and what it sold for.
export default function ListingCmas({ listing }) {
  const [attached, setAttached] = useState([]);
  const [free, setFree] = useState([]);
  const [pick, setPick] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [a, f] = await Promise.all([
      supabase.from("cmas").select(COLS).eq("listing_id", listing.id).order("updated_at", { ascending: true }),
      supabase.from("cmas").select(COLS).is("listing_id", null).order("updated_at", { ascending: false }).limit(50),
    ]);
    setAttached(a.data || []);
    setFree(f.data || []);
  }, [listing.id]);
  useEffect(() => {
    load();
  }, [load]);

  const attach = async () => {
    const cma = free.find((c) => c.id === pick);
    if (!cma) return;
    const { error: err } = await supabase.from("cmas").update({ listing_id: listing.id, attach: makeSnapshot(cma, listing) }).eq("id", cma.id);
    if (err) return setError(err.message);
    setPick("");
    setError("");
    load();
  };

  return (
    <section className={`${card} p-5 space-y-4`} aria-label="CMAs for this listing">
      <div>
        <h2 className="font-display text-lg font-semibold">CMAs</h2>
        <p className={`text-sm ${muted}`}>The price opinion behind this listing, saved as it was the day you attached it, so you can see how the price held up.</p>
      </div>
      {attached.length > 0 && (
        <ul className="space-y-3">
          {attached.map((c) => <Attached key={c.id} cma={c} listing={listing} onChanged={load} />)}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${input} max-w-sm`} aria-label="CMA to attach">
          <option value="">{free.length ? "Attach a CMA…" : "No unattached CMAs"}</option>
          {free.map((c) => <option key={c.id} value={c.id}>{[subjectAddress(c.subject), c.title].filter(Boolean).join(" · ") || "Untitled CMA"}</option>)}
        </select>
        <button type="button" disabled={!pick} onClick={attach} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Attach</button>
        <Link to={`/dashboard/cmas?new=1&address=${encodeURIComponent(listing.address_line1 || "")}`} className={quiet}>New CMA for this home</Link>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

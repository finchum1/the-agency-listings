import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import { ADJUSTMENT_PRESETS, COMP_STATUSES, adjustedPrice, adjustmentTotal, computeCma, factsLine, newComp, pricePerSqft, subjectAddress, toNumber } from "../../lib/cma";
import { formatPrice } from "../../lib/format";
import CmaReport from "../public/CmaReport";
import ClientPicker from "./ClientPicker";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a]";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white";
const COLUMNS = "id, person_id, title, subject, comps, price_low, price_high, suggested_price, notes, share_hint, shared_at, last_viewed_at, view_count, updated_at";

const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-xs font-medium ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CompEditor({ comp, subject, open, onToggle, onChange, onRemove }) {
  const set = (k) => (e) => onChange({ ...comp, [k]: e.target.value });
  const adj = adjustmentTotal(comp);
  const price = toNumber(comp.price);
  const status = COMP_STATUSES.find((s) => s.value === comp.status) || COMP_STATUSES[0];
  const setAdj = (i, patch) => onChange({ ...comp, adjustments: comp.adjustments.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const ppsf = pricePerSqft(comp);
  return (
    <li className={`${card} ${comp.include === false ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <input type="checkbox" checked={comp.include !== false} onChange={(e) => onChange({ ...comp, include: e.target.checked })} aria-label="Use this home in the analysis" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{comp.address || "New comparable"}</span>
            <span className={`block truncate text-xs ${muted}`}>{[status.label, factsLine(comp)].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-right text-sm">
            <span className="block font-semibold">{price != null ? formatPrice(price) : "—"}</span>
            {adj !== 0 && price != null && <span className={`block text-xs ${muted}`}>adjusted {formatPrice(price + adj)}</span>}
          </span>
        </button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-black/10 dark:border-white/15 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Status" className="sm:col-span-2">
              <select value={comp.status} onChange={set("status")} className={input}>
                {COMP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Address" className="sm:col-span-4"><input value={comp.address} onChange={set("address")} placeholder="123 Main St" className={input} /></Field>
            <Field label={comp.status === "sold" ? "Sold price" : "List price"} className="sm:col-span-2"><input inputMode="decimal" value={comp.price} onChange={set("price")} placeholder="350000" className={input} /></Field>
            {comp.status === "sold" && <Field label="Original list price" className="sm:col-span-2"><input inputMode="decimal" value={comp.list_price} onChange={set("list_price")} className={input} /></Field>}
            <Field label={status.dateLabel} className="sm:col-span-2"><input type="date" value={comp.date} onChange={set("date")} className={input} /></Field>
            <Field label="Days on market"><input inputMode="numeric" value={comp.dom} onChange={set("dom")} className={input} /></Field>
            <Field label="Beds"><input inputMode="decimal" value={comp.beds} onChange={set("beds")} className={input} /></Field>
            <Field label="Baths"><input inputMode="decimal" value={comp.baths} onChange={set("baths")} className={input} /></Field>
            <Field label="Sqft"><input inputMode="numeric" value={comp.sqft} onChange={set("sqft")} className={input} /></Field>
            <Field label="Year built"><input inputMode="numeric" value={comp.year_built} onChange={set("year_built")} className={input} /></Field>
            <Field label="Lot"><input value={comp.lot} onChange={set("lot")} placeholder="0.25 ac" className={input} /></Field>
            <Field label="Miles away"><input inputMode="decimal" value={comp.distance} onChange={set("distance")} className={input} /></Field>
            <Field label="MLS #"><input value={comp.mls} onChange={set("mls")} className={input} /></Field>
            <Field label="Photo address" className="sm:col-span-3"><input value={comp.photo_url} onChange={set("photo_url")} placeholder="https://… (optional)" className={input} /></Field>
            <Field label="Note for the client" className="sm:col-span-6"><input value={comp.notes} onChange={set("notes")} placeholder="Newer kitchen, backs to a busy road…" className={input} /></Field>
          </div>

          <div>
            <p className="text-xs font-semibold">Adjustments</p>
            <p className={`text-xs ${muted}`}>
              What to add to or take off this home's price so it matches {subject.address ? "yours" : "the home being priced"}. Use a plus when yours is better in that way (a bigger garage, a pool, newer updates) and a minus when this home has something yours lacks.
            </p>
            <ul className="mt-2 space-y-2">
              {comp.adjustments.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input value={a.label} onChange={(e) => setAdj(i, { label: e.target.value })} placeholder="What differs" className={input} aria-label="Adjustment name" />
                  <input inputMode="decimal" value={a.amount} onChange={(e) => setAdj(i, { amount: e.target.value })} placeholder="+5000 or -8000" className={`${input} max-w-[9rem]`} aria-label="Adjustment amount" />
                  <button type="button" onClick={() => onChange({ ...comp, adjustments: comp.adjustments.filter((_, j) => j !== i) })} className={quiet} aria-label="Remove adjustment">✕</button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ADJUSTMENT_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => onChange({ ...comp, adjustments: [...comp.adjustments, { label: p, amount: "" }] })} className={quiet}>+ {p}</button>
              ))}
              <button type="button" onClick={() => onChange({ ...comp, adjustments: [...comp.adjustments, { label: "", amount: "" }] })} className={quiet}>+ Other</button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className={muted}>{ppsf != null ? `$${Math.round(ppsf).toLocaleString("en-US")} per sqft` : ""}</span>
            <button type="button" onClick={onRemove} className="text-xs font-semibold text-red-600 dark:text-red-400 underline">Delete this comparable</button>
          </div>
        </div>
      )}
    </li>
  );
}

function CmaEditor({ id }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { brand } = useOrg();
  const [row, setRow] = useState(null); // what the database last returned (share state, view count)
  const [doc, setDoc] = useState(null);
  const [personName, setPersonName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [preview, setPreview] = useState(false);
  const [link, setLink] = useState(""); // the full share address, only known right after it is made
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    let live = true;
    supabase.from("cmas").select(COLUMNS).eq("id", id).maybeSingle().then(async ({ data, error: err }) => {
      if (!live) return;
      if (err || !data) return setError("That CMA wasn't found.");
      setRow(data);
      setDoc({ title: data.title, person_id: data.person_id, subject: data.subject || {}, comps: data.comps || [], price_low: data.price_low ?? "", price_high: data.price_high ?? "", suggested_price: data.suggested_price ?? "", notes: data.notes || "" });
      if (data.person_id) {
        const { data: p } = await supabase.from("people").select("name").eq("id", data.person_id).maybeSingle();
        if (live) setPersonName(p?.name || "");
      }
      loaded.current = true;
    });
    return () => {
      live = false;
    };
  }, [id]);

  // Save a moment after the last change.
  const save = useCallback(async (next) => {
    setStatus("Saving…");
    const { error: err } = await supabase.from("cmas").update({
      title: next.title,
      person_id: next.person_id,
      subject: next.subject,
      comps: next.comps,
      price_low: toNumber(next.price_low),
      price_high: toNumber(next.price_high),
      suggested_price: toNumber(next.suggested_price),
      notes: next.notes,
    }).eq("id", id);
    setStatus(err ? "" : "Saved");
    setError(err ? err.message : "");
  }, [id]);
  const change = (patch) => {
    setDoc((d) => {
      const next = typeof patch === "function" ? patch(d) : { ...d, ...patch };
      if (loaded.current) {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(next), 900);
        setStatus("Unsaved changes");
      }
      return next;
    });
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const calc = useMemo(() => (doc ? computeCma(doc) : null), [doc]);
  if (error && !doc) return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!doc) return <p className={`text-sm ${muted}`}>Loading…</p>;

  const setSubject = (k) => (e) => change((d) => ({ ...d, subject: { ...d.subject, [k]: e.target.value } }));
  const setComp = (compId, next) => change((d) => ({ ...d, comps: d.comps.map((c) => (c.id === compId ? next : c)) }));
  const addComp = (statusKey) => {
    const c = newComp(statusKey);
    change((d) => ({ ...d, comps: [...d.comps, c] }));
    setOpenId(c.id);
  };

  const makeLink = async () => {
    clearTimeout(timer.current);
    await save(doc);
    const { data, error: err } = await supabase.rpc("create_cma_share", { p_id: id });
    if (err) return setError(err.message);
    setLink(`${window.location.origin}/cma/${data}`);
    setRow((r) => ({ ...r, share_hint: data.slice(-4), shared_at: new Date().toISOString() }));
  };
  const stopSharing = async () => {
    const { error: err } = await supabase.rpc("revoke_cma_share", { p_id: id });
    if (err) return setError(err.message);
    setLink("");
    setRow((r) => ({ ...r, share_hint: null, shared_at: null }));
  };
  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const remove = async () => {
    if (!window.confirm("Delete this CMA? Its client link stops working too. This can't be undone.")) return;
    const { error: err } = await supabase.from("cmas").delete().eq("id", id);
    if (err) return setError(err.message);
    navigate("/dashboard/cmas");
  };

  const grouped = COMP_STATUSES.map((s) => ({ ...s, list: doc.comps.filter((c) => c.status === s.value) }));
  const reportCma = { ...doc, price_low: toNumber(doc.price_low), price_high: toNumber(doc.price_high), suggested_price: toNumber(doc.suggested_price), prepared: row?.updated_at };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link to="/dashboard/cmas" className={`text-sm underline ${muted}`}>All CMAs</Link>
        <span className={`ml-auto text-xs ${muted}`} aria-live="polite">{status}</span>
        <button type="button" onClick={() => setPreview((v) => !v)} className={quiet}>{preview ? "Back to editing" : "Preview client page"}</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/15">
          <CmaReport cma={reportCma} agent={profile} brand={brand} preview />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="space-y-6">
            <section className={`${card} p-5 space-y-3`}>
              <h2 className="font-display text-lg font-semibold">The home being priced</h2>
              <div className="grid gap-3 sm:grid-cols-6">
                <Field label="Name this CMA" className="sm:col-span-3"><input value={doc.title} onChange={(e) => change({ title: e.target.value })} placeholder="Smith listing appointment" className={input} /></Field>
                <Field label="Client" className="sm:col-span-3">
                  <ClientPicker personId={doc.person_id} name={personName} onPick={(pid, name) => { setPersonName(name); change({ person_id: pid }); }} />
                </Field>
                <Field label="Address" className="sm:col-span-6"><input value={doc.subject.address || ""} onChange={setSubject("address")} placeholder="Street address" className={input} /></Field>
                <Field label="City" className="sm:col-span-2"><input value={doc.subject.city || ""} onChange={setSubject("city")} className={input} /></Field>
                <Field label="State" className="sm:col-span-2"><input value={doc.subject.state || ""} onChange={setSubject("state")} className={input} /></Field>
                <Field label="ZIP" className="sm:col-span-2"><input value={doc.subject.zip || ""} onChange={setSubject("zip")} className={input} /></Field>
                <Field label="Beds"><input inputMode="decimal" value={doc.subject.beds || ""} onChange={setSubject("beds")} className={input} /></Field>
                <Field label="Baths"><input inputMode="decimal" value={doc.subject.baths || ""} onChange={setSubject("baths")} className={input} /></Field>
                <Field label="Sqft"><input inputMode="numeric" value={doc.subject.sqft || ""} onChange={setSubject("sqft")} className={input} /></Field>
                <Field label="Year built"><input inputMode="numeric" value={doc.subject.year_built || ""} onChange={setSubject("year_built")} className={input} /></Field>
                <Field label="Lot"><input value={doc.subject.lot || ""} onChange={setSubject("lot")} className={input} /></Field>
              </div>
            </section>

            {grouped.map((g) => (
              <section key={g.value}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold">{g.value === "sold" ? "Sold homes" : g.value === "pending" ? "Under contract" : "For sale now"} <span className={`text-sm font-normal ${muted}`}>{g.list.length}</span></h2>
                  <button type="button" onClick={() => addComp(g.value)} className={quiet}>+ Add {g.label.toLowerCase()} home</button>
                </div>
                {g.list.length === 0 ? (
                  <p className={`rounded-2xl border border-dashed border-black/15 dark:border-white/20 p-4 text-sm ${muted}`}>
                    {g.value === "sold" ? "Add the homes that sold nearby in the last six months. The price is built from these." : g.value === "pending" ? "Optional." : "Optional: the competition on the market right now."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {g.list.map((c) => (
                      <CompEditor key={c.id} comp={c} subject={doc.subject} open={openId === c.id} onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))} onChange={(n) => setComp(c.id, n)} onRemove={() => change((d) => ({ ...d, comps: d.comps.filter((x) => x.id !== c.id) }))} />
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section className={`${card} p-5 space-y-2`}>
              <h2 className="font-display text-lg font-semibold">Notes for the client</h2>
              <textarea value={doc.notes} onChange={(e) => change({ notes: e.target.value })} rows={5} maxLength={5000} placeholder="What the numbers mean, what you'd do to the house before listing, how you'd market it…" className={input} />
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4">
            <section className={`${card} p-5`} aria-label="Price opinion">
              <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#D8091B] dark:text-[#f2454b]">Suggested price</p>
              <p className="mt-1 font-display text-3xl font-semibold">{calc.suggested != null ? formatPrice(calc.suggested) : "—"}</p>
              <p className={`text-sm ${muted}`}>{calc.low != null ? `${formatPrice(calc.low)} to ${formatPrice(calc.high)}` : "Add sold homes with prices."}</p>
              <p className={`mt-2 text-xs ${muted}`}>
                {calc.basisCount ? `Built from ${calc.basisCount} ${calc.basisKind} home${calc.basisCount === 1 ? "" : "s"}, adjusted.` : ""}
                {calc.byPricePerSqft ? ` By price per sqft: about ${formatPrice(calc.byPricePerSqft)}.` : ""}
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold">Set my own numbers{calc.overridden ? " (in use)" : ""}</summary>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="Low"><input inputMode="decimal" value={doc.price_low} onChange={(e) => change({ price_low: e.target.value })} placeholder={calc.calculated.low ?? ""} className={input} /></Field>
                  <Field label="Suggested"><input inputMode="decimal" value={doc.suggested_price} onChange={(e) => change({ suggested_price: e.target.value })} placeholder={calc.calculated.suggested ?? ""} className={input} /></Field>
                  <Field label="High"><input inputMode="decimal" value={doc.price_high} onChange={(e) => change({ price_high: e.target.value })} placeholder={calc.calculated.high ?? ""} className={input} /></Field>
                </div>
                <p className={`mt-1 text-xs ${muted}`}>Leave a box empty to use the calculated number.</p>
              </details>
            </section>

            <section className={`${card} p-5 space-y-3`} aria-label="Share with the client">
              <h2 className="font-display text-lg font-semibold">Share with the client</h2>
              {row?.shared_at ? (
                <>
                  <p className={`text-sm ${muted}`}>
                    A private link is active (ends in {row.share_hint}). Seen {row.view_count || 0} time{row.view_count === 1 ? "" : "s"}{row.last_viewed_at ? `, last ${when(row.last_viewed_at)}` : ""}. The page always shows the latest version of this CMA.
                  </p>
                  {link && (
                    <div className="flex items-center gap-2">
                      <input readOnly value={link} onFocus={(e) => e.target.select()} className={input} aria-label="Client link" />
                      <button type="button" onClick={copy} className={quiet}>{copied ? "Copied" : "Copy"}</button>
                    </div>
                  )}
                  {!link && <p className={`text-xs ${muted}`}>For safety the full link is only shown when it is made. Make a new one to copy it again (the old link stops working).</p>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={makeLink} className={quiet}>Make a new link</button>
                    <button type="button" onClick={stopSharing} className={quiet}>Stop sharing</button>
                  </div>
                </>
              ) : (
                <>
                  <p className={`text-sm ${muted}`}>Makes a private page with your price opinion and the homes behind it. They can print it or save it as a PDF.</p>
                  <button type="button" onClick={makeLink} className={primary}>Create client link</button>
                </>
              )}
            </section>
            <button type="button" onClick={remove} className="text-xs font-semibold text-red-600 dark:text-red-400 underline">Delete this CMA</button>
          </aside>
        </div>
      )}
    </div>
  );
}

function CmaList() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.from("cmas").select("id, title, subject, comps, price_low, price_high, suggested_price, share_hint, view_count, updated_at").order("updated_at", { ascending: false }).then(({ data, error: err }) => {
      if (!live) return;
      if (err) setError(err.message);
      setRows(data || []);
    });
    return () => {
      live = false;
    };
  }, []);
  const create = async () => {
    setBusy(true);
    const subject = params.get("address") ? { address: params.get("address") } : {};
    const { data, error: err } = await supabase.from("cmas").insert({ subject, title: "" }).select("id").single();
    setBusy(false);
    if (err) return setError(err.message);
    navigate(`/dashboard/cmas/${data.id}`);
  };
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">CMAs</h1>
          <p className={`mt-1 text-sm ${muted}`}>Price a home from the sales around it, then share the analysis with your client.</p>
        </div>
        <button type="button" onClick={create} disabled={busy} className={primary}>New CMA</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {rows && rows.length === 0 && <p className={`rounded-2xl border border-dashed border-black/15 dark:border-white/20 p-8 text-center text-sm ${muted}`}>No CMAs yet. Start one for a listing appointment or a seller who asked what their home is worth.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {(rows || []).map((r) => {
          const m = computeCma(r);
          return (
            <li key={r.id}>
              <Link to={`/dashboard/cmas/${r.id}`} className={`${card} block p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]`}>
                <p className="font-display text-lg font-semibold">{subjectAddress(r.subject) || r.title || "Untitled CMA"}</p>
                {r.title && subjectAddress(r.subject) && <p className={`text-sm ${muted}`}>{r.title}</p>}
                <p className="mt-2 text-sm">{m.suggested != null ? `${formatPrice(m.suggested)} · ${formatPrice(m.low)} to ${formatPrice(m.high)}` : "No price yet"}</p>
                <p className={`mt-1 text-xs ${muted}`}>
                  {r.comps?.length || 0} comparable{(r.comps?.length || 0) === 1 ? "" : "s"} · edited {when(r.updated_at)}{r.share_hint ? ` · shared, seen ${r.view_count || 0}×` : ""}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function CmasPage() {
  const { id } = useParams();
  return id ? <CmaEditor key={id} id={id} /> : <CmaList />;
}

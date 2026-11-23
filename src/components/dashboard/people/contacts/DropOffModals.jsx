import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fullName } from "../../../../lib/contacts";
import { addressIsThin, googleDirectionsUrl, mapAddress, sortForRoute } from "../../../../lib/directions";

// Gift drop-offs: pick contacts, make one private link, send it to whoever is delivering (supabase/drop-off-lists.sql, api/drop-off.js,
// src/pages/DropOffPage.jsx). A stop is just a name and an address copied from the contact, so the helper never sees phone numbers or emails,
// and you can fix an address or add a "leave on the porch" note here without touching the contact.

const field = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 disabled:opacity-60";
const ghost = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-2 text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";

function Shell({ title, onClose, children, width = "max-w-2xl" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${width} max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl`} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const dropOffLink = (token) => `${window.location.origin}/dropoff/${token}`;

function CopyButton({ text, label = "Copy link" }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

/** Make a list from the picked contacts. */
export function DropOffCreate({ picked, onClose, onCreated }) {
  const withAddress = useMemo(() => picked.filter((c) => mapAddress(c)), [picked]);
  const without = picked.filter((c) => !mapAddress(c));
  const [rows, setRows] = useState(() => sortForRoute(withAddress.map((c) => ({ key: c.id, contact_id: c.id, name: fullName(c), address: mapAddress(c), note: "" }))));
  const [title, setTitle] = useState("Gift drop-offs");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");

  const edit = (key, patch) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const thin = rows.filter((r) => addressIsThin(r.address)).length;

  const submit = async () => {
    setBusy(true);
    setError("");
    const stops = rows.filter((r) => r.address.trim()).map((r) => ({ contact_id: r.contact_id, name: r.name, address: r.address, note: r.note }));
    const { data, error: err } = await supabase.rpc("create_drop_off_list", { p_title: title, p_note: note, p_days: days, p_stops: stops });
    setBusy(false);
    if (err) return setError(err.message || "Couldn't make the list.");
    setToken(data);
    onCreated?.();
  };

  if (token) {
    const link = dropOffLink(token);
    const text = `Here's the list for the gift drop-offs. Tap any address for directions, and tap Delivered after each one: ${link}`;
    return (
      <Shell title="Your drop-off list is ready" onClose={onClose} width="max-w-lg">
        <div className="space-y-4">
          <p className="text-sm">Send this link to whoever is making the deliveries. They don't need to sign in, and it shows only names, addresses and your notes.</p>
          <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Drop-off link" className={field} />
          <div className="flex flex-wrap gap-2">
            <CopyButton text={link} />
            <CopyButton text={text} label="Copy as a text message" />
            <a href={`sms:?&body=${encodeURIComponent(text)}`} className={ghost}>Open in Messages</a>
            <a href={link} target="_blank" rel="noreferrer" className={ghost}>Preview</a>
          </div>
          <p className={`text-xs ${muted}`}>It stops working in {days} days, or sooner if you turn it off under "Drop-off lists". You'll see there which stops have been delivered.</p>
          <button type="button" onClick={onClose} className={primary}>Done</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`Drop-off list · ${rows.length} stop${rows.length === 1 ? "" : "s"}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Title" aria-label="List title" className={field} />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Link stays open" className={field}>
            <option value={14}>Link open 2 weeks</option>
            <option value={30}>Link open 30 days</option>
            <option value={60}>Link open 60 days</option>
            <option value={90}>Link open 90 days</option>
          </select>
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="Instructions for your helper, such as 'Leave on the porch, don't knock before 9am' (optional)" aria-label="Instructions" className={field} />

        {without.length > 0 && (
          <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
            Left out, no address on file: {without.map(fullName).join(", ")}.
          </p>
        )}
        {thin > 0 && (
          <p className="text-sm rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
            {thin} address{thin === 1 ? " looks" : "es look"} incomplete (no city or zip), so a map may guess wrong. Fix {thin === 1 ? "it" : "them"} below. This changes only this list, not the contact.
          </p>
        )}

        <ul className="space-y-2">
          {rows.map((r) => {
            const bad = addressIsThin(r.address);
            return (
              <li key={r.key} className="rounded-xl border border-black/10 dark:border-white/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={r.name} onChange={(e) => edit(r.key, { name: e.target.value })} aria-label="Name" className={`${field} font-semibold`} />
                  <button type="button" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label={`Remove ${r.name}`} className="p-2 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-red-600">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input value={r.address} onChange={(e) => edit(r.key, { address: e.target.value })} aria-label="Address" className={`${field} ${bad ? "border-amber-400" : ""}`} />
                  {r.address.trim() && (
                    <a href={googleDirectionsUrl(r.address)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold underline" title="Check this address on a map">Check</a>
                  )}
                </div>
                <input value={r.note} onChange={(e) => edit(r.key, { note: e.target.value })} maxLength={300} placeholder="Note for this stop (optional)" aria-label="Note for this stop" className={field} />
              </li>
            );
          })}
        </ul>
        <p className={`text-xs ${muted}`}>Stops are grouped by zip code so nearby ones sit together. Your helper can also plan a whole run in Google Maps from the list.</p>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="button" disabled={busy || rows.every((r) => !r.address.trim())} onClick={submit} className={primary}>
          {busy ? "Making the link…" : "Make the link"}
        </button>
      </div>
    </Shell>
  );
}

/** The lists already made: progress, copy the link again, turn one off. */
export function DropOffLists({ onClose }) {
  const [lists, setLists] = useState(null);
  const [stops, setStops] = useState({});
  const [open, setOpen] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const { data, error: err } = await supabase.from("drop_off_lists").select("id, token, title, note, created_at, expires_at, revoked_at, last_viewed_at, view_count").order("created_at", { ascending: false }).limit(40);
    if (err) return setError(err.message);
    setLists(data || []);
    const ids = (data || []).map((l) => l.id);
    if (!ids.length) return setStops({});
    const { data: s } = await supabase.from("drop_off_stops").select("id, list_id, position, name, address, note, done_at").in("list_id", ids).order("position");
    const by = {};
    for (const x of s || []) (by[x.list_id] ||= []).push(x);
    setStops(by);
  };
  useEffect(() => {
    load();
  }, []);

  const statusOf = (l) => (l.revoked_at ? "Turned off" : new Date(l.expires_at) < new Date() ? "Expired" : "Open");
  const act = async (fn, args) => {
    setError("");
    const { error: err } = await supabase.rpc(fn, args);
    if (err) setError(err.message);
    await load();
  };
  const when = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <Shell title="Drop-off lists" onClose={onClose}>
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {lists === null && <p className={`text-sm ${muted}`}>Loading…</p>}
      {lists && lists.length === 0 && <p className={`text-sm ${muted}`}>No lists yet. Select contacts in the list, then choose "Drop-off list".</p>}
      <ul className="space-y-3">
        {(lists || []).map((l) => {
          const s = stops[l.id] || [];
          const done = s.filter((x) => x.done_at).length;
          const st = statusOf(l);
          return (
            <li key={l.id} className="rounded-xl border border-black/10 dark:border-white/10 p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-semibold">{l.title || "Gift drop-offs"}</p>
                <span className={`text-xs font-semibold ${st === "Open" ? "text-emerald-600" : muted}`}>{st}</span>
                <span className={`text-xs ${muted}`}>made {when(l.created_at)}{st === "Open" ? `, open until ${when(l.expires_at)}` : ""}</span>
              </div>
              <p className="mt-1 text-sm">
                <span className="font-semibold">{done}</span> of {s.length} delivered
                {l.view_count ? <span className={muted}> · opened {l.view_count} time{l.view_count === 1 ? "" : "s"}</span> : <span className={muted}> · not opened yet</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={dropOffLink(l.token)} />
                <button type="button" className={ghost} onClick={() => setOpen(open === l.id ? "" : l.id)}>{open === l.id ? "Hide stops" : "See stops"}</button>
                {st === "Open" ? (
                  <button type="button" className={ghost} onClick={() => act("revoke_drop_off_list", { p_id: l.id })}>Turn off</button>
                ) : (
                  <button type="button" className={ghost} onClick={() => act("extend_drop_off_list", { p_id: l.id, p_days: 30 })}>Turn on for 30 days</button>
                )}
              </div>
              {open === l.id && (
                <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10 text-sm">
                  {s.map((x) => (
                    <li key={x.id} className="py-1.5 flex items-start gap-2">
                      <span className={x.done_at ? "text-emerald-600" : muted} aria-label={x.done_at ? "Delivered" : "Not yet"}>{x.done_at ? "✓" : "○"}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{x.name}</span> <span className={muted}>{x.address}</span>
                        {x.note && <span className={`block text-xs ${muted}`}>{x.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

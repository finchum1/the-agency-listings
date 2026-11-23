import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { appleDirectionsUrl, googleDirectionsUrl, googleRouteUrl, routeChunks } from "../lib/directions";

// /dropoff/<token>: the list of gift drop-offs an agent sent a helper. No sign-in; the token in the address is the credential, and the page tells
// search engines to stay away. Each stop opens in a maps app, and ticking one off tells the agent it is delivered. Names and addresses only.
export default function DropOffPage() {
  useForceLight();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    document.title = "Drop Off List";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/drop-off?token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? { data: await r.json() } : { gone: true }))
      .catch(() => ({ gone: true }))
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [token]);

  const stops = state.data?.stops || [];
  const todo = useMemo(() => stops.filter((s) => !s.done_at), [stops]);
  const done = useMemo(() => stops.filter((s) => s.done_at), [stops]);

  const toggle = async (stop) => {
    setErr("");
    setBusy(stop.id);
    const next = !stop.done_at;
    try {
      const r = await fetch("/api/drop-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, stop_id: stop.id, done: next }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save that.");
      setState((s) => ({ ...s, data: { ...s.data, stops: s.data.stops.map((x) => (x.id === stop.id ? { ...x, done_at: j.done_at } : x)) } }));
    } catch (e) {
      setErr(e.message || "Couldn't save that. Check your signal and try again.");
    } finally {
      setBusy("");
    }
  };

  if (state.loading) return <p className="min-h-screen grid place-items-center text-sm text-[#1c1a17]/50">Loading…</p>;
  if (state.gone) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-[#F5F1E9] text-[#1C1C1B]">
        <div>
          <h1 className="text-2xl font-semibold">This list isn't available anymore</h1>
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask whoever sent it for a new link.</p>
        </div>
      </div>
    );
  }

  const { title, note, from } = state.data;
  const chunks = routeChunks(todo);
  const btn = "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="min-h-screen bg-[#F5F1E9] text-[#1C1C1B]">
      <header className="bg-[#1c1a17] text-white">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/60">Drop Off List{from ? ` · from ${from}` : ""}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{title || "Gift drop-offs"}</h1>
          <p className="mt-3 text-sm text-white/75">
            <span className="font-semibold text-white">{done.length}</span> of {stops.length} delivered
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${stops.length ? (done.length / stops.length) * 100 : 0}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 space-y-6">
        {note && <p className="rounded-2xl bg-white border border-black/10 px-4 py-3 text-sm whitespace-pre-wrap">{note}</p>}

        {todo.length > 1 && (
          <section aria-label="Whole route" className="rounded-2xl bg-white border border-black/10 p-4">
            <h2 className="text-sm font-semibold">Plan a whole run in Google Maps</h2>
            <p className="mt-1 text-xs text-[#1c1a17]/60">Opens one trip through the stops left, in list order, starting from where you are. Google takes {chunks.length > 1 ? "ten stops at a time" : "up to ten stops"}; reorder them there if you like.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chunks.map((c, i) => (
                <a key={i} href={googleRouteUrl(c.map((s) => s.address))} target="_blank" rel="noreferrer" className={`${btn} bg-[#1c1a17] text-white`}>
                  {chunks.length > 1 ? `Stops ${i * 10 + 1}–${i * 10 + c.length}` : `Route all ${c.length} stops`}
                </a>
              ))}
            </div>
          </section>
        )}

        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}

        {todo.length > 0 && (
          <ul className="space-y-3">
            {todo.map((s) => (
              <Stop key={s.id} s={s} busy={busy === s.id} onToggle={() => toggle(s)} btn={btn} />
            ))}
          </ul>
        )}
        {todo.length === 0 && stops.length > 0 && <p className="text-center text-lg font-semibold py-6">Every stop is delivered. Thank you!</p>}

        {done.length > 0 && (
          <section aria-label="Delivered">
            <h2 className="text-xs font-semibold tracking-[0.2em] uppercase text-[#1c1a17]/50 mb-2">Delivered</h2>
            <ul className="space-y-2">
              {done.map((s) => (
                <Stop key={s.id} s={s} busy={busy === s.id} onToggle={() => toggle(s)} btn={btn} />
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Stop({ s, busy, onToggle, btn }) {
  const done = Boolean(s.done_at);
  return (
    <li className={`rounded-2xl border p-4 ${done ? "bg-black/[0.03] border-black/5 opacity-70" : "bg-white border-black/10"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${done ? "line-through" : ""}`}>{s.name || "Stop"}</p>
          <p className="mt-0.5 text-sm text-[#1c1a17]/75">{s.address || "No address"}</p>
          {s.note && <p className="mt-1.5 text-sm rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5">{s.note}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.address && !done && (
          <>
            <a href={googleDirectionsUrl(s.address)} target="_blank" rel="noreferrer" className={`${btn} bg-[#1c1a17] text-white`}>Google Maps</a>
            <a href={appleDirectionsUrl(s.address)} target="_blank" rel="noreferrer" className={`${btn} border border-black/15 bg-white`}>Apple Maps</a>
          </>
        )}
        <button type="button" onClick={onToggle} disabled={busy} className={`${btn} ${done ? "border border-black/15 bg-white" : "bg-emerald-600 text-white"} disabled:opacity-50 ml-auto`}>
          {busy ? "Saving…" : done ? "Undo" : "✓ Delivered"}
        </button>
      </div>
    </li>
  );
}

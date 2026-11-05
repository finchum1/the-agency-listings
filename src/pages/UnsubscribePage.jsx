import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

// The page behind the unsubscribe link in a newsletter. Opening it changes nothing; the button does (so an email scanner that opens links cannot
// unsubscribe anyone by accident).
export default function UnsubscribePage() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | done | invalid | error
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/newsletter-unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => ({ ok: r.ok, json: await r.json().catch(() => ({})) }))
      .then(({ ok, json }) => {
        if (!live) return;
        if (!ok) return setState("invalid");
        setInfo(json);
        setState(json.done ? "done" : "ready");
      })
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/newsletter-unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
    setBusy(false);
  };

  const agent = info?.agentName || "your agent";
  return (
    <main className="min-h-screen grid place-items-center bg-[#f7f4ee] px-6 font-sans text-[#1c1a17]">
      <div className="w-full max-w-md rounded-2xl bg-white border border-black/10 p-8 text-center space-y-4">
        {state === "loading" && <p className="text-sm text-black/50">Loading…</p>}
        {state === "invalid" && (
          <>
            <h1 className="font-serif text-2xl">This link isn't valid</h1>
            <p className="text-sm text-black/60">It may be mistyped or too old. If you keep getting emails you don't want, reply to one and ask to be taken off the list.</p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="font-serif text-2xl">Something went wrong</h1>
            <p className="text-sm text-black/60">Please try again in a moment.</p>
          </>
        )}
        {state === "ready" && (
          <>
            <h1 className="font-serif text-2xl">{info?.test ? "This is a test" : "Unsubscribe?"}</h1>
            {info?.test ? (
              <p className="text-sm text-black/60">This is how the unsubscribe page looks to a reader. In a real newsletter this link is private to each person.</p>
            ) : (
              <>
                <p className="text-sm text-black/60">
                  Stop emails from {agent} to <strong>{info?.email}</strong>?
                </p>
                <button type="button" onClick={confirm} disabled={busy} className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-3 disabled:opacity-60">
                  {busy ? "One moment…" : "Yes, unsubscribe me"}
                </button>
              </>
            )}
          </>
        )}
        {state === "done" && (
          <>
            <h1 className="font-serif text-2xl">You're unsubscribed</h1>
            <p className="text-sm text-black/60">You won't get newsletters from {agent} anymore. It can take a few minutes for an email already on its way to stop.</p>
          </>
        )}
      </div>
    </main>
  );
}

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

async function call(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/deal-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}

// A coordinator's "send the agent where this deal stands" button. Opens a preview of the email (built from the deal's tasks, documents,
// signatures and dates), an optional personal note, and sends it from the server with the coordinator as the reply-to.
export default function SendAgentUpdate({ person, agentName, onSent }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const show = async (n = note) => {
    setBusy(true);
    setError("");
    try {
      setPreview(await call({ personId: person.id, action: "agent_update", preview: true, note: n }));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const openIt = () => {
    setOpen(true);
    setDone("");
    setNote("");
    setPreview(null);
    show("");
  };
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await call({ personId: person.id, action: "agent_update", note });
      setDone(`Sent to ${r.to}.`);
      setOpen(false);
      onSent?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={openIt} className="rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
          Send {agentName ? agentName.split(" ")[0] : "the agent"} an update
        </button>
        {done && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{done}</span>}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div role="dialog" aria-label="Send an update to the agent" className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white dark:bg-[#1c1c1c] shadow-2xl">
            <div className="border-b border-black/5 dark:border-white/10 px-5 py-4">
              <h3 className="font-display text-lg font-semibold">Update for {agentName || "the agent"}</h3>
              <p className={`mt-0.5 text-xs ${muted}`}>{preview ? `To ${preview.to || "no email on file"} · replies come to you` : "Building the update…"}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {preview && (
                <div>
                  <p className="text-sm font-semibold">{preview.subject}</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3 font-sans text-[13px] leading-relaxed">{preview.text}</pre>
                </div>
              )}
              <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                Add a note (optional)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => show()} rows={3} placeholder="Anything you want them to know…" className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40" />
              </label>
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-black/5 dark:border-white/10 px-5 py-3">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">Cancel</button>
              <button type="button" disabled={busy || !preview?.to} onClick={send} className="rounded-full bg-[#1c1a17] dark:bg-[#faf9f7] px-5 py-2 text-sm font-semibold text-white dark:text-[#1c1a17] disabled:opacity-50">{busy ? "Working…" : "Send update"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

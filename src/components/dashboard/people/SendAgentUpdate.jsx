import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const pill = "text-[#1c1a17] dark:text-[#faf9f7] rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

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

// A coordinator's "update the agent on where this deal stands". The main way is a private link to copy and send however they like (/update/<token>,
// see src/pages/AgentUpdatePage.jsx): key dates, tasks, documents and signatures, always as of the moment the agent opens it. The email version (built
// from the same facts, sent from the server with the coordinator as the reply-to) is still here, one click down.
export default function SendAgentUpdate({ person, agentName, onSent }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState([]);
  const [fresh, setFresh] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const first = agentName ? agentName.split(" ")[0] : "the agent";

  const loadLinks = useCallback(async () => {
    const { data } = await supabase
      .from("deal_update_links")
      .select("id, token_hint, created_at, view_count, last_viewed_at")
      .eq("person_id", person.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLinks(data || []);
  }, [person.id]);
  useEffect(() => {
    if (open) loadLinks();
  }, [open, loadLinks]);

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is shown below to copy by hand */
    }
  };
  const makeLink = async () => {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_deal_update_link", { p_person_id: person.id, p_message: note });
    setBusy(false);
    if (err) return setError(err.message);
    const url = `${window.location.origin}/update/${data}`;
    setFresh(url);
    copy(url);
    loadLinks();
    onSent?.();
  };
  const revoke = async (l) => {
    if (!confirm("Turn this link off? Anyone who has it will see an expired page.")) return;
    await supabase.rpc("revoke_deal_update_link", { p_id: l.id });
    setFresh("");
    loadLinks();
  };

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
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await call({ personId: person.id, action: "agent_update", note });
      setDone(`Emailed to ${r.to}.`);
      setOpen(false);
      onSent?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const openIt = () => {
    setOpen(true);
    setDone("");
    setNote("");
    setFresh("");
    setEmailing(false);
    setPreview(null);
    setError("");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={openIt} className="rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
          Update {first}
        </button>
        {done && <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">{done}</span>}
      </div>
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
          <div role="dialog" aria-label="Update the agent" className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white dark:bg-[#1c1c1c] text-[#1c1a17] dark:text-[#faf9f7] shadow-2xl">
            <div className="border-b border-black/5 dark:border-white/10 px-5 py-4">
              <h3 className="font-display text-lg font-semibold">Update for {agentName || "the agent"}</h3>
              <p className={`mt-0.5 text-xs ${muted}`}>A private page with the key dates, tasks, documents and signatures. It's always current when they open it.</p>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                Add a note (optional)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={600} placeholder="Anything you want them to see at the top…" className="mt-1 w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40" />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={makeLink} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy && !emailing ? "Making…" : fresh ? "Make another link" : "Copy update link"}
                </button>
                {fresh && (
                  <>
                    <button type="button" onClick={() => copy(fresh)} className={pill}>{copied ? "Copied ✓" : "Copy again"}</button>
                    <a href={fresh} target="_blank" rel="noreferrer" className={pill}>Preview</a>
                  </>
                )}
              </div>
              {fresh && <p className="text-xs break-all font-mono select-all">{fresh}</p>}
              {links.length > 0 && (
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {links.map((l) => (
                    <li key={l.id} className={`py-2 flex items-center justify-between gap-3 text-xs ${muted}`}>
                      <span>
                        Link …{l.token_hint} · made {new Date(l.created_at).toLocaleDateString()} · opened {l.view_count} time{l.view_count === 1 ? "" : "s"}
                      </span>
                      <button type="button" onClick={() => revoke(l)} className="shrink-0 font-semibold text-red-600 dark:text-red-400 hover:underline">
                        Turn off
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-black/5 dark:border-white/10 pt-3">
                {!emailing ? (
                  <button type="button" onClick={() => { setEmailing(true); show(); }} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                    Or email it from here instead
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className={`text-xs ${muted}`}>{preview ? `To ${preview.to || "no email on file"} · replies come to you` : "Building the email…"}</p>
                    {preview && (
                      <div>
                        <p className="text-sm font-semibold">{preview.subject}</p>
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3 font-sans text-[13px] leading-relaxed">{preview.text}</pre>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={busy} onClick={() => show()} className={pill}>Refresh with my note</button>
                      <button type="button" disabled={busy || !preview?.to} onClick={send} className="rounded-full bg-[#1c1a17] dark:bg-[#faf9f7] px-5 py-2 text-sm font-semibold text-white dark:text-[#1c1a17] disabled:opacity-50">{busy ? "Working…" : "Send email"}</button>
                    </div>
                  </div>
                )}
              </div>
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
            <div className="flex justify-end border-t border-black/5 dark:border-white/10 px-5 py-3">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-full px-4 py-2 text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">Close</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

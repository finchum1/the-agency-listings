import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COMPLIANCE_TONES, complianceInfo } from "../../../lib/deals";
import { refreshDealAttention } from "../../../hooks/useDealAttention";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 disabled:opacity-60";
const ghostBtn = "rounded-full border border-black/15 dark:border-white/20 text-sm font-semibold px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-60";

const KIND_LABEL = { submitted: "Submitted for review", approved: "Approved", changes: "Sent back" };
const stamp = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function ComplianceChip({ status, className = "" }) {
  const info = complianceInfo(status);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${COMPLIANCE_TONES[info.tone]} ${className}`}>{info.label}</span>;
}

// A deal's compliance status and its conversation. Same component for the agent, their coordinator and compliance:
//   viewer "owner" | "tc": submit (or resubmit) for review, and talk.
//   viewer "compliance":   approve, or send back with a message (flagged documents are listed automatically), and talk.
// `person` is the deal row; `onChanged` refreshes it in the parent after a status change.
export default function DealCompliance({ person, viewer, onChanged }) {
  const [messages, setMessages] = useState([]);
  const [names, setNames] = useState({});
  const [text, setText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endRef = useRef(null);
  const status = person.compliance_status || "none";
  const reviewer = viewer === "compliance";

  const load = useCallback(async () => {
    const { data } = await supabase.from("deal_messages").select("id, author_id, kind, body, created_at").eq("person_id", person.id).order("created_at");
    const rows = data || [];
    setMessages(rows);
    const missing = [...new Set(rows.map((m) => m.author_id).filter(Boolean))];
    if (missing.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", missing);
      setNames(Object.fromEntries((profs || []).map((p) => [p.id, p.full_name])));
    }
    return rows;
  }, [person.id]);

  // Opening the deal reads its thread; a new message while it is open is read as it arrives.
  const markRead = useCallback(async () => {
    await supabase.rpc("deal_mark_read", { p_person: person.id });
    refreshDealAttention();
  }, [person.id]);
  useEffect(() => {
    load().then(markRead);
    const timer = setInterval(() => load().then(markRead), 20000);
    return () => clearInterval(timer);
  }, [load, markRead]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const run = async (fn, clearNote = false) => {
    setBusy(true);
    setError("");
    setNotice("");
    const { error: err } = await fn();
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    if (clearNote) setReviewNote("");
    await load();
    await markRead();
    onChanged?.();
    return true;
  };

  // Sending a deal back also emails the agent (and their coordinator). The send-back itself has already been saved by then, so a
  // failed email only means a note here: they still see it in Deals.
  const emailSubmitted = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/deal-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ personId: person.id, action: "submitted" }),
      });
      const json = await res.json().catch(() => ({}));
      setNotice(res.ok ? (json.sent ? "Submitted. Compliance was emailed." : "Submitted.") : `Submitted, but the email didn't go out: ${json.error || "unknown error"}`);
    } catch {
      setNotice("Submitted, but the email didn't go out. Compliance will still see it in Deals.");
    }
  };

  const emailSentBack = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/deal-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ personId: person.id }),
      });
      const json = await res.json().catch(() => ({}));
      setNotice(res.ok ? (json.sent ? "Sent back. The agent was emailed." : "Sent back.") : `Sent back, but the email didn't go out: ${json.error || "unknown error"}`);
    } catch {
      setNotice("Sent back, but the email didn't go out. They'll still see it in Deals.");
    }
  };

  const submit = async () => {
    const ok = await run(() => supabase.rpc("deal_submit_review", { p_person: person.id, p_note: reviewNote }), true);
    if (ok) await emailSubmitted();
  };
  const decide = async (decision) => {
    const ok = await run(() => supabase.rpc("deal_review", { p_person: person.id, p_decision: decision, p_message: reviewNote }), true);
    if (ok && decision === "needs_changes") await emailSentBack();
  };
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await run(() => supabase.from("deal_messages").insert({ person_id: person.id, body: text.trim() }));
    setText("");
  };

  return (
    <section className="min-w-0 space-y-3" aria-label="Compliance review">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold">Compliance</h3>
        <ComplianceChip status={status} />
      </div>

      {status === "needs_changes" && !reviewer && (
        <p className="rounded-xl bg-red-50 dark:bg-red-400/10 px-3.5 py-2.5 text-sm text-red-800 dark:text-red-300">
          Compliance sent this deal back. Read the note below, fix what they flagged, then resubmit.
        </p>
      )}
      {status === "approved" && <p className={`text-sm ${muted}`}>Approved{person.compliance_updated_at ? ` on ${stamp(person.compliance_updated_at)}` : ""}.</p>}

      {reviewer ? (
        <div className="space-y-2">
          <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} placeholder="Message to the agent (optional when you flagged documents)" aria-label="Review message" className={inputClass} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={() => decide("approved")} className={primaryBtn}>Approve deal</button>
            <button type="button" disabled={busy} onClick={() => decide("needs_changes")} className={ghostBtn}>Send back</button>
          </div>
          <p className={`text-xs ${muted}`}>Documents you flag are listed in the message automatically.</p>
        </div>
      ) : (
        (status === "none" || status === "needs_changes" || status === "approved") && (
          <div className="space-y-2">
            <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} placeholder="Note for compliance (optional)" aria-label="Note for compliance" className={inputClass} />
            <button type="button" disabled={busy} onClick={submit} className={status === "approved" ? ghostBtn : primaryBtn}>
              {status === "needs_changes" ? "Resubmit for review" : status === "approved" ? "Submit again" : "Submit for compliance review"}
            </button>
          </div>
        )
      )}
      {!reviewer && status === "submitted" && <p className={`text-sm ${muted}`}>Waiting on compliance. You can keep adding documents; message them below if something changes.</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}

      <div className="rounded-2xl border border-black/10 dark:border-white/10">
        <ul className="max-h-72 space-y-3 overflow-y-auto p-3" aria-label="Messages">
          {messages.length === 0 && <li className={`text-sm ${muted}`}>No messages yet.</li>}
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <div className={`flex items-center gap-2 text-[11px] ${muted}`}>
                <span className="font-semibold text-[#1c1a17]/80 dark:text-[#faf9f7]/80">{names[m.author_id] || "Someone"}</span>
                <span>{stamp(m.created_at)}</span>
                {m.kind !== "message" && <span className={`rounded-full px-2 py-px font-semibold ${COMPLIANCE_TONES[m.kind === "approved" ? "green" : m.kind === "changes" ? "red" : "amber"]}`}>{KIND_LABEL[m.kind]}</span>}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
          <li ref={endRef} aria-hidden="true" />
        </ul>
        <form onSubmit={send} className="flex items-center gap-2 border-t border-black/10 dark:border-white/10 p-2.5">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message about this deal" aria-label="Message about this deal" className={`${inputClass} !py-2`} />
          <button type="submit" disabled={busy || !text.trim()} className={`${ghostBtn} shrink-0`}>Send</button>
        </form>
      </div>
    </section>
  );
}

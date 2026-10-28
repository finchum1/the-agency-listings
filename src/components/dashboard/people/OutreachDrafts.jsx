import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { announceDealWork } from "../../../lib/dealEvents";

const btn = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const CHANNEL = { email: "Email", text: "Text message", call: "Call" };

const digits = (p) => String(p || "").replace(/[^\d+]/g, "");

/** The link that opens the message ready to send in the device's own app. A call has no message to send: just the number. */
export function openHref(draft, person) {
  if (draft.channel === "email") return `mailto:${person.email}?subject=${encodeURIComponent(draft.subject || "")}&body=${encodeURIComponent(draft.body)}`;
  if (draft.channel === "text") return `sms:${digits(person.phone)}?&body=${encodeURIComponent(draft.body)}`;
  return `tel:${digits(person.phone)}`;
}

const openLabel = (c) => (c === "email" ? "Open in Mail" : c === "text" ? "Open in Messages" : "Call");

// Messages a bot drafted for this person. Nothing was sent: the agent opens each one in their own email or messages app, sends it
// there, and then marks it sent here, which also leaves a note on the card. A draft can be discarded instead.
export default function OutreachDrafts({ person, onLogged, onCount }) {
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("people_outreach").select("*").eq("person_id", person.id).eq("status", "draft").order("created_at", { ascending: true });
    setDrafts(data || []);
    onCount?.((data || []).length);
  }, [person.id, onCount]);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (d, status) => {
    setBusy(d.id);
    await supabase.from("people_outreach").update({ status, resolved_at: new Date().toISOString() }).eq("id", d.id);
    announceDealWork();
    if (status === "sent") {
      const what = d.channel === "email" ? `Emailed: ${d.subject || d.body.slice(0, 80)}` : d.channel === "text" ? `Texted: ${d.body.slice(0, 120)}` : "Called";
      await supabase.from("people_notes").insert({ person_id: person.id, body: what });
      onLogged?.();
    }
    setBusy("");
    load();
  };

  const copy = async (d) => {
    try {
      await navigator.clipboard.writeText(d.channel === "email" && d.subject ? `${d.subject}\n\n${d.body}` : d.body);
      setCopied(d.id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      /* clipboard blocked: the text is on screen to copy by hand */
    }
  };

  if (drafts.length === 0) return null;
  return (
    <div className="space-y-2.5 rounded-2xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] p-3.5">
      <h3 className="font-display text-base font-semibold">Drafts waiting for you</h3>
      <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">Written by your bot. Nothing has been sent. Open one, send it from your own app, then mark it sent.</p>
      <ul className="space-y-2.5">
        {drafts.map((d) => (
          <li key={d.id} className="rounded-xl bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/10 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              {d.channel === "call" ? "Call · talking points" : CHANNEL[d.channel]}
              {d.drafted_by ? ` · from ${d.drafted_by}` : ""}
            </p>
            {d.subject && <p className="mt-1 text-sm font-semibold">{d.subject}</p>}
            <p className="mt-1 text-sm whitespace-pre-wrap">{d.body}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href={openHref(d, person)} className={`${btn} bg-[#1c1a17] text-white border-[#1c1a17] hover:bg-[#1c1a17]/90 dark:bg-[#f2454b] dark:border-[#f2454b]`}>
                {openLabel(d.channel)}
              </a>
              <button type="button" onClick={() => copy(d)} className={btn}>
                {copied === d.id ? "Copied ✓" : "Copy"}
              </button>
              <button type="button" disabled={busy === d.id} onClick={() => resolve(d, "sent")} className={btn}>
                Mark sent
              </button>
              <button type="button" disabled={busy === d.id} onClick={() => resolve(d, "discarded")} className={`${btn} text-red-600 dark:text-red-400`}>
                Discard
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

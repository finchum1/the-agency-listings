import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const STATUS = {
  sending: ["Sending…", "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"],
  pending: ["Out for signature", "bg-amber-100 dark:bg-amber-400/15 text-amber-900 dark:text-amber-300"],
  completed: ["Signed", "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300"],
  rejected: ["Declined", "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300"],
  cancelled: ["Cancelled", "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"],
  failed: ["Didn't send", "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300"],
};

async function api(method, action, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(method === "GET" ? `/api/deal-signatures?action=${action}` : "/api/deal-signatures", {
    method,
    headers: { Authorization: `Bearer ${session?.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify({ action, ...body }) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}

// Sending a document for signature: pick the Documenso template, check who signs (the people on the deal are filled in), send.
function SendModal({ person, agent, onClose, onSent }) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState(null);
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [signers, setSigners] = useState([]);
  const [docs, setDocs] = useState([]);
  const [docId, setDocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("GET", "templates").then((r) => setTemplates(r.templates)).catch((e) => setError(e.message));
    supabase.from("transaction_documents").select("id, text, done").eq("person_id", person.id).order("position").then(({ data }) => setDocs((data || []).filter((d) => !d.done)));
  }, [person.id]);

  const pick = (id) => {
    setTemplateId(id);
    const t = templates?.find((x) => String(x.id) === String(id));
    if (!t) return setSigners([]);
    setTitle(`${t.title}${person.property_address ? ` · ${person.property_address}` : ""}`.slice(0, 200));
    let usedClient = false;
    setSigners(
      t.slots.map((s) => {
        const label = `${s.name} ${s.role}`.toLowerCase();
        if (/agent|broker|realtor|listing/.test(label) && agent?.email) return { id: s.id, slot: s.name || s.role, name: agent.name || "", email: agent.email || "" };
        if (/coordinator|tc\b/.test(label) && profile?.email) return { id: s.id, slot: s.name || s.role, name: profile.full_name || "", email: profile.email || "" };
        if (!usedClient) {
          usedClient = true;
          return { id: s.id, slot: s.name || s.role, name: person.name || "", email: person.email || "" };
        }
        return { id: s.id, slot: s.name || s.role, name: s.name && !/recipient|signer|\d/i.test(s.name) ? "" : "", email: "" };
      }),
    );
  };

  const setSigner = (i, k) => (e) => setSigners((list) => list.map((s, j) => (j === i ? { ...s, [k]: e.target.value } : s)));
  const ready = templateId && title.trim() && signers.length > 0 && signers.every((s) => s.name.trim() && s.email.trim());

  const send = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("POST", "send", { personId: person.id, templateId: Number(templateId), title, signers: signers.map(({ id, name, email }) => ({ id, name, email })), checklistDocId: docId || undefined });
      onSent();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form onSubmit={send} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl space-y-4" role="dialog" aria-label="Send for signature">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Send for signature</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5" htmlFor="sig-template">Which form?</label>
          <select id="sig-template" value={templateId} onChange={(e) => pick(e.target.value)} className={inputClass} disabled={!templates}>
            <option value="">{templates ? (templates.length ? "Choose a template…" : "No templates yet") : "Loading…"}</option>
            {(templates || []).map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          {templates && templates.length === 0 && <p className={`mt-1 text-xs ${muted}`}>Make a template in Documenso (upload the form, place the signature boxes, save it as a template) and it shows up here.</p>}
        </div>

        {signers.length > 0 && (
          <>
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5" htmlFor="sig-title">Document name</label>
              <input id="sig-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>
            <fieldset className="space-y-3">
              <legend className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5">Who signs?</legend>
              {signers.map((s, i) => (
                <div key={s.id} className="rounded-xl border border-black/10 dark:border-white/15 p-3 space-y-2">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{s.slot}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input value={s.name} onChange={setSigner(i, "name")} placeholder="Name" aria-label={`${s.slot} name`} className={inputClass} />
                    <input type="email" value={s.email} onChange={setSigner(i, "email")} placeholder="Email" aria-label={`${s.slot} email`} className={inputClass} />
                  </div>
                </div>
              ))}
            </fieldset>
            {docs.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5" htmlFor="sig-doc">Tick off this document when it's signed (optional)</label>
                <select id="sig-doc" value={docId} onChange={(e) => setDocId(e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>{d.text}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button type="submit" disabled={!ready || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {busy ? "Sending…" : "Send for signature"}
        </button>
        <p className={`text-xs ${muted}`}>Documenso emails each person a link to sign. You'll see who has signed here, and the signed copy appears when everyone is done.</p>
      </form>
    </div>
  );
}

// A deal's signature requests (Documenso): what was sent, who has signed, a reminder button, and the signed copy once everyone is done.
// viewer "owner" and "tc" can send and remind; "compliance" can read the list and open signed copies.
export default function DealSignatures({ person, viewer = "owner", agent }) {
  const [rows, setRows] = useState([]);
  const [configured, setConfigured] = useState(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const canSend = viewer !== "compliance";

  const load = useCallback(async () => {
    const { data } = await supabase.from("deal_signatures").select("*").eq("person_id", person.id).order("created_at", { ascending: false });
    setRows(data || []);
  }, [person.id]);

  useEffect(() => {
    load();
    if (canSend) api("GET", "status").then((r) => setConfigured(r.configured)).catch(() => setConfigured(false));
  }, [load, canSend]);
  // While something is out for signature, look again every 20 seconds so a signature shows up without reloading.
  const waiting = rows.some((r) => r.status === "pending" || r.status === "sending");
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [waiting, load]);

  const act = async (row, action, ok) => {
    setBusyId(row.id);
    setNote("");
    try {
      const r = await api("POST", action, { id: row.id });
      if (action === "download") window.open(r.url, "_blank", "noopener");
      else setNote(ok(r));
      await load();
    } catch (e) {
      setNote(e.message);
    }
    setBusyId(null);
  };

  if (!canSend && rows.length === 0) return null;
  return (
    <section className="min-w-0 rounded-2xl border border-black/10 dark:border-white/10 p-5 space-y-3" aria-label="Signatures">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Signatures</h3>
          <p className={`text-xs ${muted}`}>{rows.length ? `${rows.filter((r) => r.status === "completed").length} of ${rows.length} signed` : "Documents sent for e-signature"}</p>
        </div>
        {canSend && (
          <button type="button" onClick={() => setSending(true)} disabled={configured === false} title={configured === false ? "Documenso isn't connected yet" : undefined} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2 disabled:opacity-50">
            Send for signature
          </button>
        )}
      </div>
      {canSend && configured === false && <p className={`text-sm ${muted}`}>Documenso isn't connected yet. An admin needs to add the Documenso key before documents can be sent.</p>}
      {note && <p role="status" className="text-sm text-amber-700 dark:text-amber-400">{note}</p>}

      {rows.length === 0 ? (
        configured !== false && <p className={`text-sm ${muted}`}>Nothing sent for signature yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const [label, tone] = STATUS[r.status] || STATUS.pending;
            return (
              <li key={r.id} className="rounded-xl border border-black/10 dark:border-white/15 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{r.title}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
                </div>
                {(r.recipients || []).length > 0 && (
                  <p className={`mt-1 text-xs ${muted}`}>
                    {r.recipients.filter((x) => x.role !== "CC").map((x) => `${x.name || x.email} ${x.signing_status === "SIGNED" ? "✓ signed" : x.signing_status === "REJECTED" ? "declined" : "waiting"}`).join(" · ")}
                  </p>
                )}
                {r.status === "failed" && r.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{r.error}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <span className={`text-[11px] ${muted}`}>{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  {r.status === "completed" && (
                    <button type="button" disabled={busyId === r.id} onClick={() => act(r, "download")} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline disabled:opacity-60">
                      Open signed copy
                    </button>
                  )}
                  {canSend && r.status === "pending" && (
                    <>
                      <button type="button" disabled={busyId === r.id} onClick={() => act(r, "remind", (x) => `Reminder sent to ${x.reminded} ${x.reminded === 1 ? "person" : "people"}.`)} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline disabled:opacity-60">
                        Send a reminder
                      </button>
                      <button type="button" disabled={busyId === r.id} onClick={() => act(r, "refresh", () => "Checked with Documenso.")} className={`text-xs font-medium hover:underline disabled:opacity-60 ${muted}`}>
                        Check status
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sending && (
        <SendModal
          person={person}
          agent={agent}
          onClose={() => setSending(false)}
          onSent={() => {
            setSending(false);
            setNote("Sent. Documenso is emailing everyone a link to sign.");
            load();
          }}
        />
      )}
    </section>
  );
}

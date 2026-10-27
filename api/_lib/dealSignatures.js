// Brings a deal_signatures row up to date with what Documenso says about its envelope, and does the follow-up when it completes: keeps
// the signed copy, ticks the checklist document it was for, tells the deal's thread and emails the agent (and their coordinators) once.
import { downloadSigned, getEnvelope, slimRecipient, statusOf } from "./documenso.js";
import { fromAs, sendNotification } from "./inquiry.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function refreshSignature(admin, row) {
  if (!row.envelope_id) return row;
  const env = await getEnvelope(row.envelope_id);
  const status = statusOf(env.status);
  const recipients = (env.recipients || []).map(slimRecipient);
  const completed = status === "completed";
  const changes = { status, recipients, updated_at: new Date().toISOString(), completed_at: completed ? row.completed_at || env.completedAt || new Date().toISOString() : row.completed_at, error: null };

  if (completed && !row.signed_path) {
    const itemId = env.envelopeItems?.[0]?.id;
    if (itemId) {
      const pdf = await downloadSigned(itemId);
      const path = `deals/${row.person_id}/${row.id}.pdf`;
      const { error } = await admin.storage.from("deal-documents").upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (!error) changes.signed_path = path;
    }
  }
  const { data: saved } = await admin.from("deal_signatures").update(changes).eq("id", row.id).select("*").single();
  const next = saved || { ...row, ...changes };
  if (completed) await onCompleted(admin, next);
  return next;
}

// Once per signature request, however many times Documenso (or a refresh) reports it finished.
async function onCompleted(admin, row) {
  const { data: claimed } = await admin.from("deal_signatures").update({ notified_at: new Date().toISOString() }).eq("id", row.id).is("notified_at", null).select("id");
  if (!claimed?.length) return;
  if (row.checklist_doc_id) await admin.from("transaction_documents").update({ done: true, done_at: new Date().toISOString() }).eq("id", row.checklist_doc_id).eq("person_id", row.person_id);
  await admin.from("deal_messages").insert({ person_id: row.person_id, author_id: null, kind: "message", body: `Signed by everyone: “${row.title}”. The signed copy is on the deal.` });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const { data: deal } = await admin.from("people").select("id, owner_id, name, property_address").eq("id", row.person_id).maybeSingle();
  if (!deal) return;
  const [{ data: owner }, { data: team }, { data: perDeal }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", deal.owner_id).maybeSingle(),
    admin.from("deal_team").select("tc:profiles!deal_team_tc_id_fkey(email)").eq("agent_id", deal.owner_id),
    admin.from("deal_tcs").select("tc:profiles!deal_tcs_tc_id_fkey(email)").eq("person_id", deal.id),
  ]);
  const to = [...new Set([owner?.email, ...(team || []).map((t) => t.tc?.email), ...(perDeal || []).map((t) => t.tc?.email)].filter(Boolean).map((e) => e.toLowerCase()))];
  if (!to.length) return;
  const where = deal.property_address || deal.name;
  const url = `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}`;
  const subject = `Signed: ${row.title} (${where})`;
  const text = `Everyone has signed “${row.title}” for ${where}.\n\nThe signed copy is on the deal: ${url}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="max-width:600px;width:100%"><tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Signed by everyone</div><div style="margin-top:6px;font:600 24px Georgia,serif;color:#1c1a17">${esc(row.title)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(where)}</div></td></tr><tr><td style="padding:12px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the deal</a></td></tr></table></td></tr></table></body></html>`;
  await sendNotification(apiKey, { from: fromAs("Deals"), to, subject, text, html });
}

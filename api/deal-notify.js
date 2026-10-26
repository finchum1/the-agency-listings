// POST /api/deal-notify {personId}: compliance just sent a deal back (the deal_review function wrote the message); this emails the
// agent and any coordinator assigned to them. Safe to call twice: each send-back message is claimed (emailed_at) before sending.
// Only the person who wrote the send-back can trigger it, and the email text comes from the stored message, never from the request.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { sendNotification } from "./_lib/inquiry.js";
import { buildSentBackEmail } from "./_lib/dealEmail.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const personId = String(req.body?.personId || "");
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  // Read as the caller: they must be able to see this deal, and the newest unsent send-back must be theirs.
  const { data: deal } = await auth.supabase.from("people").select("id, owner_id, name, property_address, compliance_status").eq("id", personId).eq("stage_group", "transaction").maybeSingle();
  if (!deal) return res.status(404).json({ error: "Deal not found." });
  const { data: msg } = await auth.supabase
    .from("deal_messages")
    .select("id, author_id, body")
    .eq("person_id", personId)
    .eq("kind", "changes")
    .is("emailed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!msg || msg.author_id !== auth.user.id) return res.status(200).json({ ok: true, sent: 0, note: "Nothing to send." });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(502).json({ error: "Email isn't set up, so the agent wasn't emailed. They'll still see it in Deals." });

  // Claim it first so a double click can't send twice.
  const { data: claimed } = await admin.from("deal_messages").update({ emailed_at: new Date().toISOString() }).eq("id", msg.id).is("emailed_at", null).select("id");
  if (!claimed?.length) return res.status(200).json({ ok: true, sent: 0, note: "Already emailed." });

  const [{ data: owner }, { data: team }, { data: reviewer }] = await Promise.all([
    admin.from("profiles").select("full_name, email, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
    admin.from("deal_team").select("tc:profiles!deal_team_tc_id_fkey(email)").eq("agent_id", deal.owner_id),
    admin.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle(),
  ]);
  const to = [...new Set([owner?.email, ...(team || []).map((t) => t.tc?.email)].filter(Boolean).map((e) => e.toLowerCase()))];
  if (!to.length) {
    await admin.from("deal_messages").update({ emailed_at: null }).eq("id", msg.id);
    return res.status(502).json({ error: "The agent has no email address on file." });
  }
  const mail = buildSentBackEmail({
    deal,
    reviewerName: reviewer?.full_name || "",
    message: msg.body,
    orgName: owner?.org?.name,
    url: `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}`,
  });
  const ok = await sendNotification(apiKey, {
    from: process.env.LEAD_FROM_EMAIL || "Deals <onboarding@resend.dev>",
    to,
    replyTo: reviewer?.email || undefined,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  if (!ok) {
    await admin.from("deal_messages").update({ emailed_at: null }).eq("id", msg.id);
    return res.status(502).json({ error: "The email service refused it. The agent will still see it in Deals." });
  }
  return res.status(200).json({ ok: true, sent: to.length });
}

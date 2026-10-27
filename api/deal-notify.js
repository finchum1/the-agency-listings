// POST /api/deal-notify {personId, action: "agent_update", note?, preview?}: a coordinator on this deal sends the agent a status update (where it stands,
// what's overdue or coming up, what's missing). With preview: true nothing is sent; the text is returned so it can be read first.
//
// POST /api/deal-notify {personId, action: "deal_started"}: a coordinator just started this deal for an agent (deal_start_for_agent); emails the agent
// (once: deal_tcs.agent_emailed_at). Only the coordinator who started it can trigger it.
//
// POST /api/deal-notify {personId, action: "submitted"}: the agent (or their coordinator) just submitted or resubmitted a deal; emails the office's
// compliance reviewers (once per submission: deal_messages.emailed_at). Only whoever submitted it can trigger it.
//
// POST /api/deal-notify {personId, action: "tc_assigned", tcId}: the agent just picked a coordinator on their deal; emails that coordinator
// (once per pick: deal_tcs.emailed_at). Only the deal's own agent can trigger it.
//
// POST /api/deal-notify {personId}: compliance just sent a deal back (the deal_review function wrote the message); this emails the
// agent and any coordinator assigned to them. Safe to call twice: each send-back message is claimed (emailed_at) before sending.
// Only the person who wrote the send-back can trigger it, and the email text comes from the stored message, never from the request.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { sendNotification } from "./_lib/inquiry.js";
import { buildAgentUpdate, gatherDeal } from "./_lib/dealUpdate.js";
import { buildDealStartedEmail, buildSentBackEmail, buildSubmittedEmail, buildTcAssignedEmail } from "./_lib/dealEmail.js";
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
  const { data: deal } = await auth.supabase.from("people").select("id, owner_id, name, property_address, side, contract_date, closing_date, compliance_status").eq("id", personId).eq("stage_group", "transaction").maybeSingle();
  if (!deal) return res.status(404).json({ error: "Deal not found." });

  if (req.body?.action === "agent_update") {
    const access = (await auth.supabase.rpc("deal_person_access", { p_person: personId })).data;
    if (access !== "tc") return res.status(403).json({ error: "Only a transaction coordinator on this deal can send the agent an update." });
    const data = await gatherDeal(admin, personId);
    if (!data) return res.status(404).json({ error: "Deal not found." });
    const { data: me } = await admin.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle();
    const note = String(req.body?.note || "").trim().slice(0, 2000);
    const mail = buildAgentUpdate(data, { note, fromName: me?.full_name || "" });
    if (req.body?.preview) return res.status(200).json({ ok: true, to: data.owner?.email || "", subject: mail.subject, text: mail.text });
    const keyMail = process.env.RESEND_API_KEY;
    if (!keyMail) return res.status(502).json({ error: "Email isn't set up, so the update wasn't sent." });
    if (!data.owner?.email) return res.status(502).json({ error: "That agent has no email address on file." });
    const okU = await sendNotification(keyMail, { from: process.env.LEAD_FROM_EMAIL || "Deals <onboarding@resend.dev>", to: [data.owner.email], replyTo: me?.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
    if (!okU) return res.status(502).json({ error: "The email service refused it, so nothing was sent." });
    await admin.from("deal_update_log").insert({ person_id: personId, key: `manual-${new Date().toISOString()}`, kind: "manual", sent_by: auth.user.id });
    await admin.from("deal_messages").insert({ person_id: personId, author_id: auth.user.id, kind: "message", body: `Sent ${data.owner.full_name || "the agent"} an update.${note ? `\n\n${note}` : ""}` });
    return res.status(200).json({ ok: true, sent: 1, to: data.owner.email });
  }

  if (req.body?.action === "deal_started") {
    const key = process.env.RESEND_API_KEY;
    if (!key) return res.status(502).json({ error: "Email isn't set up, so the agent wasn't emailed. The deal is on their board." });
    const { data: mine } = await auth.supabase.from("deal_tcs").select("tc_id").eq("person_id", personId).eq("tc_id", auth.user.id).eq("started_by_tc", true).is("agent_emailed_at", null).maybeSingle();
    if (!mine) return res.status(200).json({ ok: true, sent: 0, note: "Nothing to send." });
    const { data: claimedD } = await admin.from("deal_tcs").update({ agent_emailed_at: new Date().toISOString() }).eq("person_id", personId).eq("tc_id", auth.user.id).is("agent_emailed_at", null).select("tc_id");
    if (!claimedD?.length) return res.status(200).json({ ok: true, sent: 0, note: "Already emailed." });
    const release = () => admin.from("deal_tcs").update({ agent_emailed_at: null }).eq("person_id", personId).eq("tc_id", auth.user.id);
    const [{ data: agent }, { data: tc }] = await Promise.all([
      admin.from("profiles").select("full_name, email, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
      admin.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle(),
    ]);
    if (!agent?.email) {
      await release();
      return res.status(502).json({ error: "That agent has no email address on file." });
    }
    const mail = buildDealStartedEmail({ deal, tcName: tc?.full_name || "", agentName: agent.full_name || "", orgName: agent.org?.name, url: `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}` });
    const okD = await sendNotification(key, { from: process.env.LEAD_FROM_EMAIL || "Deals <onboarding@resend.dev>", to: [agent.email], replyTo: tc?.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
    if (!okD) {
      await release();
      return res.status(502).json({ error: "The email service refused it. The deal is still on the agent's board." });
    }
    return res.status(200).json({ ok: true, sent: 1 });
  }

  if (req.body?.action === "submitted") {
    const apiKeyS = process.env.RESEND_API_KEY;
    if (!apiKeyS) return res.status(502).json({ error: "Email isn't set up, so compliance wasn't emailed. They'll still see it in Deals." });
    const { data: sub } = await auth.supabase
      .from("deal_messages")
      .select("id, author_id, body, created_at")
      .eq("person_id", personId)
      .eq("kind", "submitted")
      .is("emailed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || sub.author_id !== auth.user.id) return res.status(200).json({ ok: true, sent: 0, note: "Nothing to send." });
    const { data: claimedS } = await admin.from("deal_messages").update({ emailed_at: new Date().toISOString() }).eq("id", sub.id).is("emailed_at", null).select("id");
    if (!claimedS?.length) return res.status(200).json({ ok: true, sent: 0, note: "Already emailed." });
    const release = () => admin.from("deal_messages").update({ emailed_at: null }).eq("id", sub.id);
    const [{ data: agent }, { data: submitter }] = await Promise.all([
      admin.from("profiles").select("full_name, org_id, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
      admin.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle(),
    ]);
    const { data: reviewers } = agent?.org_id ? await admin.from("profiles").select("email").eq("org_id", agent.org_id).eq("deals_role", "compliance") : { data: [] };
    const to = [...new Set((reviewers || []).map((r) => r.email).filter(Boolean).map((e) => e.toLowerCase()))].filter((e) => e !== submitter?.email?.toLowerCase());
    if (!to.length) {
      await release();
      return res.status(200).json({ ok: true, sent: 0, note: "No compliance reviewer to email." });
    }
    const [{ count: tasks }, { count: tasksDone }, { count: docs }, { count: docsDone }, { count: earlier }] = await Promise.all([
      admin.from("transaction_tasks").select("id", { count: "exact", head: true }).eq("person_id", personId),
      admin.from("transaction_tasks").select("id", { count: "exact", head: true }).eq("person_id", personId).eq("done", true),
      admin.from("transaction_documents").select("id", { count: "exact", head: true }).eq("person_id", personId),
      admin.from("transaction_documents").select("id", { count: "exact", head: true }).eq("person_id", personId).eq("done", true),
      admin.from("deal_messages").select("id", { count: "exact", head: true }).eq("person_id", personId).eq("kind", "submitted").lt("created_at", sub.created_at),
    ]);
    const progress = [tasks ? `Tasks ${tasksDone || 0} of ${tasks} done` : "", docs ? `Documents ${docsDone || 0} of ${docs} collected` : ""].filter(Boolean).join(" · ");
    const note = sub.body && sub.body !== "Submitted for compliance review." ? sub.body : "";
    const mail = buildSubmittedEmail({
      deal,
      agentName: agent?.full_name || "",
      submitterName: submitter?.full_name || "",
      note,
      resubmitted: (earlier || 0) > 0,
      progress,
      orgName: agent?.org?.name,
      url: `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}`,
    });
    const okS = await sendNotification(apiKeyS, { from: process.env.LEAD_FROM_EMAIL || "Deals <onboarding@resend.dev>", to, replyTo: submitter?.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
    if (!okS) {
      await release();
      return res.status(502).json({ error: "The email service refused it. Compliance will still see it in Deals." });
    }
    return res.status(200).json({ ok: true, sent: to.length });
  }

  if (req.body?.action === "tc_assigned") {
    if (deal.owner_id !== auth.user.id) return res.status(403).json({ error: "Only the deal's agent can do that." });
    const apiKeyTc = process.env.RESEND_API_KEY;
    if (!apiKeyTc) return res.status(502).json({ error: "Email isn't set up, so the coordinator wasn't emailed. They'll still see the deal in Deals." });
    const tcId = String(req.body?.tcId || "");
    const { data: pick } = await auth.supabase.from("deal_tcs").select("tc_id").eq("person_id", personId).eq("tc_id", tcId).is("emailed_at", null).maybeSingle();
    if (!pick) return res.status(200).json({ ok: true, sent: 0, note: "Nothing to send." });
    const { data: claimedTc } = await admin.from("deal_tcs").update({ emailed_at: new Date().toISOString() }).eq("person_id", personId).eq("tc_id", tcId).is("emailed_at", null).select("tc_id");
    if (!claimedTc?.length) return res.status(200).json({ ok: true, sent: 0, note: "Already emailed." });
    const [{ data: tc }, { data: agent }] = await Promise.all([
      admin.from("profiles").select("full_name, email").eq("id", tcId).maybeSingle(),
      admin.from("profiles").select("full_name, email, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
    ]);
    const release = () => admin.from("deal_tcs").update({ emailed_at: null }).eq("person_id", personId).eq("tc_id", tcId);
    if (!tc?.email) {
      await release();
      return res.status(502).json({ error: "That coordinator has no email address on file." });
    }
    const mail = buildTcAssignedEmail({ deal, agentName: agent?.full_name || "", tcName: tc.full_name || "", orgName: agent?.org?.name, url: `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}` });
    const sentTc = await sendNotification(apiKeyTc, { from: process.env.LEAD_FROM_EMAIL || "Deals <onboarding@resend.dev>", to: [tc.email], replyTo: agent?.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
    if (!sentTc) {
      await release();
      return res.status(502).json({ error: "The email service refused it. The coordinator will still see the deal in Deals." });
    }
    return res.status(200).json({ ok: true, sent: 1 });
  }

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

  const [{ data: owner }, { data: team }, { data: perDeal }, { data: reviewer }] = await Promise.all([
    admin.from("profiles").select("full_name, email, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
    admin.from("deal_team").select("tc:profiles!deal_team_tc_id_fkey(email)").eq("agent_id", deal.owner_id),
    admin.from("deal_tcs").select("tc:profiles!deal_tcs_tc_id_fkey(email)").eq("person_id", deal.id),
    admin.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle(),
  ]);
  const to = [...new Set([owner?.email, ...(team || []).map((t) => t.tc?.email), ...(perDeal || []).map((t) => t.tc?.email)].filter(Boolean).map((e) => e.toLowerCase()))];
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

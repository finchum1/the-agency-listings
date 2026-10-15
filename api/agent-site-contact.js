// Vercel serverless function — handles an agent site's "Let's Connect"
// form. Mirrors api/contact.js exactly, keyed by agentSiteId instead of
// listingId: the client sends agentSiteId, this function looks up who to
// email SERVER-SIDE (agent_sites -> agent_id -> profiles.email), never
// trusting a client-supplied recipient address.
//
// Setup: same RESEND_API_KEY / LEAD_FROM_EMAIL env vars as api/contact.js
// (already configured if that one works), plus SUPABASE_SERVICE_ROLE_KEY
// (already configured — see api/admin/add-agent.js) used here only to
// store a durable copy of the submission in `leads` (see
// supabase/analytics.sql), best-effort, alongside the email.
//
// Beyond emailing the agent it also: drops bot submissions (honeypot +
// too-fast submit), rate-limits repeat senders, tells the agent when the
// sender is already in their People, and sends the visitor a short
// confirmation email. See api/_lib/inquiry.js.

import { createClient } from "@supabase/supabase-js";
import {
  checkRate,
  describePerson,
  findExistingPerson,
  leadAlertContext,
  parseInquiry,
  renderLeadEmailHtml,
  sendConfirmation,
  sendNotification,
} from "./_lib/inquiry.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { agentSiteId } = req.body || {};
  const parsed = parseInquiry(req.body);
  if (parsed.bot) return res.status(200).json({ ok: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  if (!agentSiteId) {
    return res.status(400).json({ error: "Name, email, and agentSiteId are required." });
  }
  const { name, email, phone, message } = parsed.data;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase env vars are not configured." });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: site, error: siteError } = await supabase
    .from("agent_sites")
    .select("agent_id, agent:profiles(full_name, email)")
    .eq("id", agentSiteId)
    .maybeSingle();

  if (siteError || !site || !site.agent?.email) {
    console.error("Agent site contact: lookup failed:", siteError);
    return res.status(404).json({ error: "Site not found." });
  }

  let confirmedRecently = false;
  let existingPerson = null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseAdmin = null;
  if (serviceKey) {
    supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const rate = await checkRate(supabaseAdmin, { targetId: agentSiteId, email, message });
    if (rate.duplicate) return res.status(200).json({ ok: true });
    if (rate.limited) {
      return res.status(429).json({ error: "Too many messages from this address. Please try again later." });
    }
    confirmedRecently = rate.confirmedRecently;

    // Looked up before the insert below, because the database trigger that
    // files the inquiry in People would otherwise make every sender look
    // like an existing contact.
    existingPerson = await findExistingPerson(supabaseAdmin, site.agent_id, email);

    const { error: leadError } = await supabaseAdmin.from("leads").insert({
      target_type: "agent_site",
      target_id: agentSiteId,
      agent_id: site.agent_id,
      name,
      email,
      phone,
      message,
    });
    if (leadError) console.error("Failed to store lead:", leadError);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Email delivery isn't configured yet (missing RESEND_API_KEY).",
    });
  }

  const fromEmail = process.env.LEAD_FROM_EMAIL || "Site Inquiries <onboarding@resend.dev>";

  try {
    const alert = await leadAlertContext(supabaseAdmin, site.agent_id, site.agent.email);
    const notice = existingPerson ? `Already in your People: ${describePerson(existingPerson)}` : "";
    const sent = await sendNotification(apiKey, {
      from: fromEmail,
      to: alert.to,
      replyTo: email,
      subject: `${existingPerson ? "Repeat website inquiry" : "New website inquiry"} from ${name}`,
      text: [
        ...(notice ? [notice, ""] : []),
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone || "—"}`,
        "",
        message || "(no message)",
        "",
        `Open in your dashboard: ${alert.dashboardUrl}`,
      ].join("\n"),
      html: renderLeadEmailHtml({
        heading: `${existingPerson ? "Repeat website inquiry" : "New website inquiry"} from ${name}`,
        agentName: site.agent.full_name,
        notice,
        fields: [["Name", name], ["Email", email], ["Phone", phone || "—"]],
        message,
        dashboardUrl: alert.dashboardUrl,
      }),
    });
    if (!sent) return res.status(502).json({ error: "Failed to send email." });

    if (!confirmedRecently) {
      await sendConfirmation(apiKey, {
        from: fromEmail,
        visitor: { name, email },
        agentName: site.agent.full_name,
        agentEmail: site.agent.email,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Agent site contact error:", err);
    return res.status(500).json({ error: "Unexpected error sending email." });
  }
}

// Vercel serverless function — handles two forms:
//   1. Every listing's "Send Inquiry" form (the original, `listingId`
//      required) — looks up who to email SERVER-SIDE (via the listing's
//      agent_id -> profiles.email). Deliberately does NOT trust a
//      client-supplied email address — that would let this endpoint be
//      used as an open mail relay to arbitrary addresses.
//   2. The Brokerage Site's Home Valuation form (`type: "valuation"`,
//      `address` required instead of listingId) — emails the brokerage's
//      own contact_email, since there's no specific agent to route to
//      (same reasoning as ContactCard.jsx's mailto/tel-only design, just
//      this one specific form DOES need a real submission handler).
//   Folded into one function, rather than a new api/home-valuation.js,
//   to stay under Vercel's Hobby-plan 12-Serverless-Functions cap (see
//   api/admin/agents.js's header for the earlier consolidation done for
//   the same reason).
//
// Setup (Vercel dashboard > Project > Settings > Environment Variables):
//   RESEND_API_KEY   — from resend.com (required)
//   LEAD_FROM_EMAIL  — optional, e.g. "Listing Inquiries <onboarding@resend.dev>"
//   SUPABASE_SERVICE_ROLE_KEY — already configured (see api/admin/add-agent.js);
//     used here only to store a durable copy of the submission in `leads`
//     (see supabase/analytics.sql, supabase/brokerage-valuation-leads.sql),
//     best-effort, so a Resend outage never loses the lead even if the
//     email fails.
// Both forms also get the same protection and follow-up as the agent-site
// form (see api/_lib/inquiry.js): bot submissions are dropped, repeat
// senders are rate-limited, the agent is told when the sender is already in
// their People, and the visitor gets a short confirmation email.
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are read too — same values
// already set for the client build; Vercel functions can read them
// regardless of the VITE_ prefix, which only affects client bundling.)

import { createClient } from "@supabase/supabase-js";
import { brokerageSiteQuery } from "../src/lib/brand.js";
import { bareHost, isAppHost } from "../src/lib/appHosts.js";
import {
  checkRate,
  describePerson,
  findExistingPerson,
  parseInquiry,
  sendConfirmation,
  sendNotification,
} from "./_lib/inquiry.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { listingId, type } = req.body || {};
  const isValuation = type === "valuation";

  const parsed = parseInquiry(req.body);
  if (parsed.bot) return res.status(200).json({ ok: true });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const { name, email, phone, message, address } = parsed.data;
  if (!isValuation && !listingId) {
    return res.status(400).json({ error: "listingId is required." });
  }
  if (isValuation && !address) {
    return res.status(400).json({ error: "A property address is required." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase env vars are not configured." });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  let recipientEmail, leadTargetType, leadTargetId, leadAgentId, subject, bodyLines, agentName, about;

  if (isValuation) {
    // Which brokerage is this form for? The one that owns the domain it was submitted from, or The Agency on the
    // app host. (With more than one brokerage in the database, "the" brokerage site is no longer a single row.)
    const host = bareHost(String(req.headers["x-forwarded-host"] || req.headers.host || ""));
    const { data: site, error: siteError } = await brokerageSiteQuery(supabase, {
      customDomain: host && !isAppHost(host) ? host : undefined,
    }).maybeSingle();
    if (siteError || !site?.contact_email) {
      console.error("Valuation form: brokerage site lookup failed:", siteError);
      return res.status(500).json({ error: "This form isn't fully set up yet — no brokerage contact email on file." });
    }
    recipientEmail = site.contact_email;
    leadTargetType = "brokerage_valuation";
    leadTargetId = site.id;
    leadAgentId = null;
    agentName = null;
    about = address;
    subject = `Home valuation request: ${address} — ${name}`;
    bodyLines = [`Property address: ${address}`, "", `Name: ${name}`, `Email: ${email}`, `Phone: ${phone || "—"}`, "", message || "(no additional message)"];
  } else {
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("address_line1, agent_id, agent:profiles(email, full_name)")
      .eq("id", listingId)
      .maybeSingle();
    if (listingError || !listing || !listing.agent?.email) {
      console.error("Contact form: listing/agent lookup failed:", listingError);
      return res.status(404).json({ error: "Listing not found." });
    }
    recipientEmail = listing.agent.email;
    leadTargetType = "listing";
    leadTargetId = listingId;
    leadAgentId = listing.agent_id;
    agentName = listing.agent.full_name;
    about = listing.address_line1;
    subject = `New inquiry: ${listing.address_line1} — ${name}`;
    bodyLines = [`Name: ${name}`, `Email: ${email}`, `Phone: ${phone || "—"}`, "", message || "(no message)"];
  }

  let confirmedRecently = false;
  let existingPerson = null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const rate = await checkRate(supabaseAdmin, { targetId: leadTargetId, email, message });
    if (rate.duplicate) return res.status(200).json({ ok: true });
    if (rate.limited) {
      return res.status(429).json({ error: "Too many messages from this address. Please try again later." });
    }
    confirmedRecently = rate.confirmedRecently;

    // Looked up before the insert, because the database trigger that files
    // the inquiry in People would otherwise make every sender look known.
    existingPerson = await findExistingPerson(supabaseAdmin, leadAgentId, email);
    if (existingPerson) bodyLines = [`Already in your People: ${describePerson(existingPerson)}`, "", ...bodyLines];

    const { error: leadError } = await supabaseAdmin.from("leads").insert({
      target_type: leadTargetType,
      target_id: leadTargetId,
      agent_id: leadAgentId,
      name,
      email,
      phone,
      message: isValuation ? `Property: ${address}${message ? `\n\n${message}` : ""}` : message,
    });
    if (leadError) console.error("Failed to store lead:", leadError);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Email delivery isn't configured yet (missing RESEND_API_KEY).",
    });
  }

  const fromEmail = process.env.LEAD_FROM_EMAIL || "Listing Inquiries <onboarding@resend.dev>";

  try {
    const sent = await sendNotification(apiKey, {
      from: fromEmail,
      to: recipientEmail,
      replyTo: email,
      subject: existingPerson ? `Repeat ${subject.charAt(0).toLowerCase()}${subject.slice(1)}` : subject,
      text: bodyLines.join("\n"),
    });
    if (!sent) return res.status(502).json({ error: "Failed to send email." });

    if (!confirmedRecently) {
      await sendConfirmation(apiKey, {
        from: fromEmail,
        visitor: { name, email },
        agentName,
        agentEmail: isValuation ? null : recipientEmail,
        about,
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return res.status(500).json({ error: "Unexpected error sending email." });
  }
}

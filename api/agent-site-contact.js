// Vercel serverless function — handles an agent site's "Let's Connect"
// form. Mirrors api/contact.js exactly, keyed by agentSiteId instead of
// listingId: the client sends agentSiteId, this function looks up who to
// email SERVER-SIDE (agent_sites -> agent_id -> profiles.email), never
// trusting a client-supplied recipient address.
//
// Setup: same RESEND_API_KEY / LEAD_FROM_EMAIL env vars as api/contact.js
// (already configured if that one works).

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, phone, message, agentSiteId } = req.body || {};

  if (!name || !email || !agentSiteId) {
    return res.status(400).json({ error: "Name, email, and agentSiteId are required." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase env vars are not configured." });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: site, error: siteError } = await supabase
    .from("agent_sites")
    .select("agent:profiles(full_name, email)")
    .eq("id", agentSiteId)
    .maybeSingle();

  if (siteError || !site || !site.agent?.email) {
    console.error("Agent site contact: lookup failed:", siteError);
    return res.status(404).json({ error: "Site not found." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Email delivery isn't configured yet (missing RESEND_API_KEY).",
    });
  }

  const fromEmail = process.env.LEAD_FROM_EMAIL || "Site Inquiries <onboarding@resend.dev>";

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: site.agent.email,
        reply_to: email,
        subject: `New website inquiry from ${name}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          `Phone: ${phone || "—"}`,
          "",
          message || "(no message)",
        ].join("\n"),
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("Resend API error:", resendRes.status, detail);
      return res.status(502).json({ error: "Failed to send email." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Agent site contact error:", err);
    return res.status(500).json({ error: "Unexpected error sending email." });
  }
}

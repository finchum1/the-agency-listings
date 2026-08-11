// Vercel serverless function — handles every listing's "Send Inquiry" form.
//
// Unlike the earlier per-listing static site, this app serves many
// listings from one deployment, so the client sends a `listingId` and
// this function looks up who to email SERVER-SIDE (via the listing's
// agent_id -> profiles.email). It deliberately does NOT trust a
// client-supplied email address — that would let this endpoint be used
// as an open mail relay to arbitrary addresses.
//
// Setup (Vercel dashboard > Project > Settings > Environment Variables):
//   RESEND_API_KEY   — from resend.com (required)
//   LEAD_FROM_EMAIL  — optional, e.g. "Listing Inquiries <onboarding@resend.dev>"
// (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are read too — same values
// already set for the client build; Vercel functions can read them
// regardless of the VITE_ prefix, which only affects client bundling.)

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, phone, message, listingId } = req.body || {};

  if (!name || !email || !listingId) {
    return res.status(400).json({ error: "Name, email, and listingId are required." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({ error: "Supabase env vars are not configured." });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("address_line1, agent:profiles(email, full_name)")
    .eq("id", listingId)
    .maybeSingle();

  if (listingError || !listing || !listing.agent?.email) {
    console.error("Contact form: listing/agent lookup failed:", listingError);
    return res.status(404).json({ error: "Listing not found." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Email delivery isn't configured yet (missing RESEND_API_KEY).",
    });
  }

  const fromEmail =
    process.env.LEAD_FROM_EMAIL || "Listing Inquiries <onboarding@resend.dev>";

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: listing.agent.email,
        reply_to: email,
        subject: `New inquiry: ${listing.address_line1} — ${name}`,
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
    console.error("Contact form error:", err);
    return res.status(500).json({ error: "Unexpected error sending email." });
  }
}

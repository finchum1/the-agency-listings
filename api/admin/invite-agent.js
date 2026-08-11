// Vercel serverless function — admin-only. Invites a new agent by email
// via Supabase Auth (sends them a "set your password" link, see
// SetPasswordPage.jsx), then fills in their profile details.
//
// Requires SUPABASE_SERVICE_ROLE_KEY as a Vercel env var (Project Settings
// > Environment Variables — add it in the Vercel dashboard yourself, never
// via chat/code). This key can do anything, including bypass RLS, so it's
// only ever used here, server-side, and only after independently verifying
// the calling user is an admin (never trusting a client-claimed role).

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({
      error: "Server not configured (missing Supabase env vars, incl. SUPABASE_SERVICE_ROLE_KEY).",
    });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Not authenticated." });

  // Verify the caller via the anon (RLS-respecting) client first.
  const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabaseAsCaller.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid session." });

  const { data: callerProfile } = await supabaseAsCaller
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (callerProfile?.role !== "admin") {
    return res.status(403).json({ error: "Only admins can invite agents." });
  }

  const { email, full_name, title, license, phone, role } = req.body || {};
  if (!email || !full_name) {
    return res.status(400).json({ error: "Email and full name are required." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      data: { full_name, role: role === "admin" ? "admin" : "agent" },
      redirectTo: `https://${req.headers.host}/accept-invite`,
    }
  );

  if (inviteError) {
    console.error("Invite error:", inviteError);
    return res.status(400).json({ error: inviteError.message });
  }

  // The on_auth_user_created trigger already inserted a bare profiles row
  // (id/email/full_name/role) — fill in the rest the admin entered.
  const newUserId = inviteData.user.id;
  const { error: updateError } = await admin
    .from("profiles")
    .update({ title, license, phone })
    .eq("id", newUserId);
  if (updateError) console.error("Profile update after invite failed:", updateError);

  return res.status(200).json({ ok: true, userId: newUserId });
}

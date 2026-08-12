// Vercel serverless function — admin-only. Creates a new agent profile,
// either as a full login-capable account (sends a "set your password"
// link, see SetPasswordPage.jsx) or as a profile-only record the admin
// manages on the agent's behalf, with no email sent and no login access
// until "Enable Login" is used later (see enable-agent-login in
// AgentsPage.jsx, which just calls supabase.auth.resetPasswordForEmail
// directly — no service role needed for that step).
//
// Every agent still gets a real auth.users row either way (profiles.id is
// an FK to it) — sendInvite just decides whether Supabase emails them a
// working login link now, or we hand them an unusable random password
// they'll never see, deferring login access until later.
//
// Requires SUPABASE_SERVICE_ROLE_KEY as a Vercel env var (Project Settings
// > Environment Variables — add it in the Vercel dashboard yourself, never
// via chat/code). This key can do anything, including bypass RLS, so it's
// only ever used here, server-side, and only after independently verifying
// the calling user is an admin (never trusting a client-claimed role).

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

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
    return res.status(403).json({ error: "Only admins can add agents." });
  }

  const { email, full_name, title, license, phone, photo_url, role, sendInvite } = req.body || {};
  if (!email || !full_name) {
    return res.status(400).json({ error: "Email and full name are required." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const metadata = {
    full_name,
    role: role === "admin" ? "admin" : "agent",
    login_enabled: !!sendInvite,
  };

  let newUserId;
  if (sendInvite) {
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      { data: metadata, redirectTo: `https://${req.headers.host}/accept-invite` }
    );
    if (inviteError) {
      console.error("Invite error:", inviteError);
      return res.status(400).json({ error: inviteError.message });
    }
    newUserId = inviteData.user.id;
  } else {
    // Profile-only agent: create the auth user so profiles.id has
    // somewhere to point, but don't send them anything. The password is
    // random and discarded immediately — no one can use it to log in
    // until an admin runs "Enable Login", which sends a real reset link.
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomUUID() + randomUUID(),
      email_confirm: true,
      user_metadata: metadata,
    });
    if (createError) {
      console.error("Create agent error:", createError);
      return res.status(400).json({ error: createError.message });
    }
    newUserId = createData.user.id;
  }

  // The on_auth_user_created trigger already inserted a bare profiles row
  // (id/email/full_name/role/login_enabled) — fill in the rest the admin
  // entered.
  const { error: updateError } = await admin
    .from("profiles")
    .update({ title, license, phone, photo_url: photo_url || null })
    .eq("id", newUserId);
  if (updateError) console.error("Profile update after create failed:", updateError);

  return res.status(200).json({ ok: true, userId: newUserId });
}

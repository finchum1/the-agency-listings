// Vercel serverless function — admin-only agent management, combining
// what used to be two separate functions (add-agent.js, delete-agent.js)
// into one dispatched by `action` in the body. Merged specifically to
// stay under Vercel's Hobby-plan 12-Serverless-Functions-per-deployment
// cap when the Repliers IDX endpoints were added (see api/repliers.js) —
// not a design preference, just where it was safest to consolidate: the
// two functions already shared near-identical auth/verification code and
// call from one place (AgentsPage.jsx).
//
// action: "add" — creates a new agent profile, either as a full
//   login-capable account (sends a "set your password" link, see
//   SetPasswordPage.jsx) or as a profile-only record the admin manages
//   on the agent's behalf, with no email sent and no login access until
//   "Enable Login" is used later (see enable-agent-login in
//   AgentsPage.jsx, which just calls supabase.auth.resetPasswordForEmail
//   directly — no service role needed for that step). Every agent still
//   gets a real auth.users row either way (profiles.id is an FK to it) —
//   sendInvite just decides whether Supabase emails them a working login
//   link now, or we hand them an unusable random password they'll never
//   see, deferring login access until later.
//
// action: "delete" — permanently deletes an agent's auth user, which
//   cascades to their profiles row (profiles.id -> auth.users ON DELETE
//   CASCADE), their agent_sites row and its testimonials/areas/posts (all
//   ON DELETE CASCADE from agent_sites), and nulls out agent_id on any
//   leads they'd received (ON DELETE SET NULL — the lead record itself
//   is kept). Storage objects (their headshot, their site's uploaded
//   photos) are NOT cleaned up here — same as everywhere else in this
//   app, deleting a row never reaches into Storage except PhotoManager's
//   own per-file delete. Known, accepted gap: orphaned blobs cost storage
//   space, nothing else. Blocked entirely (not just warned) if the agent
//   still has listings assigned — listings.agent_id is NOT NULL with ON
//   DELETE RESTRICT, so Postgres would reject the auth deletion outright;
//   this checks first and returns a clear, actionable error instead of a
//   raw FK violation.
//
// action: "list-sitemap" / "import-post" — the blog importer for moving a
//   client's posts over from another site (see api/_lib/importPost.js).
//   Folded into this function, like the rest, to stay under the 12-function cap.
//
// Requires SUPABASE_SERVICE_ROLE_KEY as a Vercel env var (Project Settings
// > Environment Variables — add it in the Vercel dashboard yourself, never
// via chat/code). This key can do anything, including bypass RLS, so it's
// only ever used here, server-side, and only after independently verifying
// the calling user is an admin (never trusting a client-claimed role).

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { listSitemap, importPost } from "../_lib/importPost.js";

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

  const { action } = req.body || {};
  if (!["add", "delete", "list-sitemap", "import-post"].includes(action)) {
    return res.status(400).json({ error: 'action must be "add", "delete", "list-sitemap" or "import-post".' });
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
    return res.status(403).json({ error: `Only admins can ${action} agents.` });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "add") {
    const { email, full_name, title, license, phone, photo_url, role, sendInvite, site_access, people_enabled } = req.body || {};
    if (!email || !full_name) {
      return res.status(400).json({ error: "Email and full name are required." });
    }

    const metadata = {
      full_name,
      role: role === "admin" ? "admin" : "agent",
      login_enabled: !!sendInvite,
    };

    let newUserId;
    if (sendInvite) {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: metadata,
        redirectTo: `https://${req.headers.host}/accept-invite`,
      });
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
      .update({
        title,
        license,
        phone,
        photo_url: photo_url || null,
        site_access: ["limited", "none"].includes(site_access) ? site_access : "full",
        people_enabled: !!people_enabled,
      })
      .eq("id", newUserId);
    if (updateError) console.error("Profile update after create failed:", updateError);

    return res.status(200).json({ ok: true, userId: newUserId });
  }

  // action === "list-sitemap" — blog importer step 1: find the addresses on
  // the old site (see api/_lib/importPost.js; admin-verified above).
  if (action === "list-sitemap") {
    try {
      const urls = await listSitemap(req.body?.site);
      return res.status(200).json({ ok: true, urls });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Couldn't read that sitemap." });
    }
  }

  // action === "import-post" — blog importer step 2: one old page in, one
  // DRAFT post out. The client calls this once per address so a long list
  // never hits the function time limit.
  if (action === "import-post") {
    const { agentSiteId, url } = req.body || {};
    if (!agentSiteId || !url) return res.status(400).json({ error: "agentSiteId and url are required." });
    const { data: site } = await admin.from("agent_sites").select("id").eq("id", agentSiteId).maybeSingle();
    if (!site) return res.status(404).json({ error: "That agent site wasn't found." });
    try {
      const result = await importPost({ admin, agentSiteId, url });
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      return res.status(200).json({ ok: false, status: "failed", error: err.message || "Import failed." });
    }
  }

  // action === "delete"
  const { agentId } = req.body || {};
  if (!agentId) return res.status(400).json({ error: "agentId is required." });

  if (agentId === user.id) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }

  const { count: listingCount, error: countError } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);
  if (countError) {
    console.error("Delete agent: listing count check failed:", countError);
    return res.status(500).json({ error: "Couldn't check this agent's listings." });
  }
  if (listingCount > 0) {
    return res.status(400).json({
      error: `This agent still has ${listingCount} listing${listingCount === 1 ? "" : "s"} assigned. Reassign or delete ${listingCount === 1 ? "it" : "them"} first, then try again.`,
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(agentId);
  if (deleteError) {
    console.error("Delete agent error:", deleteError);
    return res.status(400).json({ error: deleteError.message });
  }

  return res.status(200).json({ ok: true });
}

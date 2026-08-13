// Vercel serverless function — admin-only. Permanently deletes an agent's
// auth user, which cascades to their profiles row (profiles.id -> auth.users
// ON DELETE CASCADE), their agent_sites row and its testimonials/areas/posts
// (all ON DELETE CASCADE from agent_sites), and nulls out agent_id on any
// leads they'd received (ON DELETE SET NULL — the lead record itself is
// kept). Storage objects (their headshot, their site's uploaded photos)
// are NOT cleaned up here — same as everywhere else in this app, deleting
// a row never reaches into Storage except PhotoManager's own per-file
// delete. Known, accepted gap: orphaned blobs cost storage space, nothing
// else.
//
// Blocked entirely (not just warned) if the agent still has listings
// assigned — listings.agent_id is NOT NULL with ON DELETE RESTRICT, so
// Postgres would reject the auth deletion outright; this function checks
// first and returns a clear, actionable error instead of a raw FK
// violation.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (already configured — see
// api/admin/add-agent.js, same verify-caller-is-admin pattern).

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
    return res.status(403).json({ error: "Only admins can delete agents." });
  }

  const { agentId } = req.body || {};
  if (!agentId) return res.status(400).json({ error: "agentId is required." });

  if (agentId === user.id) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

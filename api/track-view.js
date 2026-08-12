// Vercel serverless function — records one page-view row for a listing,
// agent site, or agent-site blog post. Called once per page load from the
// public site pages (see src/lib/trackView.js) — fire-and-forget, never
// blocks rendering and never surfaces an error to the visitor.
//
// Writes with the service-role key so page_views can have NO client-facing
// RLS policy at all (see supabase/analytics.sql) — every row on that table
// came from this trusted function, never directly from a browser. Requires
// SUPABASE_SERVICE_ROLE_KEY (already configured — see api/admin/add-agent.js).
import { createClient } from "@supabase/supabase-js";

const VALID_TYPES = new Set(["listing", "agent_site", "agent_post"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { targetType, targetId } = req.body || {};
  if (!VALID_TYPES.has(targetType) || !UUID_RE.test(targetId || "")) {
    return res.status(400).json({ error: "Invalid targetType/targetId." });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Analytics should never be able to break a page — fail quietly.
    return res.status(200).json({ ok: false });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { error } = await supabase
    .from("page_views")
    .insert({ target_type: targetType, target_id: targetId });
  if (error) console.error("track-view insert failed:", error);

  return res.status(200).json({ ok: !error });
}

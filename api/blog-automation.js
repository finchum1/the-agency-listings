// Vercel serverless function — backs the scheduled blog-automation
// routine (a Claude cloud agent that runs on a cron schedule; see
// claude.ai/code/routines). The routine has no Supabase session of its
// own, so this endpoint does the actual privileged reads/writes
// server-side using SUPABASE_SERVICE_ROLE_KEY (already configured — see
// api/admin/add-agent.js), gated by a bearer secret only the routine
// knows, rather than handing the routine any real database credential.
//
// Setup (Vercel dashboard, Project Settings > Environment Variables):
//   BLOG_AUTOMATION_SECRET — a random string, shared only with the
//   routine's own prompt. Generate one with e.g. `openssl rand -hex 32`.
//
// Three actions, POST body { action, ...params }:
//   "get_context"  — read-only. Returns today's agent_blog_calendar row
//                     for the given agentSiteId (or a specific date), the
//                     agent's current active listings (for Home Spotlight
//                     days), and recent post titles/topics (for the
//                     monthly regeneration's own duplicate check).
//   "create_post"  — writes a new agent_site_posts row (always as a
//                     draft — the routine never sets status itself) and
//                     marks the matching calendar row 'generated'. Blocks
//                     if a very similar title/topic was already posted
//                     recently, the same class of mistake a human (or an
//                     earlier version of this same content calendar)
//                     already made once.
//   "seed_month"   — bulk-inserts a new month's worth of
//                     agent_blog_calendar rows (the monthly routine's own
//                     output), skipping any date that already has one.

import { createClient } from "@supabase/supabase-js";

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Cheap, dependency-free similarity check — word-overlap ratio against
// the shorter title. Good enough to catch "same topic, slightly reworded
// title" (exactly what happened once already) without needing a real NLP
// library for what's a one-line guard.
function titleSimilarity(a, b) {
  const words = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  return overlap / Math.min(wa.size, wb.size);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.BLOG_AUTOMATION_SECRET;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "Server not configured (missing BLOG_AUTOMATION_SECRET / Supabase env vars).",
    });
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token !== secret) return res.status(401).json({ error: "Invalid or missing bearer token." });

  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { action, agentSiteId } = req.body || {};
  if (!agentSiteId) return res.status(400).json({ error: "agentSiteId is required." });

  if (action === "get_context") {
    const date = req.body?.date || new Date().toISOString().slice(0, 10);

    const [{ data: calendarRow }, { data: listings }, { data: recentPosts }] = await Promise.all([
      db.from("agent_blog_calendar").select("*").eq("agent_site_id", agentSiteId).eq("post_date", date).maybeSingle(),
      db
        .from("listings")
        .select("id, slug, address_line1, city, state, price, beds, baths, sqft, property_type, description")
        .eq("agent_id", (await db.from("agent_sites").select("agent_id").eq("id", agentSiteId).single()).data?.agent_id)
        .not("status", "in", "(draft,sold)")
        .order("created_at", { ascending: false }),
      db
        .from("agent_site_posts")
        .select("title, category, post_date")
        .eq("agent_site_id", agentSiteId)
        .order("post_date", { ascending: false })
        .limit(60),
    ]);

    return res.status(200).json({ calendarRow: calendarRow || null, activeListings: listings || [], recentPosts: recentPosts || [] });
  }

  if (action === "create_post") {
    const { title, category, excerpt, body_html, image_url, related_listing_id, post_date } = req.body || {};
    if (!title || !body_html) return res.status(400).json({ error: "title and body_html are required." });

    const { data: recentPosts } = await db
      .from("agent_site_posts")
      .select("title")
      .eq("agent_site_id", agentSiteId)
      .order("post_date", { ascending: false })
      .limit(80);

    const dupe = (recentPosts || []).find((p) => titleSimilarity(p.title, title) > 0.6);
    if (dupe) {
      return res.status(409).json({
        error: `Too similar to an existing post ("${dupe.title}") — refusing to publish a near-duplicate. Pick a different angle or skip this slot.`,
      });
    }

    let slug = slugify(title);
    const { data: slugClash } = await db
      .from("agent_site_posts")
      .select("id")
      .eq("agent_site_id", agentSiteId)
      .eq("slug", slug)
      .maybeSingle();
    if (slugClash) slug = `${slug}-${Date.now().toString(36)}`;

    const { data: post, error: insertError } = await db
      .from("agent_site_posts")
      .insert({
        agent_site_id: agentSiteId,
        slug,
        title,
        category: category || "",
        post_date: post_date || new Date().toISOString().slice(0, 10),
        excerpt: excerpt || "",
        image_url: image_url || null,
        body_html,
        related_listing_id: related_listing_id || null,
        status: "draft", // the routine never publishes directly — see BrokerageSiteForm-style review flow
      })
      .select()
      .single();

    if (insertError) {
      console.error("blog-automation create_post insert failed:", insertError);
      return res.status(500).json({ error: insertError.message });
    }

    if (post_date) {
      await db
        .from("agent_blog_calendar")
        .update({ status: "generated", generated_post_id: post.id })
        .eq("agent_site_id", agentSiteId)
        .eq("post_date", post_date);
    }

    return res.status(200).json({ ok: true, post });
  }

  if (action === "seed_month") {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "rows[] is required." });

    const { data: existing } = await db.from("agent_blog_calendar").select("post_date").eq("agent_site_id", agentSiteId);
    const existingDates = new Set((existing || []).map((r) => r.post_date));
    const toInsert = rows.filter((r) => !existingDates.has(r.post_date)).map((r) => ({ ...r, agent_site_id: agentSiteId }));

    if (toInsert.length === 0) return res.status(200).json({ ok: true, inserted: 0, note: "All dates already had a row." });

    const { error: seedError } = await db.from("agent_blog_calendar").insert(toInsert);
    if (seedError) {
      console.error("blog-automation seed_month insert failed:", seedError);
      return res.status(500).json({ error: seedError.message });
    }
    return res.status(200).json({ ok: true, inserted: toInsert.length });
  }

  return res.status(400).json({ error: `Unknown action "${action}".` });
}

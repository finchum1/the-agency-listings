// Template comparison share links (see supabase/people-module.sql section 30 and src/pages/SitePreviewPage.jsx).
//   GET  /api/site-preview?token=pv...          -> the draft site's data, so the page can render it in any layout
//   POST /api/site-preview { token, layout, theme } -> records which look the person picked and tells whoever shared the link
// Anyone holding a valid, unexpired, unrevoked token can read this one site (published content only for posts and listings,
// the same rule the public pages follow). The token is the only credential, so it is only ever compared by hash.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";
import { publishedOrDueFilter } from "../src/lib/seo.js";
import { sendNotification } from "./_lib/inquiry.js";

const TOKEN = /^pv[0-9a-f]{64}$/;
const LAYOUTS = ["classic", "editorial", "bold", "portrait", "listings"];
const THEMES = ["classic", "dark", "sand", "red", "linen"];
const LAYOUT_NAMES = { classic: "Classic", editorial: "Minimal editorial", bold: "Bold statement", portrait: "Portrait split", listings: "Listings first" };

async function findLink(admin, token) {
  if (!TOKEN.test(String(token || ""))) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data } = await admin.from("site_preview_links").select("id, agent_site_id, created_by, expires_at, revoked_at, last_viewed_at").eq("token_hash", hash).maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at) < new Date()) return null;
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  const token = req.method === "GET" ? req.query?.token : req.body?.token;
  const link = await findLink(admin, token);
  if (!link) return res.status(404).json({ error: "This link isn't valid anymore. Ask for a new one." });

  if (req.method === "POST") {
    const { layout, theme } = req.body || {};
    if (!LAYOUTS.includes(layout) || (theme !== undefined && !THEMES.includes(theme))) return res.status(400).json({ error: "Pick one of the layouts shown." });
    await admin.from("site_preview_links").update({ picked_layout: layout, picked_theme: theme || null, picked_at: new Date().toISOString() }).eq("id", link.id);
    // Tell whoever shared the link, best effort: the pick is saved either way.
    try {
      const apiKey = process.env.RESEND_API_KEY;
      const [{ data: owner }, { data: site }] = await Promise.all([
        admin.from("profiles").select("email, full_name").eq("id", link.created_by).maybeSingle(),
        admin.from("agent_sites").select("slug, agent:profiles(full_name)").eq("id", link.agent_site_id).maybeSingle(),
      ]);
      if (apiKey && owner?.email) {
        const who = site?.agent?.full_name || "Someone";
        const look = `${LAYOUT_NAMES[layout]}${theme ? `, ${theme} colors` : ""}`;
        await sendNotification(apiKey, {
          from: process.env.LEAD_FROM_EMAIL || "Listing Inquiries <onboarding@resend.dev>",
          to: [owner.email],
          subject: `${who} picked a website look: ${look}`,
          text: `${who} looked at the template options and picked: ${look}.\n\nTo use it, open Dashboard > Website > Compare Templates for their site and click "Use this layout".`,
        });
      }
    } catch (err) {
      console.error("Pick notification failed:", err);
    }
    return res.status(200).json({ ok: true });
  }

  // GET: the site and everything it renders.
  const { data: site } = await admin.from("agent_sites").select("*, agent:profiles(id, full_name, title, license, phone, email, photo_url), org:organizations(*)").eq("id", link.agent_site_id).maybeSingle();
  if (!site) return res.status(404).json({ error: "This site no longer exists." });
  const [{ data: testimonials }, { data: areas }, { data: posts }, { data: listings }] = await Promise.all([
    admin.from("agent_site_testimonials").select("*").eq("agent_site_id", site.id).order("sort_order"),
    admin.from("agent_site_areas").select("*").eq("agent_site_id", site.id).order("sort_order"),
    admin.from("agent_site_posts").select("*").eq("agent_site_id", site.id).or(publishedOrDueFilter()).order("post_date", { ascending: false }),
    admin.from("listings").select("*, listing_photos(url, is_hero)").eq("agent_id", site.agent_id).neq("status", "draft"),
  ]);

  const last = link.last_viewed_at ? new Date(link.last_viewed_at).getTime() : 0;
  if (Date.now() - last > 60 * 1000) await admin.from("site_preview_links").update({ last_viewed_at: new Date().toISOString() }).eq("id", link.id);

  const { agent, ...siteRow } = site;
  return res.status(200).json({ site: siteRow, agent, testimonials: testimonials || [], areas: areas || [], posts: posts || [], listings: listings || [] });
}

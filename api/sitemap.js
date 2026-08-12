// Vercel serverless function, exposed at /sitemap.xml (see vercel.json).
// Generated live from Supabase on every request (cached at the edge, see
// Cache-Control below) rather than baked in at build time, since listings
// and agent sites publish/unpublish independently of any deploy.
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // RLS already restricts every one of these to publicly-visible rows
  // (status <> 'draft' / 'published'), same as the pages themselves.
  const [{ data: listings }, { data: sites }, { data: posts }] = await Promise.all([
    supabase.from("listings").select("slug, updated_at").neq("status", "draft"),
    supabase.from("agent_sites").select("slug, updated_at").eq("status", "published"),
    supabase
      .from("agent_site_posts")
      .select("slug, updated_at, agent_sites(slug)")
      .eq("status", "published"),
  ]);

  const urls = [
    { loc: `${SITE_ORIGIN}/` },
    ...(listings || []).map((l) => ({ loc: `${SITE_ORIGIN}/listings/${l.slug}`, lastmod: l.updated_at })),
    ...(sites || []).map((s) => ({ loc: `${SITE_ORIGIN}/sites/${s.slug}`, lastmod: s.updated_at })),
    ...(posts || [])
      .filter((p) => p.agent_sites?.slug)
      .map((p) => ({
        loc: `${SITE_ORIGIN}/sites/${p.agent_sites.slug}/blog/${p.slug}`,
        lastmod: p.updated_at,
      })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
${u.lastmod ? `    <lastmod>${new Date(u.lastmod).toISOString().slice(0, 10)}</lastmod>\n` : ""}  </url>`,
  )
  .join("\n")}
</urlset>
`;

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(xml);
}

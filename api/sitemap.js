// Vercel serverless function, exposed at /sitemap.xml (see vercel.json).
// Generated live from Supabase on every request (cached at the edge, see
// Cache-Control below) rather than baked in at build time, since listings
// and agent sites publish/unpublish independently of any deploy.
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN, publishedOrDueFilter } from "../src/lib/seo.js";

// Every agent site also has 5 standalone subpages (see App.jsx's
// /sites/:slug/* routes and api/meta-agent-site.js's ?page= handling) —
// all real, indexable, crawler-snapshotted pages, so they belong here
// too, not just each site's home URL.
const AGENT_SITE_SUBPAGES = ["about", "listings", "areas", "blog", "contact"];

// The brokerage site's own 8 standalone subpages (App.jsx's /brokerage/*
// routes, api/meta-brokerage-site.js's ?page= handling) — same idea,
// just one site instead of many.
const BROKERAGE_SUBPAGES = ["about", "agents", "areas", "blog", "listings", "search", "home-valuation", "contact"];

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
  // (status <> 'draft' / 'published', or published-or-due-scheduled for
  // posts — see lib/seo.js's publishedOrDueFilter), same as the pages
  // themselves.
  const [
    { data: listings },
    { data: sites },
    { data: posts },
    { data: agentAreas },
    { data: brokerageSite },
    { data: brokeragePosts },
    { data: brokerageAreas },
  ] = await Promise.all([
    supabase.from("listings").select("slug, updated_at").neq("status", "draft"),
    supabase.from("agent_sites").select("slug, updated_at").eq("status", "published"),
    supabase
      .from("agent_site_posts")
      .select("slug, updated_at, agent_sites(slug)")
      .or(publishedOrDueFilter()),
    supabase.from("agent_site_areas").select("slug, agent_sites(slug)"),
    supabase.from("brokerage_site").select("updated_at").eq("status", "published").maybeSingle(),
    supabase.from("brokerage_posts").select("slug, updated_at").or(publishedOrDueFilter()),
    supabase.from("brokerage_areas").select("slug"),
  ]);

  const urls = [
    { loc: `${SITE_ORIGIN}/` },
    ...(listings || []).map((l) => ({ loc: `${SITE_ORIGIN}/listings/${l.slug}`, lastmod: l.updated_at })),
    ...(sites || []).flatMap((s) => [
      { loc: `${SITE_ORIGIN}/sites/${s.slug}`, lastmod: s.updated_at },
      ...AGENT_SITE_SUBPAGES.map((page) => ({
        loc: `${SITE_ORIGIN}/sites/${s.slug}/${page}`,
        lastmod: s.updated_at,
      })),
    ]),
    ...(posts || [])
      .filter((p) => p.agent_sites?.slug)
      .map((p) => ({
        loc: `${SITE_ORIGIN}/sites/${p.agent_sites.slug}/blog/${p.slug}`,
        lastmod: p.updated_at,
      })),
    ...(agentAreas || [])
      .filter((a) => a.agent_sites?.slug)
      .map((a) => ({ loc: `${SITE_ORIGIN}/sites/${a.agent_sites.slug}/areas/${a.slug}` })),
    ...(brokerageSite
      ? [
          { loc: `${SITE_ORIGIN}/brokerage`, lastmod: brokerageSite.updated_at },
          ...BROKERAGE_SUBPAGES.map((page) => ({
            loc: `${SITE_ORIGIN}/brokerage/${page}`,
            lastmod: brokerageSite.updated_at,
          })),
        ]
      : []),
    ...(brokeragePosts || []).map((p) => ({ loc: `${SITE_ORIGIN}/brokerage/blog/${p.slug}`, lastmod: p.updated_at })),
    ...(brokerageAreas || []).map((a) => ({ loc: `${SITE_ORIGIN}/brokerage/areas/${a.slug}` })),
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

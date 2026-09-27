// Vercel serverless function, exposed at /sitemap.xml (see vercel.json's
// universal rewrite — no host condition, so this fires for the main app
// host AND every listing's/agent's/the brokerage's own custom domain).
// Generated live from Supabase on every request (cached at the edge, see
// Cache-Control below) rather than baked in at build time, since listings
// and agent sites publish/unpublish independently of any deploy.
//
// Host-aware: a request on a custom domain (e.g. terrencefinchum.com/
// sitemap.xml) gets a sitemap scoped to just THAT site's own pages, with
// every <loc> under that same domain — Google Search Console rejects (or
// fails to fetch/validate) a sitemap whose URLs don't belong to the
// property you're submitting it to, which is exactly what this function
// used to produce for every host: it always emitted SITE_ORIGIN URLs
// (the-agency-listings.vercel.app) regardless of which domain asked, so
// submitting terrencefinchum.com's sitemap in Search Console could never
// have worked. The main app host still gets the original full-platform
// sitemap (listings, every agent site + subpages, the brokerage site +
// subpages, every post and area) — that one's meant to be submitted
// under the app's own Search Console property, not a per-agent domain.
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN, publishedOrDueFilter } from "../src/lib/seo.js";
import { bareHost, isAppHost } from "../src/lib/appHosts.js";

// Every agent site also has 5 standalone subpages (see App.jsx's
// /sites/:slug/* routes and api/meta-agent-site.js's ?page= handling) —
// all real, indexable, crawler-snapshotted pages, so they belong here
// too, not just each site's home URL.
const AGENT_SITE_SUBPAGES = ["about", "listings", "areas", "blog", "contact"];

// The brokerage site's own 8 standalone subpages (App.jsx's /brokerage/*
// routes, api/meta-brokerage-site.js's ?page= handling) — same idea,
// just one site instead of many.
const BROKERAGE_SUBPAGES = ["about", "agents", "areas", "blog", "listings", "search", "home-valuation", "contact"];

// A custom domain's own subpages sit at its root (CustomDomainSitePage.jsx
// — /about, /listings, /areas, /blog, /contact for an agent site; add
// /agents, /search, /home-valuation for the brokerage), not nested under
// /sites/:slug or /brokerage the way the main app host's URLs are.
const CUSTOM_DOMAIN_AGENT_SUBPAGES = ["about", "listings", "areas", "blog", "contact"];
const CUSTOM_DOMAIN_BROKERAGE_SUBPAGES = ["about", "agents", "areas", "blog", "listings", "search", "home-valuation", "contact"];

function renderUrlset(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const host = bareHost(req.headers.host);

  if (!isAppHost(host)) {
    const xml = await buildCustomDomainSitemap(supabase, host, req.headers.host);
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
    res.status(200).send(xml);
    return;
  }

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

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(renderUrlset(urls));
}

// Same "listing, then agent site, then brokerage site" fallback order as
// meta-custom-domain.js. `rawHost` (not the bare/www-stripped `host`) is
// what every <loc> is built from, so a request on www.terrencefinchum.com
// gets www.terrencefinchum.com URLs, not a stripped/bare version that
// might not even be the canonical one for that domain.
async function buildCustomDomainSitemap(supabase, host, rawHost) {
  const origin = `https://${rawHost}`;

  const { data: listing } = await supabase.from("listings").select("updated_at").ilike("custom_domain", host).maybeSingle();
  if (listing) {
    return renderUrlset([{ loc: `${origin}/`, lastmod: listing.updated_at }]);
  }

  const { data: site } = await supabase.from("agent_sites").select("id, updated_at").ilike("custom_domain", host).maybeSingle();
  if (site) {
    const [{ data: posts }, { data: areas }] = await Promise.all([
      supabase.from("agent_site_posts").select("slug, updated_at").eq("agent_site_id", site.id).or(publishedOrDueFilter()),
      supabase.from("agent_site_areas").select("slug").eq("agent_site_id", site.id),
    ]);
    const urls = [
      { loc: `${origin}/`, lastmod: site.updated_at },
      ...CUSTOM_DOMAIN_AGENT_SUBPAGES.map((page) => ({ loc: `${origin}/${page}`, lastmod: site.updated_at })),
      ...(posts || []).map((p) => ({ loc: `${origin}/blog/${p.slug}`, lastmod: p.updated_at })),
      ...(areas || []).map((a) => ({ loc: `${origin}/areas/${a.slug}` })),
    ];
    return renderUrlset(urls);
  }

  const { data: brokerageSite } = await supabase
    .from("brokerage_site")
    .select("updated_at")
    .ilike("custom_domain", host)
    .maybeSingle();
  if (brokerageSite) {
    const [{ data: posts }, { data: areas }] = await Promise.all([
      supabase.from("brokerage_posts").select("slug, updated_at").or(publishedOrDueFilter()),
      supabase.from("brokerage_areas").select("slug"),
    ]);
    const urls = [
      { loc: `${origin}/`, lastmod: brokerageSite.updated_at },
      ...CUSTOM_DOMAIN_BROKERAGE_SUBPAGES.map((page) => ({ loc: `${origin}/${page}`, lastmod: brokerageSite.updated_at })),
      ...(posts || []).map((p) => ({ loc: `${origin}/blog/${p.slug}`, lastmod: p.updated_at })),
      ...(areas || []).map((a) => ({ loc: `${origin}/areas/${a.slug}` })),
    ];
    return renderUrlset(urls);
  }

  // Not the app host, and not a domain attached to anything — empty but
  // still valid XML rather than guessing.
  return renderUrlset([]);
}

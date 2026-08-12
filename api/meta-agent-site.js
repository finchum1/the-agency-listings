// Vercel serverless function — server-rendered "snapshot" of an agent
// site's homepage, served ONLY to crawlers/link-unfurlers. See
// api/meta-listing.js for the full rationale; this is the same idea for
// /sites/:slug.
import { createClient } from "@supabase/supabase-js";
import { buildAgentSiteMeta, escapeHtml, SITE_ORIGIN } from "../src/lib/seo.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

export default async function handler(req, res) {
  const slug = req.query.slug;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!slug) {
    res.status(400).send("Missing slug");
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: site } = await supabase
    .from("agent_sites")
    .select("*, agent:profiles(*)")
    .eq("slug", slug)
    .maybeSingle();

  const url = `${SITE_ORIGIN}/sites/${slug}`;

  if (!site) {
    res.status(404).send(
      renderMetaPage({
        title: "Site not found | The Agency",
        description: "This agent site may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Site not found",
        bodyHtml: "<p>This agent site may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildAgentSiteMeta(site, site.agent);
  const heading = site.agent?.full_name || "Agent";

  const bodyHtml = `
${site.region ? `<p>${escapeHtml(site.region)}</p>` : ""}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Visit site →</a></p>
`;

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(heading),
      bodyHtml,
    }),
  );
}

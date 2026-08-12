// Vercel serverless function — server-rendered "snapshot" of a single
// agent-site blog post, served ONLY to crawlers/link-unfurlers. See
// api/meta-listing.js for the full rationale; this is the same idea for
// /sites/:slug/blog/:postSlug.
import { createClient } from "@supabase/supabase-js";
import { buildAgentPostMeta, escapeHtml, SITE_ORIGIN } from "../src/lib/seo.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

export default async function handler(req, res) {
  const { slug, post: postSlug } = req.query;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!slug || !postSlug) {
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

  const url = `${SITE_ORIGIN}/sites/${slug}/blog/${postSlug}`;

  const { data: post } = site
    ? await supabase
        .from("agent_site_posts")
        .select("*")
        .eq("agent_site_id", site.id)
        .eq("slug", postSlug)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };

  if (!site || !post) {
    res.status(404).send(
      renderMetaPage({
        title: "Post not found | The Agency",
        description: "This post may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Post not found",
        bodyHtml: "<p>This post may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildAgentPostMeta(post, site, site.agent);

  const bodyHtml = `
${post.category ? `<p>${escapeHtml(post.category)}</p>` : ""}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Read full post →</a></p>
`;

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(post.title),
      bodyHtml,
    }),
  );
}

// Vercel serverless function — server-rendered "snapshot" for a bot/link-
// unfurler hitting "/blog/:postSlug" on an agent site's own attached
// custom domain (e.g. terrencefinchum.com/blog/oak-tree). The other
// meta-*.js functions don't cover this: meta-agent-post.js matches the
// app-host /sites/:slug/blog/:postSlug path, and meta-custom-domain.js
// only covers a custom domain's bare "/" — this is the missing case,
// same idea as meta-custom-domain.js but for a blog post instead of the
// site root. See CustomDomainSitePage.jsx's CustomDomainAgentPostPage
// for the equivalent client-side (real-browser) resolution this mirrors,
// by Host header instead of useAgentPost's siteCustomDomain param.
//
// Without this, a bot hitting a shared blog-post link on a custom domain
// fell through vercel.json's catch-all to the raw index.html — the
// app's own generic title/description, not the post's.
import { createClient } from "@supabase/supabase-js";
import { buildAgentPostMeta, escapeHtml, absoluteUrl } from "../src/lib/seo.js";
import { buildBlogPostSchema, buildBreadcrumbSchema } from "../src/lib/structuredData.js";
import brokerage from "../src/lib/brokerage.js";
import { bareHost } from "../src/lib/appHosts.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

export default async function handler(req, res) {
  const { post: postSlug } = req.query;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const host = bareHost(req.headers.host);
  const url = `https://${req.headers.host}/blog/${postSlug}`;

  if (!postSlug) {
    res.status(400).send("Missing post slug");
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
    .ilike("custom_domain", host)
    .maybeSingle();

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

  const homeUrl = `https://${req.headers.host}/`;
  const structuredData = [
    buildBlogPostSchema({
      url,
      headline: post.title,
      description: meta.description,
      image: meta.image,
      datePublished: post.post_date,
      dateModified: post.updated_at,
      authorName: site.agent?.full_name,
      publisherName: brokerage.name,
      publisherLogo: absoluteUrl(brokerage.logo),
    }),
    buildBreadcrumbSchema([
      { name: site.agent?.full_name || "Home", url: homeUrl },
      { name: "Blog", url: `${homeUrl}blog` },
      { name: post.title, url },
    ]),
  ];

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(post.title),
      bodyHtml,
      structuredData,
    }),
  );
}

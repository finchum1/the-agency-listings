import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { blocksToHtml } from "../lib/richTextFallback";
import { buildAgentPostMeta, absoluteUrl, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta, applyStructuredData } from "../lib/pageMeta";
import { buildBlogPostSchema, buildBreadcrumbSchema } from "../lib/structuredData";
import brokerage from "../lib/brokerage";
import { trackView } from "../lib/trackView";
import { isAgentSiteAppHost } from "../lib/agentSiteLinks";
import { AgentSiteProvider } from "../context/AgentSiteContext";
import Navbar from "../components/agent-site/Navbar";
import Footer from "../components/agent-site/Footer";
import SiteLink from "../components/agent-site/SiteLink";

// Shared rendering for a single blog post — used both at
// /sites/:slug/blog/:postSlug (PublicAgentPostPage.jsx) and when a
// request arrives on the parent site's own attached custom domain
// (CustomDomainAgentPostPage.jsx). Takes the raw shape returned by
// useAgentPost().
export default function AgentPostPage({ site, agent, post, loading, notFound }) {
  const adapted = site
    ? adaptAgentSite({ site, agent, testimonials: [], areas: [], posts: [], listings: [] })
    : null;

  useEffect(() => {
    if (!post || !site) return;
    const meta = buildAgentPostMeta(post, site, agent);
    const url = isAgentSiteAppHost()
      ? `${SITE_ORIGIN}/sites/${site.slug}/blog/${post.slug}`
      : window.location.href;
    applyPageMeta({
      ...meta,
      // See AgentSitePage.jsx's same url logic — canonical app-host URL
      // there, real current URL (via applyPageMeta's fallback) here.
      url: isAgentSiteAppHost() ? url : undefined,
    });
    applyStructuredData([
      buildBlogPostSchema({
        url,
        headline: post.title,
        description: meta.description,
        image: meta.image,
        datePublished: post.post_date,
        dateModified: post.updated_at,
        authorName: agent?.full_name,
        publisherName: brokerage.name,
        publisherLogo: absoluteUrl(brokerage.logo),
      }),
      buildBreadcrumbSchema([
        { name: agent?.full_name || "Home", url: isAgentSiteAppHost() ? `${SITE_ORIGIN}/sites/${site.slug}` : `${window.location.origin}/` },
        { name: "Blog", url: isAgentSiteAppHost() ? `${SITE_ORIGIN}/sites/${site.slug}/blog` : `${window.location.origin}/blog` },
        { name: post.title, url },
      ]),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, site, agent]);

  useEffect(() => {
    if (post?.id) trackView("agent_post", post.id);
  }, [post?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f4ee] font-agent-sans">
        <p className="text-[#14130f]/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted || !post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <AgentSiteProvider value={{ site: adapted, siteId: site.id }}>
      <div
        className="min-h-screen bg-[var(--as-bg)] font-agent-sans"
        data-theme={adapted.theme}
        data-font={adapted.fontPairing}
        style={adapted.accentColor ? { "--as-accent": adapted.accentColor } : undefined}
      >
        <Navbar />

        <article className="pt-32 pb-24 px-6 lg:px-10">
          <div className="mx-auto max-w-3xl">
            {post.category && (
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
                {post.category}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3 text-[var(--as-text)]">
              {post.title}
            </h1>
            <p className="text-sm text-[var(--as-text)]/50 mb-10">
              {new Date(`${post.post_date}T00:00:00`).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {post.image_url && (
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[16/9] mb-10">
                <img src={post.image_url} alt={post.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div
              className="rich-text space-y-5 text-[15.5px] leading-relaxed text-[var(--as-text)]/80"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(post.body_html || blocksToHtml(post.body)),
              }}
            />

            <div className="mt-14 pt-6 border-t border-[var(--as-text)]/10 flex items-center justify-between">
              <p className="text-sm text-[var(--as-text)]/60">
                Written by{" "}
                <SiteLink slug={site.slug} path="" className="text-[var(--as-text)] hover:underline">
                  {adapted.agent.name}
                </SiteLink>
              </p>
              <SiteLink
                slug={site.slug}
                path="/blog"
                className="text-sm text-[var(--as-accent)] hover:underline"
              >
                ← More posts
              </SiteLink>
            </div>
          </div>
        </article>

        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useBrokeragePost } from "../hooks/useBrokeragePost";
import { adaptBrokerageSite } from "../lib/adaptBrokerageSite";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { buildBrokeragePostMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { BrokerageSiteProvider } from "../context/BrokerageSiteContext";
import Navbar from "../components/brokerage-site/Navbar";
import Footer from "../components/brokerage-site/Footer";

// Single blog post at /brokerage/blog/:postSlug — parallel to
// AgentPostPage.jsx.
export default function BrokeragePostPage() {
  const { postSlug } = useParams();
  const { site, post, loading, notFound } = useBrokeragePost({ postSlug });
  const adapted = site ? adaptBrokerageSite({ site, posts: [], agents: [], areas: [] }) : null;

  useEffect(() => {
    if (!post || !site) return;
    const meta = buildBrokeragePostMeta(post, site);
    applyPageMeta({ ...meta, url: `${SITE_ORIGIN}/brokerage/blog/${post.slug}` });
  }, [post, site]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14130f] font-agent-sans">
        <p className="text-white/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted || !post) {
    return <Navigate to="/404" replace />;
  }

  return (
    <BrokerageSiteProvider value={{ site: adapted }}>
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
              <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">{post.category}</p>
            )}
            <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3 text-[var(--as-text)]">{post.title}</h1>
            <p className="text-sm text-[var(--as-text)]/50 mb-10">
              {new Date(`${post.post_date}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>

            {post.image_url && (
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[16/9] mb-10">
                <img src={post.image_url} alt={post.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div
              className="rich-text space-y-5 text-[15.5px] leading-relaxed text-[var(--as-text)]/80"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.body_html) }}
            />

            <div className="mt-14 pt-6 border-t border-[var(--as-text)]/10 flex items-center justify-between">
              <p className="text-sm text-[var(--as-text)]/60">
                Written by <span className="text-[var(--as-text)]">{adapted.brokerage.name}</span>
              </p>
              <Link to="/brokerage/blog" className="text-sm text-[var(--as-accent)] hover:underline">
                ← More posts
              </Link>
            </div>
          </div>
        </article>

        <Footer />
      </div>
    </BrokerageSiteProvider>
  );
}

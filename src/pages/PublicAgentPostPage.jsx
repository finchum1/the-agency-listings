import { useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useAgentPost } from "../hooks/useAgentPost";
import { adaptAgentSite } from "../lib/adaptAgentSite";
import { AgentSiteProvider } from "../context/AgentSiteContext";
import Navbar from "../components/agent-site/Navbar";
import Footer from "../components/agent-site/Footer";

export default function PublicAgentPostPage() {
  const { slug: siteSlug, postSlug } = useParams();
  const { site, agent, post, loading, notFound } = useAgentPost({ siteSlug, postSlug });

  const adapted = site
    ? adaptAgentSite({ site, agent, testimonials: [], areas: [], posts: [], listings: [] })
    : null;

  useEffect(() => {
    if (post) document.title = `${post.title} | ${adapted?.agent.name}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post]);

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
                <img src={post.image_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="space-y-5 text-[15.5px] leading-relaxed text-[var(--as-text)]/80">
              {(post.body || []).map((block, i) =>
                block.type === "h3" ? (
                  <h3 key={i} className="text-xl font-display font-semibold !mt-10 text-[var(--as-text)]">
                    {block.text}
                  </h3>
                ) : (
                  <p key={i}>{block.text}</p>
                ),
              )}
            </div>

            <div className="mt-14 pt-6 border-t border-[var(--as-text)]/10 flex items-center justify-between">
              <p className="text-sm text-[var(--as-text)]/60">
                Written by{" "}
                <Link to={`/sites/${siteSlug}`} className="text-[var(--as-text)] hover:underline">
                  {adapted.agent.name}
                </Link>
              </p>
              <Link to={`/sites/${siteSlug}#blog`} className="text-sm text-[var(--as-accent)] hover:underline">
                ← More posts
              </Link>
            </div>
          </div>
        </article>

        <Footer />
      </div>
    </AgentSiteProvider>
  );
}

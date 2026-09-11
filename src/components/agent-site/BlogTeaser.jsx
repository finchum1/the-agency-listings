import { useAgentSiteContext } from "../../context/AgentSiteContext";
import SiteLink from "./SiteLink";

// On Home, only a taste — the 6 most recent (posts already arrive sorted
// newest-first, see useAgentSite.js's own `order("post_date", {ascending:
// false})`) — with a Read More button down to the real, unrestricted
// /blog page. The standalone /blog page (isStandalonePage) is that real
// page, so it keeps showing every post, no cap.
const HOME_PREVIEW_COUNT = 6;

export default function BlogTeaser() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.posts.length === 0) return null;
  // See Bio.jsx's comment — Home already has an H1 from Hero.jsx, but
  // this section IS the page at standalone /blog.
  const Heading = isStandalonePage ? "h1" : "h2";
  const posts = isStandalonePage ? site.posts : site.posts.slice(0, HOME_PREVIEW_COUNT);
  const hasMore = !isStandalonePage && site.posts.length > HOME_PREVIEW_COUNT;

  return (
    <section id="blog" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
          From the Blog
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[var(--as-text)]">
          Market Insights
        </Heading>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <SiteLink key={post.id} slug={site.slug} path={`/blog/${post.slug}`} className="group block">
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
              </div>
              {post.category && (
                <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mt-4">
                  {post.category}
                </p>
              )}
              <p className="mt-2 font-medium leading-snug text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">
                {post.title}
              </p>
            </SiteLink>
          ))}
        </div>

        {hasMore && (
          <div className="mt-12 text-center">
            <SiteLink
              slug={site.slug}
              path="/blog"
              className="inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]"
            >
              Read More
            </SiteLink>
          </div>
        )}
      </div>
    </section>
  );
}

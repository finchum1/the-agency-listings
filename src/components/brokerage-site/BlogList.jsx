import { Link } from "react-router-dom";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

// `preview` caps the list to a teaser row (used on Home); the standalone
// /brokerage/blog page shows every published post.
export default function BlogList({ preview = false, isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  if (site.posts.length === 0) return null;
  const posts = preview ? site.posts.slice(0, 3) : site.posts;
  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">From the Blog</p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[var(--as-text)]">
          Market Insights
        </Heading>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} to={`/brokerage/blog/${post.slug}`} className="group block">
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                {post.image_url && (
                  <img src={post.image_url} alt={post.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                )}
              </div>
              {post.category && (
                <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mt-4">{post.category}</p>
              )}
              <p className="mt-2 font-medium leading-snug text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">
                {post.title}
              </p>
            </Link>
          ))}
        </div>

        {preview && site.posts.length > posts.length && (
          <div className="mt-14 flex justify-center">
            <Link
              to="/brokerage/blog"
              className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
            >
              Read The Blog
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

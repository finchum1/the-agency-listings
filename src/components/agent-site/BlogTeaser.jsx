import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function BlogTeaser() {
  const { site } = useAgentSiteContext();
  if (site.posts.length === 0) return null;

  return (
    <section id="blog" className="px-6 lg:px-10 py-24 bg-white border-y border-[#14130f]/10">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[#8a1c2b] mb-3">
          From the Blog
        </p>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-10 text-[#14130f]">
          Market Insights
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {site.posts.map((post) => (
            <a key={post.id} href={`/sites/${site.slug}/blog/${post.slug}`} className="group block">
              <div className="overflow-hidden bg-[#e7e2d6] aspect-[4/3]">
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
              </div>
              {post.category && (
                <p className="text-xs font-medium tracked-wide uppercase text-[#8a1c2b] mt-4">
                  {post.category}
                </p>
              )}
              <p className="mt-2 font-medium leading-snug text-[#14130f] group-hover:text-[#8a1c2b] transition-colors">
                {post.title}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

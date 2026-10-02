// Ranked all-time performance for live blog posts. Shared by PostsManager
// (agent sites) and BrokeragePostsManager; counts come from
// usePostViewCounts and are page loads, not unique visitors.
function isLive(post) {
  const isDue = post.status === "scheduled" && post.scheduled_at && new Date(post.scheduled_at) <= new Date();
  return post.status === "published" || isDue;
}

export default function PostAnalytics({ posts, viewCounts, onEdit }) {
  const ranked = posts
    .filter(isLive)
    .map((post) => ({
      post,
      total: viewCounts[post.id]?.total || 0,
      last30: viewCounts[post.id]?.last30 || 0,
    }))
    .sort((a, b) => b.total - a.total || b.last30 - a.last30);

  if (ranked.length === 0) {
    return <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No published posts yet — analytics show up once a post is live.</p>;
  }

  const totalViews = ranked.reduce((sum, r) => sum + r.total, 0);
  const total30 = ranked.reduce((sum, r) => sum + r.last30, 0);
  const max = Math.max(...ranked.map((r) => r.total), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="All-time views" value={totalViews} />
        <Stat label="Last 30 days" value={total30} />
        <Stat label="Top post" value={ranked[0].total > 0 ? ranked[0].post.title : "—"} small />
      </div>

      <ol className="space-y-2">
        {ranked.map(({ post, total, last30 }, i) => (
          <li key={post.id}>
            <button
              type="button"
              onClick={() => onEdit(post)}
              className="w-full text-left border border-black/10 dark:border-white/15 rounded-xl p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-5 text-xs font-semibold text-[#1c1a17]/40 dark:text-[#faf9f7]/40 shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                    {post.category ? `${post.category} · ` : ""}
                    {post.post_date}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{total.toLocaleString()}</p>
                  <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{last30.toLocaleString()} in 30d</p>
                </div>
              </div>
              <div className="mt-2 ml-8 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-[#ed2127] dark:bg-[#f2454b]" style={{ width: `${(total / max) * 100}%` }} />
              </div>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40">Counts are page loads, not unique visitors.</p>
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3 min-w-0">
      <p className="text-[11px] font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{label}</p>
      <p className={`font-semibold truncate ${small ? "text-sm mt-1.5" : "text-xl"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

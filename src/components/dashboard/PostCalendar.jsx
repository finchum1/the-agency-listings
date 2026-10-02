import { useState } from "react";

// Shared by PostsManager (agent sites) and BrokeragePostsManager (brokerage
// site) as an alternative to the flat post list — lets an agent see their
// Draft/Scheduled/Published posts laid out across the month instead of as
// a stack of rows, which is the more natural way to think about "what's
// going out when."

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toDateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A post's anchor date on the calendar: a scheduled post shows on the day
// it'll actually go live (scheduled_at), not the day it was written
// (post_date) — those can differ, and "when does this publish" is what
// matters for planning.
function anchorDateKey(post) {
  if (post.status === "scheduled" && post.scheduled_at) {
    return toDateKey(new Date(post.scheduled_at));
  }
  return post.post_date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_DAY = 3;

export default function PostCalendar({ posts, onEdit, onAddDate, viewCounts = {} }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const postsByDate = {};
  posts.forEach((post) => {
    const key = anchorDateKey(post);
    if (!key) return;
    (postsByDate[key] ||= []).push(post);
  });

  const firstOfMonth = startOfMonth(month);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const todayKey = toDateKey(new Date());
  const monthLabel = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const isLivePost = (post) =>
    post.status === "published" ||
    (post.status === "scheduled" && post.scheduled_at && new Date(post.scheduled_at) <= new Date());

  const statusClass = (post) => {
    if (isLivePost(post)) return "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400";
    if (post.status === "scheduled") return "bg-amber-600/15 text-amber-700 dark:text-amber-400";
    return "bg-black/10 dark:bg-white/10 text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="text-sm font-semibold min-w-[9rem] text-center">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#1c1a17]/60 dark:text-[#faf9f7]/60"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(new Date()))}
          className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
        >
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/10">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="bg-[#faf9f7] dark:bg-[#141414] px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#1c1a17]/40 dark:text-[#faf9f7]/40"
          >
            {w}
          </div>
        ))}
        {days.map((d) => {
          const key = toDateKey(d);
          const dayPosts = postsByDate[key] || [];
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              onClick={() => dayPosts.length === 0 && onAddDate?.(key)}
              className={`bg-white dark:bg-[#1a1a1a] min-h-[5.5rem] p-1.5 flex flex-col gap-1 ${inMonth ? "" : "opacity-40"} ${
                dayPosts.length === 0 ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]" : ""
              }`}
            >
              <span
                className={`text-[11px] font-medium self-start ${
                  isToday
                    ? "h-5 w-5 flex items-center justify-center rounded-full bg-[#ed2127] dark:bg-[#f2454b] text-white"
                    : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50"
                }`}
              >
                {d.getDate()}
              </span>
              <div className="flex flex-col gap-1">
                {dayPosts.slice(0, MAX_PER_DAY).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(post);
                    }}
                    className={`text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium ${statusClass(post)}`}
                    title={isLivePost(post) ? `${post.title} — ${viewCounts[post.id]?.total || 0} views` : post.title}
                  >
                    {post.title}
                    {isLivePost(post) && (
                      <span className="opacity-70"> · {viewCounts[post.id]?.total || 0}</span>
                    )}
                  </button>
                ))}
                {dayPosts.length > MAX_PER_DAY && (
                  <span className="text-[10px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40 px-1.5">
                    +{dayPosts.length - MAX_PER_DAY} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600/60" /> Published
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-600/60" /> Scheduled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-black/30 dark:bg-white/30" /> Draft
        </span>
      </div>
    </div>
  );
}

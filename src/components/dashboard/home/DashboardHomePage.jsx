import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useHomeSummary } from "../../../hooks/useHomeSummary";
import { useAgentTasks } from "../../../hooks/useAgentTasks";
import { usePeopleSummary } from "../../../hooks/usePeopleSummary";
import { usePostViewCounts } from "../../../hooks/usePostViewCounts";
import { agoLabel, daysBetween, toKey } from "../../../lib/homeDates";
import TasksCard from "./TasksCard";
import { card, muted } from "./styles";

const primaryBtn =
  "flex w-full items-center justify-center rounded-full bg-[#ed2127] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-3 hover:opacity-90 transition-opacity";

const STATUS_WORD = { published: "Published", scheduled: "Scheduled", draft: "Draft" };
const STATUS_COLOR = {
  published: "text-emerald-700 dark:text-emerald-400",
  scheduled: "text-sky-700 dark:text-sky-400",
  draft: "text-[#1c1a17]/50 dark:text-[#faf9f7]/50",
};

// A compact blog tile: the one-click "write a post" button, a one-line status, and the latest few posts with their views.
function BlogCard({ posts, hasSite, today }) {
  const now = Date.now();
  const isLive = (p) => p.status === "published" || (p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() <= now);
  const published = posts.filter(isLive);
  const drafts = posts.filter((p) => p.status === "draft");
  const scheduled = posts.filter((p) => p.status === "scheduled" && !isLive(p));
  const last = published[0];
  const daysSince = last ? daysBetween(last.post_date, today) : null;

  let nudge;
  if (posts.length === 0) nudge = hasSite ? "Write your first post. Fresh content helps you get found on Google." : "Write your first post to get started.";
  else if (drafts.length > 0) nudge = `${drafts.length} draft${drafts.length === 1 ? " is" : "s are"} waiting to be finished.`;
  else if (daysSince !== null && daysSince >= 21) nudge = `It has been ${agoLabel(daysSince).replace(" ago", "")} since your last post.`;
  else if (last) nudge = `Last post went live ${agoLabel(daysSince)}.`;
  else nudge = "";

  const recent = posts.slice(0, 3);
  const views = usePostViewCounts("agent_post", recent.map((p) => p.id));

  return (
    <section className={`${card} flex flex-col`}>
      <h2 className="font-display text-lg font-semibold">Your blog</h2>
      <p className={`text-xs mt-1 ${muted}`}>
        {published.length} published · {drafts.length} draft{drafts.length === 1 ? "" : "s"}
        {scheduled.length > 0 && ` · ${scheduled.length} scheduled`}
      </p>
      {nudge && <p className="text-xs mt-1 text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{nudge}</p>}

      <Link to="/dashboard/site/blog?new=1" className={`${primaryBtn} mt-4`}>
        + Write a new post
      </Link>

      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
          {recent.map((p) => {
            const state = isLive(p) ? "published" : p.status;
            const v = views[p.id];
            return (
              <li key={p.id}>
                <Link to={`/dashboard/site/blog?edit=${p.id}`} className="block py-2 group">
                  <span className="block text-sm font-medium truncate group-hover:underline">{p.title || "Untitled"}</span>
                  <span className="block text-[11px] mt-0.5 truncate">
                    <span className={`font-semibold ${STATUS_COLOR[state] || STATUS_COLOR.draft}`}>{STATUS_WORD[state] || state}</span>
                    {isLive(p) && (
                      <span className={muted}>
                        {" "}
                        · {(v?.total || 0).toLocaleString()} views · {(v?.last30 || 0).toLocaleString()} in 30 days
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto pt-2">
        <Link to="/dashboard/site/blog" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          All blog posts →
        </Link>
      </div>
    </section>
  );
}

// The page agents land on after signing in: a welcome, a compact blog tile, their own task list, and what needs
// attention in People. Each part only appears for what that agent's account has switched on.
export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const tasksApi = useAgentTasks(user?.id);

  const wantsBlog = (profile?.site_access || "full") !== "none";
  const wantsPeople = !!profile?.people_enabled;
  const peopleSummary = usePeopleSummary(wantsPeople);
  const { posts, hasSite, loading } = useHomeSummary(user?.id, { wantsBlog, wantsListings: false });

  const first = (profile?.full_name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const today = toKey(now);
  const dateLine = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const tasksDue = tasksApi.tasks.filter((t) => !t.done && t.due_date && t.due_date <= today).length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const bits = [];
  if (peopleSummary?.dueNow > 0) bits.push(`${plural(peopleSummary.dueNow, "follow-up")} due today or overdue`);
  if (peopleSummary?.overdueTasks > 0) bits.push(`${plural(peopleSummary.overdueTasks, "overdue deal task")}`);
  if (tasksDue > 0) bits.push(`${plural(tasksDue, "task")} on your list due today or overdue`);
  const settled = !tasksApi.loading && (!wantsPeople || peopleSummary);
  const summary = !settled ? "Here's what's going on." : bits.length ? `You have ${bits.join(" and ")}.` : "You're all caught up.";

  return (
    <div className="max-w-6xl min-w-0 space-y-6">
      <header>
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>{dateLine}</p>
        <h1 className="text-3xl font-display font-semibold mt-1.5">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        <p className="text-sm mt-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
          {summary}
          {wantsPeople && (
            <>
              {" "}
              <Link to="/dashboard/people/overview" className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                Open People overview →
              </Link>
            </>
          )}
        </p>
      </header>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-3 items-start">
        {wantsBlog && !loading && <BlogCard posts={posts} hasSite={hasSite} today={today} />}
        <TasksCard tasksApi={tasksApi} span={!wantsBlog} />
      </div>
    </div>
  );
}

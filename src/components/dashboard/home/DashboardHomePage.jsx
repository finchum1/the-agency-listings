import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useHomeSummary } from "../../../hooks/useHomeSummary";
import { agoLabel, daysBetween, toKey } from "../../../lib/homeDates";
import PeopleHighlights from "./PeopleHighlights";
import { card, muted } from "./styles";
const primaryBtn =
  "inline-flex items-center justify-center rounded-full bg-[#ed2127] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-3 hover:opacity-90 transition-opacity";
const ghostBtn =
  "inline-flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-sm font-semibold px-5 py-3 hover:bg-black/5 dark:hover:bg-white/10 transition-colors";

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-semibold leading-none">{value}</p>
      <p className={`text-xs mt-1.5 ${muted}`}>{label}</p>
    </div>
  );
}

const STATUS_LOOK = {
  published: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  draft: "bg-black/5 dark:bg-white/10 text-[#1c1a17]/60 dark:text-[#faf9f7]/60",
};

// The agent's blog at a glance, with the one button they come here for.
function BlogCard({ posts, hasSite, today }) {
  const now = Date.now();
  const isLive = (p) => p.status === "published" || (p.status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at).getTime() <= now);
  const published = posts.filter(isLive);
  const drafts = posts.filter((p) => p.status === "draft");
  const scheduled = posts.filter((p) => p.status === "scheduled" && !isLive(p));
  const last = published[0];
  const daysSince = last ? daysBetween(last.post_date, today) : null;

  let nudge;
  if (!hasSite && posts.length === 0) nudge = "Write your first post. Fresh content is one of the best ways to get found on Google.";
  else if (posts.length === 0) nudge = "You haven't written a post yet. A short local update is a great place to start.";
  else if (drafts.length > 0) nudge = `${drafts.length} draft${drafts.length === 1 ? " is" : "s are"} waiting to be finished.`;
  else if (daysSince !== null && daysSince >= 21) nudge = `It has been ${agoLabel(daysSince).replace(" ago", "")} since your last post. A quick update keeps your site fresh.`;
  else if (last) nudge = `Your last post went live ${agoLabel(daysSince)}.`;
  else nudge = "Your next post is scheduled.";

  const recent = posts.slice(0, 4);

  return (
    <section className={`${card} lg:col-span-2 flex flex-col`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Your blog</h2>
          <p className={`text-sm mt-1 ${muted}`}>{nudge}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/dashboard/site/blog?new=1" className={primaryBtn}>
            + Write a new post
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pb-6 border-b border-black/5 dark:border-white/10">
        <Stat label="Published" value={published.length} />
        <Stat label="Drafts" value={drafts.length} />
        <Stat label="Scheduled" value={scheduled.length} />
      </div>

      {recent.length > 0 ? (
        <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
          {recent.map((p) => {
            const label = isLive(p) ? "published" : p.status;
            return (
              <li key={p.id}>
                <Link to={`/dashboard/site/blog?edit=${p.id}`} className="flex items-center gap-3 py-2.5 group">
                  <span className="min-w-0 flex-1 text-sm font-medium truncate group-hover:underline">{p.title || "Untitled"}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_LOOK[label] || STATUS_LOOK.draft}`}>{label}</span>
                  <span className={`shrink-0 text-xs hidden sm:block w-24 text-right ${muted}`}>
                    {new Date(`${p.post_date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-auto pt-4">
        <Link to="/dashboard/site/blog" className="text-sm font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          All blog posts →
        </Link>
      </div>
    </section>
  );
}

function ListingsCard({ listings, span }) {
  const count = (s) => listings.filter((l) => l.status === s).length;
  return (
    <section className={`${card} flex flex-col ${span ? "lg:col-span-3" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Your listings</h2>
        <Link to="/dashboard/listings/new" className={ghostBtn.replace("px-5 py-3", "px-4 py-2")}>
          + Add
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 mt-6">
        <Stat label="For sale" value={count("for_sale")} />
        <Stat label="Coming soon" value={count("coming_soon")} />
        <Stat label="Pending" value={count("pending")} />
        <Stat label="Drafts" value={count("draft")} />
      </div>
      <div className="mt-auto pt-5">
        <Link to="/dashboard/listings" className="text-sm font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          All listings →
        </Link>
      </div>
    </section>
  );
}

// The page agents land on after signing in: a welcome, their blog (with a one-click "write a post"), what needs attention
// in People, and their listings. Each part only appears for what that agent's account has switched on.
export default function DashboardHomePage() {
  const { user, profile } = useAuth();
  const [peopleSummary, setPeopleSummary] = useState(null);

  const wantsBlog = (profile?.site_access || "full") !== "none";
  const wantsPeople = !!profile?.people_enabled;
  const { posts, hasSite, listings, loading } = useHomeSummary(user?.id, { wantsBlog, wantsListings: true });

  const first = (profile?.full_name || "").trim().split(/\s+/)[0];
  const now = new Date();
  const today = toKey(now);
  const dateLine = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  let summary = "Here's what's going on.";
  if (peopleSummary) {
    const bits = [];
    if (peopleSummary.dueNow > 0) bits.push(`${peopleSummary.dueNow} follow-up${peopleSummary.dueNow === 1 ? "" : "s"} due today or overdue`);
    if (peopleSummary.overdueTasks > 0) bits.push(`${peopleSummary.overdueTasks} overdue task${peopleSummary.overdueTasks === 1 ? "" : "s"}`);
    summary = bits.length ? `You have ${bits.join(" and ")}.` : "You're all caught up on follow-ups and tasks.";
  }

  return (
    <div className="max-w-6xl min-w-0 space-y-6">
      <header>
        <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>{dateLine}</p>
        <h1 className="text-3xl font-display font-semibold mt-1.5">{first ? `Welcome, ${first}` : "Welcome"}</h1>
        <p className="text-sm mt-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{summary}</p>
      </header>

      {loading ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : (
        <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-3">
          {wantsBlog && <BlogCard posts={posts} hasSite={hasSite} today={today} />}
          <ListingsCard listings={listings} span={!wantsBlog} />
        </div>
      )}

      {wantsPeople && <PeopleHighlights onSummary={setPeopleSummary} />}
    </div>
  );
}

import { useMemo } from "react";
import { useAgentSiteEditor } from "../../hooks/useAgentSiteEditor";
import { useSiteAnalytics } from "../../hooks/useSiteAnalytics";
import SiteForm from "./SiteForm";
import TestimonialsManager from "./TestimonialsManager";
import AreasManager from "./AreasManager";
import PostsManager from "./PostsManager";
import PeriodAnalyticsPanel from "./PeriodAnalyticsPanel";

// Shared editor for an agent's personal site — used both as "My Site"
// (agentId = the logged-in user, everyone has access) and, for admins, to
// edit any other agent's site from the Sites list. A site is 1:1 with an
// agent and is created automatically on first visit (see
// useAgentSiteEditor), so there's no separate "new site" flow to build.
//
// siteAccess ("full" | "limited", default "full") gates everything
// except Blog Posts — for an agent whose profiles.site_access is
// "limited" viewing their own "My Site" (see MySitePage.jsx, which is
// the only caller that ever passes anything other than the default).
// EditAgentSitePage.jsx (admin editing someone else's site) never passes
// this at all, so an admin always sees the full editor regardless of the
// agent's own access level — this is purely about what the agent sees
// when THEY log in, not a real permission boundary (RLS still governs
// what each table actually allows; this only hides UI).
export default function SiteEditor({ agentId, agentName, heading, siteAccess = "full" }) {
  const limited = siteAccess === "limited";
  const { site, testimonials, areas, posts, loading, error, refresh } = useAgentSiteEditor(
    agentId,
    agentName,
  );

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const analytics = useSiteAnalytics({ siteId: site?.id, postIds });

  const periodViewSources = useMemo(
    () => [
      { targetType: "agent_site", targetIds: site ? [site.id] : [] },
      { targetType: "agent_post", targetIds: postIds },
    ],
    [site, postIds],
  );
  const periodLeadSources = useMemo(() => [{ targetType: "agent_site", targetIds: site ? [site.id] : [] }], [site]);

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!site) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">{heading || (limited ? "Blog" : "My Site")}</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          {limited
            ? "Write and manage your blog posts."
            : "Your bio, testimonials, areas of expertise, and blog posts. Your listings show automatically — no separate step needed."}
        </p>
      </div>

      <PeriodAnalyticsPanel
        totals={analytics}
        viewSources={periodViewSources}
        leadSources={periodLeadSources}
        viewsLabel="Site Views"
      />

      {!limited && <SiteForm site={site} onSaved={refresh} />}
      {!limited && <TestimonialsManager agentSiteId={site.id} testimonials={testimonials} onChanged={refresh} />}
      {!limited && <AreasManager agentSiteId={site.id} areas={areas} onChanged={refresh} />}
      <PostsManager agentSiteId={site.id} agentId={agentId} posts={posts} onChanged={refresh} />
    </div>
  );
}

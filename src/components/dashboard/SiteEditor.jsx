import { useMemo } from "react";
import { useAgentSiteEditor } from "../../hooks/useAgentSiteEditor";
import { useSiteAnalytics } from "../../hooks/useSiteAnalytics";
import SiteForm from "./SiteForm";
import TestimonialsManager from "./TestimonialsManager";
import AreasManager from "./AreasManager";
import PostsManager from "./PostsManager";
import AnalyticsStats from "./AnalyticsStats";

// Shared editor for an agent's personal site — used both as "My Site"
// (agentId = the logged-in user, everyone has access) and, for admins, to
// edit any other agent's site from the Sites list. A site is 1:1 with an
// agent and is created automatically on first visit (see
// useAgentSiteEditor), so there's no separate "new site" flow to build.
export default function SiteEditor({ agentId, agentName, heading }) {
  const { site, testimonials, areas, posts, loading, error, refresh } = useAgentSiteEditor(
    agentId,
    agentName,
  );

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const analytics = useSiteAnalytics({ siteId: site?.id, postIds });

  if (loading) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!site) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">{heading || "My Site"}</h1>
        <p className="text-sm text-[#1c1a17]/60 mt-1">
          Your bio, testimonials, areas of expertise, and blog posts. Your listings show
          automatically — no separate step needed.
        </p>
      </div>

      <AnalyticsStats stats={analytics} viewsLabel="Site Views" />

      <SiteForm site={site} onSaved={refresh} />
      <TestimonialsManager agentSiteId={site.id} testimonials={testimonials} onChanged={refresh} />
      <AreasManager agentSiteId={site.id} areas={areas} onChanged={refresh} />
      <PostsManager agentSiteId={site.id} agentId={agentId} posts={posts} onChanged={refresh} />
    </div>
  );
}

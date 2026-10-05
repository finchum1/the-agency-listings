import { useMemo } from "react";
import { useAgentSiteEditor } from "../../hooks/useAgentSiteEditor";
import { useSiteAnalytics } from "../../hooks/useSiteAnalytics";
import SiteForm from "./SiteForm";
import TestimonialsManager from "./TestimonialsManager";
import AreasManager from "./AreasManager";
import PostsManager from "./PostsManager";
import PeriodAnalyticsPanel from "./PeriodAnalyticsPanel";

// Shared editor for an agent's personal site — used both for an agent's
// own "My Site" pages and, for admins, to edit any other agent's site from
// the Sites list. A site is 1:1 with an agent and is created automatically
// on first visit (see useAgentSiteEditor), so there's no separate "new
// site" flow to build.
//
// `section` picks which single part to show — an agent's My Site is one
// page per section (see App.jsx / DashboardLayout.jsx). Left undefined
// (the admin editor), every section is stacked on one page. Which
// sections an agent may open is decided by routing (MySitePage.jsx, from
// profiles.site_access); this is UI only — RLS still governs what each
// table actually allows.
const SECTIONS = {
  analytics: {
    title: "Analytics",
    blurb: "How many people are visiting your site and reaching out.",
  },
  details: {
    title: "Site Details",
    blurb: "Your bio, photo, theme, contact info, and everything else about how your site looks.",
  },
  testimonials: {
    title: "Testimonials",
    blurb: "What past clients say about working with you.",
  },
  areas: {
    title: "Areas of Expertise",
    blurb: "The neighborhoods and communities you serve.",
  },
  blog: {
    title: "Blog Posts",
    blurb: "Write and manage your blog posts.",
  },
};

export default function SiteEditor({ agentId, agentName, heading, section }) {
  const { site, testimonials, areas, posts, loading, error, refresh } = useAgentSiteEditor(
    agentId,
    agentName,
  );

  const show = (key) => !section || section === key;

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

  const meta = section ? SECTIONS[section] : null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">{heading || meta?.title || "My Site"}</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          {meta
            ? meta.blurb
            : "Your bio, testimonials, areas of expertise, and blog posts. Your listings show automatically — no separate step needed."}
        </p>
      </div>

      {show("analytics") && (
        <PeriodAnalyticsPanel
          totals={analytics}
          viewSources={periodViewSources}
          leadSources={periodLeadSources}
          viewsLabel="Site Views"
        />
      )}

      {show("details") && <SiteForm site={site} onSaved={refresh} />}
      {show("testimonials") && <TestimonialsManager agentSiteId={site.id} testimonials={testimonials} onChanged={refresh} />}
      {show("areas") && <AreasManager agentSiteId={site.id} areas={areas} onChanged={refresh} />}
      {show("blog") && <PostsManager agentSiteId={site.id} agentId={agentId} posts={posts} onChanged={refresh} />}
    </div>
  );
}

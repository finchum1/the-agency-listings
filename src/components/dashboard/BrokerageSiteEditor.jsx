import { useMemo } from "react";
import { useBrokerageSiteEditor } from "../../hooks/useBrokerageSiteEditor";
import { useBrokerageSiteAnalytics } from "../../hooks/useBrokerageSiteAnalytics";
import BrokerageSiteForm from "./BrokerageSiteForm";
import BrokeragePostsManager from "./BrokeragePostsManager";
import BrokerageAgentsManager from "./BrokerageAgentsManager";
import BrokerageAreasManager from "./BrokerageAreasManager";
import PeriodAnalyticsPanel from "./PeriodAnalyticsPanel";

// Admin-only editor for the one brokerage site (/dashboard/brokerage-site
// — see ProtectedRoute adminOnly in App.jsx). Parallel to SiteEditor.jsx,
// minus testimonials (agent-specific).
export default function BrokerageSiteEditor() {
  const { site, posts, agents, areas, loading, error, refresh } = useBrokerageSiteEditor();

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const analytics = useBrokerageSiteAnalytics({ siteId: site?.id, postIds });

  const periodViewSources = useMemo(
    () => [
      { targetType: "brokerage_site", targetIds: site ? [site.id] : [] },
      { targetType: "brokerage_post", targetIds: postIds },
    ],
    [site, postIds],
  );
  // Leads: the Home Valuation form is the only lead-generating form on
  // the brokerage site today (the main Contact page is mailto/tel-only —
  // see ContactCard.jsx) — stored as target_type "brokerage_valuation"
  // (see api/contact.js, supabase/brokerage-valuation-leads.sql).
  const periodLeadSources = useMemo(
    () => [{ targetType: "brokerage_valuation", targetIds: site ? [site.id] : [] }],
    [site],
  );

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!site) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">Brokerage Site</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          The office's own public site at /brokerage — hero, about, areas of expertise, blog, and
          the agent roster. Customizable the same way an agent's own site is: template, accent
          color, font pairing, logo, and which sections show on the home page.
        </p>
      </div>

      <PeriodAnalyticsPanel
        totals={analytics}
        viewSources={periodViewSources}
        leadSources={periodLeadSources}
        viewsLabel="Site Views"
      />

      <BrokerageSiteForm site={site} onSaved={refresh} />
      <BrokerageAgentsManager brokerageSiteId={site.id} agents={agents} onChanged={refresh} />
      <BrokerageAreasManager brokerageSiteId={site.id} areas={areas} onChanged={refresh} />
      <BrokeragePostsManager brokerageSiteId={site.id} posts={posts} onChanged={refresh} />
    </div>
  );
}

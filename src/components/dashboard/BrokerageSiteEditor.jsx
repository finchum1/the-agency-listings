import { useBrokerageSiteEditor } from "../../hooks/useBrokerageSiteEditor";
import BrokerageSiteForm from "./BrokerageSiteForm";
import BrokeragePostsManager from "./BrokeragePostsManager";
import BrokerageAgentsManager from "./BrokerageAgentsManager";
import BrokerageAreasManager from "./BrokerageAreasManager";

// Admin-only editor for the one brokerage site (/dashboard/brokerage-site
// — see ProtectedRoute adminOnly in App.jsx). Parallel to SiteEditor.jsx,
// minus testimonials (agent-specific) and analytics (no per-post view
// tracking wired up for brokerage posts yet).
export default function BrokerageSiteEditor() {
  const { site, posts, agents, areas, loading, error, refresh } = useBrokerageSiteEditor();

  if (loading) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!site) return null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-display font-semibold">Brokerage Site</h1>
        <p className="text-sm text-[#1c1a17]/60 mt-1">
          The office's own public site at /brokerage — hero, about, areas of expertise, blog, and
          the agent roster. Customizable the same way an agent's own site is: template, accent
          color, font pairing, logo, and which sections show on the home page.
        </p>
      </div>

      <BrokerageSiteForm site={site} onSaved={refresh} />
      <BrokerageAgentsManager brokerageSiteId={site.id} agents={agents} onChanged={refresh} />
      <BrokerageAreasManager brokerageSiteId={site.id} areas={areas} onChanged={refresh} />
      <BrokeragePostsManager brokerageSiteId={site.id} posts={posts} onChanged={refresh} />
    </div>
  );
}

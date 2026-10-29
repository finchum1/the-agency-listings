import { useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useBrokerageSiteEditor } from "../../hooks/useBrokerageSiteEditor";
import BrokerageSiteForm from "./BrokerageSiteForm";
import BrokeragePostsManager from "./BrokeragePostsManager";
import BrokerageAgentsManager from "./BrokerageAgentsManager";
import BrokerageAreasManager from "./BrokerageAreasManager";
import SiteAnalytics from "./SiteAnalytics";
import SiteWorkspace from "./SiteWorkspace";

const BASE = "/dashboard/brokerage-site";
// The pages of the brokerage's site. `hash` points at one accordion section of the form (BrokerageSiteForm), so each reads as a page of its own.
const GROUPS = [
  {
    title: "Content",
    items: [
      { key: "details", hash: "content", label: "Tagline, hero and about" },
      { key: "agents", label: "Agent roster" },
      { key: "areas", label: "Areas of expertise" },
      { key: "blog", label: "Blog posts" },
    ],
  },
  {
    title: "Design",
    items: [
      { key: "details", hash: "design", label: "Template and design" },
      { key: "details", hash: "home", label: "Home page sections" },
    ],
  },
  {
    title: "Settings",
    items: [
      { key: "details", hash: "contact", label: "Contact and social" },
      { key: "details", hash: "seo", label: "SEO and sharing" },
      { key: "details", hash: "domain", label: "Custom domain" },
    ],
  },
  { title: "Insights", items: [{ key: "analytics", label: "Analytics" }] },
];
const SECTIONS = [...new Set(GROUPS.flatMap((g) => g.items.map((i) => i.key)))];
const address = (i) => `${BASE}/${i.key}${i.hash ? `#${i.hash}` : ""}`;

// Admin-only editor for the one brokerage site (/dashboard/brokerage-site/:section? — see ProtectedRoute adminOnly in App.jsx). Parallel to the agent
// site editor: the same menu of pages down the left, one page at a time on the right, Draft / Live and a setup list at the top. No testimonials
// (agent-specific).
export default function BrokerageSiteEditor() {
  const { section = "details" } = useParams();
  const location = useLocation();
  const hash = location.hash.replace(/^#/, "");
  const { site, posts, agents, areas, loading, error, refresh } = useBrokerageSiteEditor();

  const checklist = useMemo(() => {
    if (!site) return [];
    const item = (key, label, done, page) => ({ key, label, done, to: address(page) });
    return [
      item("tagline", "Tagline", Boolean(site.tagline?.trim()), { key: "details", hash: "content" }),
      item("hero", "Hero photo", Boolean(site.hero_photo_url || site.hero_video_url), { key: "details", hash: "content" }),
      item("about", "About text", Boolean(String(site.about_html || "").replace(/<[^>]*>/g, "").trim()), { key: "details", hash: "content" }),
      item("agents", "An agent on the roster", agents.length > 0, { key: "agents" }),
      item("areas", "An area of expertise", areas.length > 0, { key: "areas" }),
      item("domain", "Custom domain", Boolean(site.custom_domain), { key: "details", hash: "domain" }),
    ];
  }, [site, agents, areas]);

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!site) return null;
  if (!SECTIONS.includes(section)) return <Navigate to={`${BASE}/details`} replace />;

  const changeStatus = async (status) => {
    const { error: err } = await supabase.from("brokerage_site").update({ status }).eq("id", site.id);
    if (err) return err.message;
    window.dispatchEvent(new CustomEvent("brokerage-site-status", { detail: { status } })); // the form follows, keeping what has been typed
    refresh();
    return "";
  };

  return (
    <SiteWorkspace
      title="Brokerage site"
      viewHref="/brokerage"
      groups={GROUPS}
      address={address}
      section={section}
      hash={section === "details" && !hash ? "content" : hash}
      status={site.status}
      onStatusChange={changeStatus}
      checklist={checklist}
    >
      <div className={section === "analytics" ? "max-w-5xl" : "max-w-3xl"}>
        {section === "details" && <BrokerageSiteForm site={site} onSaved={refresh} focus={hash || "content"} />}
        {section === "agents" && <BrokerageAgentsManager brokerageSiteId={site.id} agents={agents} onChanged={refresh} />}
        {section === "areas" && <BrokerageAreasManager brokerageSiteId={site.id} areas={areas} onChanged={refresh} />}
        {section === "blog" && <BrokeragePostsManager brokerageSiteId={site.id} posts={posts} onChanged={refresh} />}
        {section === "analytics" && <SiteAnalytics site={site} kind="brokerage" />}
      </div>
    </SiteWorkspace>
  );
}

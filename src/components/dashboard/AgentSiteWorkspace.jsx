import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import useSiteSummary from "../../hooks/useSiteSummary";
import SiteEditor from "./SiteEditor";
import SiteWorkspace from "./SiteWorkspace";

// The pages of an agent's site, grouped by what you are doing. `hash` points at one accordion section of the Site Details form (SiteForm), so
// each reads as a page of its own; the others are pages of the editor (see SiteEditor's sections).
const GROUPS = [
  {
    title: "Content",
    items: [
      { key: "details", hash: "basic", label: "Basic info" },
      { key: "details", hash: "photos", label: "Photos, video and bio" },
      { key: "testimonials", label: "Testimonials" },
      { key: "areas", label: "Areas of expertise" },
      { key: "blog", label: "Blog posts" },
      { key: "sales", label: "Past sales" },
    ],
  },
  {
    title: "Design",
    items: [
      { key: "details", hash: "design", label: "Template and design" },
      { key: "details", hash: "home", label: "Home page sections" },
      { key: "details", hash: "cards", label: "Buyer and seller cards" },
      { key: "compare", label: "Compare templates" },
    ],
  },
  {
    title: "Settings",
    items: [
      { key: "details", hash: "social", label: "Social media" },
      { key: "details", hash: "seo", label: "SEO and sharing" },
      { key: "details", hash: "domain", label: "Custom domain" },
      { key: "details", hash: "idx", label: "Home search (IDX)" },
      { key: "redirects", label: "Redirects" },
    ],
  },
  { title: "Insights", items: [{ key: "analytics", label: "Analytics" }] },
];
export const AGENT_SITE_SECTIONS = [...new Set(GROUPS.flatMap((g) => g.items.map((i) => i.key)))];

// What a site needs to look finished: each item says whether it is done and where to go to do it.
function checklistFor(summary, address) {
  const site = summary?.site;
  if (!site) return [];
  const hasBio = Boolean(String(site.bio_html || "").replace(/<[^>]*>/g, "").trim() || (site.bio && site.bio.length));
  const item = (key, label, done, page) => ({ key, label, done, to: address(page) });
  return [
    item("tagline", "Tagline", Boolean(site.tagline?.trim()), { key: "details", hash: "basic" }),
    item("photo", "Hero photo", Boolean(site.hero_photo_url || site.hero_video_url), { key: "details", hash: "photos" }),
    item("bio", "Bio", hasBio, { key: "details", hash: "photos" }),
    item("testimonials", "A testimonial", summary.counts.testimonials > 0, { key: "testimonials" }),
    item("areas", "An area of expertise", summary.counts.areas > 0, { key: "areas" }),
    item("domain", "Custom domain", Boolean(site.custom_domain), { key: "details", hash: "domain" }),
  ];
}

/**
 * An agent's site editor with its menu, header and setup list. `mode` "admin" edits someone else's site (addresses under /dashboard/sites/<id>), "self" the
 * signed-in agent's own (under /dashboard/site). `limited` is an agent who may only write blog posts: just that page, no menu.
 */
export default function AgentSiteWorkspace({ agentId, agentName, mode, section, hash }) {
  const base = mode === "admin" ? `/dashboard/sites/${agentId}` : "/dashboard/site";
  const address = (i) => `${base}/${i.key}${i.hash ? `#${i.hash}` : ""}`;
  const { summary, setStatus } = useSiteSummary(agentId);
  const checklist = useMemo(() => checklistFor(summary, address), [summary, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const site = summary?.site;

  if (!AGENT_SITE_SECTIONS.includes(section)) return <Navigate to={`${base}/details`} replace />;

  const changeStatus = async (status) => {
    const { error } = await supabase.from("agent_sites").update({ status }).eq("id", site.id);
    if (error) return error.message;
    setStatus(status);
    window.dispatchEvent(new CustomEvent("agent-site-status", { detail: { status } })); // the Site Details form follows, keeping what has been typed
    return "";
  };

  return (
    <SiteWorkspace
      title={mode === "admin" ? `${agentName}'s Site` : "My website"}
      back={mode === "admin" ? { to: "/dashboard/sites", label: "← All sites" } : null}
      viewHref={site ? `/sites/${site.slug}` : null}
      groups={GROUPS}
      address={address}
      section={section}
      hash={section === "details" && !hash ? "basic" : hash}
      status={site?.status}
      onStatusChange={site ? changeStatus : null}
      checklist={checklist}
    >
      <SiteEditor key={`${agentId}-${section}`} agentId={agentId} agentName={agentName} section={section} hideHeader focus={section === "details" ? hash || "basic" : undefined} />
    </SiteWorkspace>
  );
}

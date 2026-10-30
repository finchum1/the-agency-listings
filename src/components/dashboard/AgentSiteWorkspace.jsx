import { useEffect, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import useSiteSummary from "../../hooks/useSiteSummary";
import SiteEditor from "./SiteEditor";
import SiteWorkspace from "./SiteWorkspace";
import { SITE_GROUP_KEYS, SITE_GROUPS, partAnchor, siteGroup, locateSitePart } from "../../lib/siteGroups";

// The site editor is four pages — Content, Design, Settings and Insights (lib/siteGroups.js) — each one scrolling through all of its parts. The Website
// entry in the dashboard menu opens them (hover it for the list). An address that names a single part (/site/blog, /site/details#domain) goes to the
// page that part is on, scrolled to it.
export const AGENT_SITE_SECTIONS = [...SITE_GROUP_KEYS, ...new Set(SITE_GROUPS.flatMap((g) => g.items.map((i) => i.key)))];

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
  const location = useLocation();
  const base = mode === "admin" ? `/dashboard/sites/${agentId}` : "/dashboard/site";
  // The address of a part of the editor: its page, scrolled to it.
  const address = (i) => {
    const at = locateSitePart(i.key, i.hash);
    return `${base}/${at.group}#${at.anchor}`;
  };
  const { summary, setStatus } = useSiteSummary(agentId);
  const checklist = useMemo(() => checklistFor(summary, address), [summary, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const site = summary?.site;

  // Bring the part named in the address into view once the page has loaded it.
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(hash);
      if (el || ++tries > 30) {
        clearInterval(timer);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [section, hash]);

  const group = siteGroup(section);
  if (!AGENT_SITE_SECTIONS.includes(section)) return <Navigate to={`${base}/content`} replace />;
  if (!group) {
    const at = locateSitePart(section, hash);
    return <Navigate to={`${base}/${at.group}${location.search}#${at.anchor}`} replace />;
  }

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
      status={site?.status}
      onStatusChange={site ? changeStatus : null}
      checklist={checklist}
    >
      {/* The four pages of the editor, and under them the parts of the one showing (a page is long, so those are jump links). Both stay in view while it scrolls. */}
      <div className="sticky top-[3.4rem] z-20 -mx-1 mb-4 bg-[#faf9f7] dark:bg-[#0d0d0d] px-1 pt-2">
        <nav aria-label="Site pages" className="flex flex-wrap items-center gap-1 border-b border-black/10 dark:border-white/15">
          {SITE_GROUPS.map((g) => (
            <Link
              key={g.key}
              to={`${base}/${g.key}`}
              aria-current={g.key === section ? "page" : undefined}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                g.key === section ? "border-[#1c1a17] dark:border-[#faf9f7] text-[#1c1a17] dark:text-[#faf9f7]" : "border-transparent text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              }`}
            >
              {g.title}
            </Link>
          ))}
        </nav>
        <nav aria-label={`${group.title} on this page`} className="flex flex-wrap items-center gap-1.5 py-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/45 dark:text-[#faf9f7]/45">Jump to</span>
          {group.items.map((item) => (
            <button
              key={partAnchor(item)}
              type="button"
              onClick={() => document.getElementById(partAnchor(item))?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <SiteEditor key={`${agentId}-${section}`} agentId={agentId} agentName={agentName} group={section} hideHeader />
    </SiteWorkspace>
  );
}

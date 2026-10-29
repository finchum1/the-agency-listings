import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import useSiteSummary from "../../hooks/useSiteSummary";
import SiteEditor from "./SiteEditor";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

// The pages of a site, grouped by what you are doing. `hash` points at one of the accordion sections on the Site Details page (SiteForm), so those
// read as pages of their own here; the others are pages of the editor (see SiteEditor's sections).
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
const SECTION_KEYS = [...new Set(GROUPS.flatMap((g) => g.items.map((i) => i.key)))];
const hrefFor = (agentId, item) => `/dashboard/sites/${agentId}/${item.key}${item.hash ? `#${item.hash}` : ""}`;

// What a site needs to look finished: each item says whether it is done and where to go to do it.
function checklist(summary) {
  const site = summary?.site;
  if (!site) return [];
  const hasBio = Boolean(String(site.bio_html || "").replace(/<[^>]*>/g, "").trim() || (site.bio && site.bio.length));
  return [
    { key: "tagline", label: "Tagline", done: Boolean(site.tagline?.trim()), item: { key: "details", hash: "basic" } },
    { key: "photo", label: "Hero photo", done: Boolean(site.hero_photo_url || site.hero_video_url), item: { key: "details", hash: "photos" } },
    { key: "bio", label: "Bio", done: hasBio, item: { key: "details", hash: "photos" } },
    { key: "testimonials", label: "A testimonial", done: summary.counts.testimonials > 0, item: { key: "testimonials" } },
    { key: "areas", label: "An area of expertise", done: summary.counts.areas > 0, item: { key: "areas" } },
    { key: "domain", label: "Custom domain", done: Boolean(site.custom_domain), item: { key: "details", hash: "domain" } },
  ];
}

function SiteMenu({ agentId, section, hash }) {
  const navigate = useNavigate();
  // The Site Details page opens on Basic info, so that is the page you are on when there is no section in the address.
  const here = section === "details" && !hash ? "basic" : hash;
  const isActive = (item) => item.key === section && (item.hash ? item.hash === here : true);
  const values = GROUPS.flatMap((g) => g.items.map((i) => ({ i, value: hrefFor(agentId, i) })));
  const current = values.find(({ i }) => isActive(i))?.value || "";
  return (
    <>
      {/* A phone or narrow window: one menu to pick the page from. */}
      <label className="block lg:hidden">
        <span className="sr-only">Page</span>
        <select value={current} onChange={(e) => navigate(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-3 py-2.5 text-sm font-medium">
          {GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => (
                <option key={hrefFor(agentId, i)} value={hrefFor(agentId, i)}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <nav aria-label="Site pages" className="hidden lg:block sticky top-[4.5rem] self-start w-56 shrink-0 space-y-5">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className={`px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider-plus ${muted}`}>{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const active = isActive(i);
                return (
                  <li key={hrefFor(agentId, i)}>
                    <Link
                      to={hrefFor(agentId, i)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-[#1c1a17]/10 dark:bg-[#faf9f7]/10 font-semibold text-[#1c1a17] dark:text-[#faf9f7]" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

// Draft or Live, changed from the top of the page. The form below follows it (it keeps whatever has been typed).
function StatusSwitch({ summary, setStatus }) {
  const site = summary?.site;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!site) return null;
  const change = async (status) => {
    if (status === site.status || busy) return;
    const ok = status === "published" ? confirm("Make this site live? Anyone with the address can see it.") : confirm("Take this site offline and back to a draft?");
    if (!ok) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("agent_sites").update({ status }).eq("id", site.id);
    setBusy(false);
    if (err) return setError(err.message);
    setStatus(status);
    window.dispatchEvent(new CustomEvent("agent-site-status", { detail: { status } }));
  };
  const option = (value, label) => (
    <button
      type="button"
      onClick={() => change(value)}
      aria-pressed={site.status === value}
      disabled={busy}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        site.status === value ? (value === "published" ? "bg-emerald-600 text-white" : "bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]") : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label="Site status" className="inline-flex rounded-full border border-black/10 dark:border-white/15 p-0.5">
        {option("draft", "Draft")}
        {option("published", "Live")}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function SetupChecklist({ agentId, summary }) {
  const items = useMemo(() => checklist(summary), [summary]);
  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const missing = items.filter((i) => !i.done);
  return (
    <section aria-label="Setup" className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-semibold">{missing.length === 0 ? "Everything is set up" : `Setup: ${done} of ${items.length} done`}</p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/10 dark:bg-white/15" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        {missing.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {missing.map((m) => (
              <li key={m.key}>
                <Link to={hrefFor(agentId, m.item)} className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">
                  <span aria-hidden="true">+</span> {m.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Admin-only: edit any agent's site by their profile id (route /dashboard/sites/:agentId/:section?). Self-editing goes through MySitePage
// instead — same underlying SiteEditor either way. The pages of the site are a menu down the left of this page (a dropdown on a narrow screen), so
// the dashboard's own menu stays a single "Agent Sites" entry no matter whose site is open. The top of the page holds the agent's name, Draft / Live,
// a link to the site, and what is still missing.
export default function EditAgentSitePage() {
  const { agentId, section = "details" } = useParams();
  const location = useLocation();
  const hash = location.hash.replace(/^#/, "");
  const [agent, setAgent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const { summary, setStatus } = useSiteSummary(agentId);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", agentId)
      .single()
      .then(({ data }) => {
        if (!data) setNotFound(true);
        setAgent(data);
      });
  }, [agentId]);

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-4">Agent not found.</p>
        <Link to="/dashboard/sites" className="text-sm text-[#ed2127] dark:text-[#f2454b] hover:underline">
          ← Back to sites
        </Link>
      </div>
    );
  }

  if (!agent) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  if (!SECTION_KEYS.includes(section)) {
    return <Navigate to={`/dashboard/sites/${agentId}/details`} replace />;
  }

  const site = summary?.site;
  return (
    <div className="space-y-5">
      <div>
        <Link to="/dashboard/sites" className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
          ← All sites
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="text-2xl font-display font-semibold">{agent.full_name || agent.email}'s Site</h1>
          <div className="flex items-center gap-3">
            {site && (
              <a href={`/sites/${site.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                View site ↗
              </a>
            )}
            <StatusSwitch summary={summary} setStatus={setStatus} />
          </div>
        </div>
      </div>

      <SetupChecklist agentId={agentId} summary={summary} />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SiteMenu agentId={agentId} section={section} hash={hash} />
        <div className="min-w-0 flex-1">
          <SiteEditor key={`${agent.id}-${section}`} agentId={agent.id} agentName={agent.full_name} section={section} hideHeader />
        </div>
      </div>
    </div>
  );
}

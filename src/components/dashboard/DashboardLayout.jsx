import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import brokerage from "../../lib/brokerage";
import { useAuth } from "../../hooks/useAuth";

// Plain top-level tabs. (Website is a collapsible group of its own —
// see SITE_ITEMS below — and the /dashboard index route just redirects to
// the right first page for each agent, see DashboardHome.jsx.)
const NAV_ITEMS = [
  { to: "/dashboard/listings", label: "Listings", activeWhen: (p) => p === "/dashboard/listings" || p.startsWith("/dashboard/listings/") },
  { to: "/dashboard/upcoming", label: "Upcoming", activeWhen: (p) => p === "/dashboard/upcoming" },
];

// Website is a collapsible group, one page per section. profiles.site_access
// decides what an agent gets: "full" = every page, "limited" = Blog Posts
// only, "none" = no Website group at all (Listings / Upcoming / People
// only).
const SITE_ITEMS = [
  { to: "/dashboard/site/analytics", label: "Analytics" },
  { to: "/dashboard/site/details", label: "Site Details" },
  { to: "/dashboard/site/testimonials", label: "Testimonials" },
  { to: "/dashboard/site/areas", label: "Areas of Expertise" },
  { to: "/dashboard/site/blog", label: "Blog Posts" },
];

// Sites/Agents/Brokerage Site are office settings, not something every
// agent reaches for day to day — grouped under a collapsible "Admin"
// group rather than mixed into NAV_ITEMS.
// People is its own module, switched on per agent by an admin
// (profiles.people_enabled) — separate from site_access, which only
// governs website editing. Shown as a collapsible group.
const PEOPLE_ITEMS = [
  { to: "/dashboard/people/overview", label: "Overview" },
  { to: "/dashboard/people/leads", label: "Leads" },
  { to: "/dashboard/people/pipeline", label: "Pipeline" },
  { to: "/dashboard/people/transactions", label: "Transactions" },
];

const ADMIN_ITEMS = [
  { to: "/dashboard/brokerage-site", label: "Brokerage Site" },
  { to: "/dashboard/sites", label: "Agent Sites" },
  { to: "/dashboard/agents", label: "Agents" },
];

// Left-hand sidebar nav (logo top, nav + admin section in the middle,
// profile/sign-out pinned to the bottom) — more consistent with the
// other web apps agents already use day to day than the old horizontal
// top bar. Collapses to a top bar + slide-down panel below `md`, same
// shape the old mobile nav already used.
export default function DashboardLayout() {
  const { profile, isAdmin } = useAuth();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(location.pathname.startsWith("/dashboard/site"));
  const [peopleOpen, setPeopleOpen] = useState(location.pathname.startsWith("/dashboard/people"));
  const [adminOpen, setAdminOpen] = useState(
    ADMIN_ITEMS.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)),
  );

  // On recent iOS the installed app's status bar area is drawn by the
  // system, in the page's <body> background color (cached at launch).
  // The global body color is the marketing cream, so a dark dashboard got
  // a light, frosted-looking band above its dark header. Match html/body
  // to the mobile header (white, or dark gray in dark mode) while the
  // dashboard is open; the layout's own min-h-screen background covers
  // everything else, so nothing visible changes.
  useEffect(() => {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');
    const originalMeta = meta?.getAttribute("content");
    const apply = () => {
      const color = root.classList.contains("dark") ? "#1a1a1a" : "#ffffff";
      root.style.backgroundColor = color;
      document.body.style.backgroundColor = color;
      meta?.setAttribute("content", color);
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      root.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
      if (meta && originalMeta != null) meta.setAttribute("content", originalMeta);
    };
  }, []);

  // Never leave the mobile menu open behind a new page after a nav tap.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navLinkClass = (isActive) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-[#1c1a17]/10 dark:bg-[#faf9f7]/10 text-[#1c1a17] dark:text-[#faf9f7]" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10"
    }`;

  const avatarSrc =
    profile?.photo_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E";

  const siteAccess = profile?.site_access || "full";
  const siteItems = siteAccess === "limited" ? SITE_ITEMS.filter((i) => i.to.endsWith("/blog")) : SITE_ITEMS;

  const NavList = ({ onNavigate }) => {
    const group = (label, open, setOpen, items) => (
      <div className="mt-1 space-y-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${navLinkClass(false)} w-full flex items-center justify-between text-left`}
        >
          <span>{label}</span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="ml-3 pl-2 border-l border-black/10 dark:border-white/10 space-y-1">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className={navLinkClass(location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <>
        {siteAccess !== "none" && group("Website", siteOpen, setSiteOpen, siteItems)}
        {profile?.people_enabled && group("People", peopleOpen, setPeopleOpen, PEOPLE_ITEMS)}
        <div className="mt-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} onClick={onNavigate} className={navLinkClass(item.activeWhen(location.pathname))}>
              {item.label}
            </Link>
          ))}
        </div>
        {isAdmin && group("Admin", adminOpen, setAdminOpen, ADMIN_ITEMS)}
      </>
    );
  };

  const ProfileBlock = ({ onNavigate }) => (
    <div className="space-y-3">
      <Link
        to="/dashboard/profile"
        onClick={onNavigate}
        className="flex items-center gap-2.5 text-sm text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] transition-colors min-w-0"
      >
        <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full object-cover bg-black/5 dark:bg-white/10 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate">{profile?.full_name || profile?.email}</span>
          {isAdmin && <span className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b]">ADMIN</span>}
        </span>
      </Link>
      <button
        onClick={() => supabase.auth.signOut()}
        className="text-sm font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] transition-colors"
      >
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0d0d0d] text-[#1c1a17] dark:text-[#faf9f7] scheme-light dark:scheme-dark md:flex print:block">
      {/* Desktop sidebar — print:hidden matters beyond just "don't print
          the sidebar": FlyerPage.jsx's #flyer-sheet print isolation
          previously relied on `visibility: hidden` for everything else on
          the page, which does NOT remove hidden content from layout flow
          — the sidebar/header stayed exactly as tall as ever, just
          invisible, which was silently inflating the printed page to 14
          blank pages and corrupting where the absolutely-positioned hero
          photo ended up. print:hidden actually removes this from layout
          (display: none), so a printed page's height matches its real
          visible content. */}
      <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:h-screen md:sticky md:top-0 border-r border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] print:hidden">
        <div className="flex items-center gap-3 px-6 py-6 shrink-0">
          <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
          <span className="h-6 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Oklahoma</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-4">
          <NavList />
        </nav>

        <div className="px-4 py-5 border-t border-black/5 dark:border-white/10 shrink-0">
          <ProfileBlock />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden border-b border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] print:hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={brokerage.logo} alt={brokerage.name} className="h-8 w-auto shrink-0" />
            <span className="h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />
            <span className="text-[10px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Oklahoma</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
            className="p-2 -mr-1.5 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
          >
            {mobileNavOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>

        {mobileNavOpen && (
          <nav className="px-4 pb-4 border-t border-black/5 dark:border-white/10 pt-3">
            <NavList onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10">
              <ProfileBlock onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 print:p-0 print:max-w-none print:mx-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

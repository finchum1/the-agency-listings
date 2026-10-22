import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import BrandLogo from "../BrandLogo";
import { SITE_ORIGIN } from "../../lib/seo";

// The sidebar is a drawer. Open it is a menu with labels, anywhere from 224px to 360px wide (drag its right edge); closed it
// is a 64px rail of icons that stays on the left of the screen. A quick flick, or dragging it narrow enough, closes it.
const RAIL_PX = 64;
const MIN_OPEN_PX = 224;
const MAX_OPEN_PX = 360;
const DEFAULT_OPEN_PX = 256;
const NAV_KEY = "dashboardNav";
const clampOpen = (n) => Math.max(MIN_OPEN_PX, Math.min(MAX_OPEN_PX, Math.round(n)));
function readNav() {
  try {
    const v = JSON.parse(localStorage.getItem(NAV_KEY) || "null");
    if (v && typeof v.open === "boolean") return { open: v.open, px: clampOpen(Number(v.px) || DEFAULT_OPEN_PX) };
  } catch {
    /* storage blocked: use the default */
  }
  return { open: true, px: DEFAULT_OPEN_PX };
}

const ICON_PATHS = {
  home: <path d="M4 11l8-7 8 7v8.5a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19.5z" />,
  website: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5S9.6 5.9 12 3.5z" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 20c.4-3.5 3-5.5 6-5.5s5.6 2 6 5.5" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.8c1.8.7 3 2.3 3.2 5.2" />
    </>
  ),
  listings: (
    <>
      <path d="M3.5 20.5h17M6 20.5V6.5L12 3l6 3.5v14" />
      <path d="M9.5 10h1.5M13 10h1.5M9.5 13.5h1.5M13 13.5h1.5M10.5 20.5v-3.5h3v3.5" />
    </>
  ),
  upcoming: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
  vendors: (
    <>
      <path d="M14.5 6.5a3.5 3.5 0 0 0-4.6 4.4L4 16.8V20h3.2l5.9-5.9a3.5 3.5 0 0 0 4.4-4.6l-2.3 2.3-2-.6-.6-2z" />
    </>
  ),
  admin: <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z" />,
  signout: <path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10M15 8l4 4-4 4M19 12H9.5" />,
};
function NavIcon({ name, className = "" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  );
}

// Plain top-level tabs. (Website is a collapsible group of its own —
// see SITE_ITEMS below — and the /dashboard index route just redirects to
// the right first page for each agent, see DashboardHome.jsx.)
const NAV_ITEMS = [
  { to: "/dashboard/listings", label: "Listings", icon: "listings", activeWhen: (p) => p === "/dashboard/listings" || p.startsWith("/dashboard/listings/") },
  { to: "/dashboard/upcoming", label: "Upcoming", icon: "upcoming", activeWhen: (p) => p === "/dashboard/upcoming" },
  { to: "/dashboard/vendors", label: "Vendors", icon: "vendors", activeWhen: (p) => p === "/dashboard/vendors" },
];

// Website is a collapsible group, one page per section. profiles.site_access
// decides what an agent gets: "full" = every page, "limited" = Blog Posts
// only, "none" = no Website group at all (Listings / Upcoming / People
// only).
const SITE_ITEMS = [
  { to: "/dashboard/site/analytics", label: "Analytics" },
  { to: "/dashboard/site/details", label: "Site Details" },
  { to: "/dashboard/site/compare", label: "Compare Templates" },
  { to: "/dashboard/site/testimonials", label: "Testimonials" },
  { to: "/dashboard/site/areas", label: "Areas of Expertise" },
  { to: "/dashboard/site/blog", label: "Blog Posts" },
  { to: "/dashboard/site/redirects", label: "Redirects" },
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
  const { profile, isAdmin, isPlatformAdmin } = useAuth();
  // The brand of the organization being worked in (the platform owner can switch between them).
  const { brand: brokerage, org } = useOrg();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [nav, setNav] = useState(readNav); // the desktop drawer: open or closed, and how wide it is when open
  const [navLive, setNavLive] = useState(null); // its width while the edge is being dragged
  const navDrag = useRef(null);
  const [mobDx, setMobDx] = useState(0); // how far the phone drawer has been dragged shut
  const mobDragging = useRef(false);
  // NavList and ProfileBlock are called as plain functions (not rendered as <NavList />): they are redefined on every render, so
  // as components they would be torn down and rebuilt whenever any state changes, which broke hovers and open menus.
  // Closed rail: a name tag on hover, and a small menu beside the icon for the groups that have pages inside them.
  const [railTip, setRailTip] = useState(null); // { label, x, y }
  const [railMenu, setRailMenu] = useState(null); // { label, items, x, y }
  const navWidth = navLive ?? (nav.open ? nav.px : RAIL_PX);
  const showRail = navWidth < 140;

  const saveNav = (next) => {
    setNav(next);
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: it just won't be remembered */
    }
  };
  const toggleNav = () => saveNav({ ...nav, open: !nav.open });

  // Drag the sidebar's right edge: any width from the icon rail to the widest the open menu goes. Let go and it settles:
  // narrower than ~150px closes to the rail, anything else opens (never narrower than the open minimum). A quick flick
  // left closes it, a quick flick right opens it.
  const edgeHandlers = {
    onPointerDown: (e) => {
      if (e.button > 0) return;
      navDrag.current = { x: e.clientX, w: navWidth, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = navDrag.current;
      if (!d || (!d.moved && Math.abs(e.clientX - d.x) < 4)) return;
      d.moved = true;
      d.samples.push({ x: e.clientX, t: performance.now() });
      if (d.samples.length > 8) d.samples.shift();
      setNavLive(Math.max(RAIL_PX, Math.min(MAX_OPEN_PX, d.w + (e.clientX - d.x))));
    },
    onPointerUp: (e) => {
      const d = navDrag.current;
      navDrag.current = null;
      if (!d || !d.moved) return;
      const width = Math.max(RAIL_PX, Math.min(MAX_OPEN_PX, d.w + (e.clientX - d.x)));
      const last = d.samples[d.samples.length - 1];
      const from = d.samples.find((p) => last.t - p.t <= 120) || last;
      const v = performance.now() - last.t > 90 || last.t === from.t ? 0 : (last.x - from.x) / (last.t - from.t); // px per ms, right is positive
      setNavLive(null);
      if (v < -0.8) saveNav({ ...nav, open: false });
      else if (v > 0.8) saveNav({ open: true, px: clampOpen(Math.max(width, nav.px)) });
      else if (width < 150) saveNav({ ...nav, open: false });
      else saveNav({ open: true, px: clampOpen(width) });
    },
    onPointerCancel: () => {
      navDrag.current = null;
      setNavLive(null);
    },
    onDoubleClick: toggleNav,
  };

  useEffect(() => {
    setRailMenu(null);
    setRailTip(null);
  }, [location.pathname]);
  useEffect(() => {
    if (!railMenu) return;
    const onDown = (e) => {
      if (e.target instanceof Element && e.target.closest("[data-rail-menu], [data-rail-trigger]")) return;
      setRailMenu(null);
    };
    const onKey = (e) => e.key === "Escape" && setRailMenu(null);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [railMenu]);
  useEffect(() => {
    // Opening the drawer (or widening it past the rail) leaves no rail to hang a tag or menu from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (!showRail) {
      setRailMenu(null);
      setRailTip(null);
    }
  }, [showRail]);

  // Phone: the menu is a drawer from the left. Swiping it back to the left (or a quick flick) closes it.
  const closeMobile = () => {
    setMobileNavOpen(false);
    setMobDx(0);
  };
  const onMobileDrawerDown = (e) => {
    if (!mobileNavOpen || e.button > 0 || e.target.closest("input, select, textarea")) return;
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false, dead: false, samples: [{ x: e.clientX, t: performance.now() }] };
    const drawerW = e.currentTarget.getBoundingClientRect().width;
    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      mobDragging.current = false;
    };
    function onMove(ev) {
      if (ev.pointerId !== g.id || g.dead) return;
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      if (!g.active) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx) || dx > 0) {
          g.dead = true; // scrolling the menu, or pulling the wrong way: leave it alone
          return;
        }
        g.active = true;
        mobDragging.current = true;
      }
      g.samples.push({ x: ev.clientX, t: performance.now() });
      if (g.samples.length > 8) g.samples.shift();
      setMobDx(Math.min(0, dx));
    }
    function onUp(ev) {
      if (ev.pointerId !== g.id) return;
      finish();
      if (!g.active) return;
      const dx = Math.min(0, ev.clientX - g.x);
      const last = g.samples[g.samples.length - 1];
      const from = g.samples.find((p) => last.t - p.t <= 120) || last;
      const v = performance.now() - last.t > 90 || last.t === from.t ? 0 : (last.x - from.x) / (last.t - from.t);
      if (v < -0.6 || dx < -drawerW * 0.35) closeMobile();
      else setMobDx(0);
    }
    function onCancel(ev) {
      if (ev.pointerId !== g.id) return;
      finish();
      setMobDx(0);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e) => e.key === "Escape" && closeMobile();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);
  const [siteOpen, setSiteOpen] = useState(location.pathname.startsWith("/dashboard/site"));
  const [peopleOpen, setPeopleOpen] = useState(location.pathname.startsWith("/dashboard/people"));
  const inAdminArea = (path) =>
    [...ADMIN_ITEMS.map((i) => i.to), "/dashboard/brand", "/dashboard/organizations"].some((to) => path === to || path.startsWith(`${to}/`));
  const [adminOpen, setAdminOpen] = useState(inAdminArea(location.pathname));

  // Landing on a page from somewhere else (a link on the home page, a button inside a page, the browser's back button)
  // opens the menu group that page belongs to, so the highlighted item is always visible. Groups never close by themselves.
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/dashboard/site")) setSiteOpen(true);
    if (path.startsWith("/dashboard/people")) setPeopleOpen(true);
    if (inAdminArea(path)) setAdminOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
    setMobDx(0);
  }, [location.pathname]);

  const navLinkClass = (isActive) =>
    `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive ? "bg-[#1c1a17]/10 dark:bg-[#faf9f7]/10 text-[#1c1a17] dark:text-[#faf9f7]" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10"
    }`;

  const avatarSrc =
    profile?.photo_url ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E";

  // Brand settings: an organization's own admins edit its logo and name. Organizations: the platform owner's list and
  // "new organization" form.
  const adminItems = [
    ...ADMIN_ITEMS,
    { to: "/dashboard/brand", label: "Brand" },
    ...(isPlatformAdmin ? [{ to: "/dashboard/organizations", label: "Organizations" }] : []),
  ];
  // The platform owner working inside someone else's organization is there to run it (agents, brand, brokerage site), not
  // to use the Website or People tools for themselves, so those two menus step aside. Agents and admins of that
  // organization still get theirs, per their own switches.
  const workingElsewhere = Boolean(isPlatformAdmin && org && profile?.org_id && org.id !== profile.org_id);
  const siteAccess = profile?.site_access || "full";
  const siteItems = siteAccess === "limited" ? SITE_ITEMS.filter((i) => i.to.endsWith("/blog")) : SITE_ITEMS;

  const NavList = ({ onNavigate, rail = false }) => {
    const path = location.pathname;
    const inSite = path.startsWith("/dashboard/site");
    const inPeople = path.startsWith("/dashboard/people");

    // Closed drawer: one icon per main item. A group's icon goes to the first page in that group.
    if (rail) {
      const itemClass = (active, menuOpen) =>
        `mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
          active || menuOpen
            ? "bg-[#1c1a17]/10 dark:bg-[#faf9f7]/10 text-[#1c1a17] dark:text-[#faf9f7]"
            : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
        }`;
      const tipOn = (label) => (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setRailTip({ label, x: r.right + 10, y: r.top + r.height / 2 });
      };
      const tipOff = () => setRailTip(null);
      // An icon with nothing inside it goes straight to its page; one with pages inside opens a small menu of them.
      const railItem = (label, icon, active, { to, items }) => {
        const handlers = { onMouseEnter: tipOn(label), onMouseLeave: tipOff, onFocus: tipOn(label), onBlur: tipOff };
        if (!items) {
          return (
            <Link key={label} to={to} onClick={onNavigate} aria-label={label} aria-current={active ? "page" : undefined} className={itemClass(active, false)} {...handlers}>
              <NavIcon name={icon} />
            </Link>
          );
        }
        const menuOpen = railMenu?.label === label;
        return (
          <button
            key={label}
            type="button"
            data-rail-trigger=""
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setRailTip(null);
              setRailMenu((cur) => (cur?.label === label ? null : { label, items, x: r.right + 10, y: r.top }));
            }}
            className={itemClass(active, menuOpen)}
            {...handlers}
          >
            <NavIcon name={icon} />
          </button>
        );
      };
      // Admin sits apart from the day-to-day items, at the bottom of the rail just above the profile.
      return (
        <div className="flex min-h-full flex-col">
          <div className="flex flex-col gap-1.5">
            {!workingElsewhere && railItem("Home", "home", path === "/dashboard" || path === "/dashboard/", { to: "/dashboard" })}
            {!workingElsewhere && siteAccess !== "none" && railItem("Website", "website", inSite, { items: siteItems })}
            {!workingElsewhere && profile?.people_enabled && railItem("People", "people", inPeople, { items: PEOPLE_ITEMS })}
            {NAV_ITEMS.map((item) => railItem(item.label, item.icon, item.activeWhen(path), { to: item.to }))}
          </div>
          {isAdmin && (
            <div className="mt-auto pt-3">
              <div className="mx-2 mb-3 border-t border-black/10 dark:border-white/10" aria-hidden="true" />
              {railItem("Admin", "admin", inAdminArea(path), { items: adminItems })}
            </div>
          )}
        </div>
      );
    }

    const group = (label, icon, open, setOpen, items) => (
      <div className="mt-1 space-y-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`${navLinkClass(false)} w-full flex items-center justify-between text-left`}
        >
          <span className="flex items-center gap-3 min-w-0">
            <NavIcon name={icon} />
            <span className="truncate">{label}</span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
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

    // The everyday modules at the top; Admin is set apart at the bottom, just above the profile and sign-out.
    return (
      <div className="flex min-h-full flex-col">
        <div>
        {!workingElsewhere && (
          <div className="space-y-1">
            <Link to="/dashboard" onClick={onNavigate} className={`${navLinkClass(path === "/dashboard" || path === "/dashboard/")} flex items-center gap-3`}>
              <NavIcon name="home" />
              Home
            </Link>
          </div>
        )}
        {!workingElsewhere && siteAccess !== "none" && group("Website", "website", siteOpen, setSiteOpen, siteItems)}
        {!workingElsewhere && profile?.people_enabled && group("People", "people", peopleOpen, setPeopleOpen, PEOPLE_ITEMS)}
        <div className="mt-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} onClick={onNavigate} className={`${navLinkClass(item.activeWhen(path))} flex items-center gap-3`}>
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
        </div>
        {isAdmin && (
          <div className="mt-auto pt-6">
            <div className="border-t border-black/10 dark:border-white/10 pt-3">{group("Admin", "admin", adminOpen, setAdminOpen, adminItems)}</div>
          </div>
        )}
      </div>
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
      <aside
        style={{ width: navWidth }}
        className={`hidden md:flex md:shrink-0 md:flex-col md:h-screen md:sticky md:top-0 relative border-r border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] print:hidden ${
          navLive === null ? "transition-[width] duration-200 ease-out motion-reduce:transition-none" : ""
        }`}
      >
        {showRail ? (
          <>
            <div className="h-[4.75rem] shrink-0" aria-hidden="true" />
            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2" aria-label="Main">
              {NavList({ rail: true })}
            </nav>
            <div className="shrink-0 border-t border-black/5 dark:border-white/10 py-4 flex flex-col items-center gap-3">
              <Link to="/dashboard/profile" title={profile?.full_name || "Your profile"} aria-label="Your profile">
                <img src={avatarSrc} alt="" className="h-9 w-9 rounded-full object-cover bg-black/5 dark:bg-white/10" />
              </Link>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              >
                <NavIcon name="signout" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 px-6 py-6 shrink-0 min-w-0">
              <BrandLogo src={brokerage.logo} darkSrc={brokerage.darkLogo} name={brokerage.name} className="h-9 w-auto" />
              <span className="h-6 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />
              <span className="min-w-0 truncate text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{brokerage.locationLabel}</span>
            </div>

            <OrgSwitcher />

            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4" aria-label="Main">
              {NavList({})}
            </nav>

            <div className="px-4 py-5 border-t border-black/5 dark:border-white/10 shrink-0 overflow-hidden">
              {ProfileBlock({})}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={toggleNav}
          aria-label={showRail ? "Open the menu" : "Close the menu to icons"}
          title={showRail ? "Open the menu" : "Close the menu to icons"}
          className="absolute -right-3 top-7 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] text-[#1c1a17]/60 dark:text-[#faf9f7]/60 shadow-sm hover:text-[#1c1a17] dark:hover:text-[#faf9f7] hover:border-black/25 dark:hover:border-white/30 print:hidden"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={showRail ? "" : "rotate-180"}>
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Grab the right edge to make the menu wider or narrower, or to close it to the icon rail. */}
        <div
          {...edgeHandlers}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the menu"
          title="Drag to resize"
          className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none"
        >
          <span className={`absolute inset-y-0 left-[5px] w-0.5 transition-colors ${navLive !== null ? "bg-[#ed2127]/70 dark:bg-[#f2454b]/70" : "bg-transparent group-hover:bg-[#ed2127]/40 dark:group-hover:bg-[#f2454b]/40"}`} />
        </div>
      </aside>

      {/* Mobile top bar: the menu button opens the drawer below. */}
      <header className="md:hidden border-b border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] print:hidden">
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo src={brokerage.logo} darkSrc={brokerage.darkLogo} name={brokerage.name} className="h-8 w-auto shrink-0" />
            <span className="h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />
            <span className="text-[10px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{brokerage.locationLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            className="p-2 -mr-1.5 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className={`md:hidden print:hidden fixed inset-0 z-50 ${mobileNavOpen ? "" : "pointer-events-none"}`} aria-hidden={!mobileNavOpen}>
        <button
          type="button"
          tabIndex={mobileNavOpen ? 0 : -1}
          aria-label="Close menu"
          onClick={closeMobile}
          style={{ opacity: mobileNavOpen ? Math.max(0, 1 + mobDx / 320) : 0 }}
          className="absolute inset-0 bg-black/40 transition-opacity duration-300"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          onPointerDown={onMobileDrawerDown}
          style={{
            transform: mobileNavOpen ? `translateX(${mobDx}px)` : "translateX(-100%)",
            transition: mobDx !== 0 && mobDragging.current ? "none" : "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            touchAction: "pan-y",
          }}
          className="absolute inset-y-0 left-0 flex w-[84vw] max-w-[320px] flex-col bg-white dark:bg-[#1a1a1a] shadow-2xl motion-reduce:!transition-none"
        >
          <div className="flex items-center gap-3 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 shrink-0 min-w-0">
            <BrandLogo src={brokerage.logo} darkSrc={brokerage.darkLogo} name={brokerage.name} className="h-8 w-auto shrink-0" />
            <span className="h-5 w-px bg-black/10 dark:bg-white/15" aria-hidden="true" />
            <span className="min-w-0 truncate text-[10px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{brokerage.locationLabel}</span>
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close menu"
              className="ml-auto p-2 -mr-2 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="px-4 shrink-0">
            <OrgSwitcher flush />
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain px-4" aria-label="Main">
            {NavList({ onNavigate: closeMobile })}
          </nav>
          <div className="shrink-0 border-t border-black/5 dark:border-white/10 px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {ProfileBlock({ onNavigate: closeMobile })}
          </div>
        </div>
      </div>

      {showRail && railTip && !railMenu &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: railTip.x, top: railTip.y }}
            className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1c1a17] dark:bg-[#faf9f7] px-2.5 py-1.5 text-xs font-medium text-white dark:text-[#1c1a17] shadow-lg print:hidden"
          >
            {railTip.label}
          </div>,
          document.body,
        )}
      {showRail && railMenu &&
        createPortal(
          <div
            data-rail-menu=""
            role="menu"
            aria-label={railMenu.label}
            style={{ left: railMenu.x, top: Math.max(8, Math.min(railMenu.y, window.innerHeight - (railMenu.items.length * 40 + 52))) }}
            className="fixed z-[60] min-w-[200px] rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-1.5 shadow-xl print:hidden"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{railMenu.label}</p>
            {railMenu.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setRailMenu(null)}
                className={navLinkClass(location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))}
              >
                {item.label}
              </Link>
            ))}
          </div>,
          document.body,
        )}

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 print:p-0 print:max-w-none print:mx-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Platform owner only: pick which organization the dashboard is working in. Everyone else never sees it.
function OrgSwitcher({ flush = false }) {
  const { org, orgs, isPlatformAdmin, switchOrg } = useOrg();
  if (!isPlatformAdmin || orgs.length === 0) return null;
  return (
    <div className={flush ? "pb-3" : "px-4 pb-3 shrink-0"}>
      <label
        htmlFor="org-switcher"
        className="block text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-1"
      >
        Working in
      </label>
      <select
        id="org-switcher"
        value={org?.id || ""}
        onChange={(e) => switchOrg(e.target.value)}
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-[#1c1a17] dark:text-[#faf9f7]"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.brand?.admin_name || o.name}
          </option>
        ))}
      </select>
      <CopyLoginLink org={org} />
    </div>
  );
}

// The organization's personal sign-in link (see hooks/useAuthOrg.js): its logo on the login screen. Built on the platform's
// own address (VITE_SITE_ORIGIN), whatever host the owner happens to be on.
function CopyLoginLink({ org }) {
  const [copied, setCopied] = useState(false);
  if (!org?.slug) return null;
  const link = `${SITE_ORIGIN}/login?org=${org.slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard blocked (older browser, insecure context): fall back to a prompt the owner can copy from
      window.prompt("Copy this login link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={link}
      className="mt-1.5 text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] transition-colors"
    >
      {copied ? "Copied!" : "Copy login link"}
    </button>
  );
}

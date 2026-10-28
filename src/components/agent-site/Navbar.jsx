import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { agentSiteHref } from "../../lib/agentSiteLinks";
import { navPages } from "../../lib/siteNav";
import SiteLink from "./SiteLink";
import BrandLogo from "../BrandLogo";
import { LIGHT_HERO_LAYOUTS } from "./layouts";

// Presentational styles share all the scroll/active-link/mobile-menu logic below (one source of truth for nav links and behavior) and only branch on
// the actual markup — see SiteForm.jsx's "Header style" picker (agent_sites.header_style, adapted as site.headerStyle):
//   - "classic" (default): a flush, full-width fixed bar — transparent over the home page's hero, solid --as-dark elsewhere.
//   - "floating": the marketing site's own header (MarketingNav.jsx) — clear at the very top, crossfading into a detached, rounded, shadowed pill once
//     scrolled, with nav links right-aligned and the active link a solid --as-accent pill.
//   - "centered": the logo in the middle of a flush bar, half the pages on each side of it.
//   - "centered_pill": the same, as the floating pill.
//   - "stacked": the logo centered on one row, the pages centered on a row under it.
//   - "minimal": the logo, the phone number and a menu button at every width; the pages open in a panel.
// The pages and their order come from lib/siteNav.js (the agent can reorder them in the site editor).
export default function Navbar() {
  const { site } = useAgentSiteContext();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Transparent-over-hero only makes sense on the home page, which is the only page with a full-bleed photo/video behind the nav — every other page
  // would render light nav text on a light page background. Reset on every navigation so a subpage never inherits a stale scroll position.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const isHome = location.pathname === agentSiteHref(site.slug) || location.pathname === "/";
  // Some layouts open on a light page, not a photo, so their nav can't be clear-with-light-text at the top.
  const solid = scrolled || open || !isHome || LIGHT_HERO_LAYOUTS.includes(site.layout);

  const visiblePages = navPages(site);
  // With the three landing pages in the menu there are eight links plus the phone button, which needs a wider screen than the usual six: the full
  // menu waits for an extra-large window (below it, the menu button), the agent's name beside the logo is left out (the page is only 1280 wide inside, so there
  // is never room for it), and the gaps tighten.
  const many = visiblePages.length > 6;
  const style = ["floating", "centered", "centered_pill", "stacked", "minimal"].includes(site.headerStyle) ? site.headerStyle : "classic";
  const pill = style === "floating" || style === "centered_pill";
  const alwaysMenu = style === "minimal";
  const showDesktop = alwaysMenu ? "hidden" : many ? "hidden xl:flex" : "hidden lg:flex";
  const showGrid = alwaysMenu ? "hidden" : many ? "hidden xl:grid" : "hidden lg:grid";
  const hideDesktop = alwaysMenu ? "" : many ? "xl:hidden" : "lg:hidden";
  // The logo goes in the middle of the centered styles, so the agent's name beside it stays out of the way there too.
  const centeredLogo = style === "centered" || style === "centered_pill" || style === "stacked";

  const contactCta = (className) =>
    site.agent.phone ? (
      <a href={`tel:${site.agent.phone}`} className={className}>
        {site.agent.phone}
      </a>
    ) : (
      <SiteLink slug={site.slug} path="/contact" className={className}>
        Let&rsquo;s Connect
      </SiteLink>
    );

  const menuIcon = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />}
    </svg>
  );

  const logo = (
    <SiteLink slug={site.slug} path="" className="flex items-center gap-3 min-w-0 shrink-0">
      <BrandLogo src={site.brokerage.logo} name={site.brokerage.name} className="h-9 sm:h-11 w-auto" />
      {site.secondaryLogo && (
        <>
          <span className="h-8 w-px bg-[var(--as-on-dark)]/25 shrink-0" aria-hidden="true" />
          <img src={site.secondaryLogo} alt="" className="agent-secondary-logo h-8 sm:h-10 w-auto" />
        </>
      )}
      {!centeredLogo && (
        <span className={`${many || alwaysMenu ? "hidden" : "hidden sm:block"} ml-2 text-sm font-display tracked-wide whitespace-nowrap text-[var(--as-on-dark)]`}>
          {site.agent.name}
        </span>
      )}
    </SiteLink>
  );

  const menuButton = (
    <button className={`${hideDesktop} p-2 shrink-0 text-[var(--as-on-dark)]`} onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
      {menuIcon}
    </button>
  );

  const linkClass = pill
    ? `text-xs font-medium tracked-wide uppercase transition-colors whitespace-nowrap ${many ? "px-3" : "px-4"} py-2 rounded-full`
    : "text-xs font-medium tracked-wide uppercase transition-colors whitespace-nowrap text-[var(--as-on-dark)]/75 hover:text-[var(--as-on-dark)]";
  const ctaClass = pill
    ? "text-xs font-medium tracked-wide uppercase px-5 py-2.5 rounded-full border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
    : "as-btn text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]";

  const pageLink = (page) => {
    const active = location.pathname === agentSiteHref(site.slug, page.path);
    const state = pill
      ? active
        ? "bg-[var(--as-accent)] text-white"
        : "text-[var(--as-on-dark)]/75 hover:text-[var(--as-on-dark)] hover:bg-[var(--as-on-dark)]/10"
      : active
        ? "text-[var(--as-on-dark)]"
        : "";
    return (
      <SiteLink key={page.path} slug={site.slug} path={page.path} className={`${linkClass} ${state}`}>
        {page.label}
      </SiteLink>
    );
  };

  const gap = pill ? "gap-1" : many ? "gap-5 2xl:gap-8" : "gap-6 xl:gap-8";

  // The pages, laid out for the chosen style (at desktop width).
  let desktop;
  if (style === "centered" || style === "centered_pill") {
    // Half the pages each side of the logo (the extra one goes on the left); the phone button closes the right side.
    const half = Math.ceil(visiblePages.length / 2);
    desktop = (
      <div className={`${showGrid} flex-1 grid-cols-[1fr_auto_1fr] items-center gap-6`}>
        <nav className={`flex items-center justify-end ${gap}`}>{visiblePages.slice(0, half).map(pageLink)}</nav>
        {logo}
        <nav className={`flex items-center justify-start ${gap}`}>
          {visiblePages.slice(half).map(pageLink)}
          {/* With many pages the phone button would push the logo off-center, so it stays in the menu there. */}
          {!many && contactCta(`${ctaClass} ml-2`)}
        </nav>
      </div>
    );
  } else if (style === "stacked") {
    desktop = (
      <nav className={`${showDesktop} items-center justify-center ${gap} w-full`}>
        {visiblePages.map(pageLink)}
        {contactCta(`${ctaClass} ml-2`)}
      </nav>
    );
  } else if (style === "minimal") {
    desktop = null;
  } else {
    desktop = (
      <nav className={`${showDesktop} items-center ${gap} shrink-0 ${pill ? "ml-auto" : ""}`}>
        {visiblePages.map(pageLink)}
        {contactCta(`${ctaClass} ${pill ? "ml-2" : ""}`)}
      </nav>
    );
  }

  // The phone number sits beside the menu button of the minimal style, at every width.
  const minimalPhone = alwaysMenu && site.agent.phone && (
    <a href={`tel:${site.agent.phone}`} className="hidden sm:block text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/80 hover:text-[var(--as-on-dark)] whitespace-nowrap">
      {site.agent.phone}
    </a>
  );

  const drawer = open && (
    <div
      className={`${hideDesktop} ${pill ? "mt-2 rounded-2xl shadow-[0_16px_36px_-16px_rgba(0,0,0,0.45)] px-6 py-4" : "border-t border-[var(--as-on-dark)]/10 px-6 py-4"} bg-[var(--as-dark)] flex flex-col gap-4 ${
        style === "stacked" || style === "centered" || style === "centered_pill" ? "text-center items-center" : ""
      }`}
    >
      {visiblePages.map((page) => (
        <SiteLink key={page.path} slug={site.slug} path={page.path} onClick={() => setOpen(false)} className="text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/80">
          {page.label}
        </SiteLink>
      ))}
      {contactCta(
        pill
          ? "text-xs font-medium tracked-wide uppercase px-5 py-3 rounded-full bg-[var(--as-accent)] text-white text-center"
          : "as-btn text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center",
      )}
    </div>
  );

  // The top row: logo and menu button below the desktop width; the style's own layout above it.
  const mobileRow = (
    <div className={`${hideDesktop} flex w-full items-center justify-between`}>
      {logo}
      {menuButton}
    </div>
  );

  let row;
  if (style === "stacked") {
    row = (
      <>
        {mobileRow}
        <div className={`${showDesktop} w-full flex-col items-center gap-3`}>
          {logo}
          {desktop}
        </div>
      </>
    );
  } else if (style === "centered" || style === "centered_pill") {
    row = (
      <>
        {mobileRow}
        {desktop}
      </>
    );
  } else if (style === "minimal") {
    row = (
      <div className="flex w-full items-center justify-between">
        {logo}
        <div className="flex items-center gap-4">
          {minimalPhone}
          {menuButton}
        </div>
      </div>
    );
  } else {
    row = (
      <>
        {logo}
        {desktop}
        {menuButton}
      </>
    );
  }

  // Clear over the hero photo, the header's light text must read on the photo whatever the theme: a light theme (Linen) makes --as-on-dark dark ink,
  // meant for its cream bar once it is solid, so until then the text is white.
  const overPhoto = solid ? undefined : { "--as-on-dark": "#ffffff" };

  if (pill) {
    return (
      <div className="fixed top-0 inset-x-0 z-50 pt-4 px-4 sm:px-6" style={overPhoto}>
        <header className="mx-auto max-w-7xl">
          <div className={`flex items-center justify-between gap-4 rounded-full px-4 sm:px-5 py-3 transition-all duration-300 ${solid ? "bg-[var(--as-dark)] shadow-[0_16px_36px_-16px_rgba(0,0,0,0.45)]" : "bg-transparent"}`}>{row}</div>
          {drawer}
        </header>
      </div>
    );
  }

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${solid ? "bg-[var(--as-dark)] shadow-md" : "bg-transparent"}`} style={overPhoto}>
      <div className={`mx-auto max-w-7xl px-6 lg:px-10 flex items-center ${style === "stacked" ? "justify-center py-3" : "justify-between py-4"}`}>{row}</div>
      {drawer}
    </header>
  );
}

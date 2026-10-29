import { resolveLanding } from "./landingPages";

// The pages an agent site's header (and footer) menus link to. sectionKey matches agent_sites.home_sections: a page whose home section the agent has
// turned off isn't advertised, though the page itself still works if linked to directly. Contact has no sectionKey since it's never optional.
export const NAV_PAGES = [
  { path: "/about", label: "About", sectionKey: "bio" },
  { path: "/listings", label: "Listings", sectionKey: "listings" },
  { path: "/past-sales", label: "Past Sales", needsSales: true },
  { path: "/areas", label: "Areas", sectionKey: "areas" },
  { path: "/blog", label: "Blog", sectionKey: "blog" },
  { path: "/contact", label: "Contact" },
];

/** `items` in the order the agent chose (`navOrder`, a list of page paths). Items it doesn't name keep their own order, after the named ones. */
export function orderByNav(items, navOrder, pathOf = (item) => item.path) {
  const wanted = Array.isArray(navOrder) ? navOrder : [];
  if (wanted.length === 0) return items;
  const rank = (item) => {
    const i = wanted.indexOf(pathOf(item));
    return i === -1 ? wanted.length : i;
  };
  // Array.prototype.sort is stable, so the unnamed items stay in their default order.
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/**
 * The menu pages for a site: the pages whose sections are on, then Sellers / Home Value / Buyers (while the cards section is on and the agent keeps them
 * in the menu), then Contact, put in the agent's own order. Takes { homeSections, landing, navOrder }, so the site editor can call it with the form.
 */
export function navPages({ homeSections, landing, navOrder, hasSales = false }) {
  const cards = resolveLanding(landing);
  const landingPages = homeSections.includes("cards") && cards.menu ? cards.cards.filter((c) => c.on).map((c) => ({ path: c.path, label: c.nav })) : [];
  const base = NAV_PAGES.filter((page) => (!page.sectionKey || homeSections.includes(page.sectionKey)) && (!page.needsSales || hasSales));
  const standard = [...base.filter((p) => p.path !== "/contact"), ...landingPages, ...base.filter((p) => p.path === "/contact")];
  return orderByNav(standard, navOrder).map(({ path, label }) => ({ path, label }));
}

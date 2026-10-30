// The name a dashboard tab shows for a page, from its address.
const NAMES = {
  "/dashboard": "Home",
  "/dashboard/deals": "Deals",
  "/dashboard/deals/board": "Deals board",
  "/dashboard/listings": "Listings",
  "/dashboard/listings/new": "New listing",
  "/dashboard/upcoming": "Upcoming",
  "/dashboard/vendors": "Vendors",
  "/dashboard/profile": "My profile",
  "/dashboard/settings": "People settings",
  "/dashboard/people/overview": "People",
  "/dashboard/people/contacts": "Contacts",
  "/dashboard/people/leads": "Leads",
  "/dashboard/people/pipeline": "Pipeline",
  "/dashboard/site": "Website",
  "/dashboard/site/content": "Website content",
  "/dashboard/site/design": "Website design",
  "/dashboard/site/settings": "Website settings",
  "/dashboard/site/insights": "Website insights",
  "/dashboard/site/analytics": "Site analytics",
  "/dashboard/site/details": "Site details",
  "/dashboard/site/compare": "Compare templates",
  "/dashboard/site/testimonials": "Testimonials",
  "/dashboard/site/areas": "Areas of expertise",
  "/dashboard/site/listings": "Website listings",
  "/dashboard/site/sales": "Past sales",
  "/dashboard/site/blog": "Blog posts",
  "/dashboard/site/redirects": "Redirects",
  "/dashboard/agents": "Agents",
  "/dashboard/sites": "Agent sites",
  "/dashboard/office-analytics": "Office analytics",
  "/dashboard/brand": "Brand",
  "/dashboard/brokerage-site": "Brokerage site",
  "/dashboard/organizations": "Organizations",
};

export function tabTitle(url) {
  const [pathname, search = ""] = String(url).split("?");
  const path = pathname.replace(/\/+$/, "") || "/dashboard";
  const params = new URLSearchParams(search);
  if ((path === "/dashboard/deals" || path === "/dashboard/deals/board") && params.get("deal")) return "Deal";
  if ((path === "/dashboard/site/blog" || path === "/dashboard/site/content") && (params.get("new") || params.get("edit"))) return params.get("new") ? "New blog post" : "Edit blog post";
  if (path === "/dashboard/people/contacts" && params.get("contact")) return "Contact";
  if (NAMES[path]) return NAMES[path];
  if (/^\/dashboard\/listings\/[^/]+\/edit$/.test(path)) return "Edit listing";
  if (/^\/dashboard\/listings\/[^/]+\/flyer$/.test(path)) return "Listing flyer";
  if (/^\/dashboard\/listings\/[^/]+\/analytics$/.test(path)) return "Listing analytics";
  if (/^\/dashboard\/sites\/[^/]+/.test(path)) return "Agent site";
  const last = path.split("/").filter(Boolean).pop() || "Home";
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
}

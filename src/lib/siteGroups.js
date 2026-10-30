// The pages of an agent's website editor. Each group is one page that scrolls through all of its parts; `anchor` is the id of a part on that page.
// A part is either a section of the Site Details form (`key: "details"` with a `hash`) or one of the editor's own sections (`key`).
export const SITE_GROUPS = [
  {
    key: "content",
    title: "Content",
    items: [
      { key: "details", hash: "basic", label: "Basic info" },
      { key: "details", hash: "photos", label: "Photos, video and bio" },
      { key: "listings", label: "Listings" },
      { key: "testimonials", label: "Testimonials" },
      { key: "areas", label: "Areas of expertise" },
      { key: "blog", label: "Blog posts" },
      { key: "sales", label: "Past sales" },
    ],
  },
  {
    key: "design",
    title: "Design",
    items: [
      { key: "details", hash: "design", label: "Template and design" },
      { key: "details", hash: "home", label: "Home page sections" },
      { key: "details", hash: "cards", label: "Buyer and seller cards" },
      { key: "compare", label: "Compare templates" },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    items: [
      { key: "details", hash: "idx", label: "Home search (IDX)" },
      { key: "details", hash: "social", label: "Social media" },
      { key: "details", hash: "seo", label: "SEO and sharing" },
      { key: "details", hash: "domain", label: "Custom domain" },
      { key: "redirects", label: "Redirects" },
    ],
  },
  { key: "insights", title: "Insights", items: [{ key: "analytics", label: "Analytics" }] },
];

export const SITE_GROUP_KEYS = SITE_GROUPS.map((g) => g.key);
export const siteGroup = (key) => SITE_GROUPS.find((g) => g.key === key);
// The id of a part on its group's page.
export const partAnchor = (item) => item.hash || item.key;

// Where an editor section lives now ({ details, "design" } → the Design page, scrolled to Template and design). Used for the old one-page-per-part
// addresses (/dashboard/site/blog, /dashboard/site/details#domain) so links and bookmarks keep working. Returns null for an unknown section.
export function locateSitePart(key, hash) {
  for (const g of SITE_GROUPS) {
    const item = g.items.find((i) => i.key === key && (i.hash ? i.hash === (hash || "basic") : true));
    if (item) return { group: g.key, anchor: partAnchor(item) };
  }
  const first = SITE_GROUPS.find((g) => g.items.some((i) => i.key === key));
  return first ? { group: first.key, anchor: key === "details" ? "basic" : key } : null;
}

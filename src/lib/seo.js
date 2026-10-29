// Shared, framework-agnostic page-metadata helpers — pure functions only,
// no `document`/`window`/Vite-only syntax, so this file works both in the
// browser bundle (src/pages/*.jsx call these, then hand the result to
// lib/pageMeta.js to write it into the live DOM) and in the Vercel
// serverless functions (api/meta-*.js import this same file to render the
// exact same title/description for crawlers that don't execute JS — see
// vercel.json's user-agent-matched rewrites). One source of truth for
// "what is this page's title/description/share-image" instead of two
// copies that could drift.
// Explicit .js extensions below: this file is imported both by Vite
// (which resolves extensionless specifiers fine) and directly by Node in
// the Vercel serverless functions (api/meta-*.js), whose ESM resolver
// requires the extension on relative imports.
import { formatPrice, STATUS_LABELS } from "./format.js";
import { brandFromOrg } from "./brand.js";

// The platform's primary app address, used for canonical URLs and sitemap entries. Set VITE_SITE_ORIGIN (no trailing
// slash) to change it, for example when the app moves to app.latchpointstudios.com; the default is today's address.
// Written so it works in the browser bundle (Vite replaces import.meta.env) and in Node (api functions).
function configuredOrigin() {
  const fromVite = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SITE_ORIGIN : "";
  const fromServer = typeof process !== "undefined" && process.env ? process.env.VITE_SITE_ORIGIN : "";
  return String(fromVite || fromServer || "").replace(/\/$/, "");
}
export const SITE_ORIGIN = configuredOrigin() || "https://the-agency-listings.vercel.app";

export function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// A post row is publicly visible when it's actually published, OR it's
// scheduled and its scheduled_at has already passed (see the scheduled-
// publishing feature — status stays literally "scheduled" in the row;
// visibility is computed at read time rather than flipped by a cron job).
// Same condition the client-side hooks (useAgentSite.js, useBrokerageSite.js,
// useAgentPost.js, useBrokeragePost.js) already use — this is the
// server-side (api/meta-*.js, api/sitemap.js) equivalent, one place so it
// can't drift from those or from itself across files.
export function publishedOrDueFilter(nowIso = new Date().toISOString()) {
  return `status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${nowIso})`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Plain-text excerpt from a bio_html/body_html rich-text field, for a meta
// description — not for rendering (no DOM here; this file also runs in
// the Vercel serverless functions under Node, see the header note above).
// A regex strip is safe for this narrow purpose since ALLOWED_TAGS
// (lib/sanitizeHtml.js) is a small, known set with no attributes. Takes
// just the first block (paragraph or heading), matching what the old
// bio[0]/body.find(p) callers below used to take from the array formats.
function firstBlockText(html) {
  if (!html) return "";
  const match = html.match(/<(p|h3)>([\s\S]*?)<\/\1>/i);
  const inner = match ? match[2] : html;
  return inner
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// listing: a raw `listings` row. agent: its `profiles` row (nullable).
// heroPhotoUrl: resolved separately since it lives in `listing_photos`.
export function buildListingMeta(listing, agent, heroPhotoUrl) {
  const brokerage = brandFromOrg(listing.org);
  const title =
    listing.seo_title?.trim() ||
    `${listing.address_line1} | ${listing.city}, ${listing.state} — ${brokerage.name}`;

  const description =
    listing.seo_description?.trim() ||
    listing.description?.[0] ||
    [
      listing.beds ? `${listing.beds}-bed` : null,
      listing.baths ? `${listing.baths}-bath` : null,
    ]
      .filter(Boolean)
      .join(", ") +
      ` home in ${listing.city}, ${listing.state}, listed at ${formatPrice(listing.price)}${
        agent?.full_name ? ` by ${agent.full_name}` : ""
      }.`;

  const image = absoluteUrl(listing.og_image_url || heroPhotoUrl || brokerage.logo);
  const statusLabel = STATUS_LABELS[listing.status] || listing.status;

  return { title, description, image, statusLabel };
}

// site: a raw `agent_sites` row. agent: its `profiles` row (nullable).
export function buildAgentSiteMeta(site, agent) {
  const brokerage = brandFromOrg(site.org);
  const title = site.seo_title?.trim() || `${agent?.full_name || "Agent"} | ${brokerage.name}`;

  const description =
    site.seo_description?.trim() ||
    site.tagline?.trim() ||
    firstBlockText(site.bio_html) ||
    site.bio?.[0] ||
    `${agent?.full_name || "An agent"} at ${brokerage.name}${site.region ? ` serving ${site.region}` : ""}.`;

  const image = absoluteUrl(site.og_image_url || site.hero_photo_url || agent?.photo_url || brokerage.logo);

  return { title, description, image };
}

// Per-page defaults for an agent site's standalone subpages (About,
// Listings, Areas, Blog, Contact — see App.jsx's /sites/:slug/* routes).
// Without these, every subpage under one site shared buildAgentSiteMeta's
// single description verbatim — a classic duplicate-meta-description
// issue when Google (or anyone) compares pages within the same site.
const AGENT_SITE_PAGE_LABELS = { about: "About", listings: "Listings", "past-sales": "Past Sales", areas: "Areas", blog: "Blog", contact: "Contact", sellers: "Selling Your Home", buyers: "Buying a Home", "home-value": "What's Your Home Worth?" };
const AGENT_SITE_PAGE_DESCRIPTIONS = {
  about: (site, agent, brokerage) =>
    `Learn about ${agent?.full_name || "this agent"}${
      site.region ? `, serving ${site.region}` : ""
    } — background, experience, and client testimonials at ${brokerage.name}.`,
  listings: (site, agent, brokerage) =>
    `Browse current listings from ${agent?.full_name || "this agent"} at ${brokerage.name}${
      site.region ? ` in ${site.region}` : ""
    }.`,
  "past-sales": (site, agent, brokerage) =>
    `Homes ${agent?.full_name || "this agent"} at ${brokerage.name} has helped buyers and sellers close${site.region ? ` in ${site.region}` : ""}: recent sales and track record.`,
  areas: (site, agent) =>
    `Explore the neighborhoods and areas ${agent?.full_name || "this agent"} serves${
      site.region ? ` around ${site.region}` : ""
    }.`,
  blog: (site, agent, brokerage) =>
    `Real estate insights, market updates, and local guides from ${agent?.full_name || "this agent"} at ${brokerage.name}.`,
  contact: (site, agent, brokerage) =>
    `Get in touch with ${agent?.full_name || "this agent"} at ${brokerage.name} to buy, sell, or ask a question.`,
  sellers: (site, agent, brokerage) =>
    `A step-by-step guide to selling your home with ${agent?.full_name || "this agent"} at ${brokerage.name}: preparing, pricing, showings, offers and closing day.`,
  buyers: (site, agent, brokerage) =>
    `A step-by-step guide to buying a home with ${agent?.full_name || "this agent"} at ${brokerage.name}: pre-approval, the search, the offer and closing.`,
  "home-value": (site, agent, brokerage) =>
    `Request a free, personal home valuation from ${agent?.full_name || "this agent"} at ${brokerage.name}. Real comparable sales, a custom valuation within one business day.`,
};

// site: a raw `agent_sites` row. agent: its `profiles` row (nullable).
// page: one of AGENT_SITE_PAGE_LABELS's keys, or falsy for the site's own
// Home page (in which case this is identical to buildAgentSiteMeta).
export function buildAgentSitePageMeta(site, agent, page) {
  const base = buildAgentSiteMeta(site, agent);
  const label = AGENT_SITE_PAGE_LABELS[page];
  if (!label) return base;

  // An agent's own explicit seo_description is a deliberate override and
  // still wins over our computed per-page default, same priority it
  // already has inside buildAgentSiteMeta.
  const description =
    site.seo_description?.trim() || AGENT_SITE_PAGE_DESCRIPTIONS[page](site, agent, brandFromOrg(site.org)) || base.description;

  return { title: `${label} | ${base.title}`, description, image: base.image };
}

// site: a raw `brokerage_site` row.
export function buildBrokerageSiteMeta(site) {
  const brokerage = brandFromOrg(site.org);
  const loc = brokerage.locationLabel;
  const title = site.seo_title?.trim() || `${brokerage.name} | ${loc}`;
  const description =
    site.seo_description?.trim() ||
    site.tagline?.trim() ||
    firstBlockText(site.about_html) ||
    `${brokerage.name}'s ${loc} office — a boutique brokerage representing ${loc}'s most distinctive properties.`;
  const image = absoluteUrl(site.og_image_url || site.hero_photo_url || brokerage.logo);
  return { title, description, image };
}

// Per-page defaults for the brokerage site's own standalone subpages
// (About, Agents, Areas of Expertise, Blog, Our Listings, Home Search,
// Home Valuation, Contact — see App.jsx's /brokerage/* routes). Mirrors
// AGENT_SITE_PAGE_LABELS/DESCRIPTIONS above, brokerage-wide instead of
// per-agent since there's no single "agent" for these pages.
const BROKERAGE_PAGE_LABELS = {
  about: "About",
  agents: "Agents",
  areas: "Areas of Expertise",
  blog: "Blog",
  listings: "Our Listings",
  search: "Home Search",
  "home-valuation": "Home Valuation",
  contact: "Contact",
};
const BROKERAGE_PAGE_DESCRIPTIONS = {
  about: (brokerage) =>
    `Learn about ${brokerage.name}'s ${brokerage.locationLabel} office — a boutique brokerage representing ${brokerage.locationLabel}'s most distinctive properties.`,
  agents: (brokerage) => `Meet the agents at ${brokerage.name}'s ${brokerage.locationLabel} office.`,
  areas: (brokerage) => `Explore the neighborhoods and areas ${brokerage.name} serves across ${brokerage.locationLabel}.`,
  blog: (brokerage) => `Real estate insights, market updates, and local guides from ${brokerage.name}.`,
  listings: (brokerage) => `Browse current listings from ${brokerage.name}'s ${brokerage.locationLabel} office.`,
  search: (brokerage) => `Search every home for sale across the whole MLS with ${brokerage.name}.`,
  "home-valuation": (brokerage) => `Get an honest home valuation estimate from ${brokerage.name}.`,
  contact: (brokerage) => `Get in touch with ${brokerage.name}'s ${brokerage.locationLabel} office to buy, sell, or ask a question.`,
};

// site: a raw `brokerage_site` row. page: one of BROKERAGE_PAGE_LABELS's
// keys, or falsy for the site's own Home page (identical to
// buildBrokerageSiteMeta in that case).
export function buildBrokerageSitePageMeta(site, page) {
  const base = buildBrokerageSiteMeta(site);
  const label = BROKERAGE_PAGE_LABELS[page];
  if (!label) return base;

  const description =
    site.seo_description?.trim() || BROKERAGE_PAGE_DESCRIPTIONS[page](brandFromOrg(site.org)) || base.description;

  return { title: `${label} | ${base.title}`, description, image: base.image };
}

// post: a raw `brokerage_posts` row. site: the brokerage_site row.
export function buildBrokeragePostMeta(post, site) {
  const brokerage = brandFromOrg(site?.org);
  const title = `${post.title} | ${brokerage.name}`;
  const description = post.excerpt?.trim() || firstBlockText(post.body_html) || "";
  const image = absoluteUrl(post.image_url || site?.hero_photo_url || brokerage.logo);
  return { title, description, image };
}

// post: a raw `agent_site_posts` row. site/agent: the parent site + its agent.
export function buildAgentPostMeta(post, site, agent) {
  const brokerage = brandFromOrg(site?.org);
  const title = `${post.title} | ${agent?.full_name || brokerage.name}`;
  const description =
    post.excerpt?.trim() ||
    firstBlockText(post.body_html) ||
    post.body?.find((b) => b.type === "p")?.text ||
    "";
  const image = absoluteUrl(post.image_url || site?.hero_photo_url || agent?.photo_url || brokerage.logo);
  return { title, description, image };
}

export function buildAgentAreaMeta(area, site, agent) {
  const brokerage = brandFromOrg(site?.org);
  const title = `${area.name} | ${agent?.full_name || brokerage.name}`;
  const description =
    area.blurb?.trim() ||
    firstBlockText(area.description) ||
    `Explore ${area.name}${site?.region ? ` near ${site.region}` : ""} with ${
      agent?.full_name || "this agent"
    } at ${brokerage.name}.`;
  const image = absoluteUrl(area.photo_url || site?.hero_photo_url || agent?.photo_url || brokerage.logo);
  return { title, description, image };
}

export function buildBrokerageAreaMeta(area, site) {
  const brokerage = brandFromOrg(site?.org);
  const title = `${area.name} | ${brokerage.name}`;
  const description =
    area.blurb?.trim() ||
    firstBlockText(area.description) ||
    `Explore ${area.name} with ${brokerage.name}.`;
  const image = absoluteUrl(area.photo_url || site?.hero_photo_url || brokerage.logo);
  return { title, description, image };
}

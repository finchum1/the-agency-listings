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
import brokerage from "./brokerage.js";

export const SITE_ORIGIN = "https://the-agency-listings.vercel.app";

export function absoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
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
const AGENT_SITE_PAGE_LABELS = { about: "About", listings: "Listings", areas: "Areas", blog: "Blog", contact: "Contact" };
const AGENT_SITE_PAGE_DESCRIPTIONS = {
  about: (site, agent) =>
    `Learn about ${agent?.full_name || "this agent"}${
      site.region ? `, serving ${site.region}` : ""
    } — background, experience, and client testimonials at ${brokerage.name}.`,
  listings: (site, agent) =>
    `Browse current listings from ${agent?.full_name || "this agent"} at ${brokerage.name}${
      site.region ? ` in ${site.region}` : ""
    }.`,
  areas: (site, agent) =>
    `Explore the neighborhoods and areas ${agent?.full_name || "this agent"} serves${
      site.region ? ` around ${site.region}` : ""
    }.`,
  blog: (site, agent) =>
    `Real estate insights, market updates, and local guides from ${agent?.full_name || "this agent"} at ${brokerage.name}.`,
  contact: (site, agent) =>
    `Get in touch with ${agent?.full_name || "this agent"} at ${brokerage.name} to buy, sell, or ask a question.`,
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
    site.seo_description?.trim() || AGENT_SITE_PAGE_DESCRIPTIONS[page](site, agent) || base.description;

  return { title: `${label} | ${base.title}`, description, image: base.image };
}

// site: a raw `brokerage_site` row.
export function buildBrokerageSiteMeta(site) {
  const title = site.seo_title?.trim() || `${brokerage.name} | Oklahoma`;
  const description =
    site.seo_description?.trim() ||
    site.tagline?.trim() ||
    firstBlockText(site.about_html) ||
    `${brokerage.name}'s Oklahoma office — a boutique brokerage representing Oklahoma's most distinctive properties.`;
  const image = absoluteUrl(site.og_image_url || site.hero_photo_url || brokerage.logo);
  return { title, description, image };
}

// post: a raw `brokerage_posts` row. site: the brokerage_site row.
export function buildBrokeragePostMeta(post, site) {
  const title = `${post.title} | ${brokerage.name}`;
  const description = post.excerpt?.trim() || firstBlockText(post.body_html) || "";
  const image = absoluteUrl(post.image_url || site?.hero_photo_url || brokerage.logo);
  return { title, description, image };
}

// post: a raw `agent_site_posts` row. site/agent: the parent site + its agent.
export function buildAgentPostMeta(post, site, agent) {
  const title = `${post.title} | ${agent?.full_name || brokerage.name}`;
  const description =
    post.excerpt?.trim() ||
    firstBlockText(post.body_html) ||
    post.body?.find((b) => b.type === "p")?.text ||
    "";
  const image = absoluteUrl(post.image_url || site?.hero_photo_url || agent?.photo_url || brokerage.logo);
  return { title, description, image };
}

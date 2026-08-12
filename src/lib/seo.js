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
    site.bio?.[0] ||
    `${agent?.full_name || "An agent"} at ${brokerage.name}${site.region ? ` serving ${site.region}` : ""}.`;

  const image = absoluteUrl(site.og_image_url || site.hero_photo_url || agent?.photo_url || brokerage.logo);

  return { title, description, image };
}

// post: a raw `agent_site_posts` row. site/agent: the parent site + its agent.
export function buildAgentPostMeta(post, site, agent) {
  const title = `${post.title} | ${agent?.full_name || brokerage.name}`;
  const description = post.excerpt?.trim() || post.body?.find((b) => b.type === "p")?.text || "";
  const image = absoluteUrl(post.image_url || site?.hero_photo_url || agent?.photo_url || brokerage.logo);
  return { title, description, image };
}

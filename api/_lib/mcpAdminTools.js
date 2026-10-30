// The owner-only AI connection tools (scopes manage_agents, manage_sites, manage_blog, manage_listings; an admin account only). They wrap the office
// logic in api/_lib/bots/, so an AI can do everything the bot API did: add agents, build and edit any agent's website, write blog posts, create
// and edit listings. Everything it creates starts as a draft unless the tool is told otherwise. There are no delete tools.
import * as agents from "./bots/agents.js";
import * as sites from "./bots/sites.js";
import * as sales from "./bots/sales.js";
import * as posts from "./bots/posts.js";
import * as listings from "./bots/listings.js";
import * as alerts from "./bots/alerts.js";
import { importListing } from "./bots/importListing.js";
import { listingFields, postFields, saleFields, siteFields } from "./toolFields.js";
import { HttpError } from "./bots/util.js";
import { WRITES, bool, int, obj, str } from "./mcpWriteTools.js";
import { act, idOf, look, render, strip } from "./mcpAct.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const ADMIN = { needAdmin: true };
const withGrant = (...grant) => ({ needAdmin: true, grant });

// An agent's website id when none was given: the signed-in owner's own site.
async function siteIdFor(ctx, given) {
  if (given) return given;
  const { data } = await ctx.client.from("agent_sites").select("id").eq("agent_id", ctx.ownerId).maybeSingle();
  if (!data) throw new HttpError(404, "You don't have a website yet. Pass site_id (see list_sites) or create_site first.");
  return data.id;
}

// One tool from a table row: a look (no change) or an act (a change, logged).
const reader = (name, title, scope, description, inputSchema, grant, fn) => ({ name, title, scope, description, inputSchema, annotations: READ, run: (sb, u, a, x) => look(sb, u, x, withGrant(...grant), (ctx, req) => fn(ctx, a || {}, req).then((r) => render("", r).trimStart())) });
const writer = (name, title, scope, description, inputSchema, grant, fn) => ({
  name, title, scope, description, inputSchema, annotations: WRITES,
  run: (sb, u, a, x) => act(name, sb, u, x, withGrant(...grant), async (ctx, req) => {
    const r = await fn(ctx, a || {}, req);
    return { text: render(`Done: ${title}.`, r), audit: `${name}${idOf(r) ? ` ${idOf(r)}` : ""}` };
  }),
});

const siteId = (d = "Site id from list_sites") => str(d);

export const ADMIN_TOOLS = [
  // ---- agents ----
  reader("list_agents", "List agents", "manage_agents", "Everyone in the office (agents and admins) with their id, contact details, access switches and website id.", obj(), [], (ctx) => agents.listAgents(ctx)),
  reader("get_agent", "Get an agent", "manage_agents", "One agent's details.", obj({ agent_id: str("Agent id from list_agents") }, ["agent_id"]), [], (ctx, a) => agents.getAgent(ctx, a.agent_id)),
  writer("add_agent", "add an agent", "manage_agents",
    "Add an agent to the dashboard. By default this makes a profile only: no email goes out and they can't sign in until an admin enables it. Only set send_invite: true when the owner asks you to email them an invitation. The new agent's role is always agent. To build their website, follow with create_site.",
    obj({ email: str("Their email address"), full_name: str("Full name"), title: str("e.g. Real Estate Agent"), license: str("License number"), phone: str("Phone"), photo_url: str("A picture address for their headshot"), site_access: { type: "string", enum: ["full", "limited", "none"], description: "full = every part of their site (default), limited = blog posts only, none = no website" }, people_enabled: bool("Turn on People and Deals for them"), send_invite: bool("Email them a sign-in link. Default false.") }, ["email", "full_name"]),
    ["agents"], (ctx, a, req) => agents.createAgent(ctx, a, req)),

  // ---- websites ----
  reader("list_sites", "List agent websites", "manage_sites", "Every agent website in the office: id, agent, address, status, theme and layout.", obj(), [], (ctx, a, req) => sites.listSites(ctx, req)),
  reader("get_site", "Get a website", "manage_sites", "One agent's website with its areas, testimonials and past sales.", obj({ site_id: siteId() }, ["site_id"]), [], (ctx, a, req) => sites.getSite(ctx, a.site_id, req)),
  writer("create_site", "create a website", "manage_sites", "Create an agent's website (a draft unless status is published). Areas, testimonials and past sales can be sent in the same call.", obj({ agent_id: str("Agent id from list_agents"), ...siteFields }, ["agent_id"]), ["sites"], (ctx, a, req) => sites.createSite(ctx, a, req)),
  writer("update_site", "change a website", "manage_sites", "Change any part of an agent's website: tagline, bio, theme, layout, header and footer, menu order, home sections, social links, SEO, hero photo, status. Send only what changes. Setting status to published makes it live, so confirm with the owner first. Areas, testimonials and past sales sent here are added.", obj({ site_id: siteId(), ...siteFields }, ["site_id"]), ["sites"], (ctx, a, req) => sites.updateSite(ctx, a.site_id, strip(a, "site_id"), req)),
  writer("add_site_areas", "add areas of expertise", "manage_sites", "Add areas of expertise (neighborhoods) to an agent's website.", obj({ site_id: siteId(), areas: siteFields.areas }, ["site_id", "areas"]), ["sites"], (ctx, a) => sites.addAreas(ctx, a.site_id, { areas: a.areas })),
  writer("add_site_testimonials", "add testimonials", "manage_sites", "Add client testimonials to an agent's website.", obj({ site_id: siteId(), testimonials: siteFields.testimonials }, ["site_id", "testimonials"]), ["sites"], (ctx, a) => sites.addTestimonials(ctx, a.site_id, { testimonials: a.testimonials })),
  reader("list_past_sales", "List past sales", "manage_sites", "The past sales shown on an agent's website (Recently Sold).", obj({ site_id: siteId() }, ["site_id"]), [], (ctx, a) => sales.listSales(ctx, a.site_id)),
  writer("add_past_sales", "add past sales", "manage_sites", "Add past sales to an agent's website. Each needs an address, or a listing_id to copy the address, price and first photo from.", obj({ site_id: siteId(), sales: { type: "array", maxItems: 30, items: obj(saleFields) } }, ["site_id", "sales"]), ["sites"], (ctx, a) => sales.addSales(ctx, a.site_id, { sales: a.sales })),
  writer("update_past_sale", "change a past sale", "manage_sites", "Change one past sale (send only what changes).", obj({ sale_id: str("Sale id from list_past_sales"), ...saleFields }, ["sale_id"]), ["sites"], (ctx, a) => sales.updateSale(ctx, a.sale_id, strip(a, "sale_id"))),

  // ---- blog ----
  reader("list_posts", "List blog posts", "manage_blog", "An agent website's blog posts (titles, status, dates, links). Leave site_id out for the owner's own site.", obj({ site_id: siteId("Site id; omit for your own site"), status: { type: "string", enum: ["draft", "published", "scheduled"] }, limit: int("Max posts (default 50)") }), [], async (ctx, a, req) => posts.listPosts(ctx, await siteIdFor(ctx, a.site_id), { status: a.status, limit: a.limit }, req)),
  reader("get_post", "Get a blog post", "manage_blog", "One blog post including its full text.", obj({ post_id: str("Post id from list_posts") }, ["post_id"]), [], (ctx, a, req) => posts.getPost(ctx, a.post_id, req)),
  writer("create_post", "create a blog post", "manage_blog", "Write a blog post on an agent's website (the owner's own site when site_id is left out). It is a draft unless status says otherwise; only publish or schedule when the owner asks. Write the body in markdown (## for sections).", obj({ site_id: siteId("Site id; omit for your own site"), ...postFields }, ["title"]), ["blog"], async (ctx, a, req) => posts.createPost(ctx, await siteIdFor(ctx, a.site_id), strip(a, "site_id"), req)),
  writer("update_post", "edit a blog post", "manage_blog", "Edit a blog post: title, text, category, picture, status, date or pin. Send only what changes. Setting status to published makes it live; confirm with the owner first.", obj({ post_id: str("Post id from list_posts"), ...postFields }, ["post_id"]), ["blog"], (ctx, a, req) => posts.updatePost(ctx, a.post_id, strip(a, "post_id"), req)),

  // ---- listings ----
  reader("office_listings", "List office listings", "manage_listings", "Every listing in the office (any agent's), with status, price and address.", obj({ status: { type: "string", enum: ["draft", "coming_soon", "for_sale", "pending", "closed", "off_market"] }, agent_id: str("Only this agent's listings"), limit: int("Max listings (default 50)") }), [], (ctx, a, req) => listings.listListings(ctx, a, req)),
  reader("office_listing", "Get an office listing", "manage_listings", "One listing in full: details, description, features, open houses and photo count.", obj({ listing_id: str("Listing id from office_listings") }, ["listing_id"]), [], (ctx, a, req) => listings.getListing(ctx, a.listing_id, req)),
  writer("create_listing", "create a listing", "manage_listings", "Create a property listing for an agent (the owner when agent_id is left out). It is a draft unless status says otherwise. Photos are picture addresses that get downloaded and stored.", obj({ agent_id: str("Agent id from list_agents; omit for yourself"), ...listingFields }, ["address_line1", "city", "state", "zip"]), ["listings"], (ctx, a, req) => listings.createListing(ctx, { ...a, agent_id: a.agent_id || ctx.ownerId }, req)),
  writer("update_listing", "change a listing", "manage_listings", "Change a listing: price, status, description, features, photos, open houses, site settings. Send only what changes. Moving it out of draft makes it public; confirm with the owner first.", obj({ listing_id: str("Listing id from office_listings"), ...listingFields }, ["listing_id"]), ["listings"], (ctx, a, req) => listings.updateListing(ctx, a.listing_id, strip(a, "listing_id"), req)),
  writer("add_listing_photos", "add listing photos", "manage_listings", "Add photos to a listing from picture addresses (up to 25 a call).", obj({ listing_id: str("Listing id"), photos: listingFields.photos, set_hero_first: bool("Make the first photo the hero") }, ["listing_id", "photos"]), ["listings"], (ctx, a) => listings.addListingPhotos(ctx, a.listing_id, { photos: a.photos, set_hero_first: a.set_hero_first })),
  writer("import_listing", "start a listing from a link", "manage_listings", "Start a listing from a Zillow, Redfin or Realtor.com link, an MLS number or an address. It reads the address from the link and looks the home up in the office's MLS feed for price, rooms, description and photos, and says what is missing. Send create: true with agent_id to save it as a draft listing.", obj({ source_url: str("Property link"), mls_number: str(""), address_line1: str(""), city: str(""), state: str(""), zip: str(""), create: bool("Save it as a draft listing"), agent_id: str("Needed with create"), confirm_own_listing: bool("Only if the MLS says another office listed it"), ...listingFields }), ["listings"], (ctx, a, req) => importListing(ctx, { ...a, agent_id: a.agent_id || (a.create ? ctx.ownerId : undefined) }, req)),
  reader("domain_alerts", "Website domain problems", "manage_listings", "Property-site domains that have stopped responding or never worked, with the likely cause and fix. Set check_now to re-check first (up to a minute).", obj({ check_now: bool("Check every domain now before answering") }), ["monitoring"], (ctx, a) => (a.check_now ? alerts.checkNow(ctx) : alerts.listAlerts(ctx))),
];

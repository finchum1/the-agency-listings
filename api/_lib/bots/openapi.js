// The OpenAPI description of the bot API (served at /v1/openapi.json, no token needed). Give this address to a bot or an
// API tool and it can see every endpoint, field and example without reading code.
const idParam = (name, desc) => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" }, description: desc });
const json = (schema, description = "OK") => ({ description, content: { "application/json": { schema } } });
const body = (schema, example) => ({ required: true, content: { "application/json": { schema, ...(example ? { example } : {}) } } });
const obj = (properties, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const num = (description) => ({ type: "number", description });
const free = { type: "object", additionalProperties: true };
const errors = { 400: json(obj({ error: str("What was wrong") }), "Bad request"), 401: json(obj({ error: str("") }), "Missing or invalid token"), 403: json(obj({ error: str("") }), "The token lacks the needed scope"), 404: json(obj({ error: str("") }), "Not found"), 409: json(obj({ error: str("") }), "Conflict, for example a duplicate") };
const op = (summary, scope, extra) => ({ summary, description: scope ? `Needs the \`${scope}\` scope.` : "Any valid token.", security: [{ bearer: [] }], responses: { 200: json(free), ...errors }, ...extra });

const siteFields = {
  slug: str("Web address name, e.g. terri-boushon. Made from the agent's name if omitted."),
  status: str("draft (default) or published", { enum: ["draft", "published"] }),
  tagline: str("Short line under the name"),
  region: str("Region or metro area, e.g. Oklahoma City Metro"),
  theme: str("Color theme", { enum: ["classic", "dark", "sand", "red", "linen"] }),
  layout: str("Page layout", { enum: ["classic", "editorial", "bold", "portrait", "listings"] }),
  font_pairing: str("Font pairing", { enum: ["playfair-jost", "fraunces-inter", "cormorant-worksans", "libre-karla", "bodoni-manrope", "dmserif-dmsans"] }),
  header_style: str("", { enum: ["classic", "floating"] }),
  button_style: str("", { enum: ["square", "pill"] }),
  home_sections: { type: "array", items: { type: "string", enum: ["bio", "testimonials", "listings", "areas", "blog"] }, description: "Which home page sections show, in order" },
  bio_markdown: str("The About text in markdown (headings, bold, italic, links)"),
  stats: { type: "array", maxItems: 6, items: obj({ label: str("e.g. Homes sold"), value: str("e.g. 150+") }, ["label", "value"]) },
  instagram_url: str(""), facebook_url: str(""), linkedin_url: str(""), tiktok_url: str(""), youtube_url: str(""), x_url: str(""),
  hero_photo_source_url: str("A public picture address; it is downloaded and stored"),
  seo_title: str(""), seo_description: str(""),
  areas: { type: "array", items: obj({ name: str(""), slug: str(""), blurb: str("One sentence"), description_markdown: str(""), photo_source_url: str("") }, ["name"]) },
  testimonials: { type: "array", items: obj({ quote: str(""), author: str("") }, ["quote", "author"]) },
};

const listingFields = {
  status: str("draft (default), coming_soon, for_sale, pending, closed or off_market", { enum: ["draft", "coming_soon", "for_sale", "pending", "closed", "off_market"] }),
  mls_number: str(""), address_line1: str("Street address"), city: str(""), state: str("2-letter state"), zip: str(""),
  price: num("Asking price in dollars"), beds: { type: "integer" }, baths: num("5.2 means 5 full and 2 half"), sqft: { type: "integer" },
  lot_size: str("e.g. 0.75+ acres"), year_built: str(""), garage: str("e.g. 4-car"), property_type: str("e.g. Single Family Home"),
  description: str("Paragraphs separated by a blank line"),
  features: { type: "array", items: obj({ category: str("e.g. Interior"), items: { type: "array", items: { type: "string" } } }, ["category", "items"]) },
  photos: { type: "array", maxItems: 25, items: { oneOf: [{ type: "string" }, obj({ url: str(""), caption: str(""), alt: str("") }, ["url"])] }, description: "Public picture addresses; they are downloaded and stored. The first becomes the hero. Up to 25 per call." },
  open_houses: { type: "array", items: obj({ starts_at: str("ISO date-time"), ends_at: str("ISO date-time"), notes: str("") }, ["starts_at"]) },
  site_template: str("", { enum: ["classic", "luxury"] }), theme: str("", { enum: ["classic", "dark", "sand", "red", "linen"] }),
  header_style: str("", { enum: ["classic", "floating"] }), header_label: str("Text beside the logo, e.g. Nichols Hills"), custom_domain: str(""),
  hero_video_url: str(""), seo_title: str(""), seo_description: str(""), slug: str(""),
};

const postFields = {
  title: str(""), body_markdown: str("The post in markdown. Use ## for sections. Lists become bullet lines."), body_html: str("Or HTML (only p, h2, h3, strong, em, u, br, a are kept)"),
  excerpt: str("Defaults to the first lines of the body"), category: str("e.g. Market Update, Neighborhood Guide"), post_date: str("YYYY-MM-DD, defaults to today"),
  status: str("draft (default), published or scheduled", { enum: ["draft", "published", "scheduled"] }), scheduled_at: str("ISO date-time; required when scheduled"),
  image_url: str("A picture address to use as is"), image_source_url: str("A public picture address to download and store"), slug: str(""),
};

export function buildSpec(origin) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Latchpoint Real Estate bot API",
      version: "1.0.0",
      description:
        "Create and edit blog posts, agents, agent websites and property listings. Authenticate with a personal token (My Profile > Bot API access) sent as `Authorization: Bearer <token>`. Each token has scopes: `blog`, `agents`, `sites`, `listings`. Everything it creates starts as a DRAFT unless you say otherwise. There are no delete endpoints.",
    },
    servers: [{ url: `${origin}/v1` }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Token from My Profile > Bot API access" } } },
    paths: {
      "/me": { get: op("Who this token is and what it can do", null) },
      "/agents": {
        get: op("List the agents in your organization", null),
        post: op("Add an agent", "agents", {
          requestBody: body(
            obj({ email: str(""), full_name: str(""), title: str(""), license: str(""), phone: str(""), photo_url: str(""), send_invite: { type: "boolean", description: "Email them a sign-in link. Default false: a profile only, no email." }, site_access: str("", { enum: ["full", "limited", "none"] }), people_enabled: { type: "boolean" }, site: obj(siteFields, []) }, ["email", "full_name"]),
            { email: "terri@example.com", full_name: "Terri Boushon", title: "Real Estate Agent", license: "123456", phone: "405-555-0100" },
          ),
        }),
      },
      "/agents/{id}": { get: op("One agent", null, { parameters: [idParam("id", "Agent id")] }) },
      "/sites": {
        get: op("List agent websites", null),
        post: op("Create an agent's website (a draft unless status is published)", "sites", { requestBody: body(obj({ agent_id: str("From GET /agents", { format: "uuid" }), ...siteFields }, ["agent_id"]), { agent_id: "00000000-0000-4000-8000-000000000000", tagline: "Trusted guidance. Exceptional results.", region: "Oklahoma City Metro", layout: "editorial", bio_markdown: "I grew up here...\n\nWhen I'm not working..." }) }),
      },
      "/sites/{id}": {
        get: op("One site with its areas and testimonials", null, { parameters: [idParam("id", "Site id")] }),
        patch: op("Change a site (send only what changes; areas and testimonials are added)", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj(siteFields)) }),
      },
      "/sites/{id}/areas": { post: op("Add areas of expertise", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj({ areas: siteFields.areas }, ["areas"])) }) },
      "/sites/{id}/testimonials": { post: op("Add testimonials", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj({ testimonials: siteFields.testimonials }, ["testimonials"])) }) },
      "/sites/{id}/posts": {
        get: op("List a site's blog posts", null, { parameters: [idParam("id", "Site id"), { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "scheduled"] } }, { name: "limit", in: "query", schema: { type: "integer" } }] }),
        post: op("Add a blog post (a draft unless status says otherwise)", "blog", { parameters: [idParam("id", "Site id")], requestBody: body(obj(postFields, ["title"]), { title: "Best Parks in Edmond", category: "Community Feature", body_markdown: "## Why parks matter\n\nEdmond has...", status: "draft" }) }),
      },
      "/posts/{id}": {
        get: op("One blog post including its body", null, { parameters: [idParam("id", "Post id")] }),
        patch: op("Edit a blog post (send only what changes)", "blog", { parameters: [idParam("id", "Post id")], requestBody: body(obj(postFields)) }),
      },
      "/listings": {
        get: op("List property listings", null, { parameters: [{ name: "status", in: "query", schema: { type: "string" } }, { name: "agent_id", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }] }),
        post: op("Create a property listing (a draft unless status says otherwise)", "listings", { requestBody: body(obj({ agent_id: str("From GET /agents", { format: "uuid" }), ...listingFields }, ["agent_id", "address_line1", "city", "state", "zip"]), { agent_id: "00000000-0000-4000-8000-000000000000", address_line1: "1645 Saratoga Way", city: "Edmond", state: "OK", zip: "73003", price: 1385000, beds: 4, baths: 5.2, sqft: 6886, description: "Set on three-quarters of an acre...", photos: ["https://example.com/front.jpg"] }) }),
      },
      "/listings/import": {
        post: op("Start a listing from a Zillow, Redfin or Realtor.com link, an MLS number or an address", "listings", {
          description:
            "Reads the address out of the link (the page itself is never fetched: Zillow blocks that) and looks the home up in the office's MLS feed for price, rooms, description and photos. Returns what it found plus a `missing` list. Send `create: true` with `agent_id` to create the listing as a draft in the same call; any other fields you send override what was found.",
          requestBody: body(obj({ source_url: str("Zillow, Redfin or Realtor.com property link"), mls_number: str(""), address_line1: str(""), city: str(""), state: str(""), zip: str(""), create: { type: "boolean" }, agent_id: str("Required with create", { format: "uuid" }), confirm_own_listing: { type: "boolean", description: "Needed only if the MLS says another office listed it" }, ...listingFields }), { source_url: "https://www.zillow.com/homedetails/1645-Saratoga-Way-Edmond-OK-73003/12345_zpid/", create: true, agent_id: "00000000-0000-4000-8000-000000000000" }),
        }),
      },
      "/listings/{id}": {
        get: op("One listing in full", null, { parameters: [idParam("id", "Listing id")] }),
        patch: op("Change a listing (send only what changes; photos and open houses are added)", "listings", { parameters: [idParam("id", "Listing id")], requestBody: body(obj(listingFields)) }),
      },
      "/listings/{id}/photos": { post: op("Add photos from picture addresses", "listings", { parameters: [idParam("id", "Listing id")], requestBody: body(obj({ photos: listingFields.photos, set_hero_first: { type: "boolean", description: "Make the first photo in this call the hero" } }, ["photos"])) }) },
    },
  };
}

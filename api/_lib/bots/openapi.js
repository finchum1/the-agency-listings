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

const saleFields = {
  address: str("Street address, e.g. 14 Willow Creek Ln. Required unless listing_id is sent."),
  city: str(""), state: str("e.g. OK"), price: num("Sold price in dollars (optional)"), sold_on: str("YYYY-MM-DD, shown as a \"Sold Oct 2026\" tag"),
  photo_url: str("A picture address to use as is"), photo_source_url: str("A public picture address to download and store"),
  listing_id: str("One of this agent's listings (GET /listings) to copy the address, price and first photo from. Anything else you send wins. A closed listing copied this way no longer shows with the current listings.", { format: "uuid" }),
};

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
  home_sections: { type: "array", items: { type: "string", enum: ["bio", "testimonials", "cards", "listings", "areas", "blog"] }, description: "Which home page sections show, in order. cards is the Sellers / Home Value / Buyers cards." },
  bio_markdown: str("The About text in markdown (headings, bold, italic, links)"),
  stats: { type: "array", maxItems: 6, items: obj({ label: str("e.g. Homes sold"), value: str("e.g. 150+") }, ["label", "value"]) },
  instagram_url: str(""), facebook_url: str(""), linkedin_url: str(""), tiktok_url: str(""), youtube_url: str(""), x_url: str(""),
  hero_photo_source_url: str("A public picture address; it is downloaded and stored"),
  seo_title: str(""), seo_description: str(""),
  areas: { type: "array", items: obj({ name: str(""), slug: str(""), blurb: str("One sentence"), description_markdown: str(""), photo_source_url: str("") }, ["name"]) },
  testimonials: { type: "array", items: obj({ quote: str(""), author: str("") }, ["quote", "author"]) },
  sales: { type: "array", maxItems: 30, items: obj(saleFields), description: "Past sales to add (shown as Recently Sold under the listings)" },
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
  hero_video_url: str(""), video_placement: str("Where the video plays: the hero, above the photo gallery, or both.", { enum: ["hero", "gallery", "both"] }), seo_title: str(""), seo_description: str(""), slug: str(""),
};

const postFields = {
  title: str(""), body_markdown: str("The post in markdown. Use ## for sections. Lists become bullet lines."), body_html: str("Or HTML (only p, h2, h3, strong, em, u, br, a are kept)"),
  excerpt: str("Defaults to the first lines of the body"), category: str("e.g. Market Update, Neighborhood Guide"), post_date: str("YYYY-MM-DD, defaults to today"),
  status: str("draft (default), published or scheduled", { enum: ["draft", "published", "scheduled"] }), scheduled_at: str("ISO date-time; required when scheduled"),
  image_url: str("A picture address to use as is"), image_source_url: str("A public picture address to download and store"), slug: str(""),
  featured_order: { type: ["integer", "null"], minimum: 0, maximum: 3, description: "Pin to the top of the site's blog page: 1, 2 or 3 is its position (up to 3 pinned posts); null or 0 unpins. The home page keeps showing the newest posts. 409 if that slot is held by another post." },
};


const stageFields = {
  stage_group: str("Which board: lead, pipeline or transaction. Moving to another board needs `stage` too.", { enum: ["lead", "pipeline", "transaction"] }),
  stage: str("A column on that board. See GET /people/stages: agents can rename their columns."),
};
const personFields = {
  name: str(""), email: str("Used to refuse duplicates"), phone: str(""),
  source: str("e.g. Open house, Referral, Past client, Sphere of influence (GET /people/stages lists them)"),
  ...stageFields,
  side: str("buyer, seller or both. A transaction must be buyer or seller.", { enum: ["buyer", "seller", "both"] }),
  next_follow_up: str("YYYY-MM-DD"),
  property_address: str("The home in a transaction"), price: num("Contract price"), commission: num("Commission in dollars"),
  other_agent: str(""), title_company: str(""), lender: str(""),
  contract_date: str("YYYY-MM-DD"), inspection_date: str("YYYY-MM-DD"), inspection_period_end: str("YYYY-MM-DD"), inspection_time: str("HH:MM, the time of the home inspection"), appraisal_date: str("YYYY-MM-DD"), financing_deadline: str("YYYY-MM-DD"), closing_date: str("YYYY-MM-DD"),
  is_cash: { type: "boolean", description: "A cash purchase: no appraisal or financing dates" },
  note: str("Adds a note to their card"),
};
const taskFields = {
  title: str(""), due_date: str("YYYY-MM-DD"), recurrence: str("", { enum: ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "quarterly", "yearly"] }),
  list: str("A label such as Clients or Marketing"), start_time: str("HH:MM, to put it on the schedule (needs due_date)"), duration_min: { type: "integer" },
  checklist: { type: "array", items: { type: "string" }, description: "Steps inside the to-do" },
  done: { type: "boolean", description: "true completes it (a repeating to-do moves to its next date)" },
};

export function buildSpec(origin) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Latchpoint Real Estate bot API",
      version: "1.0.0",
      description:
        "Create and edit blog posts, agents, agent websites and property listings, and (scope `people`) run the token owner's own People module: leads, pipeline, transactions, notes, drafted messages and to-dos. People data is private to the person who made the token. Messages a bot writes are DRAFTS the agent approves in the dashboard; nothing is sent. Archive a person instead of deleting. Authenticate with a personal token (My Profile > Bot API access) sent as `Authorization: Bearer <token>`. Each token has scopes: `blog`, `agents`, `sites`, `listings`, `people`, `monitoring`. With `monitoring`, GET /alerts lists what is wrong right now (property-site domains that stopped responding), and the token can have a webhook: the server POSTs a signed JSON event `{ id, event, created_at, data }` to it as things happen (`domain.down`, `domain.recovered`, `test`). Verify a delivery by computing HMAC-SHA256 of `<X-Webhook-Timestamp>.<raw body>` with the webhook secret and comparing it to `X-Webhook-Signature` (`sha256=<hex>`); reject timestamps older than 5 minutes. To fix a domain problem a bot can PATCH the listing's `custom_domain` (a typo is the most common cause); DNS and Vercel changes happen outside this API. Everything it creates starts as a DRAFT unless you say otherwise. There are no delete endpoints.",
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
        get: op("One site with its areas, testimonials and past sales", null, { parameters: [idParam("id", "Site id")] }),
        patch: op("Change a site (send only what changes; areas, testimonials and sales are added)", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj(siteFields)) }),
      },
      "/sites/{id}/areas": { post: op("Add areas of expertise", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj({ areas: siteFields.areas }, ["areas"])) }) },
      "/sites/{id}/testimonials": { post: op("Add testimonials", "sites", { parameters: [idParam("id", "Site id")], requestBody: body(obj({ testimonials: siteFields.testimonials }, ["testimonials"])) }) },
      "/sites/{id}/sales": {
        get: op("List a site's past sales", null, { parameters: [idParam("id", "Site id")] }),
        post: op("Add past sales (shown as Recently Sold right under the site's current listings)", "sites", {
          description: "Needs the `sites` scope. Send one sale as the body, or several as `{ sales: [...] }` (up to 30). Each needs an address, or a `listing_id` to copy the address, price and first photo from.",
          parameters: [idParam("id", "Site id")],
          requestBody: body(obj({ ...saleFields, sales: { type: "array", maxItems: 30, items: obj(saleFields) } }), { sales: [{ address: "14 Willow Creek Ln", city: "Edmond", state: "OK", price: 412000, sold_on: "2026-09-18", photo_source_url: "https://example.com/front.jpg" }] }),
        }),
      },
      "/sales/{id}": { patch: op("Edit a past sale (send only what changes)", "sites", { parameters: [idParam("id", "Sale id")], requestBody: body(obj(saleFields)) }) },
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
      "/people/overview": { get: op("Counts per board and stage, follow-ups due, closings coming up, drafts waiting", "people") },
      "/people/stages": { get: op("The columns on each board (the agent's own names), sources, archive reasons", "people") },
      "/people": {
        get: op("List people", "people", { parameters: [{ name: "group", in: "query", schema: { type: "string", enum: ["lead", "pipeline", "transaction"] } }, { name: "stage", in: "query", schema: { type: "string" } }, { name: "q", in: "query", schema: { type: "string" }, description: "Name, email, phone or address" }, { name: "follow_up", in: "query", schema: { type: "string", enum: ["overdue", "today", "week"] } }, { name: "archived", in: "query", schema: { type: "string", enum: ["false", "true", "all"] } }, { name: "side", in: "query", schema: { type: "string" } }, { name: "source", in: "query", schema: { type: "string" } }, { name: "order", in: "query", schema: { type: "string", enum: ["updated", "follow_up"] } }, { name: "limit", in: "query", schema: { type: "integer" } }, { name: "offset", in: "query", schema: { type: "integer" } }] }),
        post: op("Add a lead, pipeline contact or transaction", "people", {
          description: "Lands on the Leads board in the first column unless you say otherwise. Refuses (409) if someone with that email is already in People, unless `allow_duplicate` is true.",
          requestBody: body(obj({ ...personFields, allow_duplicate: { type: "boolean" } }, ["name"]), { name: "Jane Smith", email: "jane@example.com", phone: "405-555-0142", source: "Open house", side: "buyer", next_follow_up: "2026-10-28", note: "Met at 88 Lakeview open house. Pre-approved to 450k." }),
        }),
      },
      "/people/{id}": {
        get: op("One person with notes, drafts and (for a transaction) checklist progress", "people", { parameters: [idParam("id", "Person id")] }),
        patch: op("Change a person: details, follow-up, stage, move between boards, archive", "people", {
          description: "Send only what changes. To move boards send `stage_group` and `stage`. A transaction needs side buyer or seller. Archive with `archived: true` and an `archived_reason`; `archived: false` brings them back. There is no delete.",
          parameters: [idParam("id", "Person id")],
          requestBody: body(obj({ ...personFields, archived: { type: "boolean" }, archived_reason: str("Deal fell through, Went with another agent, Not interested, Not responding, Timing / no longer moving, Other") })),
        }),
      },
      "/people/{id}/notes": {
        get: op("A person's notes, newest first", "people", { parameters: [idParam("id", "Person id")] }),
        post: op("Add a note (log a call, a conversation, what they want)", "people", { parameters: [idParam("id", "Person id")], requestBody: body(obj({ body: str("The note") }, ["body"]), { body: "Called. Wants to see 3 homes in Edmond this Saturday." }) }),
      },
      "/people/{id}/outreach": {
        post: op("Draft an email, text or call talking points for the agent to approve", "people", {
          description: "Nothing is sent. The draft shows on the person's card in the dashboard (and on the People overview) where the agent opens it in their own email or messages app, sends it, and marks it sent. Needs an email on file for email and a phone number for text or call. Max 10 waiting per person.",
          parameters: [idParam("id", "Person id")],
          requestBody: body(obj({ channel: str("", { enum: ["email", "text", "call"] }), subject: str("Email only"), body: str("The message, or for a call the talking points") }, ["channel", "body"]), { channel: "email", subject: "Homes for Saturday", body: "Hi Jane, I lined up three homes for Saturday morning..." }),
        }),
      },
      "/outreach": { get: op("Drafts and their status", "people", { parameters: [{ name: "status", in: "query", schema: { type: "string", enum: ["draft", "sent", "discarded"] } }, { name: "person_id", in: "query", schema: { type: "string" } }, { name: "limit", in: "query", schema: { type: "integer" } }] }) },
      "/outreach/{id}": { patch: op("Edit a waiting draft or discard it. A bot cannot mark one sent.", "people", { parameters: [idParam("id", "Draft id")], requestBody: body(obj({ subject: str(""), body: str(""), status: str("Only discarded", { enum: ["discarded"] }) })) }) },
      "/people/{id}/checklist": { get: op("A transaction's task and document checklists with due dates and progress", "people", { parameters: [idParam("id", "Person id")] }) },
      "/people/{id}/checklist/apply": { post: op("Fill an empty checklist from the agent's template for the deal's side", "people", { description: "The deal needs a side (buyer or seller). Refuses (409) if it already has that checklist.", parameters: [idParam("id", "Person id")], requestBody: body(obj({ kind: str("tasks, documents or both (default)", { enum: ["tasks", "documents", "both"] }) })) }) },
      "/people/{id}/checklist/tasks": { post: op("Add a checklist task to a transaction", "people", { parameters: [idParam("id", "Person id")], requestBody: body(obj({ text: str(""), section: str(""), anchor: str("Date it counts from", { enum: ["contract_date", "inspection_date", "closing_date"] }), offset_days: { type: "integer", description: "Days after (positive) or before (negative) the anchor" }, due_override: str("YYYY-MM-DD, pins it to a date") }, ["text"])) }) },
      "/checklist/tasks/{id}": { patch: op("Tick off or change a checklist task", "people", { parameters: [idParam("id", "Task id")], requestBody: body(obj({ done: { type: "boolean" }, text: str(""), section: str(""), anchor: str("", { enum: ["contract_date", "inspection_date", "closing_date"] }), offset_days: { type: "integer" }, due_override: str("YYYY-MM-DD, or null to clear") })) }) },
      "/people/{id}/checklist/documents": { post: op("Add a document to collect on a transaction", "people", { parameters: [idParam("id", "Person id")], requestBody: body(obj({ text: str(""), section: str("") }, ["text"])) }) },
      "/checklist/documents/{id}": { patch: op("Mark a document collected or change it", "people", { parameters: [idParam("id", "Document id")], requestBody: body(obj({ done: { type: "boolean" }, text: str(""), section: str("") })) }) },
      "/tasks": {
        get: op("The agent's own to-do list", "people", { parameters: [{ name: "done", in: "query", schema: { type: "string", enum: ["false", "true", "all"] } }, { name: "due", in: "query", schema: { type: "string", enum: ["overdue", "today", "week"] } }, { name: "limit", in: "query", schema: { type: "integer" } }] }),
        post: op("Add a to-do", "people", { requestBody: body(obj(taskFields, ["title"]), { title: "Call Jane about Saturday showings", due_date: "2026-10-24", list: "Clients" }) }),
      },
      "/tasks/{id}": { patch: op("Change or complete a to-do", "people", { parameters: [idParam("id", "Task id")], requestBody: body(obj(taskFields)) }) },
      "/alerts": { get: op("What is wrong right now: property-site domains that aren't responding", "monitoring", { description: "Needs the `monitoring` scope. Each alert has `severity` (`down`: it was working and stopped; `setup`: it has never worked yet), the domain, `status` (no_dns, not_attached, elsewhere, tls, timeout, unreachable), a plain-English `reason`, a `suggested_fix`, and the listing and agent. Refreshed every 15 minutes; use POST /alerts/check to refresh right after a fix." }) },
      "/alerts/check": { post: op("Check the office's domains now, then return the alerts", "monitoring", { description: "Needs the `monitoring` scope. Runs the same check as the schedule (it can take up to a minute with many domains), and sends the usual emails and webhooks if something changed. One check per 30 seconds." }) },
      "/alerts/test": { post: op("Send a sample `test` event to this token's webhook", "monitoring", { description: "Needs the `monitoring` scope and a webhook set on the token. Returns whether it was delivered and the response code." }) },
      "/listings/{id}/photos": { post: op("Add photos from picture addresses", "listings", { parameters: [idParam("id", "Listing id")], requestBody: body(obj({ photos: listingFields.photos, set_hero_first: { type: "boolean", description: "Make the first photo in this call the hero" } }, ["photos"])) }) },
    },
  };
}

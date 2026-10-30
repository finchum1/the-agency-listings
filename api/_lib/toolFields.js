// Field definitions shared by the AI connection tools (api/_lib/mcpAdminTools.js, mcpDealTools.js): what a website, a listing, a blog post and a
// past sale can have, as JSON Schema, so the tools describe their inputs the same way the code that validates them reads them.
const obj = (properties, required = []) => ({ type: "object", properties, ...(required.length ? { required } : {}) });
const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const num = (description) => ({ type: "number", description });

export const saleFields = {
  address: str("Street address, e.g. 14 Willow Creek Ln. Required unless listing_id is sent."),
  city: str(""), state: str("e.g. OK"), price: num("Sold price in dollars (optional)"), sold_on: str("YYYY-MM-DD, shown as a \"Sold Oct 2026\" tag"),
  photo_url: str("A picture address to use as is"), photo_source_url: str("A public picture address to download and store"),
  listing_id: str("One of this agent's listings (GET /listings) to copy the address, price and first photo from. Anything else you send wins. A closed listing copied this way no longer shows with the current listings.", { format: "uuid" }),
};

export const siteFields = {
  slug: str("Web address name, e.g. terri-boushon. Made from the agent's name if omitted."),
  status: str("draft (default) or published", { enum: ["draft", "published"] }),
  tagline: str("Short line under the name"),
  region: str("Region or metro area, e.g. Oklahoma City Metro"),
  theme: str("Color theme", { enum: ["classic", "dark", "sand", "red", "linen"] }),
  layout: str("Page layout", { enum: ["classic", "editorial", "bold", "portrait", "listings", "luxury", "warm", "guide"] }),
  font_pairing: str("Font pairing", { enum: ["playfair-jost", "fraunces-inter", "cormorant-worksans", "libre-karla", "bodoni-manrope", "dmserif-dmsans"] }),
  header_style: str("", { enum: ["classic", "floating", "centered", "centered_pill", "stacked", "minimal"] }),
  footer_style: str("", { enum: ["classic", "centered", "cta", "wide", "slim"] }),
  footer_cta_heading: str("Headline of the call to action footer band (empty for the default)"), footer_cta_text: str("Line under the headline"), footer_cta_button: str("Button label"), footer_blurb: str("Short blurb in the four-column footer"),
  nav_order: { type: "array", items: { type: "string" }, description: "Page paths in the order of the header and footer menus, e.g. [\"/about\", \"/sellers\", \"/contact\"]. Empty for the standard order." },
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

export const listingFields = {
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

export const postFields = {
  title: str(""), body_markdown: str("The post in markdown. Use ## for sections. Lists become bullet lines."), body_html: str("Or HTML (only p, h2, h3, strong, em, u, br, a are kept)"),
  excerpt: str("Defaults to the first lines of the body"), category: str("e.g. Market Update, Neighborhood Guide"), post_date: str("YYYY-MM-DD, defaults to today"),
  status: str("draft (default), published or scheduled", { enum: ["draft", "published", "scheduled"] }), scheduled_at: str("ISO date-time; required when scheduled"),
  image_url: str("A picture address to use as is"), image_source_url: str("A public picture address to download and store"), slug: str(""),
  featured_order: { type: ["integer", "null"], minimum: 0, maximum: 3, description: "Pin to the top of the site's blog page: 1, 2 or 3 is its position (up to 3 pinned posts); null or 0 unpins. The home page keeps showing the newest posts. 409 if that slot is held by another post." },
};

// The newsletter email. One function builds the HTML and plain text from the newsletter's blocks, and it runs in two places: in the editor (for the live
// preview) and on the server (for what is actually sent), so what the agent sees is what recipients get. Pure: it fetches nothing; the caller passes in
// the listings, the agent and the brokerage. Email clients are old and fussy, so this is tables with inline styles, nothing newer.

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nl2br = (v) => esc(v).replace(/\r?\n/g, "<br>");
/** Only web, mail and phone links; anything else becomes "#". */
export const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:)/i.test(String(u || "").trim()) ? String(u).trim() : "#");

const INK = "#1c1a17";
const MUTED = "#6b6762";
const RED = "#ed2127";
const CREAM = "#f0ede5";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const luminance = (hex) => {
  const n = parseInt(String(hex).slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const BANNER_COLORS = [
  { name: "Agency red", hex: "#ed2127" },
  { name: "Ink", hex: "#14130f" },
  { name: "Cream", hex: "#f0ede5" },
  { name: "Sand", hex: "#ddd0ba" },
];

/** The kinds of block an agent can add, with what a new one starts as. */
export const BLOCK_TYPES = {
  text: { label: "Text", make: () => ({ type: "text", heading: "", body: "" }) },
  listing: { label: "Listing", make: () => ({ type: "listing", listingId: "", heading: "Featured Listing", layout: "side", linkTo: "property", cta: "Request a private showing", note: "" }) },
  openhouse: { label: "Open house", make: () => ({ type: "openhouse", listingId: "", heading: "Open House", layout: "side", linkTo: "property", cta: "View the home", note: "" }) },
  post: { label: "Blog post", make: () => ({ type: "post", postId: "", cta: "Read the post" }) },
  banner: { label: "Banner", make: () => ({ type: "banner", heading: "", body: "", color: "#ed2127" }) },
  button: { label: "Button", make: () => ({ type: "button", label: "Learn more", url: "" }) },
  divider: { label: "Divider", make: () => ({ type: "divider" }) },
};

const STATUS_LABEL = { coming_soon: "Coming soon", for_sale: "For sale", pending: "Under contract", closed: "Sold" };
const money = (n) => (n || n === 0 ? `$${Math.round(Number(n)).toLocaleString("en-US")}` : "");

/**
 * What a listing block shows, from a listing row (its hero photo and open houses passed in). `origin` is the app's address; `siteBase` is the agent's own
 * website address (a custom domain, or <origin>/sites/<slug>), so a block can link to the property site or to the agent's listings page.
 */
export function listingCardData(listing, { photoUrl = "", openHouses = [], origin = "", siteBase = "", now = new Date() } = {}) {
  if (!listing) return null;
  const domain = String(listing.custom_domain || "").trim();
  const next = (openHouses || []).find((o) => new Date(o.ends_at || o.starts_at) >= now);
  const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).replace(":00", "");
  const day = next ? new Date(next.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" }) : "";
  const time = next ? (next.ends_at ? `${clock(new Date(next.starts_at))} – ${clock(new Date(next.ends_at))}` : clock(new Date(next.starts_at))) : "";
  const bedsBaths = [listing.beds ? `${Number(listing.beds)} ${Number(listing.beds) === 1 ? "Bed" : "Beds"}` : "", listing.baths ? `${Number(listing.baths)} ${Number(listing.baths) === 1 ? "Bath" : "Baths"}` : ""].filter(Boolean).join("  |  ");
  const lot = String(listing.lot_size || "").trim();
  const area = [listing.sqft ? `${Number(listing.sqft).toLocaleString("en-US")} SqFt` : "", lot ? `${lot} Lot` : ""].filter(Boolean).join("  |  ");
  return {
    address: listing.address_line1 || "",
    place: [listing.city, [listing.state, listing.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    price: money(listing.price),
    specs: [bedsBaths, area].filter(Boolean),
    status: STATUS_LABEL[listing.status] || "",
    photo: photoUrl,
    url: domain ? `https://${domain}` : `${origin}/listings/${listing.slug}`,
    websiteUrl: siteBase ? `${siteBase}/listings` : "",
    openHouse: next ? { day, time } : null,
  };
}

/** What a blog post block shows, from an agent_site_posts row. */
export function postCardData(post, { siteBase = "" } = {}) {
  if (!post) return null;
  return {
    title: post.title || "",
    category: post.category || "",
    date: post.post_date ? new Date(`${post.post_date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "",
    excerpt: post.excerpt || "",
    image: post.image_url || "",
    url: siteBase ? `${siteBase}/blog/${post.slug}` : "",
  };
}

const button = (label, href, color = RED) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto"><tr><td style="background:${color};border-radius:2px"><a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font:600 13px ${SANS};letter-spacing:.14em;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;

function blockHtml(b, ctx) {
  const wrap = ctx.wrap;
  if (b.type === "text") {
    return `<tr><td style="padding:22px 36px 6px">${b.heading ? `<h2 style="margin:0 0 10px;font:600 24px/1.25 ${SERIF};color:${INK}">${esc(b.heading)}</h2>` : ""}${b.body ? `<p style="margin:0;font:16px/1.65 ${SANS};color:#2b2926">${nl2br(b.body)}</p>` : ""}</td></tr>`;
  }
  if (b.type === "banner") {
    if (!b.heading && !b.body) return "";
    const bg = /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : RED;
    const light = luminance(bg) > 0.42;
    const ink = light ? INK : "#ffffff";
    return `<tr><td style="padding:14px 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background:${bg};padding:38px 28px">${b.heading ? `<div style="font:600 30px/1.2 ${SERIF};color:${ink}">${esc(b.heading)}</div>` : ""}${b.body ? `<div style="margin-top:10px;font:16px/1.55 ${SANS};color:${ink};opacity:.9">${nl2br(b.body)}</div>` : ""}</td></tr></table></td></tr>`;
  }
  if (b.type === "button") {
    if (safeUrl(b.url) === "#") return "";
    return `<tr><td align="center" style="padding:18px 36px">${button(b.label || "Learn more", wrap(safeUrl(b.url)))}</td></tr>`;
  }
  if (b.type === "divider") {
    return `<tr><td style="padding:14px 36px"><div style="border-top:1px solid #e3dfd8;font-size:0;line-height:0">&nbsp;</div></td></tr>`;
  }
  if (b.type === "listing" || b.type === "openhouse") {
    const l = ctx.listings?.[b.listingId];
    if (!l) return "";
    const target = b.linkTo === "website" && l.websiteUrl ? l.websiteUrl : l.url;
    const href = wrap(safeUrl(target));
    const oh = b.type === "openhouse" && l.openHouse ? l.openHouse : null;
    const cta = b.cta || (oh ? "View the home" : "Request a private showing");
    const heading = b.heading ? `<tr><td colspan="2" align="center" style="background:${CREAM};padding:26px 20px;font:400 28px ${SERIF};color:${INK}">${esc(b.heading)}</td></tr>` : "";
    const text = `${oh ? `<div style="font:600 11px ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${RED}">Open house</div><div style="margin:4px 0 14px;font:600 16px/1.35 ${SERIF};color:${INK}">${esc([oh.day, oh.time].filter(Boolean).join("  ·  "))}</div>` : ""}
<div style="font:400 22px/1.3 ${SERIF};color:${INK}">${esc(l.address)}${l.place ? `<br>${esc(l.place)}` : ""}</div>
${l.price ? `<div style="margin-top:18px;font:500 20px ${SANS};color:${INK}">${esc(l.price)}</div>` : ""}
${l.specs.map((line) => `<div style="margin-top:3px;font:14px/1.4 ${SANS};color:#2b2926">${esc(line)}</div>`).join("")}
${b.note ? `<p style="margin:14px 0 0;font:15px/1.6 ${SANS};color:#2b2926">${nl2br(b.note)}</p>` : ""}
<div style="margin-top:20px"><a href="${esc(href)}" style="font:600 12px ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${INK};text-decoration:underline">${esc(cta)}</a></div>`;
    const photo = l.photo ? `<a href="${esc(href)}"><img src="${esc(l.photo)}" alt="${esc(l.address)}" style="display:block;width:100%;height:auto;border:0"></a>` : "";
    if (b.layout === "stacked") {
      return `<tr><td style="padding:14px 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3dfd8">${heading}
${photo ? `<tr><td colspan="2">${photo}</td></tr>` : ""}
<tr><td colspan="2" style="padding:22px 24px">${text}</td></tr></table></td></tr>`;
    }
    // Side by side: the words on the left, the photo on the right. On a phone the two stack (the photo first).
    return `<tr><td style="padding:14px 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${heading}
<tr class="nl-row"><td class="nl-col" width="50%" valign="middle" style="padding:26px 22px 26px 4px">${text}</td><td class="nl-col" width="50%" valign="top" style="padding:0">${photo}</td></tr></table></td></tr>`;
  }
  if (b.type === "post") {
    const p = ctx.posts?.[b.postId];
    if (!p) return "";
    const href = p.url ? wrap(safeUrl(p.url)) : "";
    return `<tr><td style="padding:14px 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e3dfd8">
${p.image ? `<tr><td>${href ? `<a href="${esc(href)}">` : ""}<img src="${esc(p.image)}" alt="${esc(p.title)}" style="display:block;width:100%;height:auto;border:0">${href ? "</a>" : ""}</td></tr>` : ""}
<tr><td style="padding:20px 24px 24px">
<div style="font:600 11px ${SANS};letter-spacing:.18em;text-transform:uppercase;color:${RED}">${esc([p.category || "From the blog", p.date].filter(Boolean).join("  ·  "))}</div>
<div style="margin-top:8px;font:600 23px/1.25 ${SERIF};color:${INK}">${esc(p.title)}</div>
${p.excerpt ? `<p style="margin:10px 0 0;font:15px/1.6 ${SANS};color:#2b2926">${esc(p.excerpt)}</p>` : ""}
${href ? `<div style="margin-top:16px"><a href="${esc(href)}" style="font:600 12px ${SANS};letter-spacing:.14em;text-transform:uppercase;color:${RED};text-decoration:none">${esc(b.cta || "Read the post")} &rarr;</a></div>` : ""}
</td></tr></table></td></tr>`;
  }
  return "";
}

function blockText(b, ctx) {
  if (b.type === "text") return [b.heading, b.body].filter(Boolean).join("\n");
  if (b.type === "banner") return [b.heading, b.body].filter(Boolean).join("\n");
  if (b.type === "button") return b.url ? `${b.label || "Learn more"}: ${safeUrl(b.url)}` : "";
  if (b.type === "listing" || b.type === "openhouse") {
    const l = ctx.listings?.[b.listingId];
    if (!l) return "";
    const oh = b.type === "openhouse" && l.openHouse ? `Open house: ${[l.openHouse.day, l.openHouse.time].filter(Boolean).join(", ")}\n` : "";
    const target = b.linkTo === "website" && l.websiteUrl ? l.websiteUrl : l.url;
    return `${oh}${l.address}${l.place ? `, ${l.place}` : ""}\n${[l.price, ...l.specs].filter(Boolean).join("\n")}${b.note ? `\n${b.note}` : ""}\n${safeUrl(target)}`;
  }
  if (b.type === "post") {
    const p = ctx.posts?.[b.postId];
    return p ? `${p.title}${p.excerpt ? `\n${p.excerpt}` : ""}${p.url ? `\n${safeUrl(p.url)}` : ""}` : "";
  }
  return "";
}

/**
 * Builds the email.
 *   newsletter  { subject, preheader, blocks, greeting }
 *   agent       { name, title, phone, email, license, photo, contactUrl, social: { instagram, facebook, ... } }
 *   brand       { name, logo (absolute url), address: { line1, city, state, zip }, disclaimer, franchiseDisclaimer }
 *   listings    { [listingId]: listingCardData(...) }       posts   { [postId]: postCardData(...) }
 *   recipient   { first, unsubscribeUrl, pixelUrl }
 *   wrap(url)   how a link in a block is turned into the link that is sent (the tracking link on the server; the same link in the preview)
 * Returns { subject, html, text }.
 */
export function renderNewsletter({ newsletter, agent, brand, listings = {}, posts = {}, recipient = {}, wrap = (u) => u }) {
  const ctx = { listings, posts, wrap };
  const first = String(recipient.first || "").trim();
  const agentFirst = (agent.name || "").split(" ")[0] || "your agent";
  const blocks = Array.isArray(newsletter.blocks) ? newsletter.blocks : [];
  const body = blocks.map((b) => blockHtml(b, ctx)).join("\n");

  const socials = [
    ["Instagram", agent.social?.instagram],
    ["Facebook", agent.social?.facebook],
    ["LinkedIn", agent.social?.linkedin],
    ["YouTube", agent.social?.youtube],
    ["TikTok", agent.social?.tiktok],
    ["X", agent.social?.x],
  ].filter(([, u]) => u);
  const contactHref = wrap(safeUrl(agent.contactUrl || (agent.email ? `mailto:${agent.email}` : "")));
  const addr = brand.address || {};
  const addressLine = [addr.line1, [addr.city, addr.state].filter(Boolean).join(", ") + (addr.zip ? ` ${addr.zip}` : "")].filter((p) => p && p.trim()).join(", ");

  const footer = `
<tr><td align="center" style="padding:30px 36px 26px">${contactHref !== "#" ? button("Get in touch", contactHref) : ""}</td></tr>
<tr><td style="padding:0 36px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="background:${CREAM};padding:30px 20px">
${agent.photo ? `<img src="${esc(agent.photo)}" width="170" alt="${esc(agent.name)}" style="display:block;width:170px;max-width:100%;height:auto;border:0;margin:0 auto 18px">` : ""}
<div style="font:italic 26px ${SERIF};color:${INK}">${esc(agent.name)}</div>
${agent.title ? `<div style="margin-top:3px;font:13px ${SANS};color:${MUTED}">${esc(agent.title)}</div>` : ""}
${agent.email ? `<div style="margin-top:8px;font:15px ${SANS}"><a href="mailto:${esc(agent.email)}" style="color:${INK};text-decoration:none">${esc(agent.email)}</a></div>` : ""}
${agent.phone || agent.license ? `<div style="margin-top:4px;font:15px ${SANS};color:${INK}">${esc([agent.phone, agent.license ? `Lic. ${String(agent.license).replace(/^lic\.?\s*#?\s*/i, "")}` : ""].filter(Boolean).join("   |   "))}</div>` : ""}
</td></tr>
${socials.length ? `<tr><td align="center" style="padding:16px 0 18px;font:600 11px ${SANS};letter-spacing:.16em;text-transform:uppercase">${socials.map(([n, u]) => `<a href="${esc(wrap(safeUrl(u)))}" style="color:${MUTED};text-decoration:none;padding:0 10px">${n}</a>`).join("")}</td></tr>` : ""}
<tr><td style="border-top:2px solid ${RED};font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>
<tr><td align="center" style="padding:28px 36px 8px">${brand.logo ? `<img src="${esc(brand.logo)}" width="140" alt="${esc(brand.name)}" style="display:block;width:140px;height:auto;border:0;margin:0 auto">` : `<div style="font:600 18px ${SERIF};color:${INK}">${esc(brand.name)}</div>`}</td></tr>
<tr><td align="center" style="padding:14px 36px 6px;font:11px/1.8 ${SANS};letter-spacing:.1em;text-transform:uppercase;color:#4a4742">${addressLine ? `${esc(addressLine)}<br>` : ""}${brand.franchiseDisclaimer ? `${esc(brand.franchiseDisclaimer)}` : ""}</td></tr>
${brand.disclaimer ? `<tr><td align="center" style="padding:6px 36px 4px;font:11px/1.6 ${SANS};color:#8a857d">${esc(brand.disclaimer)}</td></tr>` : ""}
<tr><td align="center" style="padding:20px 36px 30px;font:13px/1.6 ${SANS};color:${MUTED}">You are receiving this because you are in ${esc(agentFirst)}'s contacts. If you would rather not get emails like this, please <a href="${esc(recipient.unsubscribeUrl || "#")}" style="color:${MUTED};text-decoration:underline">unsubscribe</a>.</td></tr>`;

  const greeting = newsletter.greeting !== false && first ? `<tr><td style="padding:26px 36px 0;font:16px ${SANS};color:${INK}">Hi ${esc(first)},</td></tr>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(newsletter.subject || "")}</title><style>@media only screen and (max-width:520px){.nl-col{display:block!important;width:100%!important;box-sizing:border-box}.nl-row{display:block!important}.nl-col img{width:100%!important}}</style></head>
<body style="margin:0;padding:0;background:#f4f2ee">
${newsletter.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(newsletter.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f2ee"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff">
<tr><td align="center" style="padding:30px 36px 6px;border-bottom:3px solid ${RED}">${brand.logo ? `<img src="${esc(brand.logo)}" width="150" alt="${esc(brand.name)}" style="display:block;width:150px;height:auto;border:0;margin:0 auto 22px">` : `<div style="font:600 20px ${SERIF};color:${INK};padding-bottom:22px">${esc(brand.name)}</div>`}</td></tr>
${greeting}
${body}
${footer}
</table></td></tr></table>
${recipient.pixelUrl ? `<img src="${esc(recipient.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0">` : ""}
</body></html>`;

  const text = [
    first && newsletter.greeting !== false ? `Hi ${first},` : "",
    ...blocks.map((b) => blockText(b, ctx)),
    "",
    `${agent.name}${agent.title ? `, ${agent.title}` : ""}`,
    [agent.email, agent.phone].filter(Boolean).join("  |  "),
    "",
    [brand.name, addressLine].filter(Boolean).join(", "),
    "",
    `You are receiving this because you are in ${agentFirst}'s contacts. To stop getting these emails, unsubscribe: ${recipient.unsubscribeUrl || ""}`,
  ]
    .filter((p) => p !== undefined)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");

  return { subject: newsletter.subject || "", html, text };
}

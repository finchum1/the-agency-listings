// Makes one guide's PDF for an agent site, from the database: the site's colors, the brokerage's logo, the agent (or, on a team site, everyone on the team)
// with their photos. Shared by api/guide-pdf.js (the download) and api/agent-site-contact.js (the guide emailed to the visitor).
import sharp from "sharp";
import { buildGuidePdf, lightness } from "./guidePdf.js";
import { emailBrand } from "./visitors.js";
import { brandFromOrg } from "../../src/lib/brand.js";
import { GUIDES } from "../../src/lib/guides.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

const MAX_PEOPLE = 6;
const PERSON = "full_name, title, license, phone, email, photo_url";

/** A picture as a PNG buffer for the PDF (it can't read SVG or WebP), or null when it can't be had. Only https pictures or our own files. */
async function picture(src, { height, width, fit = "inside" } = {}) {
  try {
    const url = new URL(src, SITE_ORIGIN);
    if (url.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) return null;
    return await sharp(bytes, { density: 300 }).resize({ height, width, fit, withoutEnlargement: false }).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * @param by        { slug } or { id } of the agent site
 * @param guideKey  a key of GUIDES
 * @returns { pdf, filename, name, first, link } or null when the site is missing, unpublished or the guide is unknown
 */
export async function makeGuide(admin, by, guideKey) {
  const guide = GUIDES[guideKey];
  if (!guide) return null;
  let query = admin
    .from("agent_sites")
    .select(
      `id, slug, status, theme, accent_color, custom_domain, agent_id, agent:profiles(${PERSON}, team:teams(name, members:profiles(id, ${PERSON}))), org:organizations(id, slug, name, brand, address_line1, city, state, zip, disclaimer, franchise_disclaimer)`,
    );
  query = by.id ? query.eq("id", by.id) : query.eq("slug", by.slug);
  const { data: site } = await query.maybeSingle();
  if (!site || site.status === "draft" || !site.agent) return null;

  const org = brandFromOrg(site.org);
  const colors = emailBrand(site.theme, site.accent_color, { org: org.name });
  const dark = lightness(colors.dark) < 0.6;
  const logoUrl = (dark ? org.logos?.white : org.logos?.iron || org.logos?.black) || org.logo;

  // Who the guide is from: the agent, or on a team site the whole team (the site's owner first, the rest by name).
  const team = site.agent.team?.name ? site.agent.team : null;
  const person = (p) => ({ name: p.full_name || "", title: p.title || "Real Estate Agent", license: p.license || "", phone: p.phone || "", email: p.email || "", photo_url: p.photo_url || "" });
  const mine = person(site.agent);
  const others = team ? (team.members || []).filter((m) => m.id !== site.agent_id).map(person).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const members = [mine, ...others].filter((m) => m.name).slice(0, MAX_PEOPLE);
  const [logo, ...photos] = await Promise.all([logoUrl ? picture(logoUrl, { height: 150 }) : null, ...members.map((m) => (m.photo_url ? picture(m.photo_url, { width: 240, height: 240, fit: "cover" }) : null))]);

  const name = team?.name || mine.name;
  const address = [org.address.line1, [org.address.city, [org.address.state, org.address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const pdf = await buildGuidePdf({
    guide,
    agent: {
      name,
      first: team ? name : name.split(" ")[0],
      team: Boolean(team),
      title: team ? "Real Estate Team" : mine.title,
      license: team ? "" : mine.license,
      phone: mine.phone,
      email: mine.email,
      website: site.custom_domain ? site.custom_domain.replace(/^www\./, "") : "",
      members: members.map((m) => ({ name: m.name, title: m.title, license: m.license, phone: m.phone, email: m.email })),
    },
    brand: { ...colors, org: org.name, address, disclaimer: org.disclaimer, franchiseDisclaimer: org.franchiseDisclaimer, location: org.locationLabel },
    images: { logo, photos },
  });
  const filename = `${guide.title} - ${name || org.name}`.replace(/[^\w .,'()-]+/g, "").trim();
  return { pdf, filename: `${filename}.pdf`, name, first: team ? name : name.split(" ")[0], link: `${SITE_ORIGIN}/api/guide-pdf?site=${encodeURIComponent(site.slug)}&guide=${encodeURIComponent(guide.slug)}`, agentEmail: mine.email };
}

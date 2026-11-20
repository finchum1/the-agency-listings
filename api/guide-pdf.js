// GET /api/guide-pdf?site=<agent site slug>&guide=sellers|buyers|home-value|relocation
// The agent's branded guide as a real PDF file: a cover in the site's theme colors with the brokerage logo and the agent's photo, the guide's pages
// (src/lib/guides.js, the same words as the website pages), and the agent's contact details and the brokerage disclaimer at the end. No sign-in: it is
// a public marketing document for a published site. The website pages ask for a name and email before they show the link (the request becomes a lead);
// this endpoint itself stays open so the agent can send the file or link anywhere. Cached for a few minutes.
import sharp from "sharp";
import { serviceClient } from "./_lib/authUser.js";
import { buildGuidePdf, lightness } from "./_lib/guidePdf.js";
import { emailBrand } from "./_lib/visitors.js";
import { brandFromOrg } from "../src/lib/brand.js";
import { GUIDES } from "../src/lib/guides.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const guide = GUIDES[String(req.query?.guide || "")];
  const slug = String(req.query?.site || "");
  if (!guide || !SLUG.test(slug)) return res.status(404).json({ error: "That guide isn't available." });
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  const { data: site } = await admin
    .from("agent_sites")
    .select(
      "slug, status, theme, accent_color, custom_domain, agent:profiles(full_name, title, license, phone, email, photo_url, team:teams(name)), org:organizations(id, slug, name, brand, address_line1, city, state, zip, disclaimer, franchise_disclaimer)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!site || site.status === "draft" || !site.agent) return res.status(404).json({ error: "That guide isn't available." });

  const org = brandFromOrg(site.org);
  const colors = emailBrand(site.theme, site.accent_color, { org: org.name });
  const dark = lightness(colors.dark) < 0.6;
  const logoUrl = (dark ? org.logos?.white : org.logos?.iron || org.logos?.black) || org.logo;
  const [logo, photo] = await Promise.all([logoUrl ? picture(logoUrl, { height: 150 }) : null, site.agent.photo_url ? picture(site.agent.photo_url, { width: 240, height: 240, fit: "cover" }) : null]);

  const name = site.agent.team?.name || site.agent.full_name || "";
  const address = [org.address.line1, [org.address.city, [org.address.state, org.address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  try {
    const pdf = await buildGuidePdf({
      guide,
      agent: {
        name,
        first: name.split(" ")[0],
        title: site.agent.team?.name ? "Real Estate Team" : site.agent.title || "Real Estate Agent",
        license: site.agent.team?.name ? "" : site.agent.license || "",
        phone: site.agent.phone || "",
        email: site.agent.email || "",
        website: site.custom_domain ? site.custom_domain.replace(/^www\./, "") : "",
      },
      brand: { ...colors, org: org.name, address, disclaimer: org.disclaimer, franchiseDisclaimer: org.franchiseDisclaimer, location: org.locationLabel },
      images: { logo, photo },
    });
    const file = `${guide.title} - ${name || org.name}`.replace(/[^\w .,'()-]+/g, "").trim();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file}.pdf"`);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(pdf);
  } catch (err) {
    console.error("Guide PDF failed:", err);
    return res.status(500).json({ error: "Couldn't make the guide. Please try again." });
  }
}

// The card a link-unfurler (iMessage, Slack, Facebook, ...) shows for a private shared link, served ONLY to crawlers (see vercel.json);
// people get the app. Used by api/meta-vendors.js, api/meta-timeline.js and api/meta-deal-update.js.
//
// The token is the credential and previews get cached by whoever fetched them, so the card says who it is from and nothing about the
// contents: no names, addresses, dates or prices. An invalid, expired or revoked link gets the same generic card. A crawler hit is not
// counted as a view.
import crypto from "node:crypto";
import { escapeHtml, absoluteUrl, SITE_ORIGIN } from "../../src/lib/seo.js";
import { brandFromOrg } from "../../src/lib/brand.js";
import { renderMetaPage } from "./renderMetaPage.js";
import { serviceClient } from "./authUser.js";

/**
 * prefix  the token's two-letter prefix ("vs", "tl", "du")      table  the links table
 * path    where the page lives ("/vendors")                      title  the card's title
 * who     "creator" (the person who made the link) or "owner" (the agent who owns the deal the link is about; the link has a person_id)
 * blurb   (name, org) => the description, where name is "Jane Doe at The Agency" or "" and `generic` applies
 */
export async function serveLinkPreview(req, res, { prefix, table, path, title, who = "creator", blurb, generic }) {
  // Only the timeline and update links belong to a deal (person_id); the vendor list does not.
  const columns = `org_id, created_by, ${who === "owner" ? "person_id, " : ""}expires_at, revoked_at`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const token = String(req.query?.token || "");
  const valid = new RegExp(`^${prefix}[0-9a-f]{64}$`).test(token);
  let person = null;
  let org = null;
  if (valid) {
    try {
      const admin = serviceClient();
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const { data: link } = await admin.from(table).select(columns).eq("token_hash", hash).maybeSingle();
      if (link && !link.revoked_at && new Date(link.expires_at) >= new Date()) {
        let profileId = link.created_by;
        if (who === "owner") {
          const { data: p } = await admin.from("people").select("owner_id").eq("id", link.person_id).maybeSingle();
          profileId = p?.owner_id || null;
        }
        const [{ data: a }, { data: o }] = await Promise.all([
          profileId ? admin.from("profiles").select("full_name, photo_url").eq("id", profileId).maybeSingle() : { data: null },
          admin.from("organizations").select("name, brand").eq("id", link.org_id).maybeSingle(),
        ]);
        person = a;
        org = o;
      }
    } catch {
      /* no database: the generic card below still works */
    }
  }

  const brand = brandFromOrg(org);
  const from = person?.full_name ? `${person.full_name}${org?.name ? ` at ${org.name}` : ""}` : "";
  const description = from ? blurb(from) : generic;
  // A logo, unless it is a vector the unfurlers won't draw; then the person's photo.
  const logo = brand.logo && !/\.svg(\?|$)/i.test(brand.logo) ? brand.logo : "";
  const image = absoluteUrl(logo || person?.photo_url || "");

  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(title),
      description: escapeHtml(description),
      image: image ? escapeHtml(image) : "",
      url: escapeHtml(`${SITE_ORIGIN}${path}/${valid ? token : ""}`),
      heading: escapeHtml(title),
      bodyHtml: `<p>${escapeHtml(description)}</p>`,
      noindex: true,
    }),
  );
}

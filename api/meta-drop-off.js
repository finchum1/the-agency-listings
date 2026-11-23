// Vercel serverless function: what a link-unfurler (iMessage, Slack, ...) sees for a gift drop-off link, /dropoff/<token>. Served only to crawlers (vercel.json);
// people get the app. Like the other private links (api/_lib/linkPreview.js) the card says who it is from and nothing about the contents: no names or addresses,
// and an invalid, expired or turned-off link gets the same generic card. A crawler hit is not counted as a view.
import crypto from "node:crypto";
import { escapeHtml, absoluteUrl, SITE_ORIGIN } from "../src/lib/seo.js";
import { brandFromOrg } from "../src/lib/brand.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";
import { serviceClient } from "./_lib/authUser.js";

const TITLE = "Drop Off List";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const token = String(req.query?.token || "");
  const valid = /^do[0-9a-f]{64}$/.test(token);
  let person = null;
  let org = null;
  if (valid) {
    try {
      const admin = serviceClient();
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const { data: list } = await admin.from("drop_off_lists").select("owner_id, expires_at, revoked_at").eq("token_hash", hash).maybeSingle();
      if (list && !list.revoked_at && new Date(list.expires_at) >= new Date()) {
        const { data: p } = await admin.from("profiles").select("full_name, photo_url, org_id").eq("id", list.owner_id).maybeSingle();
        person = p;
        const { data: o } = p?.org_id ? await admin.from("organizations").select("name, brand").eq("id", p.org_id).maybeSingle() : { data: null };
        org = o;
      }
    } catch {
      /* no database: the generic card below still works */
    }
  }

  const brand = brandFromOrg(org);
  const from = person?.full_name ? `${person.full_name}${org?.name ? ` at ${org.name}` : ""}` : "";
  const description = from ? `Gift drop-offs for ${from}: tap an address for directions and mark each one delivered.` : "A list of gift drop-offs: tap an address for directions and mark each one delivered.";
  const logo = brand.logo && !/\.svg(\?|$)/i.test(brand.logo) ? brand.logo : "";
  const image = absoluteUrl(logo || person?.photo_url || "");

  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(TITLE),
      description: escapeHtml(description),
      image: image ? escapeHtml(image) : "",
      url: escapeHtml(`${SITE_ORIGIN}/dropoff/${valid ? token : ""}`),
      heading: escapeHtml(TITLE),
      bodyHtml: `<p>${escapeHtml(description)}</p>`,
      noindex: true,
    }),
  );
}

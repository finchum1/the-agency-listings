// Vercel serverless function — what a link-unfurler (iMessage, Slack, Facebook, ...) sees for a client's closing timeline,
// /timeline/<token>. Served ONLY to crawlers (see vercel.json); people get the app (src/pages/TransactionTimelinePage.jsx).
// Same idea as api/meta-vendors.js: without it the preview card said "The Agency Dashboard".
//
// The token is the credential (supabase/people-module.sql section 40) and previews get cached by whoever fetched them, so the
// card names who is helping and nothing about the deal: no address, dates, price or people. An invalid, expired or revoked link
// gets the same generic card. A crawler hit is not counted as a view.
import crypto from "node:crypto";
import { escapeHtml, absoluteUrl, SITE_ORIGIN } from "../src/lib/seo.js";
import { brandFromOrg } from "../src/lib/brand.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^tl[0-9a-f]{64}$/;
const TITLE = "Your Closing Timeline";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const token = String(req.query?.token || "");
  let agent = null;
  let org = null;
  if (TOKEN.test(token)) {
    try {
      const admin = serviceClient();
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const { data: link } = await admin.from("transaction_timeline_links").select("org_id, created_by, expires_at, revoked_at").eq("token_hash", hash).maybeSingle();
      if (link && !link.revoked_at && new Date(link.expires_at) >= new Date()) {
        const [{ data: a }, { data: o }] = await Promise.all([
          admin.from("profiles").select("full_name, photo_url").eq("id", link.created_by).maybeSingle(),
          admin.from("organizations").select("name, brand").eq("id", link.org_id).maybeSingle(),
        ]);
        agent = a;
        org = o;
      }
    } catch {
      /* no database: the generic card below still works */
    }
  }

  const brand = brandFromOrg(org);
  const from = agent?.full_name ? `${agent.full_name}${org?.name ? ` at ${org.name}` : ""}` : "";
  const description = from ? `${from} is keeping you up to date: the key dates from contract to closing, and who is helping along the way.` : "The key dates from contract to closing, and who is helping along the way.";
  // A logo, unless it is a vector the unfurlers won't draw; then the agent's photo.
  const logo = brand.logo && !/\.svg(\?|$)/i.test(brand.logo) ? brand.logo : "";
  const image = absoluteUrl(logo || agent?.photo_url || "");

  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(TITLE),
      description: escapeHtml(description),
      image: image ? escapeHtml(image) : "",
      url: escapeHtml(`${SITE_ORIGIN}/timeline/${TOKEN.test(token) ? token : ""}`),
      heading: escapeHtml(TITLE),
      bodyHtml: `<p>${escapeHtml(description)}</p>`,
      noindex: true,
    }),
  );
}

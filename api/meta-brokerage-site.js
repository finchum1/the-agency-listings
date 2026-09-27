// Vercel serverless function — server-rendered "snapshot" of the
// brokerage site's homepage AND its standalone subpages (About/Agents/
// Areas/Blog/Listings/Search/Home Valuation/Contact — see api/meta-
// agent-site.js for the full rationale, this is the same idea for
// /brokerage and /brokerage/:page instead of /sites/:slug).
// `req.query.page` is one of BROKERAGE_PAGE_LABELS's keys, or absent for
// Home (see vercel.json's rewrites for /brokerage and /brokerage/:page).
//
// Until this file, the brokerage site had NO crawler-facing snapshot at
// all (unlike agent sites and listings) — a bot or social-link unfurler
// hitting /brokerage or /brokerage/blog/:slug fell through to the app's
// generic index.html title/description, and a shared link showed a
// blank preview card instead of the post's own title/image.
import { createClient } from "@supabase/supabase-js";
import { buildBrokerageSitePageMeta, escapeHtml, publishedOrDueFilter, SITE_ORIGIN } from "../src/lib/seo.js";
import { buildAgentSchema, buildBreadcrumbSchema } from "../src/lib/structuredData.js";
import brokerage from "../src/lib/brokerage.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

const PAGE_LABELS = {
  about: "About",
  agents: "Agents",
  areas: "Areas of Expertise",
  blog: "Blog",
  listings: "Our Listings",
  search: "Home Search",
  "home-valuation": "Home Valuation",
  contact: "Contact",
};

export default async function handler(req, res) {
  const page = PAGE_LABELS[req.query.page] ? req.query.page : undefined;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: site } = await supabase.from("brokerage_site").select("*").maybeSingle();

  const homeUrl = `${SITE_ORIGIN}/brokerage`;
  const url = page ? `${homeUrl}/${page}` : homeUrl;

  if (!site) {
    res.status(404).send(
      renderMetaPage({
        title: "Site not found | The Agency",
        description: "The brokerage site may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Site not found",
        bodyHtml: "<p>The brokerage site may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildBrokerageSitePageMeta(site, page);
  const heading = page ? PAGE_LABELS[page] : brokerage.name;

  // Only fetch what this specific page actually shows — Home, Search,
  // and Home Valuation don't need any of this (their bodyHtml is just
  // the description).
  let extraHtml = "";
  if (page === "agents") {
    const { data: agents } = await supabase.from("brokerage_agents").select("name, title").order("sort_order");
    extraHtml = (agents || []).map((a) => `<li>${escapeHtml(a.name)}${a.title ? ` — ${escapeHtml(a.title)}` : ""}</li>`).join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "areas") {
    const { data: areas } = await supabase.from("brokerage_areas").select("name, blurb").order("sort_order");
    extraHtml = (areas || []).map((a) => `<li>${escapeHtml(a.name)}${a.blurb ? ` — ${escapeHtml(a.blurb)}` : ""}</li>`).join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "blog") {
    const { data: posts } = await supabase
      .from("brokerage_posts")
      .select("slug, title, excerpt")
      .or(publishedOrDueFilter())
      .order("post_date", { ascending: false });
    extraHtml = (posts || [])
      .map(
        (p) =>
          `<li><a href="${homeUrl}/blog/${p.slug}">${escapeHtml(p.title)}</a>${
            p.excerpt ? ` — ${escapeHtml(p.excerpt)}` : ""
          }</li>`,
      )
      .join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "listings") {
    const { data: listings } = await supabase
      .from("listings")
      .select("slug, address_line1, city, state")
      .neq("status", "draft")
      .limit(50);
    extraHtml = (listings || [])
      .map(
        (l) =>
          `<li><a href="${SITE_ORIGIN}/listings/${l.slug}">${escapeHtml(
            `${l.address_line1}, ${l.city}, ${l.state}`,
          )}</a></li>`,
      )
      .join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "contact") {
    extraHtml = [
      brokerage.address ? `<p>${escapeHtml(`${brokerage.address.line1}, ${brokerage.address.city}, ${brokerage.address.state} ${brokerage.address.zip}`)}</p>` : "",
    ].join("");
  }

  const bodyHtml = `
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
${extraHtml}
<p><a href="${url}">Visit ${page ? "page" : "site"} →</a></p>
`;

  const schemas = [];
  if (!page || page === "about") {
    schemas.push(
      buildAgentSchema({
        url: homeUrl,
        name: brokerage.name,
        image: site.hero_photo_url || brokerage.logo,
        phone: undefined,
        email: undefined,
        region: "Oklahoma",
        brokerageAddress: brokerage.address,
        sameAs: [site.instagram_url, site.facebook_url, site.linkedin_url].filter(Boolean),
      }),
    );
  }
  if (page) {
    schemas.push(
      buildBreadcrumbSchema([
        { name: brokerage.name, url: homeUrl },
        { name: PAGE_LABELS[page], url },
      ]),
    );
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(heading),
      bodyHtml,
      structuredData: schemas.length ? schemas : undefined,
    }),
  );
}

// Vercel serverless function — server-rendered "snapshot" of the
// brokerage site's homepage, its standalone subpages (About/Agents/
// Areas/Blog/Listings/Search/Home Valuation/Contact), AND a single blog
// post (/brokerage/blog/:postSlug). Merged into one function (branching
// on req.query.post) rather than two separate files — the Vercel Hobby
// plan caps a deployment at 12 serverless functions total, and this
// project was already sitting exactly at that cap before this file
// existed, so every new route here has to come out of an existing slot
// (see the equivalent merge in meta-custom-domain.js). See api/meta-
// agent-site.js/meta-agent-post.js for the un-merged equivalent pattern
// this still follows internally.
//
// Until this file, the brokerage site had NO crawler-facing snapshot at
// all (unlike agent sites and listings) — a bot or social-link unfurler
// hitting /brokerage or /brokerage/blog/:slug fell through to the app's
// generic index.html title/description, and a shared link showed a
// blank preview card instead of the post's own title/image.
import { createClient } from "@supabase/supabase-js";
import {
  buildBrokerageSitePageMeta,
  buildBrokeragePostMeta,
  buildBrokerageAreaMeta,
  escapeHtml,
  absoluteUrl,
  publishedOrDueFilter,
  SITE_ORIGIN,
} from "../src/lib/seo.js";
import { buildAgentSchema, buildBlogPostSchema, buildBreadcrumbSchema } from "../src/lib/structuredData.js";
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

  if (req.query.post) {
    await handlePost(req, res, supabase, site, homeUrl);
    return;
  }

  if (req.query.areaSlug) {
    await handleAreaDetail(req, res, supabase, site, homeUrl);
    return;
  }

  const page = PAGE_LABELS[req.query.page] ? req.query.page : undefined;
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
    extraHtml = brokerage.address
      ? `<p>${escapeHtml(`${brokerage.address.line1}, ${brokerage.address.city}, ${brokerage.address.state} ${brokerage.address.zip}`)}</p>`
      : "";
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
        region: "Oklahoma",
        brokerageAddress: brokerage.address,
        sameAs: [site.instagram_url, site.facebook_url, site.linkedin_url].filter(Boolean),
      }),
    );
  }
  if (page) {
    schemas.push(buildBreadcrumbSchema([{ name: brokerage.name, url: homeUrl }, { name: PAGE_LABELS[page], url }]));
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

async function handlePost(req, res, supabase, site, homeUrl) {
  const postSlug = req.query.post;
  const url = `${homeUrl}/blog/${postSlug}`;

  const { data: post } = await supabase
    .from("brokerage_posts")
    .select("*")
    .eq("slug", postSlug)
    .or(publishedOrDueFilter())
    .maybeSingle();

  if (!post) {
    res.status(404).send(
      renderMetaPage({
        title: "Post not found | The Agency",
        description: "This post may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Post not found",
        bodyHtml: "<p>This post may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildBrokeragePostMeta(post, site);

  const bodyHtml = `
${post.category ? `<p>${escapeHtml(post.category)}</p>` : ""}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Read full post →</a></p>
`;

  const structuredData = [
    buildBlogPostSchema({
      url,
      headline: post.title,
      description: meta.description,
      image: meta.image,
      datePublished: post.post_date,
      dateModified: post.updated_at,
      publisherName: brokerage.name,
      publisherLogo: absoluteUrl(brokerage.logo),
    }),
    buildBreadcrumbSchema([
      { name: brokerage.name, url: homeUrl },
      { name: "Blog", url: `${homeUrl}/blog` },
      { name: post.title, url },
    ]),
  ];

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(post.title),
      bodyHtml,
      structuredData,
    }),
  );
}

async function handleAreaDetail(req, res, supabase, site, homeUrl) {
  const areaSlug = req.query.areaSlug;
  const url = `${homeUrl}/areas/${areaSlug}`;

  const { data: area } = await supabase.from("brokerage_areas").select("*").eq("slug", areaSlug).maybeSingle();

  if (!area) {
    res.status(404).send(
      renderMetaPage({
        title: "Area not found | The Agency",
        description: "This area page may have been removed or the link is incorrect.",
        image: "",
        url,
        heading: "Area not found",
        bodyHtml: "<p>This area page may have been removed or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildBrokerageAreaMeta(area, site);

  const bodyHtml = `
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Visit page →</a></p>
`;

  const structuredData = buildBreadcrumbSchema([
    { name: brokerage.name, url: homeUrl },
    { name: "Areas of Expertise", url: `${homeUrl}/areas` },
    { name: area.name, url },
  ]);

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(area.name),
      bodyHtml,
      structuredData,
    }),
  );
}

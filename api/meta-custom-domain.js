// Vercel serverless function — server-rendered "snapshot" for a bot/link-
// unfurler hitting a listing's, an agent site's, or the brokerage site's
// own attached custom domain (e.g. terrencefinchum.com,
// 1645SaratogaWay.com) — either the bare root "/" (a listing/site/
// brokerage home) or "/blog/:postSlug" (an agent or brokerage post,
// branching on req.query.post). Merged into one function rather than two
// separate files — the Vercel Hobby plan caps a deployment at 12
// serverless functions total, and this project was already sitting
// exactly at that cap before the brokerage-site snapshot routes existed
// (see the equivalent merge in meta-brokerage.js), so every new route
// has to come out of an existing slot.
//
// The other api/meta-*.js functions don't cover this: they all match a
// /sites/:slug, /listings/:slug, or /brokerage PATH, but a custom domain
// serves that same content at the bare root/its own "/blog" — see
// vercel.json's rewrites and CustomDomainSitePage.jsx for the equivalent
// client-side (real-browser) resolution this mirrors, by Host header
// instead of a route param. Same "listing, then agent site, then
// brokerage site last" fallback order both branches use.
//
// The root-"/" rewrite also fires for bots hitting the app's own host's
// root (the-agency-listings.vercel.app/) — isAppHost() below detects
// that case and returns the same generic title index.html already has,
// so nothing changes for the main app; this function is additive.
import { createClient } from "@supabase/supabase-js";
import {
  buildListingMeta,
  buildAgentSiteMeta,
  buildBrokerageSiteMeta,
  buildAgentPostMeta,
  buildBrokeragePostMeta,
  escapeHtml,
  absoluteUrl,
  publishedOrDueFilter,
  SITE_ORIGIN,
} from "../src/lib/seo.js";
import { buildListingSchema, buildAgentSchema, buildBlogPostSchema, buildBreadcrumbSchema } from "../src/lib/structuredData.js";
import brokerage from "../src/lib/brokerage.js";
import { bareHost, isAppHost } from "../src/lib/appHosts.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

const APP_DEFAULT_TITLE = "The Agency Listings";
const APP_DEFAULT_DESCRIPTION = "The Agency — property listing sites and agent dashboard";

// Google Search Console site-verification tokens, keyed by bare custom
// domain — see middleware.js's VERIFIED_HOSTS for how a request gets
// routed here with ?verify=1 in the first place. Add a new domain by
// adding it to both that Set and this map.
const GOOGLE_SITE_VERIFICATION = {
  "terrencefinchum.com": "e9f3EdK-JafciudKWSUna24_LF_kM-70yBL6jZsUi-Q",
};

export default async function handler(req, res) {
  const host = bareHost(req.headers.host);

  if (req.query.verify) {
    await handleVerification(req, res, host);
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  if (req.query.post) {
    await handlePost(req, res, supabase, host);
    return;
  }

  const url = `https://${req.headers.host}/`;

  if (isAppHost(host)) {
    res.status(200).send(
      renderMetaPage({
        title: APP_DEFAULT_TITLE,
        description: APP_DEFAULT_DESCRIPTION,
        image: "",
        url,
        heading: APP_DEFAULT_TITLE,
        bodyHtml: `<p>${escapeHtml(APP_DEFAULT_DESCRIPTION)}</p>`,
      }),
    );
    return;
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("*, agent:profiles(*), listing_photos(url, is_hero)")
    .ilike("custom_domain", host)
    .maybeSingle();

  if (listing) {
    const heroPhoto =
      listing.listing_photos?.find((p) => p.is_hero)?.url || listing.listing_photos?.[0]?.url || "";
    const meta = buildListingMeta(listing, listing.agent, heroPhoto);

    const bodyHtml = `
<p>${escapeHtml(`${listing.address_line1}, ${listing.city}, ${listing.state} ${listing.zip}`)}</p>
${
  listing.beds || listing.baths || listing.sqft
    ? `<p>${[
        listing.beds ? `${listing.beds} bd` : null,
        listing.baths ? `${listing.baths} ba` : null,
        listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null,
      ]
        .filter(Boolean)
        .join(" | ")}</p>`
    : ""
}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">View full listing →</a></p>
`;

    const structuredData = buildListingSchema({
      url,
      address1: listing.address_line1,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
      price: listing.price,
      status: listing.status,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      description: (listing.description || []).join(" ") || undefined,
      images: (listing.listing_photos || []).map((p) => p.url),
      datePosted: listing.created_at,
    });

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderMetaPage({
        title: escapeHtml(meta.title),
        description: escapeHtml(meta.description),
        image: meta.image,
        url,
        heading: escapeHtml(listing.address_line1),
        bodyHtml,
        structuredData,
      }),
    );
    return;
  }

  const { data: site } = await supabase
    .from("agent_sites")
    .select("*, agent:profiles(*)")
    .ilike("custom_domain", host)
    .maybeSingle();

  if (site) {
    const meta = buildAgentSiteMeta(site, site.agent);
    const heading = site.agent?.full_name || "Agent";

    const bodyHtml = `
${site.region ? `<p>${escapeHtml(site.region)}</p>` : ""}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Visit site →</a></p>
`;

    const structuredData = buildAgentSchema({
      url,
      name: site.agent?.full_name,
      image: site.agent?.photo_url,
      phone: site.agent?.phone,
      email: site.agent?.email,
      jobTitle: site.agent?.title,
      region: site.region,
      license: site.agent?.license,
      brokerageName: brokerage.name,
      brokerageAddress: brokerage.address,
      sameAs: [site.instagram_url, site.facebook_url, site.linkedin_url].filter(Boolean),
    });

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderMetaPage({
        title: escapeHtml(meta.title),
        description: escapeHtml(meta.description),
        image: meta.image,
        url,
        heading: escapeHtml(heading),
        bodyHtml,
        structuredData,
      }),
    );
    return;
  }

  const { data: brokerageSite } = await supabase
    .from("brokerage_site")
    .select("*")
    .ilike("custom_domain", host)
    .maybeSingle();

  if (brokerageSite) {
    const meta = buildBrokerageSiteMeta(brokerageSite);

    const bodyHtml = `
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Visit site →</a></p>
`;

    const structuredData = buildAgentSchema({
      url,
      name: brokerage.name,
      image: brokerage.logo,
      region: "Oklahoma",
      brokerageName: undefined,
      sameAs: [brokerageSite.instagram_url, brokerageSite.facebook_url, brokerageSite.linkedin_url].filter(Boolean),
    });

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderMetaPage({
        title: escapeHtml(meta.title),
        description: escapeHtml(meta.description),
        image: meta.image,
        url,
        heading: brokerage.name,
        bodyHtml,
        structuredData,
      }),
    );
    return;
  }

  res.status(404).send(
    renderMetaPage({
      title: "Site not found | The Agency",
      description: "This domain isn't attached to a listing, agent site, or the brokerage site.",
      image: "",
      url,
      heading: "Site not found",
      bodyHtml: "<p>This domain isn't attached to a listing, agent site, or the brokerage site.</p>",
      noindex: true,
    }),
  );
}

// "/blog/:postSlug" on a custom domain — an agent site's own post first,
// then a fallback to the brokerage site's own post (same order
// CustomDomainSitePage.jsx's SharedCustomDomainPostPage uses client-side).
async function handlePost(req, res, supabase, host) {
  const postSlug = req.query.post;
  const url = `https://${req.headers.host}/blog/${postSlug}`;
  const homeUrl = `https://${req.headers.host}/`;

  const { data: site } = await supabase
    .from("agent_sites")
    .select("*, agent:profiles(*)")
    .ilike("custom_domain", host)
    .maybeSingle();

  const { data: post } = site
    ? await supabase
        .from("agent_site_posts")
        .select("*")
        .eq("agent_site_id", site.id)
        .eq("slug", postSlug)
        .or(publishedOrDueFilter())
        .maybeSingle()
    : { data: null };

  if (site && post) {
    const meta = buildAgentPostMeta(post, site, site.agent);

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
        authorName: site.agent?.full_name,
        publisherName: brokerage.name,
        publisherLogo: absoluteUrl(brokerage.logo),
      }),
      buildBreadcrumbSchema([
        { name: site.agent?.full_name || "Home", url: homeUrl },
        { name: "Blog", url: `${homeUrl}blog` },
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
    return;
  }

  const { data: brokerageSite } = await supabase
    .from("brokerage_site")
    .select("*")
    .ilike("custom_domain", host)
    .maybeSingle();

  const { data: brokeragePost } = brokerageSite
    ? await supabase.from("brokerage_posts").select("*").eq("slug", postSlug).or(publishedOrDueFilter()).maybeSingle()
    : { data: null };

  if (!brokerageSite || !brokeragePost) {
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

  const meta = buildBrokeragePostMeta(brokeragePost, brokerageSite);

  const bodyHtml = `
${brokeragePost.category ? `<p>${escapeHtml(brokeragePost.category)}</p>` : ""}
<p>${escapeHtml(meta.description)}</p>
${meta.image ? `<img src="${meta.image}" alt="" style="max-width:100%" />` : ""}
<p><a href="${url}">Read full post →</a></p>
`;

  const structuredData = [
    buildBlogPostSchema({
      url,
      headline: brokeragePost.title,
      description: meta.description,
      image: meta.image,
      datePublished: brokeragePost.post_date,
      dateModified: brokeragePost.updated_at,
      publisherName: brokerage.name,
      publisherLogo: absoluteUrl(brokerage.logo),
    }),
    buildBreadcrumbSchema([
      { name: brokerage.name, url: homeUrl },
      { name: "Blog", url: `${homeUrl}blog` },
      { name: brokeragePost.title, url },
    ]),
  ];

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(
    renderMetaPage({
      title: escapeHtml(meta.title),
      description: escapeHtml(meta.description),
      image: meta.image,
      url,
      heading: escapeHtml(brokeragePost.title),
      bodyHtml,
      structuredData,
    }),
  );
}

// The real app shell (index.html), not the bot-snapshot page — the
// visitor here (a human, or Google's site-verification checker, which
// doesn't share Googlebot's UA and so isn't caught by middleware.js's
// bot pattern) needs the actual React SPA, just with one meta tag added.
// index.html is identical across every host this app serves, so it's
// fetched from the app's own canonical origin rather than the visitor's
// custom domain — the content doesn't differ per host, only whether this
// tag gets spliced in does, and that's decided entirely by which domain
// middleware.js routed here for.
async function handleVerification(req, res, host) {
  const token = GOOGLE_SITE_VERIFICATION[host];
  const origin = await fetch(`${SITE_ORIGIN}/index.html`);
  let html = await origin.text();
  if (token) {
    html = html.replace("</head>", `    <meta name="google-site-verification" content="${token}" />\n  </head>`);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(html);
}

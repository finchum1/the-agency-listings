// Vercel serverless function — server-rendered "snapshot" for a bot/link-
// unfurler hitting "/" on a listing's or an agent site's own attached
// custom domain (e.g. terrencefinchum.com, 1645SaratogaWay.com), the one
// case the other three api/meta-*.js functions don't cover: they all
// match a /sites/:slug or /listings/:slug PATH, but a custom domain
// serves that same content at the bare root — see vercel.json's rewrite
// for "/" and CustomDomainSitePage.jsx for the equivalent client-side
// (real-browser) resolution this mirrors, by Host header instead of a
// route param. Same "try a listing first, then an agent site" order.
//
// The same rewrite also fires for bots hitting the app's own host's root
// (the-agency-listings.vercel.app/) — isAppHost() below detects that case
// and returns the same generic title index.html already has, so nothing
// changes for the main app; this function is additive.
import { createClient } from "@supabase/supabase-js";
import { buildListingMeta, buildAgentSiteMeta, escapeHtml } from "../src/lib/seo.js";
import { bareHost, isAppHost } from "../src/lib/appHosts.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

const APP_DEFAULT_TITLE = "The Agency Listings";
const APP_DEFAULT_DESCRIPTION = "The Agency — property listing sites and agent dashboard";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const host = bareHost(req.headers.host);
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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderMetaPage({
        title: escapeHtml(meta.title),
        description: escapeHtml(meta.description),
        image: meta.image,
        url,
        heading: escapeHtml(listing.address_line1),
        bodyHtml,
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

    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderMetaPage({
        title: escapeHtml(meta.title),
        description: escapeHtml(meta.description),
        image: meta.image,
        url,
        heading: escapeHtml(heading),
        bodyHtml,
      }),
    );
    return;
  }

  res.status(404).send(
    renderMetaPage({
      title: "Site not found | The Agency",
      description: "This domain isn't attached to a listing or agent site.",
      image: "",
      url,
      heading: "Site not found",
      bodyHtml: "<p>This domain isn't attached to a listing or agent site.</p>",
      noindex: true,
    }),
  );
}

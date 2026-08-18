// Vercel serverless function — server-rendered "snapshot" of a listing
// page, served ONLY to crawlers/link-unfurlers (see vercel.json's
// user-agent-matched rewrite for /listings/:slug). A real browser never
// hits this; it gets the normal SPA. This exists because the SPA renders
// entirely client-side, so anything that fetches raw HTML without running
// JS (Slack, iMessage, Facebook, Twitter/X, etc.) would otherwise only
// ever see index.html's one generic title/description for every listing.
import { createClient } from "@supabase/supabase-js";
import { buildListingMeta, escapeHtml, SITE_ORIGIN } from "../src/lib/seo.js";
import { buildListingSchema } from "../src/lib/structuredData.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

export default async function handler(req, res) {
  const slug = req.query.slug;
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (!slug) {
    res.status(400).send("Missing slug");
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
    .eq("slug", slug)
    .maybeSingle();

  const url = `${SITE_ORIGIN}/listings/${slug}`;

  if (!listing) {
    res.status(404).send(
      renderMetaPage({
        title: "Listing not found | The Agency",
        description: "This listing may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Listing not found",
        bodyHtml: "<p>This listing may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

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
}

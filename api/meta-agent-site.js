// Vercel serverless function — server-rendered "snapshot" of an agent
// site's homepage AND its standalone subpages (About/Listings/Areas/
// Blog/Contact — see api/meta-listing.js for the full rationale).
// `req.query.page` is one of "about"|"listings"|"areas"|"blog"|"contact",
// or absent for Home (see vercel.json's rewrites for /sites/:slug and
// /sites/:slug/:page).
import { createClient } from "@supabase/supabase-js";
import { buildAgentSitePageMeta, escapeHtml, SITE_ORIGIN } from "../src/lib/seo.js";
import { buildAgentSchema, buildBreadcrumbSchema } from "../src/lib/structuredData.js";
import brokerage from "../src/lib/brokerage.js";
import { renderMetaPage } from "./_lib/renderMetaPage.js";

const PAGE_LABELS = { about: "About", listings: "Listings", areas: "Areas", blog: "Blog", contact: "Contact" };

export default async function handler(req, res) {
  const slug = req.query.slug;
  const page = PAGE_LABELS[req.query.page] ? req.query.page : undefined;
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

  const { data: site } = await supabase
    .from("agent_sites")
    .select("*, agent:profiles(*)")
    .eq("slug", slug)
    .maybeSingle();

  const homeUrl = `${SITE_ORIGIN}/sites/${slug}`;
  const url = page ? `${homeUrl}/${page}` : homeUrl;

  if (!site) {
    res.status(404).send(
      renderMetaPage({
        title: "Site not found | The Agency",
        description: "This agent site may have been unpublished or the link is incorrect.",
        image: "",
        url,
        heading: "Site not found",
        bodyHtml: "<p>This agent site may have been unpublished or the link is incorrect.</p>",
        noindex: true,
      }),
    );
    return;
  }

  const meta = buildAgentSitePageMeta(site, site.agent, page);
  const heading = page ? PAGE_LABELS[page] : site.agent?.full_name || "Agent";

  // Only fetch what this specific page actually shows — the home page
  // doesn't need any of this (its own bodyHtml is just the bio/region
  // summary, same as before).
  let extraHtml = "";
  if (page === "listings") {
    const { data: listings } = await supabase
      .from("listings")
      .select("slug, address_line1, city, state")
      .eq("agent_id", site.agent_id)
      .neq("status", "draft");
    extraHtml = (listings || [])
      .map(
        (l) =>
          `<li><a href="${SITE_ORIGIN}/listings/${l.slug}">${escapeHtml(
            `${l.address_line1}, ${l.city}, ${l.state}`,
          )}</a></li>`,
      )
      .join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "areas") {
    const { data: areas } = await supabase
      .from("agent_site_areas")
      .select("name, blurb")
      .eq("agent_site_id", site.id)
      .order("sort_order");
    extraHtml = (areas || []).map((a) => `<li>${escapeHtml(a.name)}${a.blurb ? ` — ${escapeHtml(a.blurb)}` : ""}</li>`).join("");
    extraHtml = extraHtml ? `<ul>${extraHtml}</ul>` : "";
  } else if (page === "blog") {
    const { data: posts } = await supabase
      .from("agent_site_posts")
      .select("slug, title, excerpt")
      .eq("agent_site_id", site.id)
      .eq("status", "published")
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
  } else if (page === "contact") {
    extraHtml = [
      site.agent?.phone ? `<p>${escapeHtml(site.agent.phone)}</p>` : "",
      site.agent?.email ? `<p>${escapeHtml(site.agent.email)}</p>` : "",
    ].join("");
  }

  const bodyHtml = `
${site.region ? `<p>${escapeHtml(site.region)}</p>` : ""}
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
      }),
    );
  }
  if (page) {
    schemas.push(
      buildBreadcrumbSchema([
        { name: site.agent?.full_name || "Home", url: homeUrl },
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

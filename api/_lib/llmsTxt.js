// /llms.txt for every host this app serves (vercel.json rewrites /llms.txt to /api/sitemap?llms=1, next to robots.txt).
// llms.txt is a plain-markdown summary of a site for AI tools: a title, a one-paragraph summary, then link lists. It is
// built live from the same public data the pages show (RLS limits it to published rows), so it is never out of date,
// and each host gets the file for what it serves:
//   - an agent's own domain         -> that agent site
//   - a property site's own domain  -> that one listing
//   - a brokerage's own domain      -> that brokerage site
//   - the marketing host            -> the product pages
//   - the app host                  -> a directory of the published agent sites and property sites
import { createClient } from "@supabase/supabase-js";
import { SITE_ORIGIN, publishedOrDueFilter } from "../../src/lib/seo.js";
import { MARKETING_META } from "../../src/lib/marketingMeta.js";
import { formatPrice, STATUS_LABELS } from "../../src/lib/format.js";
import { SIGNATURE_HOST, bareHost, isAppHost, isMarketingHost } from "../../src/lib/appHosts.js";

const DIRECTORY_CAP = 200;
const TIME_ZONE = "America/Chicago";

// ---- small text helpers -----------------------------------------------------------------------------------------------

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

function plain(html) {
  return String(html || "")
    .replace(/<\s*(br|\/p|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m])
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

function clip(text, max) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

// Link text can't contain brackets without breaking the markdown.
const label = (s) => String(s || "").replace(/[[\]]/g, "");
const link = (text, url) => `[${label(text)}](${url})`;

function specs(l) {
  return [l.beds != null && `${l.beds} bd`, l.baths != null && `${l.baths} ba`, l.sqft != null && `${Number(l.sqft).toLocaleString("en-US")} sqft`].filter(Boolean).join(" | ");
}

const statusLabel = (s) => STATUS_LABELS[s] || s;
const address = (l) => [l.address_line1, l.city, [l.state, l.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

function when(startIso, endIso) {
  const opts = { timeZone: TIME_ZONE };
  const day = new Date(startIso).toLocaleDateString("en-US", { ...opts, weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const t = (iso) => new Date(iso).toLocaleTimeString("en-US", { ...opts, hour: "numeric", minute: "2-digit" });
  const tz = new Date(startIso).toLocaleTimeString("en-US", { ...opts, timeZoneName: "short" }).split(" ").pop();
  return `${day}, ${t(startIso)}${endIso ? ` to ${t(endIso)}` : ""} ${tz}`;
}

const doc = (lines) => `${lines.filter((l) => l !== null && l !== undefined && l !== false).join("\n").replace(/\n{3,}/g, "\n\n")}\n`;

// ---- an agent site ----------------------------------------------------------------------------------------------------

async function agentSiteDoc(supabase, site, origin, custom) {
  const base = custom ? origin : `${SITE_ORIGIN}/sites/${site.slug}`;
  const home = custom ? `${origin}/` : base;
  const agent = site.agent || {};
  const brokerage = site.org?.name || "";
  const [{ data: listings }, { data: areas }, { data: posts }, { data: testimonials }] = await Promise.all([
    supabase.from("listings").select("slug, address_line1, city, state, zip, price, status, beds, baths, sqft").eq("agent_id", site.agent_id).neq("status", "draft").order("price", { ascending: false }).limit(30),
    supabase.from("agent_site_areas").select("slug, name, blurb").eq("agent_site_id", site.id).order("sort_order"),
    supabase.from("agent_site_posts").select("slug, title, category, excerpt, post_date").eq("agent_site_id", site.id).or(publishedOrDueFilter()).order("post_date", { ascending: false }).limit(15),
    supabase.from("agent_site_testimonials").select("quote, author").eq("agent_site_id", site.id).order("sort_order").limit(3),
  ]);

  const name = agent.full_name || "Real estate agent";
  const role = agent.title || "Real Estate Agent";
  const summary = [site.tagline, `${role}${brokerage ? ` with ${brokerage}` : ""}${site.region ? `, serving ${site.region}` : ""}.`, agent.license ? `License: ${agent.license}.` : ""].filter(Boolean).join(" ");
  const bio = clip(plain(site.bio_html || (site.bio || []).join("\n\n")), 900);

  return doc([
    `# ${name}${site.region ? `: ${role} in ${site.region}` : `: ${role}`}`,
    "",
    `> ${summary}`,
    "",
    bio || null,
    bio ? "" : null,
    "## Pages",
    `- ${link("Home", home)}: ${name}'s website`,
    `- ${link("About", `${base}/about`)}: background, experience and numbers`,
    `- ${link("Listings", `${base}/listings`)}: current and past properties`,
    `- ${link("Areas of expertise", `${base}/areas`)}: neighborhoods and cities served`,
    `- ${link("Blog", `${base}/blog`)}: market insights and advice`,
    `- ${link("Contact", `${base}/contact`)}: send a message${agent.phone ? `, or call ${agent.phone}` : ""}`,
    "",
    (listings || []).length ? "## Listings" : null,
    ...(listings || []).map((l) => `- ${link(address(l), `${SITE_ORIGIN}/listings/${l.slug}`)}: ${[formatPrice(l.price), statusLabel(l.status), specs(l)].filter(Boolean).join(", ")}`),
    (listings || []).length ? "" : null,
    (areas || []).length ? "## Areas of expertise" : null,
    ...(areas || []).map((a) => `- ${link(a.name, `${base}/areas/${a.slug}`)}${a.blurb ? `: ${clip(a.blurb, 200)}` : ""}`),
    (areas || []).length ? "" : null,
    (posts || []).length ? "## Recent blog posts" : null,
    ...(posts || []).map((p) => `- ${link(p.title, `${base}/blog/${p.slug}`)}${p.category || p.excerpt ? `: ${[p.category, clip(p.excerpt, 160)].filter(Boolean).join(". ")}` : ""}`),
    (posts || []).length ? "" : null,
    (testimonials || []).length ? "## What clients say" : null,
    ...(testimonials || []).map((t) => `- "${clip(plain(t.quote), 220)}" (${t.author})`),
  ]);
}

// ---- a property site --------------------------------------------------------------------------------------------------

async function listingDoc(supabase, listing, home) {
  const nowIso = new Date().toISOString();
  const [{ data: agent }, { data: openHouses }] = await Promise.all([
    supabase.from("profiles").select("full_name, title, phone").eq("id", listing.agent_id).maybeSingle(),
    supabase.from("open_houses").select("starts_at, ends_at, notes").eq("listing_id", listing.id).gte("starts_at", nowIso).order("starts_at").limit(5),
  ]);
  const { data: agentSite } = await supabase.from("agent_sites").select("slug, custom_domain").eq("agent_id", listing.agent_id).eq("status", "published").maybeSingle();
  const agentUrl = agentSite ? (agentSite.custom_domain ? `https://${agentSite.custom_domain}/` : `${SITE_ORIGIN}/sites/${agentSite.slug}`) : null;

  const addr = address(listing);
  const facts = [
    ["Status", statusLabel(listing.status)],
    ["Price", formatPrice(listing.price)],
    ["Bedrooms", listing.beds],
    ["Bathrooms", listing.baths],
    ["Square feet", listing.sqft != null ? Number(listing.sqft).toLocaleString("en-US") : null],
    ["Lot size", listing.lot_size],
    ["Year built", listing.year_built],
    ["Garage", listing.garage],
    ["Property type", listing.property_type],
    ["MLS number", listing.mls_number],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "—");
  const description = clip((listing.description || []).join("\n\n"), 1200);
  const features = Array.isArray(listing.features) ? listing.features.filter((g) => g?.category) : [];

  return doc([
    `# ${addr}`,
    "",
    `> Single-property website for ${listing.property_type || "a home"} at ${addr}: ${[statusLabel(listing.status), formatPrice(listing.price), specs(listing)].filter(Boolean).join(", ")}.`,
    "",
    "## Property details",
    ...facts.map(([k, v]) => `- ${k}: ${v}`),
    "",
    description ? "## About this home" : null,
    description || null,
    description ? "" : null,
    features.length ? "## Features" : null,
    ...features.map((g) => `- ${g.category}: ${clip((g.items || []).join(", "), 300)}`),
    features.length ? "" : null,
    (openHouses || []).length ? "## Open houses" : null,
    ...(openHouses || []).map((o) => `- ${when(o.starts_at, o.ends_at)}${o.notes ? `: ${clip(o.notes, 160)}` : ""}`),
    (openHouses || []).length ? "" : null,
    "## Listing agent",
    agent ? `- ${agentUrl ? link(agent.full_name || "Listing agent", agentUrl) : agent.full_name || "Listing agent"}${agent.title ? `, ${agent.title}` : ""}${agent.phone ? `, ${agent.phone}` : ""}` : "- Contact the agent through the site's contact form.",
    "",
    "## This site",
    `- ${link("Property page", home)}: photos, details, map and a form to schedule a tour`,
  ]);
}

// ---- a brokerage site -------------------------------------------------------------------------------------------------

async function brokerageDoc(supabase, site, origin, custom) {
  const base = custom ? origin : `${SITE_ORIGIN}/brokerage`;
  const [{ data: org }, { data: posts }, { data: areas }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", site.org_id).maybeSingle(),
    supabase.from("brokerage_posts").select("slug, title, category, excerpt").eq("org_id", site.org_id).or(publishedOrDueFilter()).order("post_date", { ascending: false }).limit(15),
    supabase.from("brokerage_areas").select("slug, name, blurb").eq("org_id", site.org_id).order("sort_order"),
  ]);
  const name = org?.name || "Brokerage";
  const about = clip(plain(site.about_html), 900);
  return doc([
    `# ${name}`,
    "",
    `> ${[site.tagline, `${name} real estate brokerage website: agents, home search, market insights and contact.`].filter(Boolean).join(" ")}`,
    "",
    about || null,
    about ? "" : null,
    "## Pages",
    `- ${link("Home", custom ? `${origin}/` : base)}`,
    `- ${link("About", `${base}/about`)}`,
    `- ${link("Agents", `${base}/agents`)}: the agents who work here`,
    `- ${link("Areas", `${base}/areas`)}: areas served`,
    `- ${link("Listings", `${base}/listings`)}: homes for sale`,
    `- ${link("Home search", `${base}/search`)}: search all available homes`,
    `- ${link("Home valuation", `${base}/home-valuation`)}: what is my home worth`,
    `- ${link("Blog", `${base}/blog`)}: market insights`,
    `- ${link("Contact", `${base}/contact`)}${site.contact_phone ? `: call ${site.contact_phone}` : ""}`,
    "",
    (areas || []).length ? "## Areas" : null,
    ...(areas || []).map((a) => `- ${link(a.name, `${base}/areas/${a.slug}`)}${a.blurb ? `: ${clip(a.blurb, 200)}` : ""}`),
    (areas || []).length ? "" : null,
    (posts || []).length ? "## Recent blog posts" : null,
    ...(posts || []).map((p) => `- ${link(p.title, `${base}/blog/${p.slug}`)}${p.category || p.excerpt ? `: ${[p.category, clip(p.excerpt, 160)].filter(Boolean).join(". ")}` : ""}`),
  ]);
}

// ---- the platform host ------------------------------------------------------------------------------------------------

async function directoryDoc(supabase) {
  const [{ data: sites }, { data: listings }] = await Promise.all([
    supabase.from("agent_sites").select("slug, region, tagline, agent:profiles(full_name, title)").eq("status", "published").limit(DIRECTORY_CAP),
    supabase.from("listings").select("slug, address_line1, city, state, zip, price, status, beds, baths, sqft").neq("status", "draft").order("price", { ascending: false }).limit(DIRECTORY_CAP),
  ]);
  return doc([
    "# The Agency Dashboard",
    "",
    "> The back office and website platform for The Agency real estate agents: agent websites, single-property websites, leads, pipeline, transactions and a shared calendar. This file lists the public agent and property websites it hosts.",
    "",
    "## Agent websites",
    ...(sites || []).map((s) => `- ${link(s.agent?.full_name || s.slug, `${SITE_ORIGIN}/sites/${s.slug}`)}: ${[s.agent?.title, s.region, clip(s.tagline, 120)].filter(Boolean).join(", ")}`),
    "",
    "## Property websites",
    ...(listings || []).map((l) => `- ${link(address(l), `${SITE_ORIGIN}/listings/${l.slug}`)}: ${[formatPrice(l.price), statusLabel(l.status), specs(l)].filter(Boolean).join(", ")}`),
    "",
    "## More",
    `- ${link("Sitemap", `${SITE_ORIGIN}/sitemap.xml`)}: every public page`,
  ]);
}

function marketingDoc(origin) {
  const home = MARKETING_META["/"];
  return doc([
    "# Latchpoint Real Estate",
    "",
    `> ${home?.description || "Websites and a back office for real estate agents: agent websites, property websites, leads, pipeline, transactions and calendar in one dashboard."}`,
    "",
    "## Pages",
    ...Object.entries(MARKETING_META).map(([path, m]) => `- ${link(m.title.replace(/\s*\|\s*The Agency$/, ""), `${origin}${path === "/" ? "/" : path}`)}: ${clip(m.description, 220)}`),
  ]);
}

// ---- entry point ------------------------------------------------------------------------------------------------------

export async function handleLlms(req, res) {
  const rawHost = req.headers.host || "";
  const host = bareHost(rawHost);
  const origin = `https://${rawHost}`;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");

  if (host === SIGNATURE_HOST) {
    res.status(404).send("Not found.\n");
    return;
  }
  if (isMarketingHost(rawHost)) {
    res.status(200).send(marketingDoc(origin));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send("Supabase env vars are not configured.\n");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    if (isAppHost(host)) {
      res.status(200).send(await directoryDoc(supabase));
      return;
    }

    // Same "property site, then agent site, then brokerage site" order as the sitemap and the crawler snapshots.
    const { data: listing } = await supabase.from("listings").select("*").ilike("custom_domain", host).neq("status", "draft").maybeSingle();
    if (listing) {
      res.status(200).send(await listingDoc(supabase, listing, `${origin}/`));
      return;
    }
    const { data: site } = await supabase.from("agent_sites").select("*, agent:profiles(*), org:organizations(name)").ilike("custom_domain", host).eq("status", "published").maybeSingle();
    if (site) {
      res.status(200).send(await agentSiteDoc(supabase, site, origin, true));
      return;
    }
    const { data: brokerageSite } = await supabase.from("brokerage_site").select("*").ilike("custom_domain", host).eq("status", "published").maybeSingle();
    if (brokerageSite) {
      res.status(200).send(await brokerageDoc(supabase, brokerageSite, origin, true));
      return;
    }
    res.status(404).send("Not found.\n");
  } catch (err) {
    console.error("llms.txt failed:", err);
    res.status(500).send("Couldn't build llms.txt.\n");
  }
}

// Exposed for tests.
export { agentSiteDoc, listingDoc, brokerageDoc, directoryDoc, marketingDoc, plain, clip };

import { HttpError, bad, cleanHtml, dateKey, downloadImage, isUuid, markdownToHtml, mapLimit, oneOf, slugify, storeImage, text, url } from "./util.js";
import { requireScope } from "./context.js";
import { insertSales, saleView } from "./sales.js";

const THEMES = ["classic", "dark", "sand", "red", "linen"];
const LAYOUTS = ["classic", "editorial", "bold", "portrait", "listings"];
const FONTS = ["playfair-jost", "fraunces-inter", "cormorant-worksans", "libre-karla", "bodoni-manrope", "dmserif-dmsans"];
const SECTIONS = ["bio", "testimonials", "cards", "listings", "areas", "blog"];
const BUCKET = "agent-site-photos";

const siteUrl = (req, slug) => `https://${req.headers.host}/sites/${slug}`;
export const siteView = (s, req) => ({
  id: s.id,
  agent_id: s.agent_id,
  slug: s.slug,
  status: s.status,
  tagline: s.tagline,
  region: s.region,
  theme: s.theme,
  layout: s.layout,
  font_pairing: s.font_pairing,
  header_style: s.header_style,
  button_style: s.button_style,
  home_sections: s.home_sections,
  custom_domain: s.custom_domain,
  url: s.custom_domain ? `https://${s.custom_domain}/` : siteUrl(req, s.slug),
});

async function loadSite(ctx, id) {
  if (!isUuid(id)) throw bad("That isn't a valid site id.");
  const { data } = await ctx.client.from("agent_sites").select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) throw new HttpError(404, "No agent site with that id in your organization.");
  return data;
}
export { loadSite };

// The editable fields of a site, validated and converted to columns. Only what is present in the body is returned.
function readFields(body) {
  const f = {};
  const set = (k, v) => v !== undefined && (f[k] = v);
  set("tagline", text(body, "tagline", { max: 160 }));
  set("region", text(body, "region", { max: 120 }));
  set("status", oneOf(body, "status", ["draft", "published"]));
  set("theme", oneOf(body, "theme", THEMES));
  set("layout", oneOf(body, "layout", LAYOUTS));
  set("font_pairing", oneOf(body, "font_pairing", FONTS));
  set("header_style", oneOf(body, "header_style", ["classic", "floating"]));
  set("button_style", oneOf(body, "button_style", ["square", "pill"]));
  set("logo_variant", oneOf(body, "logo_variant", ["red", "white", "black"]));
  set("seo_title", text(body, "seo_title", { max: 120 }));
  set("seo_description", text(body, "seo_description", { max: 300 }));
  for (const k of ["instagram_url", "facebook_url", "linkedin_url", "tiktok_url", "youtube_url", "x_url"]) set(k, url(body, k));

  if (body.home_sections !== undefined) {
    if (!Array.isArray(body.home_sections) || body.home_sections.some((s) => !SECTIONS.includes(s))) throw bad(`home_sections must be a list drawn from: ${SECTIONS.join(", ")}.`);
    f.home_sections = [...new Set(body.home_sections)];
  }
  if (body.stats !== undefined) {
    if (!Array.isArray(body.stats) || body.stats.length > 6) throw bad("stats must be a list of up to 6 { label, value } pairs.");
    f.stats = body.stats.map((s) => ({ label: text(s, "label", { required: true, max: 40 }), value: text(s, "value", { required: true, max: 30 }) }));
  }
  // The bio: markdown (or HTML in the editor's tag set). The plain-text copy keeps older code paths working.
  const md = text(body, "bio_markdown", { max: 100000 }) ?? text(body, "bio", { max: 100000 });
  const html = text(body, "bio_html", { max: 200000 });
  if (md !== undefined && html !== undefined) throw bad("Send either bio_markdown or bio_html, not both.");
  if (md !== undefined) {
    f.bio_html = markdownToHtml(md);
    f.bio = md.split(/\n{2,}/).map((p) => p.replace(/[#*_>]/g, "").trim()).filter(Boolean);
  } else if (html !== undefined) {
    f.bio_html = cleanHtml(html);
    f.bio = f.bio_html.replace(/<\/p>/g, "\n\n").replace(/<[^>]*>/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }
  return f;
}

async function addImage(ctx, siteId, source) {
  const image = await downloadImage(source);
  return storeImage(ctx.client, BUCKET, siteId, image);
}

async function insertAreas(ctx, site, areas) {
  if (!Array.isArray(areas) || areas.length > 30) throw bad("areas must be a list of up to 30 areas.");
  const { data: existing } = await ctx.client.from("agent_site_areas").select("slug, sort_order").eq("agent_site_id", site.id);
  const taken = new Set((existing || []).map((a) => a.slug));
  let order = Math.max(-1, ...(existing || []).map((a) => a.sort_order)) + 1;
  const rows = [];
  const photoJobs = [];
  for (const a of areas) {
    const name = text(a, "name", { required: true, max: 80 });
    let slug = slugify(text(a, "slug", { max: 80 }) || name, "area");
    for (let n = 2; taken.has(slug); n++) slug = `${slugify(name, "area")}-${n}`;
    taken.add(slug);
    const row = { agent_site_id: site.id, slug, name, blurb: text(a, "blurb", { max: 240 }) || "", description: a.description_markdown !== undefined ? markdownToHtml(text(a, "description_markdown", { max: 20000 })) : cleanHtml(text(a, "description_html", { max: 40000 }) || ""), photo_url: url(a, "photo_url") || null, sort_order: order++ };
    const source = url(a, "photo_source_url");
    if (source) photoJobs.push({ row, source });
    rows.push(row);
  }
  const photos = await mapLimit(photoJobs, 3, ({ source }) => addImage(ctx, site.id, source));
  photos.forEach((r, i) => {
    if (r.ok) photoJobs[i].row.photo_url = r.value;
  });
  if (!rows.length) return { added: [], photo_errors: [] };
  const { data, error } = await ctx.client.from("agent_site_areas").insert(rows).select("id, slug, name");
  if (error) throw new HttpError(500, error.message);
  return { added: data, photo_errors: photos.map((r, i) => (r.ok ? null : { area: photoJobs[i].row.name, error: r.error })).filter(Boolean) };
}

async function insertTestimonials(ctx, site, list) {
  if (!Array.isArray(list) || list.length > 30) throw bad("testimonials must be a list of up to 30 { quote, author } items.");
  const { data: existing } = await ctx.client.from("agent_site_testimonials").select("sort_order").eq("agent_site_id", site.id);
  let order = Math.max(-1, ...(existing || []).map((t) => t.sort_order)) + 1;
  const rows = list.map((t) => ({ agent_site_id: site.id, quote: cleanHtml(text(t, "quote", { required: true, max: 2000 })), author: text(t, "author", { required: true, max: 80 }), sort_order: order++ }));
  if (!rows.length) return { added: [] };
  const { data, error } = await ctx.client.from("agent_site_testimonials").insert(rows).select("id, author");
  if (error) throw new HttpError(500, error.message);
  return { added: data };
}

export async function listSites(ctx, req) {
  const { data, error } = await ctx.client.from("agent_sites").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false });
  if (error) throw new HttpError(500, error.message);
  return { sites: (data || []).map((s) => siteView(s, req)) };
}

export async function getSite(ctx, id, req) {
  const site = await loadSite(ctx, id);
  const [{ data: areas }, { data: testimonials }, { data: sales }] = await Promise.all([
    ctx.client.from("agent_site_areas").select("id, slug, name, blurb").eq("agent_site_id", id).order("sort_order"),
    ctx.client.from("agent_site_testimonials").select("id, author").eq("agent_site_id", id).order("sort_order"),
    ctx.client.from("agent_site_sales").select("*").eq("agent_site_id", id).order("sold_on", { ascending: false, nullsFirst: false }),
  ]);
  return { site: siteView(site, req), areas: areas || [], testimonials: testimonials || [], sales: (sales || []).map(saleView) };
}

export async function createSite(ctx, body, req) {
  requireScope(ctx, "sites");
  const agent_id = text(body, "agent_id", { required: true, max: 40 });
  if (!isUuid(agent_id)) throw bad("agent_id must be an agent's id (see GET /v1/agents).");
  const { data: agent } = await ctx.admin.from("profiles").select("id, full_name, org_id").eq("id", agent_id).maybeSingle();
  if (!agent || agent.org_id !== ctx.orgId) throw new HttpError(404, "No agent with that id in your organization.");
  const { data: have } = await ctx.admin.from("agent_sites").select("id, slug").eq("agent_id", agent_id).maybeSingle();
  if (have) throw new HttpError(409, "That agent already has a website. Use PATCH /v1/sites/{id} to change it.", { site_id: have.id });

  const fields = readFields(body);
  const base = slugify(text(body, "slug", { max: 80 }) || agent.full_name, "agent");
  let created = null;
  for (let n = 0; n < 8 && !created; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const { data, error } = await ctx.client.from("agent_sites").insert({ agent_id, slug, ...fields, status: fields.status || "draft" }).select("*").single();
    if (data) created = data;
    else if (error?.code !== "23505") throw new HttpError(error?.code === "42501" ? 403 : 500, error?.message || "Couldn't create the site.");
  }
  if (!created) throw new HttpError(409, "Couldn't find a free web address for that site. Send a different slug.");

  const extras = {};
  const heroSource = url(body, "hero_photo_source_url");
  const hero = url(body, "hero_photo_url");
  if (hero) await ctx.client.from("agent_sites").update({ hero_photo_url: hero }).eq("id", created.id);
  if (heroSource) {
    try {
      const stored = await addImage(ctx, created.id, heroSource);
      await ctx.client.from("agent_sites").update({ hero_photo_url: stored }).eq("id", created.id);
    } catch (err) {
      extras.hero_photo_error = err.message;
    }
  }
  if (body.areas !== undefined) extras.areas = await insertAreas(ctx, created, body.areas);
  if (body.testimonials !== undefined) extras.testimonials = await insertTestimonials(ctx, created, body.testimonials);
  if (body.sales !== undefined) extras.sales = await insertSales(ctx, created, body.sales);
  return { site: siteView(created, req), ...extras };
}

export async function updateSite(ctx, id, body, req) {
  requireScope(ctx, "sites");
  const site = await loadSite(ctx, id);
  const fields = readFields(body);
  const slug = text(body, "slug", { max: 80 });
  if (slug !== undefined) fields.slug = slugify(slug, site.slug);
  const hero = url(body, "hero_photo_url");
  if (hero !== undefined) fields.hero_photo_url = hero || null;
  const extras = {};
  const heroSource = url(body, "hero_photo_source_url");
  if (heroSource) {
    try {
      fields.hero_photo_url = await addImage(ctx, site.id, heroSource);
    } catch (err) {
      extras.hero_photo_error = err.message;
    }
  }
  if (!Object.keys(fields).length && !body.areas && !body.testimonials && !body.sales) throw bad("Nothing to change. Send at least one field.");
  let current = site;
  if (Object.keys(fields).length) {
    const { data, error } = await ctx.client.from("agent_sites").update(fields).eq("id", id).select("*").single();
    if (error) throw new HttpError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "That slug is already taken." : error.message);
    current = data;
  }
  if (body.areas !== undefined) extras.areas = await insertAreas(ctx, current, body.areas);
  if (body.testimonials !== undefined) extras.testimonials = await insertTestimonials(ctx, current, body.testimonials);
  if (body.sales !== undefined) extras.sales = await insertSales(ctx, current, body.sales);
  return { site: siteView(current, req), ...extras };
}

export async function addAreas(ctx, id, body) {
  requireScope(ctx, "sites");
  return insertAreas(ctx, await loadSite(ctx, id), body.areas);
}
export async function addTestimonials(ctx, id, body) {
  requireScope(ctx, "sites");
  return insertTestimonials(ctx, await loadSite(ctx, id), body.testimonials);
}
export { dateKey };

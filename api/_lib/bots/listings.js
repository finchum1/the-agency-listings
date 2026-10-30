import { HttpError, bad, downloadImage, isUuid, mapLimit, number, oneOf, slugify, storeImage, text, url } from "./util.js";
import { requireScope } from "./context.js";

const BUCKET = "listing-photos";
const STATUSES = ["draft", "coming_soon", "for_sale", "pending", "closed", "off_market"];
const THEMES = ["classic", "dark", "sand", "red", "linen"];
const FONTS = ["playfair-jost", "fraunces-inter", "cormorant-worksans", "libre-karla", "bodoni-manrope", "dmserif-dmsans"];
const MAX_PHOTOS_PER_CALL = 25;

export const listingView = (l, req) => ({
  id: l.id,
  slug: l.slug,
  agent_id: l.agent_id,
  status: l.status,
  mls_number: l.mls_number,
  address_line1: l.address_line1,
  city: l.city,
  state: l.state,
  zip: l.zip,
  price: l.price,
  beds: l.beds,
  baths: l.baths,
  sqft: l.sqft,
  lot_size: l.lot_size,
  year_built: l.year_built,
  garage: l.garage,
  property_type: l.property_type,
  site_template: l.site_template,
  theme: l.theme,
  custom_domain: l.custom_domain,
  url: l.custom_domain ? `https://${l.custom_domain}/` : `https://${req.headers.host}/listings/${l.slug}`,
  updated_at: l.updated_at,
});

async function loadListing(ctx, id) {
  if (!isUuid(id)) throw bad("That isn't a valid listing id.");
  const { data } = await ctx.client.from("listings").select("*").eq("id", id).eq("org_id", ctx.orgId).maybeSingle();
  if (!data) throw new HttpError(404, "No listing with that id in your organization.");
  return data;
}

// The editable fields of a listing, validated. `create` makes the address fields required.
function readFields(body, create) {
  const f = {};
  const set = (k, v) => v !== undefined && (f[k] = v);
  set("status", oneOf(body, "status", STATUSES));
  set("mls_number", text(body, "mls_number", { max: 40 }));
  set("address_line1", text(body, "address_line1", { required: create, max: 160 }));
  set("city", text(body, "city", { required: create, max: 80 }));
  set("state", text(body, "state", { required: create, max: 30 }));
  set("zip", text(body, "zip", { required: create, max: 12 }));
  set("price", number(body, "price", { max: 1e10 }));
  set("beds", number(body, "beds", { max: 99, integer: true }));
  set("baths", number(body, "baths", { max: 99 }));
  set("sqft", number(body, "sqft", { max: 1e7, integer: true }));
  set("lot_size", text(body, "lot_size", { max: 60 }));
  set("year_built", text(body, "year_built", { max: 20 }));
  set("garage", text(body, "garage", { max: 40 }));
  set("property_type", text(body, "property_type", { max: 60 }));
  set("hero_video_url", url(body, "hero_video_url"));
  set("video_placement", oneOf(body, "video_placement", ["hero", "gallery", "both"]));
  set("seo_title", text(body, "seo_title", { max: 120 }));
  set("seo_description", text(body, "seo_description", { max: 300 }));
  set("site_template", oneOf(body, "site_template", ["classic", "luxury"]));
  set("theme", oneOf(body, "theme", THEMES));
  set("font_pairing", oneOf(body, "font_pairing", FONTS));
  set("header_style", oneOf(body, "header_style", ["classic", "floating"]));
  set("header_label", text(body, "header_label", { max: 40 }) || (body.header_label === "" ? null : undefined));
  const domain = text(body, "custom_domain", { max: 120 });
  if (domain !== undefined) f.custom_domain = domain ? domain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase() : null;

  if (body.description !== undefined) {
    const paragraphs = Array.isArray(body.description) ? body.description : typeof body.description === "string" ? body.description.split(/\n{2,}/) : null;
    if (!paragraphs || paragraphs.some((p) => typeof p !== "string")) throw bad("description must be text (blank line between paragraphs) or a list of paragraphs.");
    f.description = paragraphs.map((p) => p.trim()).filter(Boolean).slice(0, 30);
  }
  if (body.features !== undefined) {
    if (!Array.isArray(body.features) || body.features.length > 20) throw bad("features must be a list of up to 20 { category, items: [..] } groups.");
    f.features = body.features.map((g) => {
      const category = text(g, "category", { required: true, max: 60 });
      if (!Array.isArray(g.items) || g.items.length > 60 || g.items.some((i) => typeof i !== "string")) throw bad("Each feature group needs items: a list of text, up to 60.");
      return { category, items: g.items.map((i) => i.trim()).filter(Boolean) };
    });
  }
  return f;
}

async function addPhotosTo(ctx, listing, items) {
  if (!Array.isArray(items) || items.length === 0) return { added: 0, errors: [] };
  if (items.length > MAX_PHOTOS_PER_CALL) throw bad(`Send at most ${MAX_PHOTOS_PER_CALL} photos per call; send the rest in another call.`);
  const sources = items.map((i) => (typeof i === "string" ? { url: i } : i));
  for (const s of sources) {
    if (!s || typeof s.url !== "string") throw bad("Each photo is a web address, or { url, caption?, alt? }.");
  }
  const { data: existing } = await ctx.client.from("listing_photos").select("sort_order, is_hero").eq("listing_id", listing.id);
  let order = Math.max(-1, ...(existing || []).map((p) => p.sort_order)) + 1;
  const hasHero = (existing || []).some((p) => p.is_hero);

  const stored = await mapLimit(sources, 3, async (s) => storeImage(ctx.client, BUCKET, listing.id, await downloadImage(s.url)));
  const rows = [];
  const errors = [];
  stored.forEach((r, i) => {
    if (!r.ok) {
      errors.push({ url: sources[i].url, error: r.error });
      return;
    }
    rows.push({ listing_id: listing.id, url: r.value, caption: String(sources[i].caption || "").slice(0, 80), alt: String(sources[i].alt || "").slice(0, 160), sort_order: order++, is_hero: !hasHero && rows.length === 0 });
  });
  if (rows.length) {
    const { error } = await ctx.client.from("listing_photos").insert(rows);
    if (error) throw new HttpError(500, error.message);
  }
  return { added: rows.length, errors };
}

async function addOpenHouses(ctx, listing, items) {
  if (!Array.isArray(items) || items.length > 20) throw bad("open_houses must be a list of up to 20 { starts_at, ends_at?, notes? }.");
  const rows = items.map((o) => {
    const starts = Date.parse(text(o, "starts_at", { required: true, max: 40 }));
    if (Number.isNaN(starts)) throw bad("starts_at must be a date and time, like 2026-10-25T13:00:00-05:00.");
    const endsRaw = text(o, "ends_at", { max: 40 });
    const ends = endsRaw ? Date.parse(endsRaw) : null;
    if (endsRaw && Number.isNaN(ends)) throw bad("ends_at must be a date and time.");
    return { listing_id: listing.id, starts_at: new Date(starts).toISOString(), ends_at: ends ? new Date(ends).toISOString() : null, notes: text(o, "notes", { max: 300 }) || "" };
  });
  if (!rows.length) return { added: 0 };
  const { error } = await ctx.client.from("open_houses").insert(rows);
  if (error) throw new HttpError(500, error.message);
  return { added: rows.length };
}

export async function listListings(ctx, query, req) {
  let q = ctx.client.from("listings").select("*").eq("org_id", ctx.orgId).order("updated_at", { ascending: false }).limit(Math.min(Number(query.limit) || 50, 200));
  if (STATUSES.includes(query.status)) q = q.eq("status", query.status);
  if (isUuid(query.agent_id)) q = q.eq("agent_id", query.agent_id);
  const { data, error } = await q;
  if (error) throw new HttpError(500, error.message);
  return { listings: (data || []).map((l) => listingView(l, req)) };
}

export async function getListing(ctx, id, req) {
  const l = await loadListing(ctx, id);
  const [{ count }, { data: houses }] = await Promise.all([
    ctx.client.from("listing_photos").select("id", { count: "exact", head: true }).eq("listing_id", id),
    ctx.client.from("open_houses").select("starts_at, ends_at, notes").eq("listing_id", id).order("starts_at"),
  ]);
  return { listing: { ...listingView(l, req), description: l.description, features: l.features, hero_video_url: l.hero_video_url, video_placement: l.video_placement, photo_count: count ?? 0, open_houses: houses || [] } };
}

export async function createListing(ctx, body, req) {
  requireScope(ctx, "listings");
  const agent_id = text(body, "agent_id", { required: true, max: 40 });
  if (!isUuid(agent_id)) throw bad("agent_id must be an agent's id (see list_agents).");
  const { data: agent } = await ctx.admin.from("profiles").select("id, org_id").eq("id", agent_id).maybeSingle();
  if (!agent || agent.org_id !== ctx.orgId) throw new HttpError(404, "No agent with that id in your organization.");

  const fields = readFields(body, true);
  const requestedSlug = text(body, "slug", { max: 90 });
  const bases = requestedSlug ? [slugify(requestedSlug, "listing")] : [slugify(fields.address_line1, "listing"), slugify(`${fields.address_line1} ${fields.city}`, "listing")];
  let created = null;
  const tries = [...bases];
  for (let n = 2; n < 6; n++) tries.push(`${bases[bases.length - 1]}-${n}`);
  for (const slug of tries) {
    const { data, error } = await ctx.client.from("listings").insert({ agent_id, slug, ...fields, status: fields.status || "draft" }).select("*").single();
    if (data) {
      created = data;
      break;
    }
    if (error?.code !== "23505") throw new HttpError(error?.code === "42501" ? 403 : 500, error?.message || "Couldn't create the listing.");
  }
  if (!created) throw new HttpError(409, "Couldn't find a free web address for that listing. Send a different slug.");

  const extras = {};
  const photos = body.photos ?? body.photo_urls;
  if (photos !== undefined) extras.photos = await addPhotosTo(ctx, created, photos);
  if (body.open_houses !== undefined) extras.open_houses = await addOpenHouses(ctx, created, body.open_houses);
  return { listing: listingView(created, req), ...extras };
}

export async function updateListing(ctx, id, body, req) {
  requireScope(ctx, "listings");
  const listing = await loadListing(ctx, id);
  const fields = readFields(body, false);
  const slug = text(body, "slug", { max: 90 });
  if (slug !== undefined && slugify(slug) !== listing.slug) fields.slug = slugify(slug, listing.slug);
  const hasExtras = body.photos !== undefined || body.photo_urls !== undefined || body.open_houses !== undefined;
  if (!Object.keys(fields).length && !hasExtras) throw bad("Nothing to change. Send at least one field.");
  let current = listing;
  if (Object.keys(fields).length) {
    const { data, error } = await ctx.client.from("listings").update(fields).eq("id", id).select("*").single();
    if (error) throw new HttpError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "That slug is already taken." : error.message);
    current = data;
  }
  const extras = {};
  const photos = body.photos ?? body.photo_urls;
  if (photos !== undefined) extras.photos = await addPhotosTo(ctx, current, photos);
  if (body.open_houses !== undefined) extras.open_houses = await addOpenHouses(ctx, current, body.open_houses);
  return { listing: listingView(current, req), ...extras };
}

export async function addListingPhotos(ctx, id, body) {
  requireScope(ctx, "listings");
  const listing = await loadListing(ctx, id);
  const result = await addPhotosTo(ctx, listing, body.photos ?? body.photo_urls);
  if (body.set_hero_first === true && result.added) {
    const { data: newest } = await ctx.client.from("listing_photos").select("id").eq("listing_id", id).order("sort_order", { ascending: false }).limit(result.added);
    const heroId = newest?.[newest.length - 1]?.id;
    if (heroId) {
      await ctx.client.from("listing_photos").update({ is_hero: false }).eq("listing_id", id);
      await ctx.client.from("listing_photos").update({ is_hero: true }).eq("id", heroId);
    }
  }
  return result;
}

export { readFields as readListingFields, addPhotosTo, addOpenHouses };

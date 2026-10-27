import { HttpError, bad, dateKey, downloadImage, isUuid, mapLimit, number, storeImage, text, url } from "./util.js";
import { requireScope } from "./context.js";
import { loadSite } from "./sites.js";

const BUCKET = "agent-site-photos";

export const saleView = (s) => ({
  id: s.id,
  agent_site_id: s.agent_site_id,
  address: s.address,
  city: s.city,
  state: s.state,
  price: s.price,
  sold_on: s.sold_on,
  photo_url: s.photo_url,
  listing_id: s.listing_id,
});

async function loadSale(ctx, id) {
  if (!isUuid(id)) throw bad("That isn't a valid sale id.");
  const { data: sale } = await ctx.client.from("agent_site_sales").select("*").eq("id", id).maybeSingle();
  if (!sale) throw new HttpError(404, "No past sale with that id.");
  const { data: site } = await ctx.client.from("agent_sites").select("*").eq("id", sale.agent_site_id).eq("org_id", ctx.orgId).maybeSingle();
  if (!site) throw new HttpError(404, "No past sale with that id.");
  return { sale, site };
}

// A listing the sale is copied from has to be one of this site's agent's own listings.
async function loadListing(ctx, site, id) {
  if (!isUuid(id)) throw bad("listing_id must be a listing id (see GET /v1/listings).");
  const { data } = await ctx.client.from("listings").select("id, address_line1, city, state, price, agent_id, updated_at, listing_photos(url, is_hero)").eq("id", id).eq("agent_id", site.agent_id).maybeSingle();
  if (!data) throw new HttpError(404, "That listing isn't one of this agent's listings.");
  return data;
}

// The editable fields of a sale, validated. Only what is in the body is returned.
function readFields(body) {
  const f = {};
  const set = (k, v) => v !== undefined && (f[k] = v);
  set("address", text(body, "address", { max: 200 }));
  set("city", text(body, "city", { max: 80 }));
  set("state", text(body, "state", { max: 40 }));
  set("price", number(body, "price", { max: 1e10 }));
  set("sold_on", dateKey(body, "sold_on"));
  if (f.sold_on === "") f.sold_on = null;
  const photo = url(body, "photo_url");
  if (photo !== undefined) f.photo_url = photo || null;
  return f;
}

/** Adds sales to a site. Each item needs an address, or a listing_id to copy the address, price and first photo from. */
export async function insertSales(ctx, site, list) {
  if (!Array.isArray(list) || !list.length || list.length > 30) throw bad("sales must be a list of 1 to 30 past sales.");
  const { data: existing } = await ctx.client.from("agent_site_sales").select("sort_order").eq("agent_site_id", site.id);
  let order = Math.max(-1, ...(existing || []).map((s) => s.sort_order)) + 1;
  const rows = [];
  const photoJobs = [];
  for (const item of list) {
    if (!item || typeof item !== "object") throw bad("Each sale must be an object with at least an address.");
    const row = { agent_site_id: site.id, sort_order: order++, ...readFields(item) };
    if (item.listing_id !== undefined && item.listing_id !== null) {
      const l = await loadListing(ctx, site, item.listing_id);
      row.listing_id = l.id;
      row.address ||= l.address_line1;
      row.city ??= l.city || "";
      row.state ??= l.state || "";
      row.price ??= l.price ?? null;
      row.sold_on ??= (l.updated_at || "").slice(0, 10) || null;
      row.photo_url ||= l.listing_photos?.find((p) => p.is_hero)?.url || l.listing_photos?.[0]?.url || null;
    }
    if (!row.address) throw bad("Each sale needs an address (or a listing_id to copy it from).");
    // Every row carries every column, so a batch insert never leaves one empty that the table won't accept.
    Object.assign(row, { city: row.city ?? "", state: row.state ?? "", price: row.price ?? null, sold_on: row.sold_on ?? null, photo_url: row.photo_url ?? null, listing_id: row.listing_id ?? null });
    const source = url(item, "photo_source_url");
    if (source) photoJobs.push({ row, source });
    rows.push(row);
  }
  const photos = await mapLimit(photoJobs, 3, async ({ source }) => storeImage(ctx.client, BUCKET, site.id, await downloadImage(source)));
  photos.forEach((r, i) => {
    if (r.ok) photoJobs[i].row.photo_url = r.value;
  });
  const { data, error } = await ctx.client.from("agent_site_sales").insert(rows).select("*");
  if (error) throw new HttpError(error.code === "42501" ? 403 : 500, error.message);
  return { added: (data || []).map(saleView), photo_errors: photos.map((r, i) => (r.ok ? null : { address: photoJobs[i].row.address, error: r.error })).filter(Boolean) };
}

export async function listSales(ctx, siteId) {
  await loadSite(ctx, siteId);
  const { data, error } = await ctx.client.from("agent_site_sales").select("*").eq("agent_site_id", siteId).order("sold_on", { ascending: false, nullsFirst: false }).limit(200);
  if (error) throw new HttpError(500, error.message);
  return { sales: (data || []).map(saleView) };
}

export async function addSales(ctx, siteId, body) {
  requireScope(ctx, "sites");
  const site = await loadSite(ctx, siteId);
  // One sale can be sent as the body itself; several go in `sales`.
  return insertSales(ctx, site, body.sales !== undefined ? body.sales : [body]);
}

export async function updateSale(ctx, id, body) {
  requireScope(ctx, "sites");
  const { sale, site } = await loadSale(ctx, id);
  const fields = readFields(body);
  const source = url(body, "photo_source_url");
  let photo_error;
  if (source) {
    try {
      fields.photo_url = await storeImage(ctx.client, BUCKET, site.id, await downloadImage(source));
    } catch (err) {
      photo_error = err.message;
    }
  }
  if (!Object.keys(fields).length) {
    if (photo_error) throw bad(photo_error);
    throw bad("Nothing to change. Send at least one field.");
  }
  if (fields.address === "") throw bad("A sale needs an address.");
  const { data, error } = await ctx.client.from("agent_site_sales").update(fields).eq("id", sale.id).select("*").single();
  if (error) throw new HttpError(500, error.message);
  return { sale: saleView(data), ...(photo_error ? { photo_error } : {}) };
}

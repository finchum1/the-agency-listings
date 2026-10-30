import { HttpError, bad, dateKey, downloadImage, excerptFrom, isUuid, number, oneOf, richBody, slugify, storeImage, text, url } from "./util.js";
import { requireScope } from "./context.js";
import { loadSite } from "./sites.js";

const BUCKET = "agent-site-photos";

const postUrl = (req, site, post) => (site.custom_domain ? `https://${site.custom_domain}/blog/${post.slug}` : `https://${req.headers.host}/sites/${site.slug}/blog/${post.slug}`);
const view = (p, site, req) => ({
  id: p.id,
  agent_site_id: p.agent_site_id,
  slug: p.slug,
  title: p.title,
  category: p.category,
  post_date: p.post_date,
  excerpt: p.excerpt,
  image_url: p.image_url,
  status: p.status,
  featured_order: p.featured_order ?? null,
  scheduled_at: p.scheduled_at,
  url: postUrl(req, site, p),
  updated_at: p.updated_at,
});

async function loadPost(ctx, id) {
  if (!isUuid(id)) throw bad("That isn't a valid post id.");
  const { data: post } = await ctx.client.from("agent_site_posts").select("*").eq("id", id).maybeSingle();
  if (!post) throw new HttpError(404, "No blog post with that id.");
  const { data: site } = await ctx.client.from("agent_sites").select("*").eq("id", post.agent_site_id).eq("org_id", ctx.orgId).maybeSingle();
  if (!site) throw new HttpError(404, "No blog post with that id.");
  return { post, site };
}

// What a post body may say about when it goes out: draft (not public), published (public now) or scheduled (public at a time).
function readStatus(body, current) {
  const status = oneOf(body, "status", ["draft", "published", "scheduled"]);
  const when = text(body, "scheduled_at", { max: 40 });
  let scheduled_at;
  if (when !== undefined && when !== "") {
    const t = Date.parse(when);
    if (Number.isNaN(t)) throw bad("scheduled_at must be a date and time, like 2026-10-25T09:00:00-05:00.");
    scheduled_at = new Date(t).toISOString();
  } else if (when === "") scheduled_at = null;
  const finalStatus = status ?? current?.status;
  if (finalStatus === "scheduled" && !(scheduled_at ?? current?.scheduled_at)) throw bad("A scheduled post needs scheduled_at.");
  const out = {};
  if (status !== undefined) out.status = status;
  if (scheduled_at !== undefined) out.scheduled_at = scheduled_at;
  if (status && status !== "scheduled" && scheduled_at === undefined) out.scheduled_at = null;
  return out;
}

// Pinning: 1 to 3 puts a post at the top of the site's blog page in that position; null (or 0) takes it off. A slot another post holds is a 409.
async function pinFields(ctx, siteId, postId, body) {
  const n = number(body, "featured_order", { min: 0, max: 3, integer: true });
  if (n === undefined) return {};
  if (!n) return { featured_order: null };
  const { data: holder } = await ctx.client.from("agent_site_posts").select("id, title").eq("agent_site_id", siteId).eq("featured_order", n).neq("id", postId || "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (holder) throw new HttpError(409, `Slot ${n} is already pinned to "${holder.title}". Unpin it first (use update_post on ${holder.id} with featured_order: null).`, { pinned_post_id: holder.id });
  return { featured_order: n };
}

async function pictureFields(ctx, siteId, body) {
  const out = {};
  const direct = url(body, "image_url");
  if (direct !== undefined) out.image_url = direct || null;
  const source = url(body, "image_source_url");
  if (source) out.image_url = await storeImage(ctx.client, BUCKET, siteId, await downloadImage(source));
  return out;
}

export async function listPosts(ctx, siteId, query, req) {
  const site = await loadSite(ctx, siteId);
  let q = ctx.client.from("agent_site_posts").select("*").eq("agent_site_id", siteId).order("post_date", { ascending: false }).limit(Math.min(Number(query.limit) || 50, 200));
  if (["draft", "published", "scheduled"].includes(query.status)) q = q.eq("status", query.status);
  const { data, error } = await q;
  if (error) throw new HttpError(500, error.message);
  return { posts: (data || []).map((p) => view(p, site, req)) };
}

export async function getPost(ctx, id, req) {
  const { post, site } = await loadPost(ctx, id);
  return { post: { ...view(post, site, req), body_html: post.body_html || "" } };
}

export async function createPost(ctx, siteId, body, req) {
  requireScope(ctx, "blog");
  const site = await loadSite(ctx, siteId);
  const title = text(body, "title", { required: true, max: 200 });
  const html = richBody(body, { markdownKey: "body_markdown", htmlKey: "body_html" });
  if (!html) throw bad("Send body_markdown (or body_html) with the post's text.");
  const status = readStatus({ status: "draft", ...body }, null);

  const baseSlug = slugify(text(body, "slug", { max: 90 }) || title, "post");
  const { data: taken } = await ctx.client.from("agent_site_posts").select("slug").eq("agent_site_id", siteId).like("slug", `${baseSlug}%`);
  const used = new Set((taken || []).map((t) => t.slug));
  let slug = baseSlug;
  for (let n = 2; used.has(slug); n++) slug = `${baseSlug}-${n}`;

  const row = {
    agent_site_id: siteId,
    slug,
    title,
    category: text(body, "category", { max: 60 }) || "",
    post_date: dateKey(body, "post_date") || new Date().toISOString().slice(0, 10),
    excerpt: text(body, "excerpt", { max: 300 }) ?? excerptFrom(html),
    body_html: html,
    ...status,
    ...(await pictureFields(ctx, siteId, body)),
    ...(await pinFields(ctx, siteId, null, body)),
  };
  if (body.related_listing_id !== undefined) row.related_listing_id = isUuid(body.related_listing_id) ? body.related_listing_id : null;
  const { data, error } = await ctx.client.from("agent_site_posts").insert(row).select("*").single();
  if (error) throw new HttpError(error.code === "42501" ? 403 : 500, error.message);
  return { post: view(data, site, req) };
}

export async function updatePost(ctx, id, body, req) {
  requireScope(ctx, "blog");
  const { post, site } = await loadPost(ctx, id);
  const fields = {};
  const set = (k, v) => v !== undefined && (fields[k] = v);
  set("title", text(body, "title", { max: 200 }));
  set("category", text(body, "category", { max: 60 }));
  set("post_date", dateKey(body, "post_date"));
  set("excerpt", text(body, "excerpt", { max: 300 }));
  const html = richBody(body, { markdownKey: "body_markdown", htmlKey: "body_html" });
  if (html !== undefined) {
    fields.body_html = html;
    if (body.excerpt === undefined && !post.excerpt) fields.excerpt = excerptFrom(html);
  }
  Object.assign(fields, readStatus(body, post), await pictureFields(ctx, site.id, body), await pinFields(ctx, site.id, id, body));
  const slug = text(body, "slug", { max: 90 });
  if (slug !== undefined && slugify(slug) !== post.slug) {
    fields.slug = slugify(slug, post.slug);
    const { data: clash } = await ctx.client.from("agent_site_posts").select("id").eq("agent_site_id", site.id).eq("slug", fields.slug).neq("id", id).maybeSingle();
    if (clash) throw new HttpError(409, "Another post on this site already uses that slug.");
  }
  if (!Object.keys(fields).length) throw bad("Nothing to change. Send at least one field.");
  const { data, error } = await ctx.client.from("agent_site_posts").update(fields).eq("id", id).select("*").single();
  if (error) throw new HttpError(500, error.message);
  return { post: view(data, site, req) };
}

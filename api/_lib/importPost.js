// Blog importer for moving a client's posts over from another website
// (e.g. Luxury Presence). Used only by api/admin/agents.js's "list-sitemap"
// and "import-post" actions, which verify the caller is an admin first.
//
// It fetches arbitrary public web pages on an admin's say-so, so every
// request goes through assertPublicUrl(): http(s) only, and the host must
// resolve to public addresses (no localhost, private ranges, or cloud
// metadata endpoints), re-checked on every redirect hop.
import dns from "node:dns/promises";
import net from "node:net";
import { parse } from "node-html-parser";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:");
}

async function assertPublicUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("That isn't a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) addresses can be imported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn't public.");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't public.");
  return url;
}

async function safeFetch(input, { maxBytes, accept }) {
  let current = input;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgencyImporter/1.0)", Accept: accept || "*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`The page returned ${res.status}.`);
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("That file is too large.");
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error("That file is too large.");
    return { buffer, contentType: res.headers.get("content-type") || "", finalUrl: url.toString() };
  }
  throw new Error("Too many redirects.");
}

// ---- sitemap discovery -------------------------------------------------

function locs(xml) {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
}

// Accepts a bare domain, a page address, or a sitemap address.
export async function listSitemap(input) {
  let start = String(input || "").trim();
  if (!start) throw new Error("Enter the old site's address.");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(start) && !/^https?:\/\//i.test(start)) throw new Error("Only http(s) addresses can be imported.");
  if (!/^https?:\/\//i.test(start)) start = `https://${start}`;
  if (!/\.xml(\?|$)/i.test(start)) start = new URL("/sitemap.xml", start).toString();

  const found = new Set();
  const queue = [start];
  let fetched = 0;
  while (queue.length > 0 && fetched < 12 && found.size < 3000) {
    const next = queue.shift();
    fetched++;
    const { buffer } = await safeFetch(next, { maxBytes: 5 * 1024 * 1024, accept: "application/xml,text/xml,*/*" });
    const xml = buffer.toString("utf8");
    const urls = locs(xml);
    if (/<sitemapindex/i.test(xml)) queue.push(...urls);
    else urls.forEach((u) => found.add(u));
  }
  if (found.size === 0) throw new Error("No pages were found in that sitemap.");
  return [...found];
}

// ---- page -> post --------------------------------------------------------

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const metaContent = (root, selector) => root.querySelector(selector)?.getAttribute("content")?.trim() || "";

function jsonLdPost(root) {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.rawText);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      const hit = items.find((i) => /(BlogPosting|Article|NewsArticle)/i.test([].concat(i?.["@type"] || []).join(",")));
      if (hit) return hit;
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

const STRIP_SELECTOR =
  "script, style, noscript, nav, header, footer, aside, form, button, svg, iframe, select, input, textarea, [role=navigation], [aria-hidden=true], .share, .social, .sharing, .related, .comments, .breadcrumb, .breadcrumbs, .newsletter, .meta, .post-meta, .byline, .author, .tags, .categories";

function paragraphCount(node) {
  return node.querySelectorAll("p").reduce((n, p) => n + (clean(p.text).length > 40 ? 1 : 0), 0);
}

function pickContainer(root) {
  const candidates = [
    ...root.querySelectorAll('[itemprop="articleBody"]'),
    ...root.querySelectorAll("article"),
    ...root.querySelectorAll(".post-content, .blog-content, .entry-content, .article-content, .post-body, .blog-post-content, .rich-text"),
    ...root.querySelectorAll("main"),
  ];
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = paragraphCount(c);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best || root.querySelector("body") || root;
}

function convertBody(container, baseUrl, pageHost, title) {
  const stats = { images: 0 };
  const out = [];
  const inline = (node) => {
    if (node.nodeType === 3) return esc(node.text.replace(/\s+/g, " "));
    const tag = (node.tagName || "").toLowerCase();
    const kids = () => node.childNodes.map(inline).join("");
    switch (tag) {
      case "strong":
      case "b":
        return `<strong>${kids()}</strong>`;
      case "em":
      case "i":
        return `<em>${kids()}</em>`;
      case "u":
        return `<u>${kids()}</u>`;
      case "br":
        return "<br>";
      case "a": {
        const raw = node.getAttribute("href") || "";
        let href = "";
        try {
          const u = new URL(raw, baseUrl);
          if (u.protocol === "http:" || u.protocol === "https:") {
            href = u.hostname.replace(/^www\./, "") === pageHost ? `${u.pathname}${u.search}` : u.toString();
          } else if (u.protocol === "mailto:" || u.protocol === "tel:") href = u.toString();
        } catch {
          // ignore
        }
        return href ? `<a href="${esc(href).replace(/"/g, "&quot;")}">${kids()}</a>` : kids();
      }
      case "img":
        stats.images++;
        return "";
      default:
        return kids();
    }
  };

  const block = (node) => {
    if (node.nodeType === 3) {
      const text = clean(node.text);
      if (text) out.push(`<p>${esc(text)}</p>`);
      return;
    }
    const tag = (node.tagName || "").toLowerCase();
    if (/^h[1-2]$/.test(tag) || /^h[3-6]$/.test(tag)) {
      const text = clean(node.text);
      if (!text || text.toLowerCase() === clean(title).toLowerCase()) return;
      out.push(`<h${tag === "h1" || tag === "h2" ? 2 : 3}>${esc(text)}</h${tag === "h1" || tag === "h2" ? 2 : 3}>`);
      return;
    }
    if (tag === "p" || tag === "blockquote" || tag === "figcaption") {
      const html = node.childNodes.map(inline).join("").trim();
      if (clean(node.text)) out.push(`<p>${html}</p>`);
      else if (node.querySelector("img")) stats.images++;
      return;
    }
    if (tag === "ul" || tag === "ol") {
      node.querySelectorAll("li").forEach((li, i) => {
        const html = li.childNodes.map(inline).join("").trim();
        if (clean(li.text)) out.push(`<p>${tag === "ol" ? `${i + 1}.` : "•"} ${html}</p>`);
      });
      return;
    }
    if (tag === "img") {
      stats.images++;
      return;
    }
    // containers (div, section, figure, span…): if they only hold inline
    // content treat them as one paragraph, otherwise descend
    const hasBlocks = node.querySelector("p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, div, section");
    if (!hasBlocks) {
      const html = node.childNodes.map(inline).join("").trim();
      if (clean(node.text)) out.push(`<p>${html}</p>`);
      else if (node.querySelector("img")) stats.images++;
      return;
    }
    node.childNodes.forEach(block);
  };

  container.childNodes.forEach(block);
  return { html: out.join(""), imagesDropped: stats.images };
}

export function extractPost(html, pageUrl) {
  const root = parse(html);
  const ld = jsonLdPost(root);
  const baseUrl = new URL(pageUrl);
  const pageHost = baseUrl.hostname.replace(/^www\./, "");

  const h1 = clean(root.querySelector("article h1, main h1, h1")?.text);
  const ogTitle = metaContent(root, 'meta[property="og:title"]');
  const docTitle = clean(root.querySelector("title")?.text);
  const title = clean(ld?.headline) || h1 || ogTitle.split(/\s[|–—-]\s/)[0] || docTitle.split(/\s[|–—-]\s/)[0];

  const dateRaw =
    ld?.datePublished ||
    metaContent(root, 'meta[property="article:published_time"]') ||
    root.querySelector("time[datetime]")?.getAttribute("datetime") ||
    "";
  const parsed = dateRaw ? new Date(dateRaw) : null;
  const postDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;

  const excerpt = clean(ld?.description) || metaContent(root, 'meta[name="description"]') || metaContent(root, 'meta[property="og:description"]');
  const imageRaw = (Array.isArray(ld?.image) ? ld.image[0] : ld?.image?.url || ld?.image) || metaContent(root, 'meta[property="og:image"]');
  const category = clean(Array.isArray(ld?.articleSection) ? ld.articleSection[0] : ld?.articleSection) || metaContent(root, 'meta[property="article:section"]');

  const container = pickContainer(root);
  container.querySelectorAll(STRIP_SELECTOR).forEach((n) => n.remove());
  const body = convertBody(container, baseUrl, pageHost, title);

  let imageUrl = "";
  try {
    if (imageRaw) imageUrl = new URL(String(imageRaw), baseUrl).toString();
  } catch {
    // ignore
  }

  const lastSegment = decodeURIComponent(baseUrl.pathname.split("/").filter(Boolean).pop() || "");
  return {
    slug: slugify(lastSegment) || slugify(title),
    title,
    postDate,
    excerpt,
    category,
    imageUrl,
    bodyHtml: body.html,
    imagesDropped: body.imagesDropped,
  };
}

// Fetch one page and save it as a DRAFT post on the given agent site.
export async function importPost({ admin, agentSiteId, url }) {
  const page = await safeFetch(url, { maxBytes: MAX_HTML_BYTES, accept: "text/html,*/*" });
  const post = extractPost(page.buffer.toString("utf8"), page.finalUrl);
  if (!post.title) throw new Error("Couldn't find a title on that page.");
  if (!post.slug) throw new Error("Couldn't work out an address ending for that page.");
  if (!post.bodyHtml) throw new Error("Couldn't find the article text on that page.");

  const { data: existing } = await admin
    .from("agent_site_posts")
    .select("id")
    .eq("agent_site_id", agentSiteId)
    .eq("slug", post.slug)
    .maybeSingle();
  if (existing) return { status: "skipped", slug: post.slug, title: post.title, reason: "A post with this address already exists." };

  const warnings = [];
  let imageUrl = null;
  if (post.imageUrl) {
    try {
      const img = await safeFetch(post.imageUrl, { maxBytes: MAX_IMAGE_BYTES, accept: "image/*" });
      const mime = img.contentType.split(";")[0].trim().toLowerCase();
      // Raster formats only: an SVG served from the public bucket can carry scripts.
      const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
      const ext = EXT[mime];
      if (!ext) throw new Error(`unsupported image type ${mime || "unknown"}`);
      const path = `${agentSiteId}/${Date.now()}-${post.slug.slice(0, 60)}.${ext}`;
      const { error: uploadError } = await admin.storage.from("agent-site-photos").upload(path, img.buffer, { contentType: mime });
      if (uploadError) throw new Error(uploadError.message);
      imageUrl = admin.storage.from("agent-site-photos").getPublicUrl(path).data.publicUrl;
    } catch (err) {
      warnings.push(`Cover image couldn't be copied (${err.message}).`);
    }
  } else {
    warnings.push("No cover image found.");
  }
  if (!post.postDate) warnings.push("No publish date found — set to today.");
  if (post.imagesDropped > 0) warnings.push(`${post.imagesDropped} image${post.imagesDropped === 1 ? "" : "s"} inside the article weren't brought over.`);

  const { error } = await admin.from("agent_site_posts").insert({
    agent_site_id: agentSiteId,
    slug: post.slug,
    title: post.title,
    category: post.category || "",
    post_date: post.postDate || new Date().toISOString().slice(0, 10),
    excerpt: post.excerpt || "",
    image_url: imageUrl,
    body_html: post.bodyHtml,
    status: "draft",
  });
  if (error) throw new Error(error.message);

  return { status: "imported", slug: post.slug, title: post.title, warnings };
}

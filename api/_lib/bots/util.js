import crypto from "node:crypto";
import { safeFetch } from "../safeFetch.js";

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const bad = (message, extra) => new HttpError(400, message, extra);

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === "string" && UUID.test(v);

export function slugify(text, fallback = "item") {
  return (
    String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80)
      .replace(/-$/, "") || fallback
  );
}

// ---- field readers: each returns undefined when the field is absent, throws a 400 when it is present but wrong ----

export function text(body, key, { max = 300, required = false } = {}) {
  const v = body?.[key];
  if (v === undefined) {
    if (required) throw bad(`${key} is required.`);
    return undefined;
  }
  if (v === null) return "";
  if (typeof v !== "string") throw bad(`${key} must be text.`);
  const t = v.trim();
  if (required && !t) throw bad(`${key} is required.`);
  if (t.length > max) throw bad(`${key} is too long (max ${max} characters).`);
  return t;
}

export function oneOf(body, key, allowed) {
  const v = body?.[key];
  if (v === undefined) return undefined;
  if (!allowed.includes(v)) throw bad(`${key} must be one of: ${allowed.join(", ")}.`);
  return v;
}

export function number(body, key, { min = 0, max = 1e12, integer = false } = {}) {
  const v = body?.[key];
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`${key} must be a number between ${min} and ${max}.`);
  if (integer && !Number.isInteger(n)) throw bad(`${key} must be a whole number.`);
  return n;
}

export function url(body, key, { required = false } = {}) {
  const v = text(body, key, { max: 2000, required });
  if (v === undefined || v === "") return v;
  let u;
  try {
    u = new URL(v);
  } catch {
    throw bad(`${key} must be a full web address starting with https://.`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw bad(`${key} must be an http(s) address.`);
  return u.toString();
}

export const dateKey = (body, key) => {
  const v = text(body, key, { max: 10 });
  if (v === undefined || v === "") return v;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${key} must look like 2026-10-21.`);
  return v;
};

export const timeKey = (body, key) => {
  const v = text(body, key, { max: 5 });
  if (v === undefined || v === "") return v;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad(`${key} must look like 14:30.`);
  return v;
};

// ---- rich text: the site only renders p, h2, h3, strong, em, u, br, a and span.brand-red (see src/lib/sanitizeHtml.js),
// so that is all that is stored. The page sanitizes again when it renders; this keeps the stored copy tidy too. ----

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(line) {
  return esc(line)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+|\/[^\s)]*)\)/g, (_, t, u) => `<a href="${u.replace(/"/g, "%22")}">${t}</a>`)
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a || b}</strong>`)
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)|(?<![_\w])_([^_\n]+)_(?![_\w])/g, (_, a, b) => `<em>${a || b}</em>`);
}

/** Markdown (headings, paragraphs, bold, italic, links, simple lists) -> the editor's HTML. Lists become "• " paragraphs. */
export function markdownToHtml(md) {
  const blocks = String(md || "").replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!lines.length) continue;
    const head = /^(#{1,6})\s+(.*)$/.exec(lines[0]);
    if (head) {
      out.push(`<${head[1].length <= 2 ? "h2" : "h3"}>${inline(head[2])}</${head[1].length <= 2 ? "h2" : "h3"}>`);
      lines.shift();
      if (!lines.length) continue;
    }
    if (lines.every((l) => /^\s*([-*+]|\d+[.)])\s+/.test(l))) {
      for (const l of lines) out.push(`<p>• ${inline(l.replace(/^\s*([-*+]|\d+[.)])\s+/, ""))}</p>`);
      continue;
    }
    out.push(`<p>${lines.map((l) => inline(l.replace(/^>\s?/, ""))).join("<br>")}</p>`);
  }
  return out.join("");
}

/** Keeps only the tags and attributes the editor produces; everything else is dropped (text stays). */
export function cleanHtml(html) {
  return String(html || "")
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (m, slash, tag, attrs) => {
      const t = tag.toLowerCase();
      if (!["p", "h2", "h3", "strong", "em", "u", "br", "a", "span"].includes(t)) return t === "h1" || t === "h4" ? (slash ? "</h2>" : "<h2>") : "";
      if (slash) return `</${t}>`;
      if (t === "a") {
        const href = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(attrs);
        const h = href ? href[1] || href[2] : "";
        return /^(https?:|mailto:|tel:|\/)/i.test(h) ? `<a href="${h.replace(/"/g, "%22")}">` : "<a>";
      }
      if (t === "span") return /class\s*=\s*["']brand-red["']/i.test(attrs) ? '<span class="brand-red">' : "<span>";
      return `<${t}>`;
    });
}

export const htmlToText = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
export const excerptFrom = (html, max = 180) => {
  const t = htmlToText(html);
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};

/** A body given as markdown or HTML, ready to store. */
export function richBody(body, { markdownKey, htmlKey }) {
  const md = text(body, markdownKey, { max: 200000 });
  const html = text(body, htmlKey, { max: 400000 });
  if (md !== undefined && html !== undefined) throw bad(`Send either ${markdownKey} or ${htmlKey}, not both.`);
  if (md !== undefined) return markdownToHtml(md);
  if (html !== undefined) return cleanHtml(html);
  return undefined;
}

// ---- pictures: fetched from a public address, checked, and stored in our own bucket ----

const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

export async function downloadImage(source) {
  let result;
  try {
    result = await safeFetch(source, { maxBytes: 15 * 1024 * 1024, accept: "image/*", userAgent: "Mozilla/5.0 (compatible; LatchpointImporter/1.0)" });
  } catch (err) {
    throw bad(`Couldn't download ${source}: ${err.message}`);
  }
  const type = (result.contentType || "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  if (!ext) throw bad(`${source} isn't a JPEG, PNG, WebP, GIF or AVIF image.`);
  return { buffer: result.buffer, contentType: type, ext };
}

export async function storeImage(client, bucket, folder, image) {
  const path = `${folder}/${Date.now()}-${crypto.randomBytes(5).toString("hex")}.${image.ext}`;
  const { error } = await client.storage.from(bucket).upload(path, image.buffer, { contentType: image.contentType });
  if (error) throw new HttpError(502, `Couldn't store the picture: ${error.message}`);
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Runs async jobs a few at a time; resolves to an array of { ok, value | error } in the original order. */
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { ok: true, value: await fn(items[i], i) };
        } catch (err) {
          results[i] = { ok: false, error: err.message || String(err) };
        }
      }
    }),
  );
  return results;
}

// Shared pieces of the visitor accounts for the public Home Search (api/visitor.js): the secrets and hashes, which site a request is for, what a
// visitor may save, and the emails. Server-only. See supabase/site-visitors.sql for the tables and why these are not Supabase auth users.
import crypto from "node:crypto";
import { brokerageSiteQuery } from "../../src/lib/brand.js";
import { bareHost, isAppHost } from "../../src/lib/appHosts.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

// ------------------------------------------------------------------ secrets, codes, tokens
// Codes and session tokens are stored only as keyed hashes. The key is VISITOR_SECRET when set, else the service key (already a server secret).
const secret = () => process.env.VISITOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const hmac = (value) => crypto.createHmac("sha256", secret()).update(String(value)).digest("hex");
export const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const cleanEmail = (v) => String(v || "").trim().toLowerCase().slice(0, 254);
export const cleanText = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** A link that turns alert emails off for one visitor, signed so it can't be guessed for someone else. */
export const unsubscribeToken = (visitorId) => `${visitorId}.${hmac(`unsub:${visitorId}`).slice(0, 32)}`;
export function readUnsubscribeToken(token) {
  const [id, sig] = String(token || "").split(".");
  if (!id || !sig || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return safeEqual(sig, hmac(`unsub:${id}`).slice(0, 32)) ? id : null;
}

// ------------------------------------------------------------------ which site is this for
// A site reference from the browser is only ever an id or "the brokerage": who owns the site, what it is called and where its emails go are read
// here from the database, never taken from the request.
//   { kind: "agent", id }   an agent's website (must have Home Search switched on)
//   { kind: "brokerage" }   the brokerage site on the request's host (the default organization on the app host)
export async function resolveSite(admin, req, ref) {
  const host = bareHost(String(req.headers["x-forwarded-host"] || req.headers.host || ""));
  if (ref?.kind === "agent" && /^[0-9a-f-]{36}$/.test(String(ref.id || ""))) {
    const { data: site } = await admin
      .from("agent_sites")
      .select("id, slug, agent_id, org_id, idx_enabled, custom_domain, agent:profiles(full_name, email)")
      .eq("id", ref.id)
      .maybeSingle();
    if (!site || !site.idx_enabled || !site.agent?.email) return null;
    return {
      kind: "agent",
      siteColumn: { agent_site_id: site.id },
      agentSiteId: site.id,
      orgId: site.org_id,
      agentId: site.agent_id,
      agent: site.agent,
      label: site.agent.full_name || "your agent",
      notifyEmail: site.agent.email,
      origin: originFor(host, site.custom_domain),
    };
  }
  if (ref?.kind === "brokerage") {
    const { data: site } = await brokerageSiteQuery(admin, { customDomain: host && !isAppHost(host) ? host : undefined }).maybeSingle();
    if (!site?.org?.id || site.org.status !== "active") return null;
    return {
      kind: "brokerage",
      siteColumn: { org_id: site.org.id },
      orgId: site.org.id,
      agentId: null,
      agent: null,
      label: site.org.name || "The brokerage",
      notifyEmail: site.contact_email || "",
      origin: originFor(host, site.custom_domain),
    };
  }
  return null;
}

// The address to link back to: the site's own domain when the request came in on it, else the platform address. Never a host taken from the body.
function originFor(host, customDomain) {
  if (host && customDomain && host === String(customDomain).toLowerCase().replace(/^www\./, "")) return `https://${host}`;
  if (host && customDomain && host === `www.${String(customDomain).toLowerCase().replace(/^www\./, "")}`) return `https://${host}`;
  return SITE_ORIGIN;
}

/** A saved search's page address: the site origin plus a path the browser sent, which must be a plain absolute path on that site. */
export function pageUrlFor(origin, path) {
  const p = String(path || "");
  if (!p.startsWith("/") || p.startsWith("//") || p.length > 300 || /[\s\\<>"'`]/.test(p)) return origin;
  return `${origin}${p}`;
}

// ------------------------------------------------------------------ what a visitor may save
const POLYGON_POINTS = 500;
function validPolygon(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  let n = 0;
  const point = (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number" && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
  for (const polygon of value) {
    if (!Array.isArray(polygon)) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring)) return false;
      for (const p of ring) if (!point(p) || ++n > POLYGON_POINTS) return false;
    }
  }
  return true;
}

const SORTS = new Set(["createdOnDesc", "listPriceDesc", "listPriceAsc", "sqftDesc"]);
const WHOLE = /^\d{1,9}$/;

/** The filters of a saved search, reduced to the known keys with safe values. Anything else is dropped. */
export function cleanSearchParams(input) {
  const p = input && typeof input === "object" ? input : {};
  const out = {};
  const city = cleanText(p.city, 80);
  if (city) out.city = city;
  for (const k of ["minPrice", "maxPrice"]) if (WHOLE.test(String(p[k] ?? ""))) out[k] = String(p[k]);
  for (const k of ["minBeds", "minBaths"]) if (/^\d{1,2}$/.test(String(p[k] ?? ""))) out[k] = String(p[k]);
  if (SORTS.has(p.sortBy)) out.sortBy = p.sortBy;
  if (p.office === true || p.office === "true") out.office = "true";
  if (typeof p.map === "string" && p.map) {
    try {
      const parsed = JSON.parse(p.map);
      if (validPolygon(parsed)) out.map = JSON.stringify(parsed);
    } catch {
      // not valid JSON: dropped like any other bad value
    }
  }
  return out;
}

/** A saved home's card data: a few short strings, so the list still reads after the listing leaves the market. */
export function cleanSnapshot(input) {
  const s = input && typeof input === "object" ? input : {};
  const num = (v) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : null);
  return {
    address: cleanText(s.address, 120),
    city: cleanText(s.city, 60),
    state: cleanText(s.state, 4),
    price: num(s.price),
    beds: num(s.beds),
    baths: num(s.baths),
    photo: /^https:\/\/[^\s"'<>]{1,300}$/.test(String(s.photo || "")) ? String(s.photo) : "",
  };
}

export { describeSearch } from "../../src/lib/visitorSearch.js";

// ------------------------------------------------------------------ emails
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const shell = (inner) => `<!doctype html><html><body style="margin:0;background:#f4f2ee;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#14130f"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e3ded3;padding:28px">${inner}</div></body></html>`;

export function codeEmail({ siteName, code }) {
  return {
    subject: `${code} is your ${siteName} sign-in code`,
    text: `Your sign-in code for ${siteName} is ${code}.\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: shell(`<p style="margin:0 0 6px;font-size:13px;color:#6b665a">${esc(siteName)} Home Search</p><p style="margin:0 0 18px;font-size:16px">Your sign-in code:</p><p style="margin:0 0 18px;font-size:34px;letter-spacing:8px;font-weight:700">${esc(code)}</p><p style="margin:0;font-size:13px;color:#6b665a">It works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>`),
  };
}

const money = (n) => (Number.isFinite(Number(n)) && n !== null ? `$${Number(n).toLocaleString("en-US")}` : "");

/** The daily email of new homes: `sections` is [{ name, url, homes: [normalized listings], extra }]. */
export function alertEmail({ siteName, sections, unsubscribeUrl, disclaimer }) {
  const total = sections.reduce((n, s) => n + s.homes.length + (s.extra || 0), 0);
  const subject = `${total} new ${total === 1 ? "home" : "homes"} for your saved ${sections.length === 1 ? "search" : "searches"}`;
  const homeText = (h) => `${money(h.price)}  ${[h.address_line1, h.city].filter(Boolean).join(", ")}  ${[h.beds && `${h.beds} bd`, h.baths && `${h.baths} ba`, h.sqft && `${Number(h.sqft).toLocaleString("en-US")} sqft`].filter(Boolean).join(" | ")}${h.officeName ? `  (Courtesy of ${h.officeName})` : ""}`;
  const text = [
    `New homes on ${siteName} Home Search`,
    "",
    ...sections.flatMap((s) => [`${s.name}`, ...s.homes.map(homeText), ...(s.extra ? [`...and ${s.extra} more`] : []), `See them: ${s.url}`, ""]),
    disclaimer,
    "",
    `Stop these emails: ${unsubscribeUrl}`,
  ].join("\n");
  const homeHtml = (h) =>
    `<tr><td style="padding:10px 0;border-top:1px solid #eee7da;vertical-align:top">${h.hero_photo_url ? `<img src="${esc(h.hero_photo_url)}" width="120" alt="" style="display:block;border:0;width:120px;height:80px;object-fit:cover">` : ""}</td><td style="padding:10px 0 10px 14px;border-top:1px solid #eee7da;vertical-align:top"><div style="font-size:17px;font-weight:700">${esc(money(h.price))}</div><div style="font-size:14px">${esc([h.address_line1, h.city, h.state].filter(Boolean).join(", "))}</div><div style="font-size:12px;color:#6b665a">${esc([h.beds && `${h.beds} bd`, h.baths && `${h.baths} ba`, h.sqft && `${Number(h.sqft).toLocaleString("en-US")} sqft`].filter(Boolean).join(" | "))}</div>${h.officeName ? `<div style="font-size:11px;color:#8c887d;margin-top:2px">Courtesy of ${esc(h.officeName)}</div>` : ""}</td></tr>`;
  const html = shell(
    `<p style="margin:0 0 4px;font-size:13px;color:#6b665a">${esc(siteName)} Home Search</p><h1 style="margin:0 0 18px;font-size:22px">${esc(subject)}</h1>` +
      sections
        .map(
          (s) =>
            `<h2 style="margin:22px 0 6px;font-size:16px">${esc(s.name)}</h2><table style="width:100%;border-collapse:collapse">${s.homes.map(homeHtml).join("")}</table>${s.extra ? `<p style="margin:8px 0 0;font-size:13px;color:#6b665a">...and ${s.extra} more</p>` : ""}<p style="margin:12px 0 0"><a href="${esc(s.url)}" style="display:inline-block;background:#14130f;color:#fff;text-decoration:none;font-size:13px;padding:10px 18px">See these homes</a></p>`,
        )
        .join("") +
      `<p style="margin:26px 0 0;font-size:11px;color:#8c887d;line-height:1.5">${esc(disclaimer)}</p><p style="margin:10px 0 0;font-size:11px;color:#8c887d"><a href="${esc(unsubscribeUrl)}" style="color:#8c887d">Stop these emails</a></p>`,
  );
  return { subject, text, html };
}

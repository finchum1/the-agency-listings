// The bot API, served at /v1/... (vercel.json rewrites /v1/:path* here). Scoped personal tokens (made under My Profile >
// Bot API access) let automations such as Grok bots add and edit blog posts, add agents, create agent websites and create
// property listings. Admin-only, draft-first, no deletes, every call logged in api_audit_log. The full description is the
// OpenAPI document at /v1/openapi.json (api/_lib/bots/openapi.js).
import { isAppHost } from "../src/lib/appHosts.js";
import { audit, authenticateBot } from "./_lib/bots/context.js";
import { HttpError, bad } from "./_lib/bots/util.js";
import { buildSpec } from "./_lib/bots/openapi.js";
import * as agents from "./_lib/bots/agents.js";
import * as sites from "./_lib/bots/sites.js";
import * as posts from "./_lib/bots/posts.js";
import * as listings from "./_lib/bots/listings.js";
import { importListing } from "./_lib/bots/importListing.js";

const send = (res, status, payload) => {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(payload);
};

// [method, path pattern, handler(ctx, params, body, query, req)]
const ROUTES = [
  ["GET", "/me", (ctx) => ({ name: ctx.tokenName, scopes: ctx.scopes, admin: { id: ctx.ownerId, name: ctx.profile.full_name }, organization_id: ctx.orgId })],
  ["GET", "/agents", (ctx) => agents.listAgents(ctx)],
  ["GET", "/agents/:id", (ctx, p) => agents.getAgent(ctx, p.id)],
  ["POST", "/agents", (ctx, p, body, q, req) => agents.createAgent(ctx, body, req)],
  ["GET", "/sites", (ctx, p, b, q, req) => sites.listSites(ctx, req)],
  ["GET", "/sites/:id", (ctx, p, b, q, req) => sites.getSite(ctx, p.id, req)],
  ["POST", "/sites", (ctx, p, body, q, req) => sites.createSite(ctx, body, req)],
  ["PATCH", "/sites/:id", (ctx, p, body, q, req) => sites.updateSite(ctx, p.id, body, req)],
  ["POST", "/sites/:id/areas", (ctx, p, body) => sites.addAreas(ctx, p.id, body)],
  ["POST", "/sites/:id/testimonials", (ctx, p, body) => sites.addTestimonials(ctx, p.id, body)],
  ["GET", "/sites/:id/posts", (ctx, p, b, q, req) => posts.listPosts(ctx, p.id, q, req)],
  ["POST", "/sites/:id/posts", (ctx, p, body, q, req) => posts.createPost(ctx, p.id, body, req)],
  ["GET", "/posts/:id", (ctx, p, b, q, req) => posts.getPost(ctx, p.id, req)],
  ["PATCH", "/posts/:id", (ctx, p, body, q, req) => posts.updatePost(ctx, p.id, body, req)],
  ["GET", "/listings", (ctx, p, b, q, req) => listings.listListings(ctx, q, req)],
  ["POST", "/listings/import", (ctx, p, body, q, req) => importListing(ctx, body, req)],
  ["GET", "/listings/:id", (ctx, p, b, q, req) => listings.getListing(ctx, p.id, req)],
  ["POST", "/listings", (ctx, p, body, q, req) => listings.createListing(ctx, body, req)],
  ["PATCH", "/listings/:id", (ctx, p, body, q, req) => listings.updateListing(ctx, p.id, body, req)],
  ["POST", "/listings/:id/photos", (ctx, p, body) => listings.addListingPhotos(ctx, p.id, body)],
];

function match(method, path) {
  const segs = path.split("/").filter(Boolean);
  let pathExists = false;
  for (const [m, pattern, fn] of ROUTES) {
    const ps = pattern.split("/").filter(Boolean);
    if (ps.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].startsWith(":")) params[ps[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (ps[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    pathExists = true;
    if (m === method) return { fn, params };
  }
  return { pathExists };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!isAppHost(String(req.headers.host || "").split(":")[0])) return send(res, 404, { error: "Not found." });

  const raw = req.query?.path;
  const path = `/${Array.isArray(raw) ? raw.join("/") : raw || ""}`.replace(/\/+$/, "") || "/";
  const query = { ...req.query };
  delete query.path;

  if (path === "/openapi.json" && req.method === "GET") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=300");
    return send(res, 200, buildSpec(`https://${req.headers.host}`));
  }
  if (path === "/" && req.method === "GET") {
    return send(res, 200, { name: "Latchpoint Real Estate bot API", version: "1.0.0", docs: `https://${req.headers.host}/v1/openapi.json`, auth: "Authorization: Bearer <token from My Profile > Bot API access>" });
  }

  let ctx = null;
  try {
    const found = match(req.method, path);
    if (!found.fn) {
      if (found.pathExists) throw new HttpError(405, `${req.method} isn't allowed on ${path}.`);
      throw new HttpError(404, `No such endpoint: ${req.method} ${path}. See /v1/openapi.json.`);
    }
    ctx = await authenticateBot(req);

    let body = {};
    if (req.method === "POST" || req.method === "PATCH") {
      body = typeof req.body === "string" ? safeParse(req.body) : req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw bad("Send a JSON object as the request body (Content-Type: application/json).");
    }
    const result = await found.fn(ctx, found.params, body, query, req);
    await audit(ctx, req, path, 200, summarize(req.method, result));
    return send(res, req.method === "POST" && isCreate(path, result) ? 201 : 200, result);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error("bot api error:", err);
    if (ctx) await audit(ctx, req, path, status, err.message);
    if (status === 401) res.setHeader("WWW-Authenticate", 'Bearer realm="latchpoint-bots"');
    return send(res, status, { error: status === 500 ? "Something went wrong on our side." : err.message, ...(err instanceof HttpError && err.extra ? err.extra : {}) });
  }
}

const isCreate = (path, result) =>
  Boolean(result) &&
  ((/^\/(agents|sites|listings)$/.test(path) && (result.agent_id || result.site || result.listing)) || (/^\/sites\/[^/]+\/posts$/.test(path) && result.post) || (path === "/listings/import" && result.created));

function summarize(method, result) {
  if (method === "GET") return null;
  const id = result?.agent_id || result?.site?.id || result?.post?.id || result?.listing?.id;
  return id ? `id ${id}` : null;
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

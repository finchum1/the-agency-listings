import { serviceClient } from "../authUser.js";
import { hashToken, sessionClientFor, TOKEN_PATTERN } from "../mcpAuth.js";
import { HttpError } from "./util.js";

// A bot token -> what the request is allowed to do. Looks the token up by its hash, makes sure its owner is still an admin,
// and gives back a client that acts AS that admin (row-level security applies) plus the service client for the few things
// only the server may do (creating login accounts).
const hits = new Map(); // token id -> recent request times, for a simple per-token rate limit
const LIMIT = 120; // requests per minute

export async function authenticateBot(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN_PATTERN.test(token)) throw new HttpError(401, "Missing or invalid token. Send it as: Authorization: Bearer <token>");
  const admin = serviceClient();
  const { data: row } = await admin.from("api_tokens").select("id, owner_id, name, scopes, last_used_at").eq("token_hash", hashToken(token)).is("revoked_at", null).maybeSingle();
  if (!row) throw new HttpError(401, "Invalid or revoked token.");

  const now = Date.now();
  const recent = (hits.get(row.id) || []).filter((t) => now - t < 60000);
  if (recent.length >= LIMIT) throw new HttpError(429, `Too many requests (limit ${LIMIT} per minute).`);
  recent.push(now);
  hits.set(row.id, recent);

  const { data: profile } = await admin.from("profiles").select("id, role, org_id, full_name, email").eq("id", row.owner_id).maybeSingle();
  if (!profile || profile.role !== "admin" || !profile.org_id) throw new HttpError(403, "The account behind this token is no longer an admin.");

  const client = await sessionClientFor(admin, row.owner_id);
  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (now - last > 5 * 60 * 1000) await admin.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return { tokenId: row.id, tokenName: row.name, scopes: row.scopes, ownerId: row.owner_id, orgId: profile.org_id, profile, client, admin, host: req.headers.host };
}

export function requireScope(ctx, scope) {
  if (!ctx.scopes.includes(scope)) throw new HttpError(403, `This token doesn't have the "${scope}" scope.`, { scopes: ctx.scopes, needed: scope });
}

export async function audit(ctx, req, path, status, detail) {
  try {
    await ctx.admin.from("api_audit_log").insert({ token_id: ctx.tokenId, owner_id: ctx.ownerId, method: req.method, path: path.slice(0, 300), status, detail: detail ? String(detail).slice(0, 500) : null });
  } catch {
    /* the log must never break a request */
  }
}

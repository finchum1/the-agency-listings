// Shared by the AI connection tools that wrap the office-level logic in api/_lib/bots/ (agents, sites, blog, listings, deals, drafts): builds the
// context those functions expect from the signed-in person, and runs a change with the same guard rails as the people tools (rate limit, audit log).
import { serviceClient } from "./authUser.js";
import { HttpError } from "./bots/util.js";
import { audit, rateLimit } from "./mcpWriteTools.js";

const BOT_SCOPE = { manage_blog: "blog", manage_listings: "listings", manage_agents: "agents", manage_sites: "sites" };

/**
 * `needAdmin` tools (the manage_ scopes) work only for an admin account. Others (a person's own deals, drafts) work for any agent.
 * `grant` adds the bot-style scopes the called function checks for (e.g. ["blog"]).
 */
export async function botCtx(sb, userId, extra, { needAdmin = false, grant = [] } = {}) {
  const admin = serviceClient();
  const { data: profile } = await admin.from("profiles").select("id, role, org_id, full_name, email").eq("id", userId).maybeSingle();
  if (!profile?.org_id) throw new HttpError(403, "This account isn't part of an organization.");
  if (needAdmin && profile.role !== "admin") throw new HttpError(403, "Only the office admin can do that.");
  const scopes = [...new Set([...(extra?.scopes || []).map((s) => BOT_SCOPE[s]).filter(Boolean), ...grant, "people"])];
  return { tokenId: null, tokenName: "AI connection", scopes, ownerId: userId, orgId: profile.org_id, profile, client: sb, admin, host: extra?.host, peopleOk: false };
}
export const fakeReq = (extra) => ({ headers: { host: extra?.host || "localhost" }, method: "POST" });

const cap = (s, n = 9000) => (s.length > n ? `${s.slice(0, n)}\n… (cut short: ask for less at a time)` : s);
/** Results go back to the AI as a short line of what happened, then the data as compact JSON. */
export const render = (label, result) => cap(`${label}${result === undefined ? "" : `\n${JSON.stringify(result)}`}`);

/** A change: rate limited and logged. `fn(ctx, req)` returns { text, audit }. */
export async function act(tool, sb, userId, extra, opts, fn) {
  rateLimit(userId);
  try {
    const out = await fn(await botCtx(sb, userId, extra, opts), fakeReq(extra));
    await audit(userId, tool, 200, out.audit);
    return out.text;
  } catch (err) {
    await audit(userId, tool, err.status || 500, `failed: ${err.message}`);
    throw err;
  }
}
/** A look: no change, so no log. `fn(ctx, req)` returns the text. */
export async function look(sb, userId, extra, opts, fn) {
  return fn(await botCtx(sb, userId, extra, opts), fakeReq(extra));
}

export const strip = (a, ...keys) => Object.fromEntries(Object.entries(a || {}).filter(([k]) => !keys.includes(k)));
export const idOf = (result) => result?.agent_id || result?.site?.id || result?.post?.id || result?.listing?.id || result?.person?.id || result?.task?.id || result?.document?.id || result?.outreach?.id || null;

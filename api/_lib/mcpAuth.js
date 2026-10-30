import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "./authUser.js";
import { ACCESS_PATTERN } from "./oauth.js";

// A personal token (made on the dashboard, shown once, stored only as a hash) -> a Supabase client that acts AS that
// person, so the dashboard's row-level rules apply to everything the connection reads. The server never queries with
// the service key on the person's behalf: it uses the service key only to look up the token and to start a session for
// the token's owner, then drops back to a normal signed-in client.
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// owner id -> { client, expires }. A session lasts about an hour, so reuse it for 45 minutes.
const sessions = new Map();
const SESSION_MS = 45 * 60 * 1000;

/** A Supabase client signed in AS this person (row-level security applies), reused for 45 minutes. */
export async function sessionClientFor(admin, ownerId) {
  const cached = sessions.get(ownerId);
  if (cached && cached.expires > Date.now()) return cached.client;
  sessions.delete(ownerId);

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(ownerId);
  const email = userData?.user?.email;
  if (userError || !email) throw new Error("Couldn't find the account behind this token.");

  // A magic-link token is generated for the owner (nothing is emailed) and exchanged for a normal session.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) throw new Error("Couldn't start a session for this token.");
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const accessToken = verified?.session?.access_token;
  if (verifyError || !accessToken) throw new Error("Couldn't start a session for this token.");

  const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  sessions.set(ownerId, { client, expires: Date.now() + SESSION_MS });
  return client;
}

export const hashToken = sha256;
export const TOKEN_PATTERN = /^lp_[0-9a-f]{64}$/;

// Whose account this is and whether AI connections are allowed on it right now: an admin always, anyone else only when an admin has switched
// "AI access" on for them, and never while their login is switched off. Checked on every call, so switching it off cuts every connection at once.
async function allowedProfile(admin, userId) {
  const { data } = await admin.from("profiles").select("role, ai_access, login_enabled").eq("id", userId).maybeSingle();
  return Boolean(data && data.login_enabled !== false && (data.role === "admin" || data.ai_access));
}

/**
 * The bearer token on a request -> { client, userId, tokenName, scopes } (a Supabase client that acts AS the person), or null when it is not valid.
 * Two kinds work: an OAuth access token (oat_, from an AI app the person approved) and a personal token (lp_, made on the dashboard).
 */
export async function authenticateToken(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const personal = TOKEN_PATTERN.test(token);
  if (!personal && !ACCESS_PATTERN.test(token)) return null;
  const hash = sha256(token);
  const admin = serviceClient();
  const now = new Date();
  let owner;
  let name;
  let scopes;

  if (personal) {
    const { data: row } = await admin.from("mcp_tokens").select("id, owner_id, name, scopes, last_used_at").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
    if (!row) return null;
    owner = row.owner_id;
    name = row.name;
    scopes = row.scopes || ["read"];
    // "Last used" is for the list on the dashboard; no need to write it on every request.
    const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
    if (now.getTime() - last > 5 * 60 * 1000) await admin.from("mcp_tokens").update({ last_used_at: now.toISOString() }).eq("id", row.id);
  } else {
    const { data: row } = await admin.from("oauth_tokens").select("access_expires_at, grant:oauth_grants(id, user_id, scopes, revoked_at, last_used_at, client:oauth_clients(client_name))").eq("access_hash", hash).maybeSingle();
    if (!row || !row.grant || row.grant.revoked_at || new Date(row.access_expires_at) < now) return null;
    owner = row.grant.user_id;
    name = row.grant.client?.client_name || "AI app";
    scopes = row.grant.scopes;
    const last = row.grant.last_used_at ? new Date(row.grant.last_used_at).getTime() : 0;
    if (now.getTime() - last > 5 * 60 * 1000) await admin.from("oauth_grants").update({ last_used_at: now.toISOString() }).eq("id", row.grant.id);
  }

  if (!(await allowedProfile(admin, owner))) return null;
  return { client: await sessionClientFor(admin, owner), userId: owner, tokenName: name, scopes };
}

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { serviceClient } from "./authUser.js";

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

export async function authenticateToken(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN_PATTERN.test(token)) return null;
  const hash = sha256(token);

  const admin = serviceClient();
  const { data: row } = await admin.from("mcp_tokens").select("id, owner_id, name, last_used_at").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
  if (!row) return null;

  const client = await sessionClientFor(admin, row.owner_id);
  const entry = { client, userId: row.owner_id, tokenName: row.name };

  // "Last used" is for the list on the dashboard; no need to write it on every request.
  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (Date.now() - last > 5 * 60 * 1000) await admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return entry;
}

// Vercel serverless function: the sign-in for AI connections (Claude, ChatGPT, Grok bots, ...). OAuth 2.1 with PKCE. vercel.json maps:
//   /.well-known/oauth-protected-resource[/...]     -> ?a=resource   what this server protects and who signs people in
//   /.well-known/oauth-authorization-server[/...]   -> ?a=server     where to register, authorize and get tokens
//   /oauth/register  (POST)                         -> ?a=register   an AI app registers itself (RFC 7591); no secret, PKCE instead
//   /oauth/token     (POST)                         -> ?a=token      a code or refresh token for an access token
//   /oauth/revoke    (POST)                         -> ?a=revoke     an AI app discards a token
//   /api/oauth       (POST, signed in)              -> authorize     the consent page asks about an app and records the agent's answer
// The page the agent sees (/oauth/authorize) is part of the dashboard app (src/pages/OAuthAuthorizePage.jsx).
import { isAppHost } from "../src/lib/appHosts.js";
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { ACCESS_TTL_S, ADMIN_SCOPES, CODE_TTL_S, REFRESH_PATTERN, REFRESH_TTL_S, SCOPE_NAMES, newAccessToken, newRefreshToken, originOf, parseScopes, pkceMatches, randomHex, redirectUriOk, sha256 } from "./_lib/oauth.js";

const json = (res, status, body, extra = {}) => {
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
};
// Browser-based AI tools call the metadata, register, token and revoke addresses from another origin; none of them use cookies.
const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version");
};
const oauthError = (res, status, error, description) => json(res, status, { error, error_description: description });

const bodyOf = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return typeof req.body === "string" && req.body.trim().startsWith("{") ? JSON.parse(req.body) : Object.fromEntries(new URLSearchParams(String(req.body || "")));
  } catch {
    return {};
  }
};

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const origin = originOf(req, isAppHost);
  if (!origin) return res.status(404).json({ error: "Not found." });
  const a = String(req.query?.a || "");

  if (req.method === "GET") {
    if (a === "resource") {
      return json(res, 200, { resource: `${origin}/api/mcp`, resource_name: "Latchpoint Real Estate dashboard", authorization_servers: [origin], scopes_supported: SCOPE_NAMES, bearer_methods_supported: ["header"] });
    }
    if (a === "server") {
      return json(res, 200, {
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        registration_endpoint: `${origin}/oauth/register`,
        revocation_endpoint: `${origin}/oauth/revoke`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        revocation_endpoint_auth_methods_supported: ["none"],
        scopes_supported: SCOPE_NAMES,
      });
    }
    return json(res, 404, { error: "Not found." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, { error: "Method not allowed." });
  }

  let admin;
  try {
    admin = serviceClient();
  } catch {
    return json(res, 500, { error: "Server not configured." });
  }
  const body = bodyOf(req);

  // ---- an AI app registers itself ----
  if (a === "register") {
    const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (uris.length === 0 || uris.length > 10 || !uris.every(redirectUriOk)) return oauthError(res, 400, "invalid_redirect_uri", "Give one to ten redirect addresses (https, or localhost).");
    const name = String(body.client_name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 100) || "AI app";
    // A registration is public by design, so there is a cap on how many can arrive in an hour.
    const { count } = await admin.from("oauth_clients").select("client_id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 3600 * 1000).toISOString());
    if ((count || 0) > 300) return oauthError(res, 429, "temporarily_unavailable", "Too many new apps right now. Try again later.");
    const clientId = `ac_${randomHex(16)}`;
    const { error } = await admin.from("oauth_clients").insert({ client_id: clientId, client_name: name, redirect_uris: uris });
    if (error) return oauthError(res, 500, "server_error", "Couldn't register this app.");
    return json(res, 201, { client_id: clientId, client_name: name, redirect_uris: uris, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", scope: SCOPE_NAMES.join(" ") });
  }

  // ---- the consent page: about an app, and the agent's answer ----
  if (a === "" || a === "authorize") {
    const auth = await authenticate(req, res);
    if (!auth) return;
    const { data: client } = await admin.from("oauth_clients").select("client_id, client_name, redirect_uris").eq("client_id", String(body.client_id || "")).maybeSingle();
    const redirectUri = String(body.redirect_uri || "");
    if (!client || !client.redirect_uris.includes(redirectUri)) return json(res, 400, { error: "This app's request isn't valid. Start the connection again from the app." });
    const { data: profile } = await admin.from("profiles").select("role, ai_access, login_enabled, full_name").eq("id", auth.user.id).maybeSingle();
    const allowed = Boolean(profile && profile.login_enabled !== false && (profile.role === "admin" || profile.ai_access));

    const isAdmin = profile?.role === "admin";
    if (body.action === "info") return json(res, 200, { client_name: client.client_name, allowed, admin: isAdmin, scopes: SCOPE_NAMES.filter((s) => isAdmin || !ADMIN_SCOPES.includes(s)), you: profile?.full_name || auth.user.email });
    if (!allowed) return json(res, 403, { error: "AI connections aren't turned on for your account. Ask an admin to turn them on." });

    const state = body.state ? `&state=${encodeURIComponent(String(body.state).slice(0, 500))}` : "";
    const join = redirectUri.includes("?") ? "&" : "?";
    if (body.action === "deny") return json(res, 200, { redirect: `${redirectUri}${join}error=access_denied${state}` });

    const challenge = String(body.code_challenge || "");
    if (body.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return json(res, 400, { error: "This app didn't use the required secure sign-in method (PKCE)." });
    const code = randomHex(32);
    const { error } = await admin.from("oauth_codes").insert({
      code_hash: sha256(code),
      client_id: client.client_id,
      user_id: auth.user.id,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      scopes: parseScopes(body.scopes, isAdmin),
      expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
    });
    if (error) return json(res, 500, { error: "Couldn't finish connecting. Try again." });
    return json(res, 200, { redirect: `${redirectUri}${join}code=${code}${state}` });
  }

  // ---- an app gives up a token ----
  if (a === "revoke") {
    const token = String(body.token || "");
    const col = token.startsWith("ort_") ? "refresh_hash" : token.startsWith("oat_") ? "access_hash" : null;
    if (col) {
      const { data: row } = await admin.from("oauth_tokens").select("grant_id").eq(col, sha256(token)).maybeSingle();
      if (row) await admin.from("oauth_grants").update({ revoked_at: new Date().toISOString() }).eq("id", row.grant_id).is("revoked_at", null);
    }
    return res.status(200).json({});
  }

  // ---- a code or refresh token becomes an access token ----
  if (a === "token") {
    const issue = async (grantId, scopes) => {
      const access = newAccessToken();
      const refresh = newRefreshToken();
      const now = Date.now();
      const { error } = await admin.from("oauth_tokens").insert({
        grant_id: grantId,
        access_hash: sha256(access),
        refresh_hash: sha256(refresh),
        access_expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
        refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
      });
      if (error) return oauthError(res, 500, "server_error", "Couldn't issue a token.");
      return json(res, 200, { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: scopes.join(" ") });
    };

    if (body.grant_type === "authorization_code") {
      const code = String(body.code || "");
      const { data: row } = await admin.from("oauth_codes").select("*").eq("code_hash", sha256(code)).maybeSingle();
      if (!row || row.client_id !== String(body.client_id || "") || row.redirect_uri !== String(body.redirect_uri || "") || new Date(row.expires_at) < new Date()) return oauthError(res, 400, "invalid_grant", "That code isn't valid or has expired.");
      // A code works once: claiming it is a single conditional update, so two requests with the same code can't both win.
      const { data: claimed } = await admin.from("oauth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", row.code_hash).is("used_at", null).select("code_hash");
      if (!claimed?.length) return oauthError(res, 400, "invalid_grant", "That code was already used.");
      if (!pkceMatches(body.code_verifier, row.code_challenge)) return oauthError(res, 400, "invalid_grant", "The code verifier doesn't match.");
      // Connecting the same app again replaces the earlier connection rather than piling up.
      await admin.from("oauth_grants").update({ revoked_at: new Date().toISOString() }).eq("user_id", row.user_id).eq("client_id", row.client_id).is("revoked_at", null);
      const { data: grant, error } = await admin.from("oauth_grants").insert({ user_id: row.user_id, client_id: row.client_id, scopes: row.scopes }).select("id").single();
      if (error) return oauthError(res, 500, "server_error", "Couldn't save the connection.");
      return issue(grant.id, row.scopes);
    }

    if (body.grant_type === "refresh_token") {
      const refresh = String(body.refresh_token || "");
      if (!REFRESH_PATTERN.test(refresh)) return oauthError(res, 400, "invalid_grant", "That refresh token isn't valid.");
      const { data: row } = await admin.from("oauth_tokens").select("id, grant_id, refresh_expires_at, rotated_at, grant:oauth_grants(id, client_id, scopes, revoked_at)").eq("refresh_hash", sha256(refresh)).maybeSingle();
      if (!row || !row.grant || row.grant.revoked_at || row.grant.client_id !== String(body.client_id || "")) return oauthError(res, 400, "invalid_grant", "That refresh token isn't valid.");
      if (row.rotated_at) {
        // A refresh token that was already used is being used again: someone copied it. The whole connection is cut off.
        await admin.from("oauth_grants").update({ revoked_at: new Date().toISOString() }).eq("id", row.grant_id).is("revoked_at", null);
        return oauthError(res, 400, "invalid_grant", "That refresh token was already used. Connect the app again.");
      }
      if (new Date(row.refresh_expires_at) < new Date()) return oauthError(res, 400, "invalid_grant", "That refresh token has expired. Connect the app again.");
      const { data: rotated } = await admin.from("oauth_tokens").update({ rotated_at: new Date().toISOString() }).eq("id", row.id).is("rotated_at", null).select("id");
      if (!rotated?.length) return oauthError(res, 400, "invalid_grant", "That refresh token was already used.");
      return issue(row.grant_id, row.grant.scopes);
    }
    return oauthError(res, 400, "unsupported_grant_type", "Use authorization_code or refresh_token.");
  }

  return json(res, 404, { error: "Not found." });
}

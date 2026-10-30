// Shared pieces of the AI connection sign-in (OAuth 2.1 + PKCE): scopes, token making and hashing, the address the server answers at.
import crypto from "node:crypto";

export const SCOPES = {
  read: "See your tasks, people, deals, listings and website",
  write_people: "Add people, move them between stages, set follow-ups, add notes",
  write_tasks: "Add and tick off tasks, add and update contacts",
  write_deals: "Update deal dates and contacts, tick off deal tasks",
  write_drafts: "Draft messages for you to send",
  // Owner-only: these change your office's websites, listings and agents, and only an admin account can allow them.
  manage_blog: "Write and edit blog posts on any agent site",
  manage_listings: "Create and edit listings",
  manage_agents: "Add agents to your dashboard",
  manage_sites: "Edit any agent's website, areas, testimonials and past sales",
};
export const ADMIN_SCOPES = ["manage_blog", "manage_listings", "manage_agents", "manage_sites"];
export const SCOPE_NAMES = Object.keys(SCOPES);

export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_S = 60 * 24 * 60 * 60;
export const CODE_TTL_S = 10 * 60;

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const randomHex = (bytes) => crypto.randomBytes(bytes).toString("hex");
export const newAccessToken = () => `oat_${randomHex(32)}`;
export const newRefreshToken = () => `ort_${randomHex(32)}`;
export const ACCESS_PATTERN = /^oat_[0-9a-f]{64}$/;
export const REFRESH_PATTERN = /^ort_[0-9a-f]{64}$/;

/** "read write_people" -> only the scopes that exist, always including read. The manage_ scopes are for admin accounts only. */
export function parseScopes(value, isAdmin = false) {
  const asked = Array.isArray(value) ? value : String(value || "").split(/[\s,]+/);
  const set = new Set(asked.filter((s) => SCOPE_NAMES.includes(s) && (isAdmin || !ADMIN_SCOPES.includes(s))));
  set.add("read");
  return [...set];
}

/** The address this server is reached at (the issuer), or null when the request came in on a host that isn't one of the app's own. */
export function originOf(req, isAppHost) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!host || !isAppHost(host.replace(/:\d+$/, ""))) return null;
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** A redirect address an AI app may register: https, a localhost address, or an app's own scheme (claude://, cursor://). Never a script or file. */
export function redirectUriOk(uri) {
  let u;
  try {
    u = new URL(String(uri));
  } catch {
    return false;
  }
  if (String(uri).length > 500 || u.hash) return false;
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["javascript:", "data:", "file:", "blob:", "vbscript:", "about:", "ftp:"].includes(u.protocol);
}

/** PKCE S256: the challenge sent at the start must be the hash of the verifier sent with the code. */
export const pkceMatches = (verifier, challenge) => crypto.createHash("sha256").update(String(verifier)).digest("base64url") === challenge;

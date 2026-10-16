// Google Calendar for the dashboard home page's two-way sync: the sign-in (OAuth) pieces, encrypted storage of the
// long-lived refresh token, and reading / creating / changing / deleting events through Google's Calendar API.
// Used by api/google.js, api/google-callback.js and api/calendar.js.
//
// Setup (once, by the platform owner): a Google Cloud OAuth client of type "Web application", with its address
//   https://<the app host>/api/google-callback   as an authorized redirect URI, and two Vercel environment variables:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Without them everything here reports "not set up" and the dashboard hides
//   the Google option. Optional: GOOGLE_REDIRECT_URI to override the redirect address.
//
// Security: scopes are limited to calendar events + the calendar list + the account's email. Refresh tokens are stored
// only in google_tokens (no client can read that table), encrypted with AES-256-GCM under a key derived from the service
// key, so a copy of the database alone is not enough to use them. The sign-in "state" is signed and expires in 10 minutes.
import crypto from "node:crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const API = "https://www.googleapis.com/calendar/v3";
const TIMEOUT_MS = 12000;

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function siteOrigin(fallbackHost) {
  return (process.env.VITE_SITE_ORIGIN || (fallbackHost ? `https://${fallbackHost}` : "")).replace(/\/+$/, "");
}

export const redirectUri = (fallbackHost) => process.env.GOOGLE_REDIRECT_URI || `${siteOrigin(fallbackHost)}/api/google-callback`;

/** Where the browser may be sent back to after signing in with Google: the app's own hosts only. */
export function allowedReturnOrigin(origin, fallbackHost) {
  try {
    const u = new URL(origin);
    const canonical = siteOrigin(fallbackHost);
    const extra = String(process.env.VITE_APP_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
    const ok =
      u.origin === canonical ||
      (u.protocol === "https:" && (u.hostname.endsWith(".vercel.app") || extra.includes(u.hostname.toLowerCase()))) ||
      (u.protocol === "http:" && u.hostname === "localhost");
    return ok ? u.origin : canonical;
  } catch {
    return siteOrigin(fallbackHost);
  }
}

// ---- encryption and signed state ------------------------------------------------------------------------------------

function derivedKey(purpose) {
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Server not configured.");
  return Buffer.from(crypto.hkdfSync("sha256", base, "agency-google-sync-v1", purpose, 32));
}

export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey("token-encryption"), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptToken(stored) {
  const [version, iv, tag, body] = String(stored).split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Stored token is unreadable.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey("token-encryption"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

export function signState(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", derivedKey("oauth-state")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state) {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) throw new Error("Invalid sign-in link.");
  const expected = crypto.createHmac("sha256", derivedKey("oauth-state")).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Invalid sign-in link.");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) throw new Error("That sign-in link expired. Please try again.");
  return payload;
}

// ---- OAuth ----------------------------------------------------------------------------------------------------------

export function buildAuthUrl({ state, host, loginHint }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(host),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // so Google gives us a refresh token
    prompt: "consent", // ...every time, even when the account was connected before
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params}`;
}

async function postForm(url, form) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/** Trades the one-time code for tokens and finds out which Google account signed in. */
export async function exchangeCode(code, host) {
  const r = await postForm(TOKEN_URL, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(host),
    grant_type: "authorization_code",
  });
  if (!r.ok) throw new Error("Google didn't accept the sign-in. Please try again.");
  const { access_token: accessToken, refresh_token: refreshToken, scope = "" } = r.json;
  if (!accessToken) throw new Error("Google didn't return an access token.");
  const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const profile = await info.json().catch(() => ({}));
  if (!profile.email) throw new Error("Couldn't read the Google account's email.");
  return { accessToken, refreshToken, scope, email: String(profile.email).toLowerCase() };
}

const accessCache = new Map(); // connection id -> { token, exp }

/** A current access token for a stored connection (refreshing it when needed). Marks the connection when Google says no. */
export async function accessTokenFor(admin, connectionId) {
  const hit = accessCache.get(connectionId);
  if (hit && hit.exp > Date.now() + 60 * 1000) return hit.token;
  const { data: row } = await admin.from("google_tokens").select("refresh_token_enc").eq("connection_id", connectionId).maybeSingle();
  if (!row) throw new Error("This Google account needs to be reconnected.");
  const r = await postForm(TOKEN_URL, {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: decryptToken(row.refresh_token_enc),
    grant_type: "refresh_token",
  });
  if (!r.ok) {
    if (r.json?.error === "invalid_grant") {
      await admin.from("google_connections").update({ status: "needs_reconnect" }).eq("id", connectionId);
      throw new Error("Google access was removed or expired. Reconnect this Google account.");
    }
    throw new Error("Couldn't reach Google right now. Try again in a moment.");
  }
  accessCache.set(connectionId, { token: r.json.access_token, exp: Date.now() + (Number(r.json.expires_in) || 3000) * 1000 });
  return r.json.access_token;
}

export async function revokeRefreshToken(storedEncrypted) {
  try {
    await postForm(REVOKE_URL, { token: decryptToken(storedEncrypted) });
  } catch {
    /* best effort: the connection is removed here either way */
  }
}

export const forgetAccessToken = (connectionId) => accessCache.delete(connectionId);

// ---- Calendar API ---------------------------------------------------------------------------------------------------

async function api(token, path, { method = "GET", query, body } = {}) {
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 204) return {};
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = res.status === 403 ? "Google says this calendar can't be changed with your access." : res.status === 404 ? "That calendar or event no longer exists in Google Calendar." : res.status === 401 ? "Google access expired. Reconnect this Google account." : json?.error?.message || "Google Calendar returned an error.";
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** The account's calendars: [{ id, name, color, role, primary, canWrite }]. */
export async function listCalendars(token) {
  const out = [];
  let pageToken;
  for (let page = 0; page < 5; page++) {
    const r = await api(token, "/users/me/calendarList", { query: { minAccessRole: "freeBusyReader", maxResults: "250", ...(pageToken ? { pageToken } : {}) } });
    for (const c of r.items || []) {
      out.push({ id: c.id, name: c.summaryOverride || c.summary || c.id, color: /^#[0-9a-f]{6}$/i.test(c.backgroundColor || "") ? c.backgroundColor : "#1a5fb4", role: c.accessRole, primary: Boolean(c.primary), canWrite: c.accessRole === "owner" || c.accessRole === "writer" });
    }
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

function mapEvent(e, rowId, canWrite) {
  const allDay = Boolean(e.start?.date);
  const base = { uid: e.id, eventId: e.id, title: e.summary || "(No title)", location: e.location || "", description: e.description || "", htmlLink: e.htmlLink || "", recurring: Boolean(e.recurringEventId), calendarId: rowId, source: "google", canWrite };
  return allDay ? { ...base, allDay: true, startDate: e.start.date, endDate: e.end?.date || e.start.date } : { ...base, allDay: false, start: new Date(e.start.dateTime).toISOString(), end: new Date(e.end?.dateTime || e.start.dateTime).toISOString() };
}

/** Events for one calendar in a range, recurring series already expanded by Google. */
export async function listEvents(token, googleCalendarId, rangeStart, rangeEnd, { rowId, canWrite }) {
  const events = [];
  let pageToken;
  for (let page = 0; page < 4; page++) {
    const r = await api(token, `/calendars/${encodeURIComponent(googleCalendarId)}/events`, {
      query: { singleEvents: "true", orderBy: "startTime", timeMin: rangeStart.toISOString(), timeMax: rangeEnd.toISOString(), maxResults: "250", ...(pageToken ? { pageToken } : {}) },
    });
    for (const e of r.items || []) {
      if (e.status === "cancelled") continue;
      if ((e.attendees || []).some((a) => a.self && a.responseStatus === "declined")) continue;
      if (!e.start?.date && !e.start?.dateTime) continue;
      events.push(mapEvent(e, rowId, canWrite));
    }
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return events;
}

// ---- writing --------------------------------------------------------------------------------------------------------

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** Validates an event the dashboard sends and turns it into Google's shape. Throws plain-language messages. */
export function buildEventBody(input) {
  const title = String(input?.title ?? "").trim();
  if (!title) throw new Error("Give the event a title.");
  if (title.length > 300) throw new Error("That title is too long.");
  const body = { summary: title, location: String(input.location || "").slice(0, 300), description: String(input.description || "").slice(0, 4000) };
  if (input.allDay) {
    if (!DATE.test(input.startDate || "")) throw new Error("Pick a date.");
    const endDate = DATE.test(input.endDate || "") ? input.endDate : input.startDate;
    // Google's all-day end is exclusive: a one-day event ends the next day.
    const exclusive = new Date(`${endDate}T00:00:00Z`);
    exclusive.setUTCDate(exclusive.getUTCDate() + 1);
    body.start = { date: input.startDate };
    body.end = { date: exclusive.toISOString().slice(0, 10) };
  } else {
    if (!DATETIME.test(input.start || "") || !DATETIME.test(input.end || "")) throw new Error("Pick a start and end time.");
    if (new Date(input.end) <= new Date(input.start)) throw new Error("The event has to end after it starts.");
    let timeZone = "UTC";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: input.timeZone });
      timeZone = input.timeZone;
    } catch {
      /* UTC */
    }
    body.start = { dateTime: input.start, timeZone };
    body.end = { dateTime: input.end, timeZone };
  }
  return body;
}

export async function createEvent(token, googleCalendarId, input, meta) {
  const e = await api(token, `/calendars/${encodeURIComponent(googleCalendarId)}/events`, { method: "POST", body: buildEventBody(input) });
  return mapEvent(e, meta.rowId, true);
}

export async function updateEvent(token, googleCalendarId, eventId, input, meta) {
  const e = await api(token, `/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", body: buildEventBody(input) });
  return mapEvent(e, meta.rowId, true);
}

export async function deleteEvent(token, googleCalendarId, eventId) {
  await api(token, `/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
}

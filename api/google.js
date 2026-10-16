// Vercel serverless function: connecting Google accounts and changing events on them. Signed-in agents only.
//
//   { action: "config" }                                  -> { configured }  (is Google sign-in set up on this server?)
//   { action: "auth-url", origin }                        -> { url }         (send the browser there to connect an account)
//   { action: "calendars", connectionId }                 -> the account's calendars, with which are already linked
//   { action: "link-calendars", connectionId, calendarIds } -> links the chosen calendars to the agent's schedule
//   { action: "disconnect", connectionId }                -> revokes the access at Google and removes the account
//   { action: "event-create" | "event-update" | "event-delete", calendarRowId, eventId?, event? }
//
// Reading events is in api/calendar.js (alongside the iCal-address calendars). The sign-in's return trip is
// api/google-callback.js. Every action checks that the connection or calendar belongs to the signed-in agent.
import crypto from "node:crypto";
import { authenticate, serviceClient } from "./_lib/authUser.js";
import {
  accessTokenFor,
  allowedReturnOrigin,
  buildAuthUrl,
  createEvent,
  deleteEvent,
  forgetAccessToken,
  googleConfigured,
  listCalendars,
  revokeRefreshToken,
  signState,
  updateEvent,
} from "./_lib/googleCalendar.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;
  const { supabase, user } = auth;
  const body = req.body || {};
  const { action } = body;

  if (action === "config") return res.status(200).json({ configured: googleConfigured() });
  if (!googleConfigured()) return res.status(503).json({ error: "Google sign-in isn't set up on this server yet.", notConfigured: true });

  try {
    const admin = serviceClient();
    const ownedConnection = async (id) => {
      if (!UUID.test(String(id || ""))) return null;
      const { data } = await admin.from("google_connections").select("id, email, status").eq("id", id).eq("owner_id", user.id).maybeSingle();
      return data || null;
    };

    if (action === "auth-url") {
      const state = signState({ uid: user.id, ret: allowedReturnOrigin(body.origin, req.headers.host), n: crypto.randomBytes(8).toString("hex") });
      return res.status(200).json({ url: buildAuthUrl({ state, host: req.headers.host, loginHint: typeof body.loginHint === "string" ? body.loginHint.slice(0, 320) : undefined }) });
    }

    if (action === "calendars" || action === "link-calendars") {
      const conn = await ownedConnection(body.connectionId);
      if (!conn) return res.status(404).json({ error: "That Google account isn't connected." });
      const list = await listCalendars(await accessTokenFor(admin, conn.id));
      const { data: linkedRows } = await supabase.from("agent_calendars").select("google_calendar_id").eq("connection_id", conn.id);
      const linked = new Set((linkedRows || []).map((r) => r.google_calendar_id));

      if (action === "calendars") return res.status(200).json({ calendars: list.map((c) => ({ ...c, linked: linked.has(c.id) })) });

      // Link: only calendars Google says this account has, with the role Google reports, never what the browser claims.
      const wanted = new Set(Array.isArray(body.calendarIds) ? body.calendarIds.map(String) : []);
      const rows = list
        .filter((c) => wanted.has(c.id) && !linked.has(c.id))
        .map((c) => ({ owner_id: user.id, name: c.name.slice(0, 80), color: c.color, source: "google", connection_id: conn.id, google_calendar_id: c.id, can_write: c.canWrite }));
      if (rows.length === 0) return res.status(200).json({ linked: 0 });
      const { error } = await admin.from("agent_calendars").insert(rows);
      if (error) return res.status(400).json({ error: /10 calendars/.test(error.message) ? "You can link up to 10 calendars." : "Couldn't link those calendars." });
      return res.status(200).json({ linked: rows.length });
    }

    if (action === "disconnect") {
      const conn = await ownedConnection(body.connectionId);
      if (!conn) return res.status(404).json({ error: "That Google account isn't connected." });
      const { data: tokenRow } = await admin.from("google_tokens").select("refresh_token_enc").eq("connection_id", conn.id).maybeSingle();
      if (tokenRow) await revokeRefreshToken(tokenRow.refresh_token_enc);
      await admin.from("google_connections").delete().eq("id", conn.id); // cascades to its tokens and linked calendars
      forgetAccessToken(conn.id);
      return res.status(200).json({ ok: true });
    }

    if (action === "event-create" || action === "event-update" || action === "event-delete") {
      if (!UUID.test(String(body.calendarRowId || ""))) return res.status(400).json({ error: "Pick a calendar." });
      const { data: row } = await supabase.from("agent_calendars").select("id, source, connection_id, google_calendar_id, can_write").eq("id", body.calendarRowId).maybeSingle();
      if (!row || row.source !== "google") return res.status(404).json({ error: "That calendar isn't a connected Google calendar." });
      if (!row.can_write) return res.status(403).json({ error: "This calendar is read-only for your Google account." });
      const conn = await ownedConnection(row.connection_id);
      if (!conn) return res.status(404).json({ error: "That Google account isn't connected." });
      const token = await accessTokenFor(admin, conn.id);
      const meta = { rowId: row.id };
      if (action === "event-create") return res.status(200).json({ event: await createEvent(token, row.google_calendar_id, body.event, meta) });
      if (!body.eventId || typeof body.eventId !== "string") return res.status(400).json({ error: "Missing event." });
      if (action === "event-update") return res.status(200).json({ event: await updateEvent(token, row.google_calendar_id, body.eventId, body.event, meta) });
      await deleteEvent(token, row.google_calendar_id, body.eventId);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    const status = err.status === 403 || err.status === 404 ? err.status : err.status ? 502 : 400;
    return res.status(status).json({ error: err.message || "Something went wrong." });
  }
}

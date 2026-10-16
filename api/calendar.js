// Vercel serverless function: the dashboard home page's schedule. Signed-in agents only.
//
//   { action: "events", start, end, tz }  -> events from every enabled calendar the agent has linked, for that range
//   { action: "check", url }               -> fetches one address (before it is saved) and reports whether it is a calendar
//
// A linked calendar is either a private iCal address (read-only) or a calendar from a connected Google account (read live
// from Google, and writable through api/google.js). Both live in agent_calendars, private to the agent: row-level security
// means this function, which acts AS the signed-in agent, can only ever read their own. iCal addresses and Google tokens
// are never sent back to the browser, and error messages never contain them.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { expandEvents, feedName, loadFeedText, normalizeIcsUrl } from "./_lib/calendarFeed.js";
import { accessTokenFor, googleConfigured, listEvents } from "./_lib/googleCalendar.js";

const MAX_RANGE_DAYS = 70;

function validTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");

  const auth = await authenticate(req, res);
  if (!auth) return;
  const { supabase, user } = auth;

  const { action } = req.body || {};

  if (action === "check") {
    try {
      const address = normalizeIcsUrl(req.body?.url);
      const text = await loadFeedText(address);
      const now = new Date();
      const soon = expandEvents(text, now, new Date(now.getTime() + 60 * 864e5), "UTC").length;
      return res.status(200).json({ ok: true, name: feedName(text), upcoming: soon, address });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Couldn't read that calendar." });
    }
  }

  if (action === "events") {
    const start = new Date(req.body?.start);
    const end = new Date(req.body?.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return res.status(400).json({ error: "A valid start and end are required." });
    if (end - start > MAX_RANGE_DAYS * 864e5) return res.status(400).json({ error: `Ask for ${MAX_RANGE_DAYS} days or fewer at a time.` });
    const tz = validTimeZone(req.body?.tz);

    // As the signed-in agent: row-level security returns only their own calendars.
    const { data: calendars, error } = await supabase
      .from("agent_calendars")
      .select("id, name, color, ics_url, source, connection_id, google_calendar_id, can_write")
      .eq("enabled", true)
      .order("created_at");
    if (error) return res.status(500).json({ error: "Couldn't load your calendars." });

    // Google calendars: confirm each connection really is this agent's before using its token.
    let admin = null;
    const verified = new Map();
    const connectionOk = async (id) => {
      if (!verified.has(id)) {
        admin = admin || serviceClient();
        const { data } = await admin.from("google_connections").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
        verified.set(id, Boolean(data));
      }
      return verified.get(id);
    };

    const results = await Promise.allSettled(
      (calendars || []).map(async (c) => {
        if (c.source === "google") {
          if (!googleConfigured()) throw new Error("Google sign-in isn't set up on this server yet.");
          if (!(await connectionOk(c.connection_id))) throw new Error("That Google account isn't connected.");
          const token = await accessTokenFor(admin, c.connection_id);
          return listEvents(token, c.google_calendar_id, start, end, { rowId: c.id, canWrite: c.can_write });
        }
        const text = await loadFeedText(c.ics_url);
        return expandEvents(text, start, end, tz).map((e) => ({ ...e, calendarId: c.id, source: "ics", canWrite: false }));
      }),
    );
    const events = [];
    const errors = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") events.push(...r.value);
      else errors.push({ calendarId: calendars[i].id, name: calendars[i].name, message: r.reason?.message || "Couldn't read this calendar." });
    });
    return res.status(200).json({ events, errors });
  }

  return res.status(400).json({ error: 'action must be "events" or "check".' });
}

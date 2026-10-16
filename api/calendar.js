// Vercel serverless function: the dashboard home page's schedule. Signed-in agents only.
//
//   { action: "events", start, end, tz }  -> events from every enabled calendar the agent has linked, for that range
//   { action: "check", url }               -> fetches one address (before it is saved) and reports whether it is a calendar
//
// Calendars are linked by their private iCal address, stored in agent_calendars (private to the agent: row-level
// security means this function, which acts AS the signed-in agent, can only ever read their own). The address is never
// sent back to the browser, and error messages never contain it.
import { createClient } from "@supabase/supabase-js";
import { expandEvents, feedName, loadFeedText, normalizeIcsUrl } from "./_lib/calendarFeed.js";

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

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return res.status(500).json({ error: "Server not configured." });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Not signed in." });
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: "Invalid session." });

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
    const { data: calendars, error } = await supabase.from("agent_calendars").select("id, name, color, ics_url").eq("enabled", true).order("created_at");
    if (error) return res.status(500).json({ error: "Couldn't load your calendars." });

    const results = await Promise.allSettled(
      (calendars || []).map(async (c) => {
        const text = await loadFeedText(c.ics_url);
        return expandEvents(text, start, end, tz).map((e) => ({ ...e, calendarId: c.id }));
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

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

async function callApi(path, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || "Request failed");
    err.notConfigured = Boolean(json.notConfigured);
    throw err;
  }
  return json;
}

// The server answers for at most 70 days at a time, and the week view can hold far more than that, so a range is asked for in 28-day chunks on a fixed
// grid of local days. Each chunk is remembered (until a calendar changes), so scrolling on only fetches the days that are new.
const CHUNK_DAYS = 28;
const GRID_START = new Date(2020, 0, 1);
const dayNumber = (d) => Math.round((d - GRID_START) / 864e5);
const chunkBounds = (i) => {
  const start = new Date(GRID_START);
  start.setDate(start.getDate() + i * CHUNK_DAYS);
  const end = new Date(start);
  end.setDate(end.getDate() + CHUNK_DAYS);
  return { start, end };
};
const chunksFor = (rangeStart, rangeEnd) => {
  const out = [];
  for (let i = Math.floor(dayNumber(rangeStart) / CHUNK_DAYS); chunkBounds(i).start < rangeEnd; i++) out.push(i);
  return out;
};
const eventKey = (e) => `${e.calendarId}|${e.eventId || e.uid}|${e.start || e.startDate}`;

/** Checks an iCal address before it is saved. Resolves { name, upcoming, address }; rejects with a plain-language message. */
export const checkCalendarAddress = (url) => callApi("/api/calendar", { action: "check", url });

export const browserTimeZone = browserZone;

// The agent's linked calendars (id, name, color, on/off, source, whether they can be edited; never an iCal address or a
// Google token), their connected Google accounts, and the events from the calendars that are on, for one date range.
// Events come from api/calendar.js. Connecting accounts and changing events go through api/google.js.
export function useCalendarEvents(userId, rangeStart, rangeEnd) {
  const [calendars, setCalendars] = useState([]);
  const [connections, setConnections] = useState([]);
  const [googleConfigured, setGoogleConfigured] = useState(null); // null = not asked yet
  const [events, setEvents] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [version, setVersion] = useState(0);
  const cache = useRef({ version: -1, chunks: new Map() });

  const loadCalendars = useCallback(async () => {
    const [{ data: cals }, { data: conns }] = await Promise.all([
      supabase.from("agent_calendars").select("id, name, color, enabled, source, can_write, connection_id").order("created_at"),
      supabase.from("google_connections").select("id, email, status").order("created_at"),
    ]);
    setCalendars(cals || []);
    setConnections(conns || []);
    setLoadingCalendars(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadCalendars();
    callApi("/api/google", { action: "config" })
      .then((r) => setGoogleConfigured(Boolean(r.configured)))
      .catch(() => setGoogleConfigured(false));
  }, [userId, loadCalendars]);

  const anyOn = calendars.some((c) => c.enabled);

  useEffect(() => {
    if (!userId || loadingCalendars) return;
    if (!anyOn) {
      setEvents([]);
      setErrors([]);
      return;
    }
    let active = true;
    if (cache.current.version !== version) cache.current = { version, chunks: new Map() };
    const store = cache.current;
    const wanted = chunksFor(rangeStart, rangeEnd);
    const missing = wanted.filter((i) => !store.chunks.has(i));
    // Everything in range, once: the same event can sit in two neighbouring chunks.
    const assemble = (failures) => {
      const seen = new Set();
      const merged = [];
      const problems = [...failures];
      for (const i of wanted) {
        const c = store.chunks.get(i);
        if (!c) continue;
        for (const e of c.events) {
          const k = eventKey(e);
          if (!seen.has(k)) {
            seen.add(k);
            merged.push(e);
          }
        }
        for (const er of c.errors) if (!problems.some((p) => p.calendarId === er.calendarId && p.message === er.message)) problems.push(er);
      }
      setEvents(merged);
      setErrors(problems);
    };
    if (missing.length === 0) {
      assemble([]);
      return () => {
        active = false;
      };
    }
    setLoadingEvents(true);
    const failures = [];
    Promise.all(
      missing.map((i) => {
        const { start, end } = chunkBounds(i);
        return callApi("/api/calendar", { action: "events", start: start.toISOString(), end: end.toISOString(), tz: browserZone() })
          .then((r) => store.chunks.set(i, { events: r.events || [], errors: r.errors || [] }))
          .catch((err) => {
            if (!failures.some((f) => f.message === err.message)) failures.push({ calendarId: null, name: "Calendars", message: err.message });
          });
      }),
    )
      .then(() => active && assemble(failures))
      .finally(() => active && setLoadingEvents(false));
    return () => {
      active = false;
    };
    // The range is passed as dates; compare by value so a re-render with the same range doesn't refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadingCalendars, anyOn, rangeStart.getTime(), rangeEnd.getTime(), version]);

  const refresh = () => setVersion((v) => v + 1);

  const addCalendar = async ({ name, address, color }) => {
    const { error } = await supabase.from("agent_calendars").insert({ name: name.trim(), ics_url: address, color });
    if (error) throw new Error(error.message);
    await loadCalendars();
    refresh();
  };
  const updateCalendar = async (id, changes) => {
    setCalendars((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const { error } = await supabase.from("agent_calendars").update(changes).eq("id", id);
    if (error) loadCalendars();
    else refresh();
  };
  const removeCalendar = async (id) => {
    setCalendars((list) => list.filter((c) => c.id !== id));
    await supabase.from("agent_calendars").delete().eq("id", id);
    refresh();
  };

  // ---- Google accounts ----
  const connectGoogle = async (loginHint) => {
    const { url } = await callApi("/api/google", { action: "auth-url", origin: window.location.origin, loginHint });
    window.location.assign(url);
  };
  const googleCalendars = (connectionId) => callApi("/api/google", { action: "calendars", connectionId }).then((r) => r.calendars);
  const linkGoogleCalendars = async (connectionId, calendarIds) => {
    const r = await callApi("/api/google", { action: "link-calendars", connectionId, calendarIds });
    await loadCalendars();
    refresh();
    return r.linked;
  };
  const disconnectGoogle = async (connectionId) => {
    await callApi("/api/google", { action: "disconnect", connectionId });
    await loadCalendars();
    refresh();
  };

  // ---- changing events on a connected Google calendar ----
  const saveEvent = async ({ calendarRowId, eventId, event }) => {
    await callApi("/api/google", { action: eventId ? "event-update" : "event-create", calendarRowId, eventId, event });
    refresh();
  };
  const deleteEvent = async ({ calendarRowId, eventId }) => {
    await callApi("/api/google", { action: "event-delete", calendarRowId, eventId });
    refresh();
  };

  return {
    calendars,
    connections,
    googleConfigured,
    events,
    errors,
    loading: loadingCalendars || loadingEvents,
    addCalendar,
    updateCalendar,
    removeCalendar,
    connectGoogle,
    googleCalendars,
    linkGoogleCalendars,
    disconnectGoogle,
    saveEvent,
    deleteEvent,
    refresh,
  };
}

import { useCallback, useEffect, useState } from "react";
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
    setLoadingEvents(true);
    callApi("/api/calendar", { action: "events", start: rangeStart.toISOString(), end: rangeEnd.toISOString(), tz: browserZone() })
      .then((r) => {
        if (!active) return;
        setEvents(r.events || []);
        setErrors(r.errors || []);
      })
      .catch((err) => {
        if (active) setErrors([{ calendarId: null, name: "Calendars", message: err.message }]);
      })
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

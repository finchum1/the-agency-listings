import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const browserZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

async function callCalendarApi(body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

/** Checks an address before it is saved. Resolves { name, upcoming, address }; rejects with a plain-language message. */
export const checkCalendarAddress = (url) => callCalendarApi({ action: "check", url });

// The agent's linked calendars (id, name, color, on/off; never the private address) and the events from the ones that are
// on, for one date range. Events come from api/calendar.js, which reads the calendars' iCal addresses server-side.
export function useCalendarEvents(userId, rangeStart, rangeEnd) {
  const [calendars, setCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loadingCalendars, setLoadingCalendars] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [version, setVersion] = useState(0);

  const loadCalendars = useCallback(async () => {
    const { data } = await supabase.from("agent_calendars").select("id, name, color, enabled").order("created_at");
    setCalendars(data || []);
    setLoadingCalendars(false);
  }, []);

  useEffect(() => {
    if (userId) loadCalendars();
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
    callCalendarApi({ action: "events", start: rangeStart.toISOString(), end: rangeEnd.toISOString(), tz: browserZone() })
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

  const addCalendar = async ({ name, address, color }) => {
    const { error } = await supabase.from("agent_calendars").insert({ name: name.trim(), ics_url: address, color });
    if (error) throw new Error(error.message);
    await loadCalendars();
    setVersion((v) => v + 1);
  };
  const updateCalendar = async (id, changes) => {
    setCalendars((list) => list.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const { error } = await supabase.from("agent_calendars").update(changes).eq("id", id);
    if (error) loadCalendars();
    else setVersion((v) => v + 1);
  };
  const removeCalendar = async (id) => {
    setCalendars((list) => list.filter((c) => c.id !== id));
    await supabase.from("agent_calendars").delete().eq("id", id);
    setVersion((v) => v + 1);
  };

  return { calendars, events, errors, loading: loadingCalendars || loadingEvents, addCalendar, updateCalendar, removeCalendar, refresh: () => setVersion((v) => v + 1) };
}

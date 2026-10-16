// Reads a calendar's private iCal address (Google Calendar: Settings > Integrate calendar > "Secret address in iCal
// format"; Outlook and Apple publish the same kind) and turns it into plain events for one date range, recurring events
// expanded. Used by api/calendar.js. Read-only: nothing here ever writes to the calendar.
import ICAL from "ical.js";
import { safeFetch } from "./safeFetch.js";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ITERATIONS = 4000; // per recurring event: a daily event from years ago is still well inside this
const MAX_EVENTS_PER_CALENDAR = 1500;
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // address -> { at, text } (per server instance; keeps a busy page from re-downloading the feed)

/** "webcal://..." and "https://..." only; returns the https address. */
export function normalizeIcsUrl(input) {
  let v = String(input || "").trim();
  if (/^webcal:\/\//i.test(v)) v = `https://${v.slice("webcal://".length)}`;
  if (!/^https:\/\/[^\s]+$/i.test(v) || v.length > 2000) {
    throw new Error("That doesn't look like a calendar address. It should start with https:// or webcal://");
  }
  return v;
}

export async function loadFeedText(address) {
  const hit = cache.get(address);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.text;
  let buffer;
  try {
    ({ buffer } = await safeFetch(address, { maxBytes: MAX_BYTES, accept: "text/calendar,text/plain,*/*", userAgent: "Mozilla/5.0 (compatible; AgencyCalendar/1.0)" }));
  } catch (err) {
    // Only known, address-free messages are passed on: the address is a secret, and low-level errors can repeat it.
    if (/returned (401|403|404|410)/.test(err.message)) throw new Error("The calendar address was rejected. Copy it again from your calendar's settings.");
    if (/^(That address isn't public\.|That file is too large\.|Too many redirects\.|The page returned)/.test(err.message)) throw new Error(err.message.replace("The page returned", "The calendar returned"));
    throw new Error("Couldn't reach that calendar. Check the address and try again.");
  }
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  if (!/^\s*BEGIN:VCALENDAR/i.test(text)) throw new Error("That address didn't return a calendar. Make sure you copied the iCal address, not the public link.");
  cache.set(address, { at: Date.now(), text });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return text;
}

// ---- time zones ---------------------------------------------------------------------------------------------------

function registerTimezones(root) {
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    const tzid = vtz.getFirstPropertyValue("tzid");
    if (tzid && !ICAL.TimezoneService.has(tzid)) {
      try {
        ICAL.TimezoneService.register(vtz);
      } catch {
        /* a malformed zone just falls back to UTC below */
      }
    }
  }
}

// Wall-clock time in an IANA zone -> a real Date (for "floating" times, which carry no zone of their own).
function zonedToDate(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(guess));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(guess - (asUtc - guess));
}

function toDate(time, tz) {
  if (time.zone && time.zone !== ICAL.Timezone.localTimezone && time.zone !== ICAL.Timezone.utcTimezone) return time.toJSDate();
  if (time.zone === ICAL.Timezone.utcTimezone) return time.toJSDate();
  // floating: read in the agent's own zone
  return zonedToDate(time.year, time.month, time.day, time.hour, time.minute, time.second, tz);
}

const dateKey = (t) => `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

// ---- expansion ----------------------------------------------------------------------------------------------------

/**
 * Events overlapping [rangeStart, rangeEnd) from an iCal text. Timed events carry ISO `start`/`end`; all-day events carry
 * `allDay: true` with `startDate`/`endDate` (YYYY-MM-DD, end exclusive, as iCal defines it).
 */
export function expandEvents(text, rangeStart, rangeEnd, tz = "UTC") {
  const root = new ICAL.Component(ICAL.parse(text));
  registerTimezones(root);

  const mains = new Map(); // uid -> ICAL.Event
  const exceptions = [];
  for (const vevent of root.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(vevent);
    if (!ev.uid || !ev.startDate) continue;
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else mains.set(ev.uid, ev);
  }
  for (const ex of exceptions) mains.get(ex.uid)?.relateException(ex);
  // An edited single occurrence of a series whose main event isn't in the feed still shows up on its own.
  const orphans = exceptions.filter((ex) => !mains.has(ex.uid));

  const out = [];
  const push = (ev, startTime, endTime) => {
    if (ev.component.getFirstPropertyValue("status") === "CANCELLED") return;
    const allDay = startTime.isDate;
    let item;
    if (allDay) {
      const endDay = endTime && endTime.compare(startTime) > 0 ? endTime : (() => { const e = startTime.clone(); e.day += 1; return e; })();
      const s = new Date(`${dateKey(startTime)}T00:00:00Z`);
      const e = new Date(`${dateKey(endDay)}T00:00:00Z`);
      if (e <= new Date(rangeStart.getTime() - 14 * 864e5) || s >= new Date(rangeEnd.getTime() + 14 * 864e5)) return;
      item = { allDay: true, startDate: dateKey(startTime), endDate: dateKey(endDay) };
    } else {
      const s = toDate(startTime, tz);
      const e = endTime ? toDate(endTime, tz) : s;
      if (e < rangeStart && s < rangeStart) return;
      if (s >= rangeEnd) return;
      item = { allDay: false, start: s.toISOString(), end: (e < s ? s : e).toISOString() };
    }
    out.push({ uid: ev.uid, title: ev.summary || "(No title)", location: ev.location || "", ...item });
  };

  for (const ev of mains.values()) {
    if (out.length >= MAX_EVENTS_PER_CALENDAR) break;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate);
      continue;
    }
    const iterator = ev.iterator();
    for (let i = 0, next; i < MAX_ITERATIONS && (next = iterator.next()); i++) {
      const details = ev.getOccurrenceDetails(next);
      const startJs = details.startDate.isDate ? new Date(`${dateKey(details.startDate)}T00:00:00Z`) : toDate(details.startDate, tz);
      if (startJs >= new Date(rangeEnd.getTime() + 2 * 864e5)) break;
      push(details.item, details.startDate, details.endDate);
    }
  }
  for (const ex of orphans) push(ex, ex.startDate, ex.endDate);

  return out.slice(0, MAX_EVENTS_PER_CALENDAR);
}

/** The calendar's own display name, when the feed has one. */
export function feedName(text) {
  try {
    return new ICAL.Component(ICAL.parse(text)).getFirstPropertyValue("x-wr-calname") || "";
  } catch {
    return "";
  }
}

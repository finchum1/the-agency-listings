import AddressInput from "./AddressInput";
import { useEffect, useState } from "react";
import { browserTimeZone, checkCalendarAddress } from "../../../hooks/useCalendarEvents";
import { toKey } from "../../../lib/homeDates";
import { muted } from "./styles";

export const PALETTE = ["#ed2127", "#1a5fb4", "#1c7c4d", "#7c3aed", "#0e7490", "#be185d", "#525252"];
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const smallBtn = "rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-3.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10";
const dot = (color) => <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />;

// ---- the Calendars panel -------------------------------------------------------------------------------------------

function GoogleCalendarPicker({ cal, connection, onDone }) {
  const [list, setList] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    cal
      .googleCalendars(connection.id)
      .then((l) => active && setList(l))
      .catch((err) => active && setError(err.message));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.id]);

  const toggle = (id) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const link = async () => {
    setBusy(true);
    setError("");
    try {
      await cal.linkGoogleCalendars(connection.id, [...picked]);
      onDone();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="mt-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-3 space-y-2">
      {!list && !error && <p className={`text-xs ${muted}`}>Loading calendars…</p>}
      {list && (
        <>
          <p className="text-xs font-semibold">Show these calendars in your schedule</p>
          <ul className="space-y-1.5">
            {list.map((c) => (
              <li key={c.id}>
                <label className={`flex items-center gap-2.5 text-sm ${c.linked ? "opacity-60" : "cursor-pointer"}`}>
                  <input type="checkbox" disabled={c.linked} checked={c.linked || picked.has(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 accent-[#ed2127]" />
                  {dot(c.color)}
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className={`text-[11px] ${muted}`}>{c.linked ? "Already shown" : c.canWrite ? "Can edit" : "View only"}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={link} disabled={busy || picked.size === 0} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50">
              {busy ? "Adding…" : `Add ${picked.size || ""} calendar${picked.size === 1 ? "" : "s"}`.replace("Add  ", "Add ")}
            </button>
            <button type="button" onClick={onDone} className={`text-xs ${muted}`}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function CalendarsPanel({ cal, onClose, notice, openConnectionId }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[(cal.calendars.length + 1) % PALETTE.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(notice || "");
  const [pickFor, setPickFor] = useState(openConnectionId || null);

  const addIcal = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const found = await checkCalendarAddress(address);
      await cal.addCalendar({ name: name.trim() || found.name || "My calendar", address: found.address, color });
      setMessage(`Linked. Found ${found.upcoming} event${found.upcoming === 1 ? "" : "s"} in the next 60 days.`);
      setAddress("");
      setName("");
      setColor(PALETTE[(cal.calendars.length + 2) % PALETTE.length]);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const connect = async (hint) => {
    setError("");
    try {
      await cal.connectGoogle(hint);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Calendars</h3>
        <button type="button" onClick={onClose} className={`text-xs ${muted} hover:text-[#1c1a17] dark:hover:text-[#faf9f7]`}>
          Close
        </button>
      </div>
      {message && <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">{message}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Google accounts: two-way */}
      <div className="space-y-2.5">
        <div>
          <p className="text-sm font-semibold">Google accounts</p>
          <p className={`text-[11px] leading-snug ${muted}`}>Connect Google and your calendars stay in sync both ways: events show here as they change, and events you add or edit here appear in Google Calendar.</p>
        </div>
        {cal.connections.length > 0 && (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {cal.connections.map((c) => (
              <li key={c.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm truncate">{c.email}</span>
                  {c.status === "needs_reconnect" ? (
                    <>
                      <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5">Needs reconnecting</span>
                      <button type="button" onClick={() => connect(c.email)} className={smallBtn}>
                        Reconnect
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setPickFor(pickFor === c.id ? null : c.id)} className={smallBtn}>
                      Choose calendars
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => confirm(`Disconnect ${c.email}? Its calendars leave your schedule. Nothing is deleted from Google.`) && cal.disconnectGoogle(c.id).catch((err) => setError(err.message))}
                    className={`text-xs ${muted} hover:text-red-600 dark:hover:text-red-400`}
                  >
                    Disconnect
                  </button>
                </div>
                {pickFor === c.id && <GoogleCalendarPicker cal={cal} connection={c} onDone={() => setPickFor(null)} />}
              </li>
            ))}
          </ul>
        )}
        {cal.googleConfigured === false ? (
          <p className={`text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2 ${muted}`}>Connecting Google accounts hasn't been switched on for this dashboard yet. You can still link a calendar by its private address below.</p>
        ) : (
          <button type="button" onClick={() => connect()} disabled={cal.googleConfigured === null} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2 disabled:opacity-50">
            {cal.connections.length ? "+ Connect another Google account" : "Connect a Google account"}
          </button>
        )}
      </div>

      {/* what is on the schedule */}
      {cal.calendars.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-1">On your schedule</p>
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {cal.calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <input type="checkbox" checked={c.enabled} onChange={(e) => cal.updateCalendar(c.id, { enabled: e.target.checked })} aria-label={`Show ${c.name}`} className="h-4 w-4 accent-[#ed2127]" />
                {dot(c.color)}
                <span className="min-w-0 flex-1 text-sm truncate">{c.name}</span>
                <span className={`text-[11px] ${muted}`}>{c.source === "google" ? (c.can_write ? "Google · can edit" : "Google · view only") : "Address · view only"}</span>
                {c.source === "google" && c.can_write &&
                  (c.is_default ? (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Default for new events</span>
                  ) : (
                    <button type="button" onClick={() => cal.setDefaultCalendar(c.id)} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                      Make default
                    </button>
                  ))}
                <button type="button" onClick={() => confirm(`Remove “${c.name}” from your schedule? Nothing changes in the calendar itself.`) && cal.removeCalendar(c.id)} className={`text-xs ${muted} hover:text-red-600 dark:hover:text-red-400`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* iCal address: one-way */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-semibold">Or link a calendar by its private address (view only)</summary>
        <form onSubmit={addIcal} className="space-y-3 mt-3">
          <ol className={`text-xs leading-relaxed list-decimal pl-4 space-y-0.5 ${muted}`}>
            <li>
              In Google Calendar on a computer, hover the calendar in the left list, click <strong>⋮</strong> → <strong>Settings and sharing</strong>.
            </li>
            <li>
              Scroll to <strong>Integrate calendar</strong> and copy the <strong>Secret address in iCal format</strong>.
            </li>
            <li>Paste it below. Outlook and Apple calendars have a similar “subscribe” / “published” address.</li>
          </ol>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" aria-label="Calendar address" className={inputClass} />
          <div className="flex flex-wrap items-center gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Calendar name" maxLength={80} className={`${inputClass} !w-48`} />
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
              {PALETTE.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={color === p} aria-label={p} onClick={() => setColor(p)} className={`h-5 w-5 rounded-full border-2 ${color === p ? "border-[#1c1a17] dark:border-[#faf9f7]" : "border-transparent"}`} style={{ background: p }} />
              ))}
            </div>
            <button type="submit" disabled={busy || !address.trim()} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-5 py-2 disabled:opacity-50">
              {busy ? "Checking…" : "Link calendar"}
            </button>
          </div>
          <p className={`text-[11px] leading-snug ${muted}`}>The address is private to you and only read, never changed. Google refreshes these addresses every few hours, so a new event can take a while to appear. Connecting your Google account above avoids that.</p>
        </form>
      </details>
    </div>
  );
}

// ---- event window ---------------------------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
const localDate = (iso) => toKey(new Date(iso));
const localTime = (iso) => `${pad(new Date(iso).getHours())}:${pad(new Date(iso).getMinutes())}`;
const plusHour = (hhmm) => `${pad(Math.min(23, Number(hhmm.slice(0, 2)) + 1))}:${hhmm.slice(3)}`;

// Add or edit an event on a connected Google calendar, or look at one that can't be changed.
export function EventModal({ cal, event, defaultDate, defaults, onClose }) {
  const writable = cal.calendars.filter((c) => c.source === "google" && c.can_write);
  const editing = Boolean(event);
  const canEdit = !editing || event.canWrite;
  const calendarFor = (id) => cal.calendars.find((c) => c.id === id);

  const [f, setF] = useState(() => {
    if (!event) return { title: "", allDay: Boolean(defaults?.allDay), startDate: defaults?.date || defaultDate, endDate: defaults?.date || defaultDate, start: defaults?.start || "09:00", end: defaults?.end || "10:00", location: "", description: "", calendarRowId: (writable.find((c) => c.is_default) || writable[0])?.id || "" };
    if (event.allDay) {
      const last = new Date(`${event.endDate}T00:00:00`);
      last.setDate(last.getDate() - 1); // Google's all-day end is the day after the last day
      return { title: event.title, allDay: true, startDate: event.startDate, endDate: toKey(last) < event.startDate ? event.startDate : toKey(last), start: "09:00", end: "10:00", location: event.location || "", description: event.description || "", calendarRowId: event.calendarId };
    }
    return { title: event.title, allDay: false, startDate: localDate(event.start), endDate: localDate(event.end), start: localTime(event.start), end: localTime(event.end), location: event.location || "", description: event.description || "", calendarRowId: event.calendarId };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim() || !canEdit) return;
    setBusy(true);
    setError("");
    const payload = f.allDay
      ? { title: f.title.trim(), allDay: true, startDate: f.startDate, endDate: f.endDate < f.startDate ? f.startDate : f.endDate, location: f.location, description: f.description }
      : { title: f.title.trim(), start: `${f.startDate}T${f.start}:00`, end: `${f.endDate || f.startDate}T${f.end}:00`, timeZone: browserTimeZone(), location: f.location, description: f.description };
    try {
      await cal.saveEvent({ calendarRowId: f.calendarRowId, eventId: editing ? event.eventId : undefined, event: payload });
      if (makeDefault && !editing) await cal.setDefaultCalendar(f.calendarRowId);
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm(`Delete “${event.title}” from Google Calendar${event.recurring ? " (this one occurrence)" : ""}?`)) return;
    setBusy(true);
    try {
      await cal.deleteEvent({ calendarRowId: event.calendarId, eventId: event.eventId });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const title = editing ? (canEdit ? "Edit event" : "Event") : "New event";
  const readOnly = !canEdit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form onSubmit={submit} className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            ✕
          </button>
        </div>

        {!editing && writable.length === 0 ? (
          <p className="text-sm">Connect a Google account (under <strong>Calendars</strong>) to add events from here.</p>
        ) : (
          <>
            <div>
              <label className={labelClass}>Title</label>
              <input required autoFocus={canEdit} disabled={readOnly} value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={300} className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={readOnly} checked={f.allDay} onChange={(e) => set({ allDay: e.target.checked })} className="h-4 w-4 accent-[#ed2127]" />
              All day
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Starts</label>
                <input type="date" required disabled={readOnly} value={f.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} className={inputClass} />
              </div>
              {!f.allDay && (
                <div>
                  <label className={labelClass}>&nbsp;</label>
                  <input type="time" required disabled={readOnly} value={f.start} onChange={(e) => set({ start: e.target.value, end: f.startDate === f.endDate && f.end <= e.target.value ? plusHour(e.target.value) : f.end })} aria-label="Start time" className={inputClass} />
                </div>
              )}
              <div>
                <label className={labelClass}>Ends</label>
                <input type="date" required disabled={readOnly} min={f.startDate} value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className={inputClass} />
              </div>
              {!f.allDay && (
                <div>
                  <label className={labelClass}>&nbsp;</label>
                  <input type="time" required disabled={readOnly} value={f.end} onChange={(e) => set({ end: e.target.value })} aria-label="End time" className={inputClass} />
                </div>
              )}
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <AddressInput disabled={readOnly} value={f.location} onChange={(v) => set({ location: v })} maxLength={300} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea disabled={readOnly} value={f.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={4000} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Calendar</label>
              {editing ? (
                <p className="text-sm flex items-center gap-2">
                  {dot(calendarFor(f.calendarRowId)?.color || "#525252")}
                  {calendarFor(f.calendarRowId)?.name || "Calendar"}
                  {!event.canWrite && <span className={`text-xs ${muted}`}>· view only</span>}
                </p>
              ) : (
                <select value={f.calendarRowId} onChange={(e) => set({ calendarRowId: e.target.value })} className={inputClass}>
                  {writable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.is_default ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {!editing && f.calendarRowId && !calendarFor(f.calendarRowId)?.is_default && (
                <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-3.5 w-3.5" />
                  Use this as my default calendar for new events
                </label>
              )}
            </div>
            {editing && event.recurring && canEdit && <p className={`text-xs ${muted}`}>This is one occurrence of a repeating event. Changes apply to this occurrence only.</p>}
            {editing && event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                Open in Google Calendar ↗
              </a>
            )}
          </>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          {canEdit && (editing || writable.length > 0) && (
            <button type="submit" disabled={busy || !f.title.trim()} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-60">
              {busy ? "Saving…" : editing ? "Save changes" : "Add event"}
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            {canEdit ? "Cancel" : "Close"}
          </button>
          {editing && canEdit && (
            <button type="button" onClick={remove} disabled={busy} className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-60">
              Delete
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

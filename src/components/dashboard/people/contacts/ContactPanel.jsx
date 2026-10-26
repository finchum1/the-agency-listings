import { useCallback, useEffect, useMemo, useState } from "react";
import { boardPath } from "../../../../lib/deals";
import { Link } from "react-router-dom";
import { supabase } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../hooks/useAuth";
import { useAgentTasks } from "../../../../hooks/useAgentTasks";
import { usePeopleStages } from "../../../../hooks/usePeopleStages";
import { BOARDS, SOURCES } from "../../../../lib/peopleStages";
import { RECURRENCES } from "../../../../lib/taskRecurrence";
import { addDays, dayLabel, toKey } from "../../../../lib/homeDates";
import { NOTE_KINDS, RELATIONSHIPS, TOUCH_OPTIONS, cityLine, digits, fullName, initials, lastContactLabel, touchDue } from "../../../../lib/contacts";
import { TagChip, TagPicker } from "./TagParts";

const input = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const label = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const pill = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const heading = "font-display text-base font-semibold";

// A field that keeps its own text while you type and saves when you leave it.
function Field({ title, value, onCommit, type = "text", placeholder, list, className = "" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <div className={className}>
      <label className={label}>{title}</label>
      <input
        type={type}
        value={v}
        list={list}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = type === "date" ? v || null : v.trim();
          const current = type === "date" ? value || null : value || "";
          if (next !== current) onCommit(next);
        }}
        className={input}
      />
    </div>
  );
}

const fmtWhen = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const kindLabel = (k) => NOTE_KINDS.find((n) => n.value === k)?.label || "Note";

export default function ContactPanel({ contact, ctx, tags, cards, onClose, onUpdate, onTagAdd, onTagRemove, onCreateTag, onDelete, onChanged }) {
  const { user } = useAuth();
  const { stages } = usePeopleStages();
  const { tasks, add, complete, remove, error: taskError } = useAgentTasks(user?.id);
  const mine = useMemo(() => tasks.filter((t) => t.contact_id === contact.id && !t.done), [tasks, contact.id]);
  const [notes, setNotes] = useState([]);
  const [kind, setKind] = useState("note");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [repeat, setRepeat] = useState("none");
  const [boardBusy, setBoardBusy] = useState("");
  const [error, setError] = useState("");

  const first = contact.first_name || contact.company || "them";
  const today = toKey(new Date());
  const tagIds = ctx.tagsByContact.get(contact.id) || [];
  const myTags = tagIds.map((id) => ctx.tagById.get(id)).filter(Boolean);
  const myCards = cards.filter((c) => c.contact_id === contact.id);

  const loadNotes = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from("contact_notes").select("id, kind, body, occurred_at").eq("contact_id", contact.id).order("occurred_at", { ascending: false }).limit(200),
      cards.some((c) => c.contact_id === contact.id)
        ? supabase.from("people_notes").select("id, body, created_at, person_id").in("person_id", cards.filter((c) => c.contact_id === contact.id).map((c) => c.id)).order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] }),
    ]);
    const merged = [
      ...(a.data || []).map((n) => ({ id: `c${n.id}`, rawId: n.id, mine: true, kind: n.kind, body: n.body, at: n.occurred_at })),
      ...(b.data || []).map((n) => ({ id: `p${n.id}`, kind: "card", body: n.body, at: n.created_at })),
    ].sort((x, y) => y.at.localeCompare(x.at));
    setNotes(merged);
  }, [contact.id, cards]);
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    setTitle("");
    setDue("");
    setRepeat("none");
    setBody("");
    setError("");
  }, [contact.id]);

  const logActivity = async (e) => {
    e.preventDefault();
    if (!body.trim() && kind === "note") return;
    setSaving(true);
    const { error: err } = await supabase.from("contact_notes").insert({ contact_id: contact.id, kind, body: body.trim() });
    setSaving(false);
    if (err) return setError(err.message);
    setBody("");
    setKind("note");
    // The database moves "last contacted" for a call, text, email, meeting or showing; reload to show it.
    await onChanged();
    loadNotes();
  };
  const deleteNote = async (n) => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("contact_notes").delete().eq("id", n.rawId);
    loadNotes();
  };

  const addFollowUp = async (e) => {
    e.preventDefault();
    const ok = await add({ title: title.trim() || `Follow up with ${fullName(contact)}`, due_date: due || null, recurrence: repeat, contact_id: contact.id });
    if (ok) {
      setTitle("");
      setDue("");
      setRepeat("none");
      onChanged();
    }
  };
  const quick = (days) => setDue(toKey(addDays(new Date(), days)));

  const addToBoard = async (group) => {
    setBoardBusy(group);
    const { error: err } = await supabase.from("people").insert({
      name: fullName(contact),
      email: contact.email,
      phone: contact.phone,
      source: contact.source || "Added manually",
      stage_group: group,
      stage: stages[group][0],
      contact_id: contact.id,
    });
    setBoardBusy("");
    if (err) return setError(err.message);
    onChanged();
  };

  const set = (changes) => onUpdate(contact.id, changes);
  const lines = (s) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="h-full w-full sm:w-[34rem] overflow-y-auto bg-white dark:bg-[#161616] shadow-2xl" aria-label={`Contact: ${fullName(contact)}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#161616]/95 backdrop-blur px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-sm font-semibold text-white">{initials(contact)}</span>
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold truncate">{fullName(contact)}</h2>
              <p className={`text-xs truncate ${muted}`}>
                {RELATIONSHIPS.find((r) => r.value === contact.relationship)?.label}
                {cityLine(contact) ? ` · ${cityLine(contact)}` : ""}
                {contact.archived ? " · Archived" : ""}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            ✕
          </button>
        </div>

        <div className="space-y-7 px-5 py-5">
          <div className="flex flex-wrap gap-2">
            {contact.phone ? (
              <>
                <a href={`tel:${digits(contact.phone)}`} className={pill}>Call</a>
                <a href={`sms:${digits(contact.phone)}`} className={pill}>Text</a>
              </>
            ) : null}
            {contact.email ? <a href={`mailto:${contact.email}`} className={pill}>Email</a> : null}
            {!contact.phone && !contact.email && <span className={`text-xs ${muted}`}>Add a phone number or email to call, text or email from here.</span>}
          </div>
          {contact.do_not_contact && <p className="rounded-lg bg-red-500/10 text-red-800 dark:text-red-300 px-3 py-2 text-sm font-medium">Marked do not contact.</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <section className="space-y-2.5">
            <h3 className={heading}>Tags</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              {myTags.map((t) => (
                <TagChip key={t.id} tag={t} onRemove={() => onTagRemove([contact.id], t.id)} />
              ))}
              <TagPicker tags={tags} exclude={tagIds} onPick={(t) => onTagAdd([contact.id], t.id)} onCreate={onCreateTag} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={heading}>Follow-ups</h3>
              {contact.touch_every_days ? (
                <span className={`text-xs ${touchDue(contact) ? "font-semibold text-red-600 dark:text-red-400" : muted}`}>{touchDue(contact) ? "Due for a touch · " : ""}Last in touch: {lastContactLabel(contact)}</span>
              ) : (
                <span className={`text-xs ${muted}`}>Last in touch: {lastContactLabel(contact)}</span>
              )}
            </div>
            {mine.length === 0 ? (
              <p className={`text-sm ${muted}`}>Nothing scheduled for {first}.</p>
            ) : (
              <ul className="space-y-1.5">
                {mine.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2">
                    <input type="checkbox" checked={false} onChange={async () => { await complete(t); onChanged(); }} aria-label="Mark done" className="h-4 w-4 shrink-0 accent-[#ed2127]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{t.title}</p>
                      <p className={`text-xs ${t.due_date && t.due_date < today ? "text-red-600 dark:text-red-400 font-medium" : muted}`}>
                        {t.due_date ? dayLabel(t.due_date, today) : "No date"}
                        {t.recurrence !== "none" ? ` · ${RECURRENCES.find((r) => r.value === t.recurrence)?.short}` : ""}
                      </p>
                    </div>
                    <button type="button" onClick={async () => { await remove(t.id); onChanged(); }} aria-label="Delete follow-up" className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600">✕</button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addFollowUp} className="space-y-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Follow up with ${first}`} className={input} aria-label="Follow-up title" />
              <div className="flex flex-wrap items-center gap-1.5">
                {[["Tomorrow", 1], ["1 week", 7], ["1 month", 30], ["3 months", 90]].map(([l, d]) => (
                  <button key={l} type="button" onClick={() => quick(d)} className={`${pill} ${due === toKey(addDays(new Date(), d)) ? "bg-[#1c1a17] text-white border-[#1c1a17] dark:bg-[#f2454b] dark:border-[#f2454b]" : ""}`}>
                    {l}
                  </button>
                ))}
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={`${input} !w-auto`} />
                <select value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-label="Repeat" className={`${input} !w-auto`}>
                  {RECURRENCES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2">Schedule follow-up</button>
              {taskError && <p className="text-xs text-red-600 dark:text-red-400">{taskError}</p>}
            </form>
            <div>
              <label className={label}>Remind me to stay in touch</label>
              <select value={contact.touch_every_days ?? ""} onChange={(e) => set({ touch_every_days: e.target.value ? Number(e.target.value) : null })} className={`${input} sm:!w-56`}>
                {TOUCH_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className={`mt-1 text-xs ${muted}`}>When this long goes by without a call, text, email or meeting logged, {first} shows up as due for a touch.</p>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className={heading}>On your boards</h3>
            <div className="flex flex-wrap items-center gap-2">
              {myCards.length === 0 && <span className={`text-sm ${muted}`}>Not on Leads, Pipeline or Deals.</span>}
              {myCards.map((c) => (
                <Link key={c.id} to={boardPath(c.stage_group)} className={pill}>
                  {BOARDS[c.stage_group].title} · {c.stage}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {["lead", "pipeline"].filter((g) => !myCards.some((c) => c.stage_group === g)).map((g) => (
                <button key={g} type="button" disabled={boardBusy === g} onClick={() => addToBoard(g)} className={`${pill} disabled:opacity-50`}>
                  {boardBusy === g ? "Adding…" : `Add to ${BOARDS[g].title}`}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className={heading}>Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field title="First name" value={contact.first_name} onCommit={(v) => (v || contact.last_name || contact.company) && set({ first_name: v })} />
              <Field title="Last name" value={contact.last_name} onCommit={(v) => (v || contact.first_name || contact.company) && set({ last_name: v })} />
              <Field title="Company" value={contact.company} onCommit={(v) => set({ company: v })} className="col-span-2" />
              <div className="col-span-2">
                <label className={label}>Relationship</label>
                <select value={contact.relationship} onChange={(e) => set({ relationship: e.target.value })} className={input}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <Field title="Email" type="email" value={contact.email} onCommit={(v) => set({ email: v.toLowerCase() })} />
              <Field title="Phone" type="tel" value={contact.phone} onCommit={(v) => set({ phone: v })} />
              <div>
                <label className={label}>Other emails</label>
                <textarea defaultValue={contact.other_emails.join("\n")} key={`oe${contact.id}${contact.other_emails.join()}`} rows={2} onBlur={(e) => lines(e.target.value).join() !== contact.other_emails.join() && set({ other_emails: lines(e.target.value).map((x) => x.toLowerCase()) })} placeholder="One per line" className={input} />
              </div>
              <div>
                <label className={label}>Other phones</label>
                <textarea defaultValue={contact.other_phones.join("\n")} key={`op${contact.id}${contact.other_phones.join()}`} rows={2} onBlur={(e) => lines(e.target.value).join() !== contact.other_phones.join() && set({ other_phones: lines(e.target.value) })} placeholder="One per line" className={input} />
              </div>
              <Field title="Address" value={contact.address_line1} onCommit={(v) => set({ address_line1: v })} className="col-span-2" />
              <Field title="City" value={contact.city} onCommit={(v) => set({ city: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field title="State" value={contact.state} onCommit={(v) => set({ state: v })} />
                <Field title="Zip" value={contact.zip} onCommit={(v) => set({ zip: v })} />
              </div>
              <Field title="Birthday" type="date" value={contact.birthday} onCommit={(v) => set({ birthday: v })} />
              <Field title="Home anniversary" type="date" value={contact.home_anniversary} onCommit={(v) => set({ home_anniversary: v })} />
              <Field title="Source" value={contact.source} list="contact-sources" onCommit={(v) => set({ source: v })} className="col-span-2" />
              <datalist id="contact-sources">
                {SOURCES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="col-span-2">
                <label className={label}>About</label>
                <textarea key={`ab${contact.id}`} defaultValue={contact.about} rows={3} onBlur={(e) => e.target.value !== contact.about && set({ about: e.target.value })} placeholder="Family, interests, what they're looking for…" className={input} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className={heading}>Activity</h3>
            <form onSubmit={logActivity} className="space-y-2">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Type of activity">
                {NOTE_KINDS.map((k) => (
                  <button key={k.value} type="button" onClick={() => setKind(k.value)} aria-pressed={kind === k.value} className={`${pill} ${kind === k.value ? "bg-[#1c1a17] text-white border-[#1c1a17] dark:bg-[#f2454b] dark:border-[#f2454b]" : ""}`}>
                    {k.label}
                  </button>
                ))}
              </div>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={kind === "note" ? "Add a note…" : `What happened on the ${kindLabel(kind).toLowerCase()}? (optional)`} className={input} />
              <button type="submit" disabled={saving || (kind === "note" && !body.trim())} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
                {saving ? "Saving…" : kind === "note" ? "Add note" : `Log ${kindLabel(kind).toLowerCase()}`}
              </button>
            </form>
            {notes.length === 0 ? (
              <p className={`text-sm ${muted}`}>Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{n.kind === "card" ? "From a Leads / Pipeline card" : kindLabel(n.kind)}</p>
                    {n.body && <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>}
                    <div className={`mt-1.5 flex items-center justify-between text-[11px] ${muted}`}>
                      <span>{fmtWhen(n.at)}</span>
                      {n.mine && <button type="button" onClick={() => deleteNote(n)} className="hover:text-red-600 dark:hover:text-red-400">Delete</button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 border-t border-black/5 dark:border-white/10 pt-5">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={contact.do_not_contact} onChange={(e) => set({ do_not_contact: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#ed2127]" />
              <span>
                Do not contact
                <span className={`block text-xs ${muted}`}>Keeps {first} out of "due for a touch" reminders.</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set({ archived: !contact.archived })} className={pill}>
                {contact.archived ? "Restore" : "Archive"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm(`Permanently delete ${fullName(contact)}, their activity and tags? Their Leads / Pipeline / Deals cards stay. This can't be undone.`)) {
                    await onDelete(contact.id);
                    onClose();
                  }
                }}
                className={`${pill} text-red-600 dark:text-red-400`}
              >
                Delete contact
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

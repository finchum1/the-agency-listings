import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { RELATIONSHIPS, daysSinceContact, fullName, relationshipLabel, touchDue } from "../../../lib/contacts";
import { addDays, dayLabel, toKey } from "../../../lib/homeDates";
import { boardPath } from "../../../lib/deals";
import { useContacts } from "../../../hooks/useContacts";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import ContactButtons from "./ContactButtons";
import PersonPanel from "./PersonPanel";

const DRAFTS_SHOWN = 3; // draft messages listed before the "show more" switch
const FOLLOW_UP_DAYS = 7;
const SHOW = 5; // rows shown per group before "N more"

const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const eyebrow = "text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const rowClass = "w-full text-left rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]";

function BoardTile({ group, people, stages }) {
  const board = BOARDS[group];
  const rows = people.filter((p) => p.stage_group === group && !p.archived);
  return (
    <Link to={boardPath(group)} className={`${card} block hover:shadow-sm transition-shadow`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">{board.title}</h2>
        <span className="text-2xl font-semibold">{rows.length}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {stages.map((s) => (
          <li key={s} className="flex items-center justify-between text-sm">
            <span className={muted}>{s}</span>
            <span className="font-medium">{rows.filter((p) => p.stage === s).length}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function ContactsTile({ contacts }) {
  const counts = {};
  for (const c of contacts) counts[c.relationship] = (counts[c.relationship] || 0) + 1;
  const rows = RELATIONSHIPS.filter((r) => counts[r.value]).sort((a, b) => counts[b.value] - counts[a.value]);
  return (
    <Link to="/dashboard/people/contacts" className={`${card} block hover:shadow-sm transition-shadow`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold">Contacts</h2>
        <span className="text-2xl font-semibold">{contacts.length.toLocaleString()}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <li key={r.value} className="flex items-center justify-between text-sm">
            <span className={muted}>{r.label}</span>
            <span className="font-medium">{counts[r.value].toLocaleString()}</span>
          </li>
        ))}
        {rows.length === 0 && <li className={`text-sm ${muted}`}>Add or import your database.</li>}
        {rows.length > 5 && <li className={`text-xs ${muted}`}>+ {rows.length - 5} more groups</li>}
      </ul>
    </Link>
  );
}

function Stat({ label, value, sub, to }) {
  const body = (
    <>
      <p className={`text-xs font-medium ${muted}`}>{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className={`text-xs mt-1 ${muted}`}>{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className={`${card} block hover:shadow-sm transition-shadow`}>{body}</Link>
  ) : (
    <div className={card}>{body}</div>
  );
}

// People > Overview: where your contacts, leads and pipeline stand, who to reach out to, and what's waiting. Deals have their own overview, at
// the top of the Deals page.
export default function PeopleOverview() {
  const { people: allPeople, loading, error, refresh } = usePeople();
  const crm = useContacts();
  const { stages } = usePeopleStages();
  const [selectedId, setSelectedId] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [allDrafts, setAllDrafts] = useState(false);
  const [expanded, setExpanded] = useState({});

  // Deals are not part of this page: only leads and pipeline cards count here.
  const people = useMemo(() => allPeople.filter((p) => p.stage_group !== "transaction"), [allPeople]);

  const loadDrafts = useCallback(async () => {
    const { data } = await supabase.from("people_outreach").select("id, person_id, channel, subject, body, created_at").eq("status", "draft").order("created_at", { ascending: true }).limit(50);
    setDrafts(data || []);
  }, []);
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  if (loading || crm.loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  const now = new Date();
  const today = toKey(now);
  const followHorizon = toKey(addDays(now, FOLLOW_UP_DAYS));
  const monthAgo = addDays(now, -30).toISOString();

  const contacts = crm.contacts.filter((c) => !c.archived);
  const byContact = new Map(contacts.map((c) => [c.id, c]));
  const dueTouch = contacts
    .filter(touchDue)
    .sort((a, b) => (daysSinceContact(b) ?? 99999) - (daysSinceContact(a) ?? 99999));
  const newContacts = contacts.filter((c) => c.created_at >= monthAgo).length;
  const contactTasks = (crm.tasks || [])
    .filter((t) => byContact.has(t.contact_id) && t.due_date && t.due_date <= followHorizon)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const live = people.filter((p) => !p.archived);
  const newLeads = live.filter((p) => p.stage_group === "lead" && p.stage === (stages.lead[0] || "New")).length;
  const followUps = live.filter((p) => p.next_follow_up && p.next_follow_up <= followHorizon).sort((a, b) => a.next_follow_up.localeCompare(b.next_follow_up));
  const dueNow = followUps.filter((p) => p.next_follow_up <= today);
  const dueSoon = followUps.filter((p) => p.next_follow_up > today);
  const peopleDrafts = drafts.filter((d) => people.some((p) => p.id === d.person_id));

  const selected = people.find((p) => p.id === selectedId) || null;
  const toggleMore = (key) => setExpanded((x) => ({ ...x, [key]: !x[key] }));
  const moreButton = (key, total) =>
    total > SHOW && (
      <button type="button" onClick={() => toggleMore(key)} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
        {expanded[key] ? "Show fewer" : `${total - SHOW} more`}
      </button>
    );

  const personRow = (p, right) => (
    <li key={p.id + (right || "")}>
      <button type="button" onClick={() => setSelectedId(p.id)} className={rowClass}>
        <span className="block text-sm font-medium truncate">{p.name}</span>
        <span className={`block text-xs truncate ${muted}`}>{right}</span>
      </button>
    </li>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Overview</h1>
        <p className="text-sm mt-1 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Where your contacts, leads and pipeline stand right now.</p>
      </div>
      {(error || crm.error) && <p className="text-sm text-red-600 dark:text-red-400">{error || crm.error}</p>}

      {peopleDrafts.length > 0 && (
        <section className={`${card} space-y-3 border-[#ed2127]/30 dark:border-[#f2454b]/40`}>
          <h2 className="font-display text-lg font-semibold">Drafts waiting for you ({peopleDrafts.length})</h2>
          <p className={`text-xs ${muted}`}>Written by your bot. Nothing has been sent. Open a person to send, edit or discard.</p>
          <ul className="space-y-1.5">
            {(allDrafts ? peopleDrafts : peopleDrafts.slice(0, DRAFTS_SHOWN)).map((d) => {
              const person = people.find((p) => p.id === d.person_id);
              return personRow(person, `${d.channel === "email" ? "Email" : d.channel === "text" ? "Text" : "Call"}${d.subject ? `: ${d.subject}` : `: ${d.body.slice(0, 70)}`}`);
            })}
          </ul>
          {peopleDrafts.length > DRAFTS_SHOWN && (
            <button
              type="button"
              role="switch"
              aria-checked={allDrafts}
              onClick={() => setAllDrafts((v) => !v)}
              className="flex items-center gap-2.5 text-xs font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              <span className={`relative h-5 w-9 rounded-full transition-colors ${allDrafts ? "bg-[#ed2127] dark:bg-[#f2454b]" : "bg-black/20 dark:bg-white/25"}`}>
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${allDrafts ? "translate-x-4" : ""}`} />
              </span>
              {allDrafts ? "Show fewer" : `Show ${peopleDrafts.length - DRAFTS_SHOWN} more`}
            </button>
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <ContactsTile contacts={contacts} />
        <BoardTile group="lead" people={people} stages={stages.lead} />
        <BoardTile group="pipeline" people={people} stages={stages.pipeline} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Due for a touch" value={dueTouch.length} sub="Contacts you haven't reached in a while" to="/dashboard/people/contacts" />
        <Stat label="Added in 30 days" value={newContacts} sub="New contacts" to="/dashboard/people/contacts" />
        <Stat label="New leads" value={newLeads} sub={`In "${stages.lead[0] || "New"}"`} to={boardPath("lead")} />
        <Stat label="Follow-ups due" value={dueNow.length + contactTasks.filter((t) => t.due_date <= today).length} sub="Today and overdue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} space-y-3`}>
          <h2 className="font-display text-base font-semibold">Reach out to</h2>
          {dueTouch.length === 0 && contactTasks.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nobody is due for a touch and no contact follow-ups are due in the next {FOLLOW_UP_DAYS} days.</p>
          ) : (
            <div className="space-y-4">
              {contactTasks.length > 0 && (
                <div className="space-y-1.5">
                  <p className={eyebrow}>Contact follow-ups ({contactTasks.length})</p>
                  <ul className="space-y-1.5">
                    {(expanded.tasks ? contactTasks : contactTasks.slice(0, SHOW)).map((t) => {
                      const c = byContact.get(t.contact_id);
                      return (
                        <li key={t.id}>
                          <Link to={`/dashboard/people/contacts?contact=${c.id}`} className={`${rowClass} block`}>
                            <span className="block text-sm font-medium truncate">{t.title}</span>
                            <span className={`block text-xs truncate ${t.due_date < today ? "text-red-600 dark:text-red-400" : muted}`}>
                              {fullName(c)} · {dayLabel(t.due_date, today)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {moreButton("tasks", contactTasks.length)}
                </div>
              )}
              {dueTouch.length > 0 && (
                <div className="space-y-1.5">
                  <p className={eyebrow}>Due for a touch ({dueTouch.length})</p>
                  <ul className="space-y-1.5">
                    {(expanded.touch ? dueTouch : dueTouch.slice(0, SHOW)).map((c) => {
                      const days = daysSinceContact(c);
                      return (
                        <li key={c.id} className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 space-y-2">
                          <Link to={`/dashboard/people/contacts?contact=${c.id}`} className="block">
                            <span className="block text-sm font-medium truncate">{fullName(c)}</span>
                            <span className={`block text-xs truncate ${muted}`}>
                              {relationshipLabel(c.relationship)} · {days == null ? "Never contacted" : `${days} days since you were in touch`}
                            </span>
                          </Link>
                          <ContactButtons person={{ name: fullName(c), phone: c.phone, email: c.email }} size="sm" />
                        </li>
                      );
                    })}
                  </ul>
                  {moreButton("touch", dueTouch.length)}
                </div>
              )}
            </div>
          )}
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className="font-display text-base font-semibold">Lead and pipeline follow-ups</h2>
          {followUps.length === 0 ? (
            <p className={`text-sm ${muted}`}>Nobody is due for a follow-up in the next {FOLLOW_UP_DAYS} days.</p>
          ) : (
            <div className="space-y-4">
              {[
                ["Due today & overdue", dueNow],
                [`Next ${FOLLOW_UP_DAYS} days`, dueSoon],
              ]
                .filter(([, list]) => list.length > 0)
                .map(([title, list]) => (
                  <div key={title} className="space-y-1.5">
                    <p className={eyebrow}>
                      {title} ({list.length})
                    </p>
                    <ul className="space-y-1.5">
                      {(expanded[title] ? list : list.slice(0, SHOW)).map((p) => (
                        <li key={p.id} className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 space-y-2">
                          <button type="button" onClick={() => setSelectedId(p.id)} className="block w-full text-left">
                            <span className="block text-sm font-medium truncate">{p.name}</span>
                            <span className={`block text-xs truncate ${p.next_follow_up < today ? "text-red-600 dark:text-red-400" : muted}`}>
                              {BOARDS[p.stage_group].title} · {p.stage} · {dayLabel(p.next_follow_up, today)}
                            </span>
                          </button>
                          <ContactButtons person={p} size="sm" />
                        </li>
                      ))}
                    </ul>
                    {moreButton(title, list.length)}
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <PersonPanel
          key={selected.id}
          person={selected}
          stageNames={stages[selected.stage_group]}
          nextStageNames={BOARDS[selected.stage_group].next ? stages[BOARDS[selected.stage_group].next.group] : null}
          prevStageNames={BOARDS[selected.stage_group].prev ? stages[BOARDS[selected.stage_group].prev.group] : null}
          position={0}
          total={0}
          onClose={() => {
            setSelectedId(null);
            loadDrafts();
          }}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

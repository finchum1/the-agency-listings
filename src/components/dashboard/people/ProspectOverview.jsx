import { Link } from "react-router-dom";
import { addDays, dayLabel, daysBetween, toKey } from "../../../lib/homeDates";
import { RELATIONSHIPS, lastContactLabel } from "../../../lib/contacts";
import { TagChip, TagPicker } from "./contacts/TagParts";
import { ActivityList } from "./ProspectActivity";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const card = "rounded-2xl border border-black/10 dark:border-white/15 p-4";
const ghost = "rounded-full border border-black/15 dark:border-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10";
const control = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";

/** Where a person's follow-up stands: { label, tone } for a chip or line. */
export function followUpState(nextFollowUp, today = toKey(new Date())) {
  if (!nextFollowUp) return { label: "No follow-up set", tone: "none" };
  const d = daysBetween(today, nextFollowUp);
  if (d < 0) return { label: `Follow-up ${-d} day${d === -1 ? "" : "s"} overdue`, tone: "alert" };
  if (d === 0) return { label: "Follow up today", tone: "due" };
  return { label: `Follow up ${dayLabel(nextFollowUp, today).toLowerCase() === "tomorrow" ? "tomorrow" : `in ${d} days`}`, tone: "none" };
}

// A Leads / Pipeline card's Overview tab: when to follow up next (with one-tap "Followed up" that uses the column's cadence), who they are in
// Contacts (relationship, tags, last contact), the latest activity, and the move to the next board. Drafts and the move block are added by the
// panel around it (`children`: { top, bottom }).
//   cadence     days between follow-ups for this column, or null     onFollowUp(dateKey | null) sets the next follow-up
export default function ProspectOverview({ person, nextFollowUp, cadence, columnName, onFollowUp, card: contactCard, activity, onTab, children }) {
  const today = toKey(new Date());
  const state = followUpState(nextFollowUp, today);
  const plus = (n) => toKey(addDays(new Date(), n));
  const c = contactCard.contact;

  return (
    <div className="space-y-6">
      {children?.top}

      <section aria-label="Follow-up" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Follow-up</p>
            <p className={`mt-0.5 text-base font-semibold ${state.tone === "alert" ? "text-red-600 dark:text-red-400" : ""}`}>{state.label}</p>
            {nextFollowUp && <p className={`text-xs ${muted}`}>{dayLabel(nextFollowUp, today)}</p>}
          </div>
          <button
            type="button"
            onClick={() => onFollowUp(cadence ? plus(cadence) : null)}
            className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white"
          >
            Followed up
          </button>
        </div>
        <p className={`mt-1.5 text-xs ${muted}`}>
          {cadence ? `“Followed up” sets the next one ${cadence} day${cadence === 1 ? "" : "s"} out, the cadence for ${columnName}.` : `${columnName} has no cadence, so “Followed up” clears the reminder. Set one from the column’s ⋯ menu on the board.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`text-xs ${muted}`}>Or</span>
          {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([label, n]) => (
            <button key={n} type="button" onClick={() => onFollowUp(plus(n))} className={ghost}>
              {label}
            </button>
          ))}
          <input type="date" value={nextFollowUp || ""} onChange={(e) => onFollowUp(e.target.value || null)} aria-label="Pick a follow-up date" className={control} />
        </div>
      </section>

      <section aria-label="In Contacts" className={card}>
        <div className="flex items-center justify-between gap-3">
          <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>In Contacts</p>
          {person.contact_id && (
            <Link to={`/dashboard/people/contacts?contact=${person.contact_id}`} className="text-xs font-semibold underline underline-offset-2">
              Open contact
            </Link>
          )}
        </div>
        {c ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <span className={muted}>Relationship</span>
                <select value={c.relationship} onChange={(e) => contactCard.setRelationship(e.target.value)} className={control}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
              <span className={`text-sm ${muted}`}>Last in touch: {lastContactLabel(c).toLowerCase()}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {contactCard.tagIds.map((id) => (
                <TagChip key={id} tag={contactCard.tagById.get(id)} onRemove={() => contactCard.removeTag(id)} />
              ))}
              <TagPicker tags={contactCard.tags} exclude={contactCard.tagIds} onPick={contactCard.addTag} onCreate={contactCard.createTag} />
            </div>
            {c.do_not_contact && <p className="text-xs font-semibold text-red-600 dark:text-red-400">Marked do not contact.</p>}
          </div>
        ) : (
          <p className={`mt-2 text-sm ${muted}`}>Loading…</p>
        )}
      </section>

      <section aria-label="Recent activity" className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">Recent activity</h3>
          <button type="button" onClick={() => onTab("activity")} className="text-xs font-semibold underline underline-offset-2">
            Log activity
          </button>
        </div>
        <ActivityList items={activity.items} limit={3} />
        {activity.items.length > 3 && (
          <button type="button" onClick={() => onTab("activity")} className={`text-xs ${muted} underline underline-offset-2`}>
            See all {activity.items.length}
          </button>
        )}
      </section>

      {children?.bottom}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { daysBetween, toKey } from "../../../lib/homeDates";
import { fullName, relationshipLabel } from "../../../lib/contacts";
import { OCCASIONS, nextOccurrence, occasionAudience } from "../../../lib/plans";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const tab = (on) => `rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"}`;
const when = (key, today) => {
  const n = daysBetween(today, key);
  const d = new Date(`${key}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
  return n === 0 ? "Today" : n === 1 ? `Tomorrow (${d})` : `${d} (in ${n} days)`;
};

// Under a birthday / home-anniversary plan: who it will reach (has the date saved), who is coming up, and who still needs the date.
export default function OccasionCoverage({ plan, contacts: list }) {
  const contacts = list || [];
  const [view, setView] = useState("");
  const kind = OCCASIONS[plan.starts_when.type];
  const today = toKey(new Date());
  const { have, missing, field } = useMemo(() => occasionAudience(plan, contacts), [plan, contacts]);
  const upcoming = useMemo(
    () => have.map((c) => ({ c, on: nextOccurrence(c[field], today) })).sort((a, b) => a.on.localeCompare(b.on) || fullName(a.c).localeCompare(fullName(b.c))),
    [have, field, today],
  );
  const row = (c, right) => (
    <li key={c.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <Link to={`/dashboard/people/contacts?contact=${c.id}`} className="min-w-0 truncate font-medium hover:underline">{fullName(c)}</Link>
      <span className={`shrink-0 text-xs ${muted}`}>{right}</span>
    </li>
  );
  const total = have.length + missing.length;
  if (!list) return null;
  return (
    <div className="mt-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3.5">
      <p className="text-sm">
        <span className="font-semibold">{have.length}</span> of {total} contact{total === 1 ? "" : "s"} in this plan have a {kind.noun} saved
        {missing.length > 0 && <>, <span className="font-semibold">{missing.length}</span> still need it</>}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setView(view === "upcoming" ? "" : "upcoming")} aria-pressed={view === "upcoming"} className={tab(view === "upcoming")}>Coming up ({have.length})</button>
        <button type="button" onClick={() => setView(view === "missing" ? "" : "missing")} aria-pressed={view === "missing"} className={tab(view === "missing")}>Need a date ({missing.length})</button>
      </div>
      {view === "upcoming" && (
        <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-black/5 dark:divide-white/10">
          {upcoming.length === 0 ? <li className={`py-2 text-sm ${muted}`}>No one has a {kind.noun} saved yet.</li> : upcoming.map(({ c, on }) => row(c, when(on, today)))}
        </ul>
      )}
      {view === "missing" && (
        <>
          <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-black/5 dark:divide-white/10">
            {missing.length === 0 ? <li className={`py-2 text-sm ${muted}`}>Everyone in this plan has a {kind.noun} saved.</li> : missing.map((c) => row(c, relationshipLabel(c.relationship)))}
          </ul>
          <p className={`mt-2 text-xs ${muted}`}>
            Open a name to add the date, or <Link to={`/dashboard/people/contacts?dates=no_${field === "birthday" ? "birthday" : "anniversary"}`} className="font-semibold underline">see everyone without one in Contacts</Link>. Only contacts in this plan's relationships are listed here.
          </p>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { FILTERS, countByFilter, filterEntries, groupByPeriod } from "../../../../lib/contactTimeline";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const PAGE = 40;

// The scroll of everything: filter by type, search the words, and read it by day and month. `labelOf(entry)` is the small heading on each entry and `whenOf(entry)`
// its date and time; `onDelete` (optional) is offered on entries that came from this contact's own log.
export default function TimelineList({ entries, labelOf, whenOf, onDelete }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const counts = useMemo(() => countByFilter(entries), [entries]);
  const rows = useMemo(() => filterEntries(entries, filter, query), [entries, filter, query]);
  const groups = useMemo(() => groupByPeriod(rows.slice(0, shown)), [rows, shown]);
  const chip = (active) => `rounded-full border px-3 py-1 text-xs font-semibold ${active ? "bg-[#1c1a17] text-white border-[#1c1a17] dark:bg-[#f2454b] dark:border-[#f2454b]" : "border-black/10 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}`;

  if (entries.length === 0) return <p className={`text-sm ${muted}`}>Nothing logged yet.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => (
          <button key={f.key} type="button" onClick={() => { setFilter(f.key); setShown(PAGE); }} aria-pressed={filter === f.key} className={chip(filter === f.key)}>
            {f.label} <span className="opacity-60">{counts[f.key]}</span>
          </button>
        ))}
      </div>
      <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search this history" aria-label="Search this history" className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40" />
      {rows.length === 0 ? (
        <p className={`text-sm ${muted}`}>Nothing matches.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h4 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${muted}`}>{g.label}</h4>
              <ul className="space-y-2">
                {g.items.map((n) => (
                  <li key={n.id} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{labelOf(n)}</p>
                    {n.title && <p className="mt-1 text-sm font-medium">{n.title}</p>}
                    {n.body && <p className={`${n.title ? "mt-0.5" : "mt-1"} text-sm whitespace-pre-wrap`}>{n.body}</p>}
                    <div className={`mt-1.5 flex items-center justify-between text-[11px] ${muted}`}>
                      <span>{whenOf(n)}</span>
                      {n.mine && onDelete && <button type="button" onClick={() => onDelete(n)} className="hover:text-red-600 dark:hover:text-red-400">Delete</button>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {rows.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-lg border border-black/10 dark:border-white/15 py-2 text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
              Show {Math.min(PAGE, rows.length - shown)} more ({rows.length - shown} left)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import { buildTimeline, inDays, prettyDate } from "../../../lib/timeline";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const short = (key) => prettyDate(key, { month: "short", day: "numeric" });

// The next two dates still ahead on a deal (contract, inspection, appraisal, loan approval...), each with how far away it is. The closing date is
// not here: the card always shows it in its top right corner. When only closing is left, it is the one line shown.
export default function DealTimelineStrip({ deal, today }) {
  const { milestones, closed } = buildTimeline(deal, today);
  // Earnest money has no date of its own to plan around, so it is left off the card.
  const items = milestones.filter((m) => m.key !== "earnest_money_delivered");
  if (items.length === 0) return <p className={`text-xs ${muted}`}>No dates set yet</p>;
  if (closed) return null;

  const ahead = items.filter((m) => m.state !== "done");
  const others = ahead.filter((m) => m.key !== "closing_date");
  const rows = others.length ? others.slice(0, 2) : ahead.slice(0, 1);
  if (rows.length === 0) return <p className={`text-xs ${muted}`}>All dates have passed</p>;

  return (
    <ul className="space-y-0.5" aria-label="Next dates">
      {rows.map((m, i) => (
        <li key={m.key} title={`${m.label}, ${prettyDate(m.date)}${m.time ? ` at ${m.time}` : ""}`} className="flex items-baseline justify-between gap-2 text-xs">
          <span className={`min-w-0 truncate ${i === 0 ? "font-semibold" : "font-medium"}`}>
            {m.label} <span className={`font-medium ${muted}`}>· {short(m.date)}</span>
          </span>
          <span className={`shrink-0 font-medium ${m.state === "today" ? "text-amber-700 dark:text-amber-400" : muted}`}>{inDays(m.days)}</span>
        </li>
      ))}
    </ul>
  );
}

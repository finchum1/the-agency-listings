import { buildTimeline, inDays, prettyDate } from "../../../lib/timeline";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const SEG = {
  done: "bg-emerald-600",
  today: "bg-amber-500",
  next: "bg-[#ed2127] dark:bg-[#f2454b]",
  later: "bg-black/10 dark:bg-white/15",
};
const short = (key) => prettyDate(key, { month: "short", day: "numeric" });

// Where the deal stands, at a glance, on the board card: a slim bar with one piece for each date the deal has (contract, inspection, appraisal,
// loan approval, closing), filled as each one passes, then the next date in words and when it closes. Hovering a piece names its date.
export default function DealTimelineStrip({ deal, today }) {
  const { milestones, nextIndex, closed } = buildTimeline(deal, today);
  // Earnest money has no date of its own to plan around, so it is left off the card.
  const items = milestones.filter((m) => m.key !== "earnest_money_delivered");
  if (items.length === 0) return <p className={`text-xs ${muted}`}>No dates set yet</p>;

  const next = nextIndex >= 0 ? milestones[nextIndex] : null;
  const closing = items.find((m) => m.key === "closing_date");
  const full = (m) => `${m.label}, ${prettyDate(m.date)}${m.time ? ` at ${m.time}` : ""}`;

  return (
    <div className="space-y-1.5" role="img" aria-label={`Deal timeline: ${items.map((m) => `${full(m)}${m.state === "done" ? " (done)" : ""}`).join("; ")}`}>
      <div className="flex gap-1" aria-hidden="true">
        {items.map((m) => (
          <span key={m.key} title={full(m)} className={`h-1.5 flex-1 rounded-full ${closed ? SEG.done : SEG[m.state]}`} />
        ))}
      </div>
      {closed ? (
        <p className="text-xs font-semibold">
          Closed {closing && <span className={`font-medium ${muted}`}>· {short(closing.date)}</span>}
        </p>
      ) : next ? (
        <div className="space-y-0.5">
          <p className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-semibold">
              {next.label} <span className={`font-medium ${muted}`}>· {short(next.date)}</span>
            </span>
            <span className={`shrink-0 font-medium ${next.state === "today" ? "text-amber-700 dark:text-amber-400" : muted}`}>{inDays(next.days)}</span>
          </p>
          {closing && next.key !== "closing_date" && <p className={`text-[11px] ${muted}`}>Closes {short(closing.date)}</p>}
        </div>
      ) : (
        <p className={`text-xs ${muted}`}>All dates have passed</p>
      )}
    </div>
  );
}

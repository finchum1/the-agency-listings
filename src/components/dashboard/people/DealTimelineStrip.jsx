import { buildTimeline, inDays, prettyDate } from "../../../lib/timeline";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const SHORT = {
  contract_date: "Contract",
  inspection_date: "Inspect",
  inspection_period_end: "Insp. ends",
  appraisal_date: "Appraisal",
  financing_deadline: "Loan",
  closing_date: "Closing",
};
const DOT = {
  done: "bg-emerald-600 border-emerald-600",
  today: "bg-amber-500 border-amber-500 ring-2 ring-amber-500/30",
  next: "bg-white dark:bg-[#1a1a1a] border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/20",
  later: "bg-white dark:bg-[#1a1a1a] border-black/25 dark:border-white/30",
};

// The deal's dates as a line on the board card: a stop for each date it has (contract, inspection, appraisal, loan approval, closing) with its
// date under it, filled in as each one passes and the next one marked. Reads the same dates as the client timeline.
export default function DealTimelineStrip({ deal, today }) {
  const { milestones, fill, nextIndex, closed } = buildTimeline(deal, today);
  // Earnest money has no date of its own to plan around, so it is left off the card.
  const items = milestones.map((m, i) => ({ ...m, fill: fill[i] })).filter((m) => m.key !== "earnest_money_delivered");
  if (items.length === 0) return <p className={`text-xs ${muted}`}>No dates set yet</p>;

  // A closed deal with just its closing date has no line to draw.
  if (closed && items.length === 1) return <p className="text-[11px] font-semibold leading-tight">Closed <span className={`font-medium ${muted}`}>· {prettyDate(items[0].date, { month: "short", day: "numeric" })}</span></p>;

  const next = nextIndex >= 0 ? milestones[nextIndex] : null;
  const name = (m) => SHORT[m.key] || m.label;
  const full = (m) => `${m.label}, ${prettyDate(m.date)}${m.time ? ` at ${m.time}` : ""}`;

  return (
    <div className="space-y-1.5" role="img" aria-label={`Deal timeline: ${items.map((m) => `${full(m)}${m.state === "done" ? " (done)" : ""}`).join("; ")}`}>
      <ol className="flex" aria-hidden="true">
        {items.map((m, i) => {
          const state = closed ? "done" : m.state;
          return (
            <li key={m.key} title={full(m)} className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
              {i < items.length - 1 && (
                <span className="absolute left-1/2 top-[5px] h-0.5 w-full -translate-y-1/2 bg-black/10 dark:bg-white/15">
                  <span className="block h-full bg-emerald-600" style={{ width: `${(closed ? 1 : m.fill) * 100}%` }} />
                </span>
              )}
              <span className={`relative z-10 h-2.5 w-2.5 rounded-full border-2 ${DOT[state]}`} />
              <span className={`max-w-full truncate whitespace-nowrap text-[9px] leading-none ${state === "next" || state === "today" ? "font-bold" : `font-medium ${muted}`}`}>{name(m)}</span>
              <span className={`max-w-full whitespace-nowrap text-[9px] leading-none tabular-nums ${state === "today" ? "font-semibold text-amber-700 dark:text-amber-400" : muted}`}>
                {prettyDate(m.date, { month: "short", day: "numeric" })}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] font-semibold leading-tight">
        {closed ? (
          "Closed"
        ) : next ? (
          <>
            <span className={`font-medium ${muted}`}>Next: </span>
            {next.label} <span className={next.state === "today" ? "text-amber-700 dark:text-amber-400" : muted}>· {inDays(next.days).toLowerCase()}</span>
          </>
        ) : (
          <span className={muted}>All dates have passed</span>
        )}
      </p>
    </div>
  );
}

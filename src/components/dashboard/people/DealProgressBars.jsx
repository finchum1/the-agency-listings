// The deal panel's checklist and document progress as two thin bars with their counts (the same look as the Mac app), in place of "Tasks 2/6 · Docs 3/5".
// Fills the whole row of the header's wrapping chips so the bars sit on their own line. Turns green once everything is done.
function Bar({ label, done, total }) {
  const pct = total ? Math.min(1, done / total) : 0;
  const complete = total > 0 && done === total;
  return (
    <div className="flex items-center gap-3">
      <span className="w-[4.75rem] shrink-0 text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{label}</span>
      <div className="h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-black/10 dark:bg-white/15" role="img" aria-label={`${label}: ${done} of ${total} done`}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${complete ? "bg-emerald-500" : "bg-[#1c1a17]/70 dark:bg-[#faf9f7]/70"}`} style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{done}/{total}</span>
    </div>
  );
}

export default function DealProgressBars({ summary }) {
  if (!summary.loaded || (summary.tasksTotal === 0 && summary.docsTotal === 0)) return null;
  return (
    <div className="basis-full space-y-1.5 pt-1">
      {summary.tasksTotal > 0 && <Bar label="Checklist" done={summary.tasksDone} total={summary.tasksTotal} />}
      {summary.docsTotal > 0 && <Bar label="Documents" done={summary.docsDone} total={summary.docsTotal} />}
    </div>
  );
}

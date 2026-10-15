// Small circular progress indicator with the percentage in the middle; turns green once everything is done.
// Used large in the Tasks / Documents cards inside a deal, and small on the Transactions board cards.
export default function ProgressRing({ done, total, size = 44, stroke = 5, textClass = "text-[11px]" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  const complete = total > 0 && done === total;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} complete`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-black/10 dark:stroke-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={`transition-[stroke-dashoffset] duration-500 ${complete ? "stroke-emerald-500" : "stroke-[#ed2127] dark:stroke-[#f2454b]"}`}
        />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center font-semibold tabular-nums ${textClass}`}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

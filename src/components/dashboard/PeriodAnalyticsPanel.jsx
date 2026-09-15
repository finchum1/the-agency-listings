import { useMemo, useState } from "react";
import { usePeriodAnalytics } from "../../hooks/usePeriodAnalytics";
import { dayLabel, shortDateLabel, monthLabel, weekRangeLabel } from "../../lib/periodBuckets";

// One combined Analytics section: the all-time/30d totals (`totals`,
// same shape AnalyticsStats.jsx renders standalone for the Listings
// module's portfolio-wide aggregate — kept as a separate component
// there, since that page deliberately has no navigable chart) up top,
// a divider, then the navigable Weekly (7 daily bars for one week) /
// Monthly (that month's weekly bars) chart below — back/forward paging
// and a "Today" shortcut back to the current period, forward capped
// there since there's nothing to show beyond "now". Previously two
// separate bordered cards stacked on top of each other; merged into one
// per feedback, since they were really one feature (site/listing
// activity) split into two pieces of chrome. Used on an individual
// listing's edit page, the agent site editor, and the brokerage site
// editor.
export default function PeriodAnalyticsPanel({
  totals,
  viewSources,
  leadSources,
  viewsLabel = "Views",
  leadsLabel = "Leads",
}) {
  const [mode, setMode] = useState("week"); // "week" | "month"
  const [offset, setOffset] = useState(0); // periods back from current; 0 = now

  const period = usePeriodAnalytics({ viewSources, leadSources, mode, offset });

  const switchMode = (next) => {
    if (next === mode) return;
    setMode(next);
    setOffset(0);
  };

  const periodLabel = useMemo(() => {
    if (period.buckets.length === 0) return "";
    const first = period.buckets[0].start;
    const lastEnd = period.buckets[period.buckets.length - 1].end;
    return mode === "month" ? monthLabel(first) : weekRangeLabel(first, lastEnd);
  }, [period.buckets, mode]);

  if (totals.loading || period.loading) {
    return (
      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mb-6 h-[380px] animate-pulse" />
    );
  }

  const totalsCells = [
    { label: viewsLabel, value: totals.views },
    { label: `${viewsLabel} (30d)`, value: totals.views30d },
    { label: leadsLabel, value: totals.leads },
    { label: `${leadsLabel} (30d)`, value: totals.leads30d },
  ];

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mb-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {totalsCells.map((c) => (
          <div key={c.label}>
            <p className="text-2xl font-display font-semibold">{c.value.toLocaleString()}</p>
            <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-1">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-black/5 dark:border-white/10 pt-4 flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-sm font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70">Analytics</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffset(0)}
            disabled={offset === 0}
            className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-30 disabled:hover:text-[#1c1a17]/50 dark:disabled:hover:text-[#faf9f7]/50 disabled:cursor-not-allowed"
          >
            Today
          </button>
          <div className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5 text-xs font-medium">
            {["week", "month"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`px-3 py-1 rounded-full capitalize transition-colors ${
                  mode === m
                    ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white"
                    : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          aria-label={`Previous ${mode}`}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-[#1c1a17]/70 dark:text-[#faf9f7]/70 text-center">{periodLabel}</p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          aria-label={`Next ${mode}`}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-6">
        <div>
          <p className="text-xl font-display font-semibold">{period.totalViews.toLocaleString()}</p>
          <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {viewsLabel}
          </p>
        </div>
        <div>
          <p className="text-xl font-display font-semibold">{period.totalLeads.toLocaleString()}</p>
          <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {leadsLabel}
          </p>
        </div>
      </div>

      <PeriodBarRow label={viewsLabel} buckets={period.buckets} field="views" mode={mode} />
      <PeriodBarRow label={leadsLabel} buckets={period.buckets} field="leads" mode={mode} />
    </div>
  );
}

function PeriodBarRow({ label, buckets, field, mode }) {
  const max = Math.max(1, ...buckets.map((b) => b[field]));
  const now = Date.now();
  const barLabel = (d) => (mode === "month" ? shortDateLabel(d) : dayLabel(d));

  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-1.5">
        {label} / {mode === "month" ? "week" : "day"}
      </p>
      <div className="flex items-end gap-1 h-16">
        {buckets.map((b, i) => {
          const value = b[field];
          const heightPct = value === 0 ? 3 : Math.max(6, (value / max) * 100);
          // Only the bucket actually containing "now" gets the accent
          // highlight — with paging, the last bar in view isn't
          // necessarily current anymore (e.g. a past week/month).
          const isNow = now >= b.start.getTime() && now < b.end.getTime();
          return (
            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end min-w-0">
              <span className="text-[9px] leading-tight tabular-nums text-[#1c1a17]/45 dark:text-[#faf9f7]/45 mb-0.5">
                {value.toLocaleString()}
              </span>
              <div
                title={`${barLabel(b.start)}: ${value.toLocaleString()}`}
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t-[2px] ${
                  isNow ? "bg-[#ed2127] dark:bg-[#f2454b]" : "bg-[#1c1a17]/15 dark:bg-[#faf9f7]/20"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex mt-1 text-[9px] text-[#1c1a17]/35 dark:text-[#faf9f7]/35">
        {buckets.map((b, i) => (
          <span key={i} className="flex-1 text-center truncate">
            {barLabel(b.start)}
          </span>
        ))}
      </div>
    </div>
  );
}

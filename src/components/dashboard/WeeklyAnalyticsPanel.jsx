import { weekLabel } from "../../lib/weeklyBuckets";

// Trend companion to AnalyticsStats' all-time/30d totals — a rolling-7-day
// pair of stat cards (same visual language) plus an 8-week bar chart, so
// "is this actually working" is answerable at a glance instead of just a
// running total. Fed by useWeeklyAnalytics; used on an individual
// listing's edit page, the agent site editor, and the brokerage site
// editor — deliberately NOT on the Listings module's portfolio-wide
// aggregate, which stays a simple running total.
export default function WeeklyAnalyticsPanel({ weekly, viewsLabel = "Views", leadsLabel = "Leads" }) {
  if (weekly.loading) {
    return (
      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mb-6 h-[220px] animate-pulse" />
    );
  }

  const { weeks, views7d, leads7d } = weekly;
  const maxViews = Math.max(1, ...weeks.map((w) => w.views));
  const maxLeads = Math.max(1, ...weeks.map((w) => w.leads));

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mb-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="font-display text-sm font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70">
          Weekly Trend
        </h3>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xl font-display font-semibold">{views7d.toLocaleString()}</p>
            <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              {viewsLabel} (7d)
            </p>
          </div>
          <div>
            <p className="text-xl font-display font-semibold">{leads7d.toLocaleString()}</p>
            <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              {leadsLabel} (7d)
            </p>
          </div>
        </div>
      </div>

      <WeekBarRow label={viewsLabel} weeks={weeks} field="views" max={maxViews} />
      <WeekBarRow label={leadsLabel} weeks={weeks} field="leads" max={maxLeads} />
    </div>
  );
}

function WeekBarRow({ label, weeks, field, max }) {
  const barWidth = 100 / weeks.length;
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-1.5">
        {label} / week
      </p>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-10">
        {weeks.map((w, i) => {
          const value = w[field];
          const height = value === 0 ? 1 : Math.max(2, (value / max) * 30);
          return (
            <rect
              key={i}
              x={i * barWidth + barWidth * 0.15}
              y={32 - height}
              width={barWidth * 0.7}
              height={height}
              rx="0.6"
              className={
                i === weeks.length - 1
                  ? "fill-[#ed2127] dark:fill-[#f2454b]"
                  : "fill-[#1c1a17]/15 dark:fill-[#faf9f7]/20"
              }
            >
              <title>
                {weekLabel(w.start)}: {value.toLocaleString()}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-[#1c1a17]/35 dark:text-[#faf9f7]/35">
        <span>{weekLabel(weeks[0].start)}</span>
        <span>{weekLabel(weeks[weeks.length - 1].start)}</span>
      </div>
    </div>
  );
}

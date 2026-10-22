import { formatDuration, pct, placeLabel, sourceLabel } from "../../lib/listingAnalytics";

// The analytics body shared by the dashboard's listing analytics page and the seller report: one listing's numbers for a
// period (see listing_analytics() in supabase/people-module.sql). Takes the JSON that function returns.
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5";
const eyebrow = "text-[11px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";

function Stat({ label, value, hint }) {
  return (
    <div className={card}>
      <p className="text-2xl font-display font-semibold tabular-nums">{value}</p>
      <p className={`${eyebrow} mt-1`}>{label}</p>
      {hint && <p className={`text-xs mt-1 ${muted}`}>{hint}</p>}
    </div>
  );
}

function BarList({ rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className={`text-sm ${muted}`}>{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className={`shrink-0 tabular-nums ${muted}`}>{r.note ?? r.value.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10">
            <div className="h-full rounded-full bg-[#1c1a17] dark:bg-[#f2454b]" style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Trend({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.views));
  const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const every = Math.max(1, Math.ceil(daily.length / 6));
  return (
    <div>
      <div className="flex items-end gap-[2px] h-36" role="img" aria-label="Views per day">
        {daily.map((d) => (
          <div key={d.day} className="flex-1 h-full flex items-end min-w-0" title={`${fmt(d.day)}: ${d.views} view${d.views === 1 ? "" : "s"}, ${d.visitors} visitor${d.visitors === 1 ? "" : "s"}`}>
            <div className="w-full rounded-t-[2px] bg-[#1c1a17]/80 dark:bg-[#f2454b]" style={{ height: `${d.views === 0 ? 2 : Math.max(5, (d.views / max) * 100)}%`, opacity: d.views === 0 ? 0.2 : 1 }} />
          </div>
        ))}
      </div>
      <div className={`mt-1.5 flex text-[10px] ${muted}`}>
        {daily.map((d, i) => (
          <span key={d.day} className="flex-1 min-w-0 text-center whitespace-nowrap overflow-visible">
            {i % every === 0 ? fmt(d.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const SECTION_LABELS = { facts: "Saw the key facts", overview: "Read the overview", gallery: "Reached the photo gallery", features: "Looked at features", location: "Looked at the map", contact: "Reached the contact form" };

export default function ListingAnalyticsView({ data, loading }) {
  if (loading || !data) return <div className={`${card} h-64 animate-pulse`} />;
  const e = data.engagement;
  const tracked = data.tracked_views;
  const rangeDays = data.days;
  const sinceNote = data.detail_since && tracked < data.views;

  const sources = data.sources.map((s) => ({ label: sourceLabel(s.source), value: s.views, note: `${s.views.toLocaleString()} · ${pct(s.views, data.views)}%` }));
  const devices = data.devices.map((d) => ({ label: d.device === "unknown" ? "Not recorded" : d.device.charAt(0).toUpperCase() + d.device.slice(1), value: d.views, note: `${pct(d.views, data.views)}%` }));
  const places = data.locations.map((l) => ({ label: placeLabel(l) || "Unknown", value: l.views, note: l.views.toLocaleString() }));
  const funnel = ["facts", "gallery", "features", "location", "contact"]
    .filter((k) => k in e.sections || tracked > 0)
    .map((k) => ({ label: SECTION_LABELS[k], value: e.sections[k] || 0, note: `${pct(e.sections[k] || 0, tracked)}%` }));
  const actions = [
    { label: "Opened a photo", value: e.gallery_opens, note: `${pct(e.gallery_opens, tracked)}%` },
    { label: "Tapped the agent's phone number", value: e.phone_clicks, note: `${pct(e.phone_clicks, tracked)}%` },
    { label: "Tapped the agent's email", value: e.email_clicks, note: `${pct(e.email_clicks, tracked)}%` },
    { label: "Started the inquiry form", value: e.form_starts, note: `${pct(e.form_starts, tracked)}%` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Views" value={data.views.toLocaleString()} />
        <Stat label="Unique visitors" value={data.visitors.toLocaleString()} hint={data.returning ? `${data.returning} came back` : undefined} />
        <Stat label="Avg. time on page" value={formatDuration(data.avg_duration)} />
        <Stat label="Avg. scroll depth" value={data.avg_depth == null ? "—" : `${data.avg_depth}%`} />
        <Stat label="Inquiries" value={data.leads.toLocaleString()} hint={data.visitors ? `${pct(data.leads, data.visitors)}% of visitors` : undefined} />
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-base font-semibold">Views by day</h3>
          <span className={`text-xs ${muted}`}>{rangeDays > 90 ? "Last 90 days" : `Last ${rangeDays} days`}</span>
        </div>
        <Trend daily={data.daily} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="font-display text-base font-semibold mb-3">Where visitors came from</h3>
          <BarList rows={sources} empty="No visits in this period yet." />
          {data.referrers.length > 0 && (
            <p className={`mt-3 text-xs ${muted}`}>Other websites: {data.referrers.map((r) => `${r.referrer_host} (${r.views})`).join(", ")}</p>
          )}
        </div>
        <div className={card}>
          <h3 className="font-display text-base font-semibold mb-3">Devices</h3>
          <BarList rows={devices} empty="No visits in this period yet." />
          <h3 className="font-display text-base font-semibold mt-6 mb-3">Top locations</h3>
          <BarList rows={places} empty="Locations appear as new visits come in." />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="font-display text-base font-semibold mb-1">How far visitors got</h3>
          <p className={`text-xs mb-3 ${muted}`}>Share of visits that reached each part of the page.</p>
          <BarList rows={funnel} empty="Appears as new visits come in." />
        </div>
        <div className={card}>
          <h3 className="font-display text-base font-semibold mb-1">What visitors did</h3>
          <p className={`text-xs mb-3 ${muted}`}>
            {e.gallery_opens > 0 ? `Visitors who opened photos looked at about ${(e.photo_views / e.gallery_opens).toFixed(1)} on average.` : "Share of visits that took each action."}
          </p>
          <BarList rows={actions} empty="" />
        </div>
      </div>

      {sinceNote && (
        <p className={`text-xs ${muted}`}>
          Source, device, location and engagement details have been collected since {new Date(data.detail_since).toLocaleDateString()}; earlier views show up in the totals only.
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { useSiteAnalyticsRollup } from "../../hooks/useListingAnalytics";
import { RANGES, SITE_SHARE_CHANNELS, formatDuration, pct, placeLabel, siteUrl, sourceLabel } from "../../lib/listingAnalytics";
import { BarList, Stat, Trend, card, isWeekly, muted } from "./ListingAnalyticsView";
import TrackedLinks from "./TrackedLinks";

const PAGE_LABELS = { home: "Home", about: "About", listings: "Listings", areas: "Areas", area: "Area pages", blog: "Blog list", contact: "Contact", post: "Blog posts" };
const SECTION_LABELS = { bio: "Read the bio", listings: "Looked at listings", areas: "Looked at areas", blog: "Saw the blog", contact: "Reached the contact form" };

function View({ data, loading }) {
  if (loading || !data) return <div className={`${card} h-64 animate-pulse`} />;
  const e = data.engagement;
  const tracked = data.tracked_visits;
  const sources = data.sources.map((s) => ({ label: sourceLabel(s.source), value: s.visits, note: `${s.visits.toLocaleString()} · ${pct(s.visits, tracked || data.visits)}%` }));
  const devices = data.devices.map((d) => ({ label: d.device === "unknown" ? "Not recorded" : d.device.charAt(0).toUpperCase() + d.device.slice(1), value: d.visits, note: `${pct(d.visits, data.visits)}%` }));
  const places = data.locations.map((l) => ({ label: placeLabel(l) || "Unknown", value: l.visits, note: l.visits.toLocaleString() }));
  const pages = data.pages.map((p) => ({ label: PAGE_LABELS[p.page] || p.page, value: p.views, note: `${p.views.toLocaleString()} · ${pct(p.views, data.views)}%` }));
  const posts = data.posts.map((p) => ({ label: p.title, value: p.views }));
  const funnel = Object.keys(SECTION_LABELS).map((k) => ({ label: SECTION_LABELS[k], value: e.sections[k] || 0, note: `${pct(e.sections[k] || 0, tracked)}%` }));
  const actions = [
    { label: "Tapped your phone number", value: e.phone_clicks },
    { label: "Tapped your email", value: e.email_clicks },
    { label: "Started the contact form", value: e.form_starts },
    { label: "Opened one of your listings", value: e.listing_clicks },
    { label: "Opened a blog post", value: e.blog_clicks },
    { label: "Clicked a social link", value: e.social_clicks },
  ].map((a) => ({ ...a, note: `${pct(a.value, tracked)}%` }));
  const sinceNote = data.detail_since && data.tracked_views < data.views;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Page views" value={data.views.toLocaleString()} />
        <Stat label="Unique visitors" value={data.visitors.toLocaleString()} hint={data.returning ? `${data.returning} came back` : undefined} />
        <Stat label="Visits" value={data.visits.toLocaleString()} hint={data.pages_per_visit ? `${data.pages_per_visit} pages per visit` : undefined} />
        <Stat label="Avg. visit length" value={formatDuration(data.avg_visit_secs)} />
        <Stat label="Inquiries" value={data.leads.toLocaleString()} hint={data.visitors ? `${pct(data.leads, data.visitors)}% of visitors` : undefined} />
      </div>

      <div className={card}>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="font-display text-base font-semibold">{isWeekly(data.daily) ? "Page views by week" : "Page views by day"}</h3>
          <span className={`text-xs ${muted}`}>{data.days > 90 ? "Last 90 days" : `Last ${data.days} days`}</span>
        </div>
        <Trend daily={data.daily} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="font-display text-base font-semibold mb-1">Where visitors came from</h3>
          <p className={`text-xs mb-3 ${muted}`}>Counted by visit, using how each visit started.</p>
          <BarList rows={sources} empty="Appears as new visits come in." />
          {data.referrers.length > 0 && <p className={`mt-3 text-xs ${muted}`}>Other websites: {data.referrers.map((r) => `${r.referrer_host} (${r.views})`).join(", ")}</p>}
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
          <h3 className="font-display text-base font-semibold mb-3">Most viewed pages</h3>
          <BarList rows={pages} empty="No page views in this period yet." />
          {posts.length > 0 && (
            <>
              <h3 className="font-display text-base font-semibold mt-6 mb-3">Top blog posts</h3>
              <BarList rows={posts} empty="" />
            </>
          )}
        </div>
        <div className="space-y-5">
          <div className={card}>
            <h3 className="font-display text-base font-semibold mb-1">How far visitors got</h3>
            <p className={`text-xs mb-3 ${muted}`}>Share of visits that reached each part of a page.</p>
            <BarList rows={funnel} empty="" />
          </div>
          <div className={card}>
            <h3 className="font-display text-base font-semibold mb-1">What visitors did</h3>
            <p className={`text-xs mb-3 ${muted}`}>Share of visits that took each action.</p>
            <BarList rows={actions} empty="" />
          </div>
        </div>
      </div>

      {sinceNote && (
        <p className={`text-xs ${muted}`}>Source, device, location and engagement details have been collected since {new Date(data.detail_since).toLocaleDateString()}; earlier views show up in the totals only.</p>
      )}
    </div>
  );
}

// The agent site's analytics: everything the public site can tell us about its visitors, plus tagged links for each place the
// address gets shared. Shown on the Analytics page of My Site, and in the admin editor for any agent's site.
export default function SiteAnalytics({ site }) {
  const [days, setDays] = useState(30);
  const { data, loading, error } = useSiteAnalyticsRollup(site.id, days);
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5 text-xs font-medium" role="group" aria-label="Time period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => setDays(r.days)} className={`px-3 py-1.5 rounded-full transition-colors ${days === r.days ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <View data={data} loading={loading} />}
      <TrackedLinks base={siteUrl(site)} channels={SITE_SHARE_CHANNELS} what="your website" />
      <p className={`text-xs ${muted}`}>Visits while you're signed in to the dashboard aren't counted, so checking your own site never inflates these numbers. Known search and link-preview bots are left out too.</p>
    </div>
  );
}

// Shared stat-card strip — used at the top of both the Listings module
// (aggregate across listings, see useListingsAnalytics) and the site
// editor (one agent site, see useSiteAnalytics). Same four numbers either
// way: all-time / last-30-days views and leads.
export default function AnalyticsStats({ stats, viewsLabel = "Views", leadsLabel = "Leads" }) {
  if (stats.loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-black/5 rounded-2xl p-5 h-[76px] animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: viewsLabel, value: stats.views },
    { label: `${viewsLabel} (30d)`, value: stats.views30d },
    { label: leadsLabel, value: stats.leads },
    { label: `${leadsLabel} (30d)`, value: stats.leads30d },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-black/5 rounded-2xl p-5">
          <p className="text-2xl font-display font-semibold">{c.value.toLocaleString()}</p>
          <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50 mt-1">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}

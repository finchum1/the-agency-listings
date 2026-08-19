// Shared filter bar for UpcomingListingsPage.jsx and BuyerNeedsPage.jsx —
// same dimensions on both (status, agent, price range, min beds/baths),
// only the status vocabulary and the filtering *predicate* differ (a
// buyer's price fields are their own budget range, matched by overlap;
// a listing's price is a single point, matched by min/max bounds — see
// each page's own useMemo). Filtering is entirely client-side: both
// tables are already fully loaded office-wide, so there's no pagination
// or query round-trip to avoid.
export default function FilterBar({
  statusLabels,
  statusColors,
  statusValue,
  onStatusChange,
  agents,
  agentValue,
  onAgentChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  minBeds,
  onMinBedsChange,
  minBaths,
  onMinBathsChange,
  onClear,
  hasActiveFilters,
}) {
  const fieldLabelClass = "block text-[10px] font-semibold uppercase tracking-wide text-[#1c1a17]/40 mb-1";
  const selectClass =
    "rounded-lg border border-black/10 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";
  const numberClass = `${selectClass} w-24`;
  const smallNumberClass = `${selectClass} w-16`;

  return (
    <div className="bg-white border border-black/5 rounded-2xl p-4 mb-4 flex flex-wrap items-end gap-x-5 gap-y-3">
      <div>
        <label className={fieldLabelClass}>Status</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
              statusValue === "all" ? "bg-[#1c1a17] text-white" : "bg-black/5 text-[#1c1a17]/70 hover:bg-black/10"
            }`}
          >
            All
          </button>
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onStatusChange(value)}
              style={
                statusValue === value
                  ? { background: statusColors[value], color: "#fff" }
                  : { background: "rgba(0,0,0,0.05)" }
              }
              className="text-xs font-semibold rounded-full px-3 py-1.5 transition-colors text-[#1c1a17]/70 hover:bg-black/10"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={fieldLabelClass}>Agent</label>
        <select value={agentValue} onChange={(e) => onAgentChange(e.target.value)} className={selectClass}>
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name || a.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={fieldLabelClass}>Min Price</label>
        <input
          type="number"
          min="0"
          value={minPrice}
          onChange={(e) => onMinPriceChange(e.target.value)}
          className={numberClass}
          placeholder="$"
        />
      </div>
      <div>
        <label className={fieldLabelClass}>Max Price</label>
        <input
          type="number"
          min="0"
          value={maxPrice}
          onChange={(e) => onMaxPriceChange(e.target.value)}
          className={numberClass}
          placeholder="$"
        />
      </div>
      <div>
        <label className={fieldLabelClass}>Min Beds</label>
        <input
          type="number"
          min="0"
          value={minBeds}
          onChange={(e) => onMinBedsChange(e.target.value)}
          className={smallNumberClass}
        />
      </div>
      <div>
        <label className={fieldLabelClass}>Min Baths</label>
        <input
          type="number"
          min="0"
          step="0.5"
          value={minBaths}
          onChange={(e) => onMinBathsChange(e.target.value)}
          className={smallNumberClass}
        />
      </div>

      {hasActiveFilters && (
        <button type="button" onClick={onClear} className="text-xs font-medium text-[#ed2127] hover:underline pb-2">
          Clear filters
        </button>
      )}
    </div>
  );
}

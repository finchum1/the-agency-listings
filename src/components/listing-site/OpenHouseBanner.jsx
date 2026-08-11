import { useListingContext } from "../../context/ListingContext";
import { formatDateTime } from "../../lib/format";

// New addition (no property-site-template precedent) — shows a slim banner
// when there's at least one upcoming open house.
export default function OpenHouseBanner() {
  const { openHouses } = useListingContext();
  const upcoming = (openHouses || []).filter((oh) => new Date(oh.starts_at) > new Date());

  if (upcoming.length === 0) return null;

  return (
    <section className="bg-[#8a7a5c] text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 py-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm font-medium">
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Open House{upcoming.length > 1 ? "s" : ""}
        </span>
        {upcoming.map((oh) => (
          <span key={oh.id} className="text-white/90">
            {formatDateTime(oh.starts_at)}
            {oh.ends_at ? ` – ${formatDateTime(oh.ends_at)}` : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

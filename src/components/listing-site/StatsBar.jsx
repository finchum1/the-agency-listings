import { useListingContext } from "../../context/ListingContext";
import { formatNumber } from "../../lib/format";

const icons = {
  beds: (
    <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V9a2 2 0 0 1 2-2h3v5M9 7h6" />
  ),
  baths: (
    <path d="M4 12h16M6 12V6a2 2 0 0 1 2-2h1M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M9 18v2M15 18v2" />
  ),
  sqft: <path d="M4 4h7v7H4zM13 13h7v7h-7zM4 20h4M20 4h-4" />,
  lot: <path d="M4 20 20 4M4 4h6M4 4v6M14 20h6M20 20v-6" />,
  year: (
    <path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
  ),
  garage: <path d="M4 21V10l8-6 8 6v11M4 21h16M8 21v-6h8v6" />,
};

const stats = [
  { key: "beds", label: "Beds", value: (f) => f.beds ?? "—" },
  { key: "baths", label: "Baths", value: (f) => f.baths ?? "—" },
  { key: "sqft", label: "Sq Ft", value: (f) => formatNumber(f.sqft) },
  { key: "lot", label: "Lot Size", value: (f) => f.lotSize },
  { key: "year", label: "Year Built", value: (f) => f.yearBuilt },
  { key: "garage", label: "Garage", value: (f) => f.garage },
];

export default function StatsBar() {
  const { listing } = useListingContext();
  const f = listing.quickFacts;

  return (
    <section id="facts" className="relative z-20 -mt-14 px-6 lg:px-10">
      <div className="mx-auto max-w-6xl bg-white rounded-2xl shadow-xl shadow-black/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-black/5">
        {stats.map((s) => (
          <div key={s.key} className="flex flex-col items-center justify-center gap-2 py-7 px-4 text-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8a7a5c" strokeWidth="1.6">
              {icons[s.key]}
            </svg>
            <span className="text-lg font-semibold text-[#1c1a17]">{s.value(f)}</span>
            <span className="text-[11px] uppercase tracking-wider-plus text-[#1c1a17]/50">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useListingContext } from "../../../context/ListingContext";
import { stats, icons, CountUp } from "../StatsBar";

// Small pieces the split, mosaic and showcase layouts share. The sections they reuse as they are (gallery, map, contact form,
// open house banner) live in the parent folder.

export function Kicker({ children, className = "" }) {
  return <p className={`text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-accent)] ${className}`}>{children}</p>;
}

// "Active  ·  MLS# 12345" above the address.
export function StatusLine({ className = "" }) {
  const { listing } = useListingContext();
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="inline-flex items-center rounded-full bg-[var(--ls-accent)] px-3.5 py-1 text-[11px] font-semibold tracking-wider-plus uppercase text-white">
        {listing.status}
      </span>
      {listing.mlsNumber && <span className="text-xs tracking-wider-plus uppercase text-[var(--ls-text)]/55">{listing.mlsNumber}</span>}
    </div>
  );
}

// The six quick numbers (beds, baths, sq ft, lot, year, garage) as a ruled grid. The caller says how many columns.
export function StatCells({ className = "" }) {
  const { listing } = useListingContext();
  const f = listing.quickFacts;
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-[var(--ls-text)]/10 bg-[var(--ls-text)]/10 ${className}`}>
      {stats.map((s) => (
        <div key={s.key} className="flex flex-col items-center justify-center gap-1.5 bg-[var(--ls-bg)] px-3 py-5 text-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ls-accent)" strokeWidth="1.6" aria-hidden="true">
            {icons[s.key]}
          </svg>
          <span className="text-base font-semibold text-[var(--ls-text)]">
            <CountUp text={s.value(f)} year={s.key === "year"} />
          </span>
          <span className="text-[10.5px] uppercase tracking-wider-plus text-[var(--ls-text)]/50">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// Label / value rows: MLS number, type, year, lot, garage, status.
export function useFacts() {
  const { listing } = useListingContext();
  return [
    { label: "MLS #", value: listing.mlsNumber.replace("MLS# ", "") || "—" },
    { label: "Property Type", value: listing.quickFacts.propertyType || "—" },
    { label: "Year Built", value: listing.quickFacts.yearBuilt },
    { label: "Lot Size", value: listing.quickFacts.lotSize },
    { label: "Garage", value: listing.quickFacts.garage },
    { label: "Status", value: listing.status },
  ];
}

export function FactsList({ className = "" }) {
  const facts = useFacts();
  return (
    <dl className={`space-y-3 ${className}`}>
      {facts.map((f) => (
        <div key={f.label} className="flex items-center justify-between border-b border-[var(--ls-text)]/10 pb-3 text-sm last:border-0 last:pb-0">
          <dt className="text-[var(--ls-text)]/55">{f.label}</dt>
          <dd className="font-medium text-[var(--ls-text)]">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The "About this home" paragraphs.
export function AboutText({ className = "", lead = false }) {
  const { listing } = useListingContext();
  return (
    <div className={`space-y-5 leading-relaxed text-[15.5px] text-[var(--ls-text)]/75 ${className}`}>
      {listing.description.map((p, i) => (
        <p key={i} className={lead && i === 0 ? "font-display text-xl sm:text-[1.65rem] leading-snug text-[var(--ls-text)]" : ""}>
          {p}
        </p>
      ))}
    </div>
  );
}

// The feature groups (Interior, Exterior, ...) as checklists. `columns` is the class for how the groups sit side by side.
export function FeatureGroups({ columns = "sm:grid-cols-2" }) {
  const { listing } = useListingContext();
  if (!listing.features || listing.features.length === 0) return null;
  return (
    <div className={`grid gap-x-10 gap-y-9 ${columns}`}>
      {listing.features.map((group) => (
        <div key={group.category}>
          <h3 className="mb-4 font-display text-lg font-semibold text-[var(--ls-text)]">{group.category}</h3>
          <ul className="space-y-2.5">
            {group.items.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[var(--ls-text)]/75">
                <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ls-accent)" strokeWidth="2" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

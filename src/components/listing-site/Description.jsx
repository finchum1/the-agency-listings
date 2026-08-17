import { useListingContext } from "../../context/ListingContext";

export default function Description() {
  const { listing } = useListingContext();

  const facts = [
    { label: "MLS #", value: listing.mlsNumber.replace("MLS# ", "") || "—" },
    { label: "Property Type", value: listing.quickFacts.propertyType },
    { label: "Year Built", value: listing.quickFacts.yearBuilt },
    { label: "Lot Size", value: listing.quickFacts.lotSize },
    { label: "Garage", value: listing.quickFacts.garage },
    { label: "Status", value: listing.status },
  ];

  return (
    <section className="px-6 lg:px-10 py-24">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-3 gap-14">
        <div className="lg:col-span-2">
          <p className="text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-accent)] mb-3">
            About This Home
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold mb-6 text-[var(--ls-text)]">
            Thoughtfully designed, beautifully maintained
          </h2>
          <div className="space-y-5 text-[var(--ls-text)]/75 leading-relaxed text-[15.5px]">
            {listing.description.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div className="bg-[var(--ls-bg-alt)] rounded-2xl border border-black/5 p-8 h-fit">
          <h3 className="text-sm font-semibold tracking-wider-plus uppercase text-[var(--ls-text)]/60 mb-5">
            Quick Facts
          </h3>
          <dl className="space-y-4">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between text-sm border-b border-black/5 pb-3 last:border-0 last:pb-0">
                <dt className="text-[var(--ls-text)]/55">{f.label}</dt>
                <dd className="font-medium text-[var(--ls-text)]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

import { useListingContext } from "../../context/ListingContext";

export default function Features() {
  const { listing } = useListingContext();

  if (!listing.features || listing.features.length === 0) return null;

  return (
    <section id="features" className="px-6 lg:px-10 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-wider-plus uppercase text-[var(--ls-accent)] mb-3">
          Features
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold mb-12 text-[var(--ls-text)]">
          Everything this home has to offer
        </h2>

        <div className="grid md:grid-cols-3 gap-10">
          {listing.features.map((group) => (
            <div key={group.category}>
              <h3 className="text-lg font-semibold mb-5 font-display text-[var(--ls-text)]">
                {group.category}
              </h3>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--ls-text)]/75">
                    <svg
                      className="mt-0.5 shrink-0"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--ls-accent)"
                      strokeWidth="2"
                    >
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useListingContext } from "../../../context/ListingContext";
import { formatNumber, formatPrice } from "../../../lib/format";
import { HeroMedia } from "../Hero";
import OpenHouseBanner from "../OpenHouseBanner";
import Features from "../Features";
import Gallery from "../Gallery";
import LocationMap from "../LocationMap";
import AgentContact from "../AgentContact";
import { AboutText, Kicker, useFacts } from "./parts";

// "4 Beds · 3 Baths · 2,860 Sq Ft": the headline numbers as one quiet line under the address.
function FactsLine() {
  const { listing } = useListingContext();
  const f = listing.quickFacts;
  const parts = [
    f.beds != null && `${f.beds} Bed${f.beds === 1 ? "" : "s"}`,
    f.baths != null && `${f.baths} Bath${f.baths === 1 ? "" : "s"}`,
    f.sqft != null && `${formatNumber(f.sqft)} Sq Ft`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm uppercase tracking-wider-plus text-[var(--ls-text)]/70">
      {parts.map((p, i) => (
        <span key={p} className="flex items-center gap-5">
          {i > 0 && <span className="h-3 w-px bg-[var(--ls-text)]/25" aria-hidden="true" />}
          {p}
        </span>
      ))}
    </p>
  );
}

// Every detail as a spec sheet: small label over a large value, ruled underneath.
function SpecSheet() {
  const { listing } = useListingContext();
  const f = listing.quickFacts;
  const facts = useFacts();
  const rows = [
    { label: "Bedrooms", value: f.beds ?? "—" },
    { label: "Bathrooms", value: f.baths ?? "—" },
    { label: "Living Area", value: f.sqft != null ? `${formatNumber(f.sqft)} sq ft` : "—" },
    ...facts.filter((x) => x.label !== "Status"),
  ];
  return (
    <section className="px-6 py-20 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <Kicker className="mb-3">The Details</Kicker>
          <h2 className="text-3xl font-semibold text-[var(--ls-text)] sm:text-4xl">At a glance</h2>
        </div>
        <dl className="grid gap-x-12 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="border-b border-[var(--ls-text)]/12 py-6">
              <dt className="text-[11px] uppercase tracking-wider-plus text-[var(--ls-text)]/50">{r.label}</dt>
              <dd className="mt-1.5 font-display text-2xl font-semibold text-[var(--ls-text)]">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// Showcase: a quiet, centered, magazine-style page. A big address and price, one wide framed photo, a single narrow column of text, a
// full-width photo break, then the details as a spec sheet. Everything after that is the standard sections.
export default function ShowcaseLayout() {
  const { listing } = useListingContext();
  const breakPhoto = listing.images[1];

  return (
    <>
      <section id="overview" className="px-6 pt-32 text-center sm:pt-40 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[var(--ls-accent)] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider-plus text-white">{listing.status}</span>
            {listing.mlsNumber && <span className="text-xs uppercase tracking-wider-plus text-[var(--ls-text)]/55">{listing.mlsNumber}</span>}
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] text-[var(--ls-text)] sm:text-6xl lg:text-7xl">{listing.address.line1}</h1>
          <p className="mt-5 text-lg tracking-wide text-[var(--ls-text)]/60">
            {listing.address.city}, {listing.address.state} {listing.address.zip}
          </p>
          <div className="mx-auto my-8 h-px w-16 bg-[var(--ls-accent)]" aria-hidden="true" />
          <p className="font-display text-3xl font-semibold text-[var(--ls-text)] sm:text-4xl">{formatPrice(listing.price)}</p>
          <div className="mt-6">
            <FactsLine />
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href="#contact" className="rounded-full bg-[var(--ls-text)] px-7 py-3 text-sm font-semibold text-[var(--ls-bg)] transition-opacity hover:opacity-90">
              Schedule a Private Tour
            </a>
            {listing.agent.phone && (
              <a href={`tel:${listing.agent.phone}`} className="rounded-full border border-[var(--ls-text)]/25 px-7 py-3 text-sm font-semibold text-[var(--ls-text)] transition-colors hover:bg-[var(--ls-text)]/5">
                Call {listing.agent.phone}
              </a>
            )}
          </div>
        </div>

        <div className="relative mx-auto mt-14 aspect-[4/3] max-w-6xl overflow-hidden rounded-[1.75rem] shadow-2xl shadow-black/15 sm:aspect-[16/9] lg:aspect-[21/10]">
          <HeroMedia height="56.25vw" shade={false} />
        </div>
      </section>

      <div className="mt-14 empty:hidden">
        <OpenHouseBanner />
      </div>

      <section className="px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <Kicker className="mb-4 text-center">About This Home</Kicker>
          <AboutText lead />
        </div>
      </section>

      {breakPhoto && (
        <div className="relative h-[46vh] min-h-[280px] w-full overflow-hidden" aria-hidden="true">
          <img src={breakPhoto.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <SpecSheet />
      <Features />
      <Gallery />
      <LocationMap />
      <AgentContact />
    </>
  );
}

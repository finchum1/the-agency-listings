import { useListingContext } from "../../../context/ListingContext";
import { formatPrice } from "../../../lib/format";
import { HeroMedia } from "../Hero";
import OpenHouseBanner from "../OpenHouseBanner";
import Gallery from "../Gallery";
import LocationMap from "../LocationMap";
import AgentContact from "../AgentContact";
import { AboutText, FactsList, FeatureGroups, Kicker, StatCells, StatusLine } from "./parts";

// Split screen: the photo (or silent video) is pinned on the left for the whole read while everything about the home scrolls on the
// right. On a phone the photo sits on top and the story follows. The gallery, map and contact form run full width underneath.
// The header is always solid here, so the page starts below it.
export default function SplitLayout() {
  const { listing } = useListingContext();

  return (
    <>
      <div id="overview" className="pt-20 sm:pt-[5.5rem] lg:grid lg:grid-cols-2">
        <div className="relative h-[58vh] overflow-hidden lg:sticky lg:top-[5.5rem] lg:h-[calc(100vh-5.5rem)] lg:self-start">
          <HeroMedia height="100vh" shade={false} />
        </div>

        <div className="min-w-0 px-6 py-12 sm:px-10 lg:px-14 lg:py-16 xl:px-20">
          <StatusLine className="mb-5" />
          <h1 className="text-4xl font-semibold leading-tight text-[var(--ls-text)] sm:text-5xl">{listing.address.line1}</h1>
          <p className="mt-2 text-lg tracking-wide text-[var(--ls-text)]/60">
            {listing.address.city}, {listing.address.state} {listing.address.zip}
          </p>
          <p className="mt-6 font-display text-4xl font-semibold text-[var(--ls-text)]">{formatPrice(listing.price)}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#contact" className="rounded-full bg-[var(--ls-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Schedule a Private Tour
            </a>
            {listing.agent.phone && (
              <a href={`tel:${listing.agent.phone}`} className="rounded-full border border-[var(--ls-text)]/25 px-6 py-3 text-sm font-semibold text-[var(--ls-text)] transition-colors hover:bg-[var(--ls-text)]/5">
                Call {listing.agent.phone}
              </a>
            )}
          </div>

          <StatCells className="mt-10 grid-cols-2 sm:grid-cols-3" />

          <div className="mt-10 overflow-hidden rounded-xl empty:hidden">
            <OpenHouseBanner />
          </div>

          <div className="mt-14">
            <Kicker className="mb-3">About This Home</Kicker>
            <h2 className="mb-6 text-2xl font-semibold text-[var(--ls-text)] sm:text-3xl">Thoughtfully designed, beautifully maintained</h2>
            <AboutText />
          </div>

          <div className="mt-12 rounded-2xl border border-[var(--ls-text)]/10 bg-[var(--ls-bg-alt)] p-7">
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider-plus text-[var(--ls-text)]/60">Quick Facts</h3>
            <FactsList />
          </div>

          {listing.features?.length > 0 && (
            <div id="features" className="mt-14 scroll-mt-28">
              <Kicker className="mb-3">Features</Kicker>
              <h2 className="mb-8 text-2xl font-semibold text-[var(--ls-text)] sm:text-3xl">Everything this home has to offer</h2>
              <FeatureGroups columns="sm:grid-cols-2" />
            </div>
          )}
        </div>
      </div>

      <Gallery />
      <LocationMap />
      <AgentContact />
    </>
  );
}

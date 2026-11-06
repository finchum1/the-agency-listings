import { useListingContext } from "../../../context/ListingContext";
import { formatPrice } from "../../../lib/format";
import { HeroMedia } from "../Hero";
import OpenHouseBanner from "../OpenHouseBanner";
import Gallery, { openGallery } from "../Gallery";
import LocationMap from "../LocationMap";
import { AgentCard, InquiryForm } from "../AgentContact";
import { AboutText, FactsList, FeatureGroups, Kicker, StatCells, StatusLine } from "./parts";

// How the photo tiles sit in the mosaic for 1 to 5 photos: [grid classes, class for each tile in order]. The first tile is the lead.
// On a phone it is a single column (only the lead shows), so every class here starts at md.
const SHAPES = {
  1: ["md:grid-cols-1", ["md:col-span-1 md:row-span-1"]],
  2: ["md:grid-cols-2", ["", ""]],
  3: ["md:grid-cols-4 md:grid-rows-2", ["md:col-span-2 md:row-span-2", "md:col-span-2", "md:col-span-2"]],
  4: ["md:grid-cols-4 md:grid-rows-2", ["md:col-span-2 md:row-span-2", "md:col-span-2", "", ""]],
  5: ["md:grid-cols-4 md:grid-rows-2", ["md:col-span-2 md:row-span-2", "", "", "", ""]],
};

// Photos first: a big photo with up to four more beside it, "view all" opening the viewer, then the address and price, the numbers,
// and a main column with a contact card that follows you down the page. If the listing has a hero video it plays in the lead tile.
function Mosaic() {
  const { listing } = useListingContext();
  const images = listing.images;
  const hasVideo = !!(listing.heroVideo || listing.heroEmbed);
  if (images.length === 0 && !hasVideo) return null;

  const shown = images.slice(0, hasVideo ? 4 : 5);
  const count = Math.min(5, shown.length + (hasVideo ? 1 : 0));
  const [grid, tiles] = SHAPES[Math.max(1, count)];
  const tileBase = "group relative min-h-0 overflow-hidden bg-black/5";
  // The header's "Gallery" link lands here, unless there's a gallery video, whose own section takes that id.
  const anchor = listing.galleryVideo || listing.galleryEmbed ? undefined : "gallery";

  return (
    <div id={anchor} className="relative scroll-mt-28">
      <div className={`grid gap-2 overflow-hidden rounded-2xl h-[320px] grid-cols-1 sm:h-[440px] lg:h-[560px] ${grid}`}>
        {hasVideo && (
          <div className={`${tileBase} ${tiles[0]}`}>
            <HeroMedia height="40vw" shade={false} />
          </div>
        )}
        {shown.map((img, i) => {
          const slot = i + (hasVideo ? 1 : 0);
          return (
            <button
              key={img.url}
              type="button"
              onClick={() => openGallery(i)}
              aria-label={`Open photo ${i + 1} of ${images.length}`}
              // On a phone only the lead tile shows; the rest are one tap away under "View all".
              className={`${tileBase} ${tiles[slot]} ${slot === 0 ? "" : "hidden md:block"}`}
            >
              <img src={img.url} alt={img.alt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
            </button>
          );
        })}
      </div>
      {images.length > 0 && (
        <button
          type="button"
          onClick={() => openGallery(0)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-black shadow-lg transition-colors hover:bg-white"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" strokeLinejoin="round" />
          </svg>
          View all {images.length} photo{images.length === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

export default function MosaicLayout() {
  const { listing } = useListingContext();

  return (
    <>
      <div id="overview" className="mx-auto w-full max-w-7xl px-4 pt-24 sm:px-6 sm:pt-28 lg:px-10">
        <Mosaic />

        <div className="mt-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <StatusLine className="mb-4" />
            <h1 className="text-4xl font-semibold leading-tight text-[var(--ls-text)] sm:text-5xl">{listing.address.line1}</h1>
            <p className="mt-2 text-lg tracking-wide text-[var(--ls-text)]/60">
              {listing.address.city}, {listing.address.state} {listing.address.zip}
            </p>
          </div>
          <p className="font-display text-4xl font-semibold text-[var(--ls-text)] md:text-5xl">{formatPrice(listing.price)}</p>
        </div>

        <StatCells className="mt-8 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />

        <div className="mt-12 grid gap-12 pb-24 lg:grid-cols-3 lg:gap-14">
          <div className="min-w-0 lg:col-span-2">
            <div className="mb-10 overflow-hidden rounded-xl empty:hidden">
              <OpenHouseBanner />
            </div>

            <Kicker className="mb-3">About This Home</Kicker>
            <h2 className="mb-6 text-3xl font-semibold text-[var(--ls-text)] sm:text-4xl">Thoughtfully designed, beautifully maintained</h2>
            <AboutText />

            <div className="mt-12 rounded-2xl border border-[var(--ls-text)]/10 bg-[var(--ls-bg-alt)] p-7 sm:p-8">
              <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider-plus text-[var(--ls-text)]/60">Quick Facts</h3>
              <FactsList className="sm:grid sm:grid-cols-2 sm:gap-x-12 sm:gap-y-3 sm:space-y-0" />
            </div>

            {listing.features?.length > 0 && (
              <div id="features" className="mt-14 scroll-mt-28">
                <Kicker className="mb-3">Features</Kicker>
                <h2 className="mb-8 text-3xl font-semibold text-[var(--ls-text)] sm:text-4xl">Everything this home has to offer</h2>
                <FeatureGroups columns="sm:grid-cols-2" />
              </div>
            )}
          </div>

          <aside id="contact" className="scroll-mt-28 space-y-4 lg:sticky lg:top-28 lg:self-start">
            <div>
              <Kicker className="mb-2">Contact</Kicker>
              <h2 className="text-2xl font-semibold text-[var(--ls-text)]">Interested in {listing.address.line1}?</h2>
            </div>
            <AgentCard />
            <InquiryForm compact />
          </aside>
        </div>
      </div>

      {/* The photos are in the mosaic above, so this renders just the photo viewer (and the gallery video, if there is one). */}
      <Gallery lightboxOnly />
      <LocationMap />
    </>
  );
}

import { useListingContext } from "../../context/ListingContext";

export default function LocationMap() {
  const { listing } = useListingContext();
  const embedSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    listing.map.query
  )}&z=14&output=embed`;

  return (
    <section id="location" className="px-6 lg:px-10 py-24 bg-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#8a7a5c] mb-3">
          Location
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold mb-6">
          {listing.address.city}, {listing.address.state}
        </h2>
        <p className="text-[#1c1a17]/70 max-w-2xl mb-10 leading-relaxed text-[15.5px]">
          Located in a sought-after neighborhood close to top-rated schools, parks, and
          everyday conveniences — with easy access to major commuter routes.
        </p>

        <div className="rounded-2xl overflow-hidden border border-black/5 shadow-sm">
          <iframe
            title="Property location map"
            src={embedSrc}
            width="100%"
            height="420"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

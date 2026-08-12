import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { formatPrice, STATUS_LABELS } from "../../lib/format";

export default function FeaturedListings() {
  const { site } = useAgentSiteContext();
  if (site.listings.length === 0) return null;

  return (
    <section id="listings" className="px-6 lg:px-10 py-24 bg-white border-y border-black/5">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#8a7a5c] mb-3">
          Portfolio
        </p>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-10">Featured Properties</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {site.listings.map((listing) => (
            <a key={listing.id} href={`/listings/${listing.slug}`} className="group block">
              <div className="relative rounded-2xl overflow-hidden bg-black/5 aspect-[4/3]">
                {listing.hero_photo_url && (
                  <img
                    src={listing.hero_photo_url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
                <span className="absolute top-4 left-4 bg-[#1c1a17] text-white text-[10px] font-semibold tracking-wider-plus uppercase px-3 py-1.5 rounded-full">
                  {STATUS_LABELS[listing.status] || listing.status}
                </span>
              </div>
              <p className="mt-4 font-medium">{listing.address_line1}</p>
              <p className="text-sm text-[#1c1a17]/60">
                {listing.city}, {listing.state} {listing.zip}
              </p>
              <p className="mt-1 text-sm text-[#1c1a17]/50">
                {listing.beds} bd | {listing.baths} ba | {listing.sqft?.toLocaleString()} sqft
              </p>
              <p className="mt-1 font-display text-lg text-[#8a7a5c]">{formatPrice(listing.price)}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

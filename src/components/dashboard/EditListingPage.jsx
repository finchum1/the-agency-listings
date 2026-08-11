import { useParams, Link } from "react-router-dom";
import { useListing } from "../../hooks/useListing";
import ListingForm from "./ListingForm";
import PhotoManager from "./PhotoManager";
import OpenHouseManager from "./OpenHouseManager";

export default function EditListingPage() {
  const { id } = useParams();
  const { listing, photos, openHouses, loading, notFound, refresh } = useListing({ id });

  if (loading) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;
  if (notFound) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 mb-4">
          Listing not found, or you don't have access to it.
        </p>
        <Link to="/dashboard" className="text-sm text-[#8a7a5c] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold">{listing.address_line1}</h1>
        {listing.status !== "draft" && (
          <a
            href={`/listings/${listing.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#8a7a5c] hover:underline"
          >
            View live site →
          </a>
        )}
      </div>

      <ListingForm mode="edit" listing={listing} onSaved={refresh} />
      <PhotoManager listingId={listing.id} photos={photos} onChanged={refresh} />
      <OpenHouseManager listingId={listing.id} openHouses={openHouses} onChanged={refresh} />
    </div>
  );
}

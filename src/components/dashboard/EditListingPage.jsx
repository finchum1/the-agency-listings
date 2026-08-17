import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListing } from "../../hooks/useListing";
import { useListingsAnalytics } from "../../hooks/useListingsAnalytics";
import ListingForm from "./ListingForm";
import PhotoManager from "./PhotoManager";
import OpenHouseManager from "./OpenHouseManager";
import AnalyticsStats from "./AnalyticsStats";

export default function EditListingPage() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { listing, photos, openHouses, loading, notFound, refresh } = useListing({ id });

  // Reuses the same aggregate hook as the Listings module's stats strip,
  // just scoped to this one listing (a single-id array is a valid input).
  const listingIds = useMemo(() => (listing ? [listing.id] : []), [listing]);
  const analytics = useListingsAnalytics(listingIds);

  // RLS lets anyone read a *published* listing by id (same policy that
  // powers the public /listings/:slug page — see useListings.js), so a
  // non-owning agent could otherwise open another agent's edit page
  // directly by URL and read it, even though saving would still be
  // correctly blocked by the update policy. Treated identically to
  // notFound — no hint that a listing exists there at all.
  const noAccess = listing && !isAdmin && listing.agent_id !== user?.id;

  if (loading) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;
  if (notFound || noAccess) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 mb-4">
          Listing not found, or you don't have access to it.
        </p>
        <Link to="/dashboard" className="text-sm text-[#ed2127] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold">{listing.address_line1}</h1>
        <div className="flex items-center gap-4">
          <Link to={`/dashboard/listings/${listing.id}/flyer`} className="text-sm text-[#ed2127] hover:underline">
            Flyer →
          </Link>
          {listing.status !== "draft" && (
            <a
              href={`/listings/${listing.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#ed2127] hover:underline"
            >
              View live site →
            </a>
          )}
        </div>
      </div>

      <AnalyticsStats stats={analytics} />

      <ListingForm mode="edit" listing={listing} onSaved={refresh} />
      <PhotoManager listingId={listing.id} photos={photos} onChanged={refresh} />
      <OpenHouseManager listingId={listing.id} openHouses={openHouses} onChanged={refresh} />
    </div>
  );
}

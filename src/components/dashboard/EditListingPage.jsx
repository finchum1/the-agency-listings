import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListing } from "../../hooks/useListing";
import { useListingsAnalytics } from "../../hooks/useListingsAnalytics";
import ListingForm from "./ListingForm";
import PhotoManager from "./PhotoManager";
import HeroScrollPhotosManager from "./HeroScrollPhotosManager";
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

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;
  if (notFound || noAccess) {
    return (
      <div>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-4">
          Listing not found, or you don't have access to it.
        </p>
        <Link to="/dashboard/listings" className="text-sm text-[#ed2127] dark:text-[#f2454b] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  // A plain text link read as too subtle for "Flyer"/"View live site" --
  // an outlined accent pill matches the weight of an actual action
  // without competing with the page's primary ink-fill buttons.
  const pillLinkClass =
    "rounded-full border border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b] text-xs font-semibold px-4 py-2 hover:bg-[#ed2127] dark:hover:bg-[#f2454b] hover:text-white dark:hover:text-white transition-colors";

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold">{listing.address_line1}</h1>
        <div className="flex items-center gap-3">
          <Link to={`/dashboard/listings/${listing.id}/flyer`} className={pillLinkClass}>
            Flyer
          </Link>
          {listing.status !== "draft" && (
            <a href={`/listings/${listing.slug}`} target="_blank" rel="noopener noreferrer" className={pillLinkClass}>
              View live site
            </a>
          )}
        </div>
      </div>

      <AnalyticsStats stats={analytics} />

      <ListingForm mode="edit" listing={listing} onSaved={refresh} />
      <PhotoManager listingId={listing.id} photos={photos} onChanged={refresh} />
      {listing.site_template === "luxury" && (
        <HeroScrollPhotosManager listingId={listing.id} photos={photos} onChanged={refresh} />
      )}
      <OpenHouseManager listingId={listing.id} openHouses={openHouses} onChanged={refresh} />
    </div>
  );
}

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptListing } from "../lib/adaptListing";
import { buildListingMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta } from "../lib/pageMeta";
import { ListingProvider } from "../context/ListingContext";

import Navbar from "../components/listing-site/Navbar";
import Hero from "../components/listing-site/Hero";
import StatsBar from "../components/listing-site/StatsBar";
import OpenHouseBanner from "../components/listing-site/OpenHouseBanner";
import Description from "../components/listing-site/Description";
import Gallery from "../components/listing-site/Gallery";
import Features from "../components/listing-site/Features";
import LocationMap from "../components/listing-site/LocationMap";
import AgentContact from "../components/listing-site/AgentContact";
import Footer from "../components/listing-site/Footer";

// Shared rendering for a single listing's public site — used both at
// /listings/:slug (PublicListingPage.jsx) and when a request arrives on a
// listing's own attached custom domain (CustomDomainSitePage.jsx).
// Takes the raw shape returned by useListing().
export default function ListingSitePage({ listing, agent, photos, openHouses, loading, notFound }) {
  const adapted = listing ? adaptListing({ listing, agent, photos }) : null;

  useEffect(() => {
    if (!listing) return;
    const heroPhoto = photos?.find((p) => p.is_hero)?.url || photos?.[0]?.url || "";
    const meta = buildListingMeta(listing, agent, heroPhoto);
    applyPageMeta({ ...meta, url: `${SITE_ORIGIN}/listings/${listing.slug}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing, agent, photos]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <p className="text-[#1c1a17]/40 text-sm">Loading…</p>
      </div>
    );
  }

  if (notFound || !adapted) {
    return <Navigate to="/404" replace />;
  }

  return (
    <ListingProvider value={{ listing: adapted, openHouses, listingId: listing.id }}>
      <div className="min-h-screen bg-[#faf9f7]">
        <Navbar />
        <Hero />
        <StatsBar />
        <OpenHouseBanner />
        <Description />
        <Gallery />
        <Features />
        <LocationMap />
        <AgentContact />
        <Footer />
      </div>
    </ListingProvider>
  );
}

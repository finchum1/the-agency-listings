import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { adaptListing } from "../lib/adaptListing";
import { buildListingMeta, SITE_ORIGIN } from "../lib/seo";
import { applyPageMeta, applyStructuredData } from "../lib/pageMeta";
import { buildListingSchema } from "../lib/structuredData";
import { isAppHost } from "../lib/appHosts";
import { trackView } from "../lib/trackView";
import { ListingProvider } from "../context/ListingContext";

import Navbar from "../components/listing-site/Navbar";
import Hero from "../components/listing-site/Hero";
import LuxuryHero from "../components/listing-site/LuxuryHero";
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
    // Self-canonical wherever this is actually being viewed — the app
    // host's own /listings/:slug URL there, or the listing's own custom
    // domain root there (a listing site has never been more than one
    // page — see CustomDomainSitePage.jsx). Previously this always
    // pointed at the app-host URL even when viewed via a listing's own
    // attached custom domain, which told search engines the custom
    // domain's copy was a duplicate and suppressed IT from being
    // indexed on its own — the same class of bug already fixed for
    // agent sites (see AgentSitePage.jsx).
    const url = isAppHost(window.location.hostname)
      ? `${SITE_ORIGIN}/listings/${listing.slug}`
      : `${window.location.origin}/`;
    applyPageMeta({ ...meta, url });
    applyStructuredData(
      buildListingSchema({
        url,
        address1: listing.address_line1,
        city: listing.city,
        state: listing.state,
        zip: listing.zip,
        price: listing.price,
        status: listing.status,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        description: (listing.description || []).join(" ") || undefined,
        images: (photos || []).map((p) => p.url),
        datePosted: listing.created_at,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing, agent, photos]);

  // Separate effect, keyed only on the id, so a re-render (e.g. from a
  // realtime update to the listing) never fires a second view for the
  // same visit.
  useEffect(() => {
    if (listing?.id) trackView("listing", listing.id);
  }, [listing?.id]);

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

  // Luxury is a fixed, non-customizable look — its own theme + font
  // pairing, hardcoded here rather than offered through the regular
  // picker (see ListingForm.jsx and index.css's own comments on
  // [data-theme="luxury"]). Every other section (StatsBar, Description,
  // Gallery, etc.) is unchanged — same components, just re-skinned by
  // the luxury CSS variables, same as any other theme.
  const isLuxury = adapted.siteTemplate === "luxury";

  return (
    <ListingProvider value={{ listing: adapted, openHouses, listingId: listing.id }}>
      <div
        className="min-h-screen bg-[var(--ls-bg)] font-ls-sans"
        data-theme={isLuxury ? "luxury" : adapted.theme}
        data-font={isLuxury ? "bodoni-manrope" : adapted.fontPairing}
        style={!isLuxury && adapted.accentColor ? { "--ls-accent": adapted.accentColor } : undefined}
      >
        <Navbar />
        {isLuxury ? <LuxuryHero /> : <Hero />}
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

import { brandFromOrg } from "./brand";
import { parseVideoLink } from "./videoEmbed";
import { STATUS_LABELS } from "./format";

// Shapes a Supabase `listings` row (+ agent profile + photos) into the
// exact object shape property-site-template/src/data/listing.js used to
// export statically, so the ported site components need almost no changes.
export function adaptListing({ listing, agent, photos }) {
  const brokerage = brandFromOrg(listing.org);
  const mlsNumber = listing.mls_number ? `MLS# ${listing.mls_number}` : "";

  return {
    brand: {
      name: listing.address_line1,
      tagline: `${agent?.full_name || brokerage.name} — ${brokerage.name}`,
    },
    // logo_variant picks among brokerage.logos (red/white/black) — falls
    // back to the default red mark for older listings saved before this
    // existed, or an unrecognized value. Mirrors adaptAgentSite.js. The
    // Red template forces white regardless of that pick: its header/
    // footer background is the literal Agency Red (--ls-dark), so a red-
    // or black-variant mark would have much weaker contrast against its
    // own matching/near-matching background.
    brokerage: {
      ...brokerage,
      logo: listing.theme === "red" ? (brokerage.logos.white || brokerage.logo) : brokerage.logos[listing.logo_variant] || brokerage.logo,
    },
    siteTemplate: listing.site_template || "classic",
    // "classic" (flush full-width bar) or "floating" (clear at the top, a detached rounded pill once scrolled).
    headerStyle: listing.header_style === "floating" ? "floating" : "classic",
    // Optional short text beside the logo in the header (a neighborhood or city), typed in the back office.
    headerLabel: (listing.header_label || "").trim(),
    theme: listing.theme || "classic",
    fontPairing: listing.font_pairing || "playfair-jost",
    accentColor: listing.accent_color || "",
    status: STATUS_LABELS[listing.status] || listing.status,
    mlsNumber,
    address: {
      line1: listing.address_line1,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
    },
    price: listing.price,
    quickFacts: {
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      lotSize: listing.lot_size || "—",
      yearBuilt: listing.year_built || "—",
      garage: listing.garage || "—",
      propertyType: listing.property_type,
    },
    description: listing.description || [],
    features: listing.features || [],
    images: (photos || []).map((p) => ({ url: p.url, alt: p.alt, caption: p.caption })),
    // Curated, ordered subset for the Luxury template's no-video scroll
    // sequence (see LuxuryHero.jsx / HeroScrollPhotosManager.jsx) —
    // independent of `images`' own gallery order.
    heroScrollPhotos: (photos || [])
      .filter((p) => p.hero_scroll_order != null)
      .sort((a, b) => a.hero_scroll_order - b.hero_scroll_order)
      .map((p) => ({ url: p.url, alt: p.alt })),
    map: {
      query: `${listing.address_line1}, ${listing.city}, ${listing.state} ${listing.zip}`,
    },
    // One video file, shown in the hero, above the photo gallery, or both (listings.video_placement; older listings are "hero").
    // A YouTube or Vimeo link is an embed: it can play silently behind the classic hero, but not drive the Luxury scroll effect
    // (that needs a real file), so on the Luxury template an embed set for the hero is shown above the gallery instead.
    ...videoSpots(listing),
    agent: {
      name: agent?.full_name || "",
      title: agent?.title || "Real Estate Agent",
      license: agent?.license || "",
      phone: agent?.phone || "",
      email: agent?.email || "",
      photo: agent?.photo_url || "",
    },
  };
}

function videoSpots(listing) {
  const url = listing.hero_video_url || "";
  const placement = listing.video_placement || "hero";
  const embed = parseVideoLink(url);
  const inHero = placement !== "gallery";
  const inGallery = placement === "gallery" || placement === "both";
  if (!url) return { heroVideo: null, heroEmbed: null, galleryVideo: null, galleryEmbed: null };
  if (embed) {
    const luxury = listing.site_template === "luxury";
    return { heroVideo: null, heroEmbed: inHero && !luxury ? embed : null, galleryVideo: null, galleryEmbed: inGallery || (inHero && luxury) ? embed : null };
  }
  return { heroVideo: inHero ? url : null, heroEmbed: null, galleryVideo: inGallery ? url : null, galleryEmbed: null };
}

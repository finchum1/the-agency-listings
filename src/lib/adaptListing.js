import brokerage from "./brokerage";
import { STATUS_LABELS } from "./format";

// Shapes a Supabase `listings` row (+ agent profile + photos) into the
// exact object shape property-site-template/src/data/listing.js used to
// export statically, so the ported site components need almost no changes.
export function adaptListing({ listing, agent, photos }) {
  const mlsNumber = listing.mls_number ? `MLS# ${listing.mls_number}` : "";

  return {
    brand: {
      name: listing.address_line1,
      tagline: `${agent?.full_name || "The Agency"} — ${brokerage.name}`,
    },
    // logo_variant picks among brokerage.logos (red/white/black) — falls
    // back to the default red mark for older listings saved before this
    // existed, or an unrecognized value. Mirrors adaptAgentSite.js.
    brokerage: {
      ...brokerage,
      logo: brokerage.logos[listing.logo_variant] || brokerage.logo,
    },
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
    map: {
      query: `${listing.address_line1}, ${listing.city}, ${listing.state} ${listing.zip}`,
    },
    heroVideo: listing.hero_video_url || null,
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

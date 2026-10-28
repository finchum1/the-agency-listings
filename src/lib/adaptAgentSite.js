import { brandFromOrg } from "./brand";
import { paragraphsToHtml } from "./richTextFallback";

// Shapes a Supabase agent_sites row (+ profile + testimonials + areas +
// posts + the agent's own listings + past sales) into one convenient object for the
// public site components — same idea as adaptListing.js.
export function adaptAgentSite({ site, agent, testimonials, areas, posts, listings, sales }) {
  // A closed listing the agent copied into their past sales shows there, not in the current listings too.
  const soldListingIds = new Set((sales || []).map((s) => s.listing_id).filter(Boolean));
  const brokerage = brandFromOrg(site.org);
  return {
    brand: {
      name: agent?.full_name || "",
      tagline: site.tagline || "",
    },
    // logo_variant picks among brokerage.logos (red/white/black) — falls
    // back to the default red mark for older sites saved before this
    // existed, or an unrecognized value. The Red template forces white
    // regardless of that pick: its header/footer background is the
    // literal Agency Red (--as-dark), so a red- or black-variant mark
    // would have much weaker contrast against its own matching/
    // near-matching background.
    brokerage: {
      ...brokerage,
      logo: site.theme === "red" ? (brokerage.logos.white || brokerage.logo) : brokerage.logos[site.logo_variant] || brokerage.logo,
    },
    logoVariant: site.logo_variant || "red",
    slug: site.slug,
    tagline: site.tagline || "",
    region: site.region || "",
    theme: site.theme || "classic",
    // How the home page and its sections are arranged (classic | editorial | bold | portrait | listings) — independent of the color theme.
    layout: ["editorial", "bold", "portrait", "listings", "luxury", "warm", "guide"].includes(site.layout) ? site.layout : "classic",
    // Independent of the color/font `theme` above — whether the Navbar
    // renders as today's flush full-width bar ("classic") or the
    // marketing site's floating pill that's clear at the top and gains a
    // rounded, shadowed pill once scrolled ("floating"). See
    // Navbar.jsx and SiteForm.jsx's "Header Style" picker.
    headerStyle: ["floating", "centered", "centered_pill", "stacked", "minimal"].includes(site.header_style) ? site.header_style : "classic",
    // classic | centered | cta | wide | slim — see Footer.jsx.
    footerStyle: ["centered", "cta", "wide", "slim"].includes(site.footer_style) ? site.footer_style : "classic",
    // The agent's own order for the header and footer menus, a list of page paths (see lib/siteNav.js).
    navOrder: Array.isArray(site.nav_order) ? site.nav_order : [],
    // "square" (original) or "pill" — see index.css [data-buttons="pill"] .as-btn.
    buttonStyle: site.button_style === "pill" ? "pill" : "square",
    fontPairing: site.font_pairing || "playfair-jost",
    accentColor: site.accent_color || "",
    homeSections: site.home_sections?.length
      ? site.home_sections
      : ["bio", "testimonials", "cards", "listings", "areas", "blog"],
    // The Sellers / Home Value / Buyers pages and their cards (see lib/landingPages.js).
    landing: site.landing && typeof site.landing === "object" ? site.landing : {},
    // Whether this agent opted in to the full MLS search block on their
    // own area pages (AgentAreaPage.jsx's "Search Homes in {Area}") — see
    // SiteForm.jsx's "Home Search (IDX)" toggle. Off by default for a new
    // site; most agents don't opt in.
    idxEnabled: !!site.idx_enabled,
    secondaryLogo: site.secondary_logo_url || "",
    heroPhoto: site.hero_photo_url || agent?.photo_url || "",
    heroVideo: site.hero_video_url || null,
    bio: site.bio || [],
    // bio_html is the new rich-text source of truth (RichTextEditor.jsx /
    // Bio.jsx). Falls back to converting the old bio text[] array on the
    // fly for any row the SQL backfill hasn't reached yet, or before
    // supabase/rich-text-fields.sql has been run at all — zero visual
    // change either way.
    bioHtml: site.bio_html || paragraphsToHtml(site.bio),
    stats: site.stats || [],
    social: {
      instagram: site.instagram_url || "",
      facebook: site.facebook_url || "",
      linkedin: site.linkedin_url || "",
      tiktok: site.tiktok_url || "",
      youtube: site.youtube_url || "",
      x: site.x_url || "",
    },
    agent: {
      name: agent?.full_name || "",
      title: agent?.title || "Real Estate Agent",
      license: agent?.license || "",
      phone: agent?.phone || "",
      email: agent?.email || "",
      photo: agent?.photo_url || "",
    },
    testimonials: testimonials || [],
    areas: areas || [],
    posts: posts || [],
    listings: (listings || []).filter((l) => !soldListingIds.has(l.id)),
    // Newest sale first; sales with no date go last.
    sales: [...(sales || [])].sort((a, b) => (b.sold_on || "").localeCompare(a.sold_on || "") || a.sort_order - b.sort_order),
  };
}

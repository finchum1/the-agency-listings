import brokerage from "./brokerage";
import { paragraphsToHtml } from "./richTextFallback";

// Shapes a Supabase agent_sites row (+ profile + testimonials + areas +
// posts + the agent's own listings) into one convenient object for the
// public site components — same idea as adaptListing.js.
export function adaptAgentSite({ site, agent, testimonials, areas, posts, listings }) {
  return {
    brand: {
      name: agent?.full_name || "",
      tagline: site.tagline || "",
    },
    // logo_variant picks among brokerage.logos (red/white/black) — falls
    // back to the default red mark for older sites saved before this
    // existed, or an unrecognized value.
    brokerage: {
      ...brokerage,
      logo: brokerage.logos[site.logo_variant] || brokerage.logo,
    },
    logoVariant: site.logo_variant || "red",
    slug: site.slug,
    tagline: site.tagline || "",
    region: site.region || "",
    theme: site.theme || "classic",
    fontPairing: site.font_pairing || "playfair-jost",
    accentColor: site.accent_color || "",
    homeSections: site.home_sections?.length
      ? site.home_sections
      : ["bio", "testimonials", "listings", "areas", "blog"],
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
    listings: listings || [],
  };
}

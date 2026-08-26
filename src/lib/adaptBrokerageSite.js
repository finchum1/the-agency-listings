import brokerage from "./brokerage";

// Shapes a Supabase brokerage_site row (+ agents + posts + areas) into
// one convenient object for the public brokerage-site components — same
// idea as adaptAgentSite.js, just without anything keyed to a specific
// agent (no slug/custom-domain).
export function adaptBrokerageSite({ site, agents, posts, areas }) {
  return {
    brokerage,
    theme: site.theme || "dark",
    fontPairing: site.font_pairing || "playfair-jost",
    accentColor: site.accent_color || "",
    logoVariant: site.logo_variant || "white",
    homeSections: site.home_sections?.length ? site.home_sections : ["about", "agents", "blog", "areas"],
    tagline: site.tagline || "",
    heroPhoto: site.hero_photo_url || "",
    heroVideo: site.hero_video_url || null,
    aboutHtml: site.about_html || "",
    stats: site.stats || [],
    contact: {
      email: site.contact_email || "",
      phone: site.contact_phone || "",
    },
    social: {
      instagram: site.instagram_url || "",
      facebook: site.facebook_url || "",
      linkedin: site.linkedin_url || "",
    },
    agents: agents || [],
    posts: posts || [],
    areas: areas || [],
  };
}

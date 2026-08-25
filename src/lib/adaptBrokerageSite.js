import brokerage from "./brokerage";

// Shapes a Supabase brokerage_site row (+ agents + posts) into one
// convenient object for the public brokerage-site components — same idea
// as adaptAgentSite.js, just without anything keyed to a specific agent
// (no slug/theme/font/accent picker — see BrokerageSitePage.jsx, which
// hardcodes data-theme="dark" data-font="playfair-jost" instead).
export function adaptBrokerageSite({ site, agents, posts }) {
  return {
    brokerage,
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
  };
}

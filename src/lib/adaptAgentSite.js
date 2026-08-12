import brokerage from "./brokerage";

// Shapes a Supabase agent_sites row (+ profile + testimonials + areas +
// posts + the agent's own listings) into one convenient object for the
// public site components — same idea as adaptListing.js.
export function adaptAgentSite({ site, agent, testimonials, areas, posts, listings }) {
  return {
    brand: {
      name: agent?.full_name || "",
      tagline: site.tagline || "",
    },
    brokerage,
    slug: site.slug,
    tagline: site.tagline || "",
    region: site.region || "",
    heroPhoto: site.hero_photo_url || agent?.photo_url || "",
    heroVideo: site.hero_video_url || null,
    bio: site.bio || [],
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

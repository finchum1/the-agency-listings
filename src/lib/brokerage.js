// Brokerage-wide constant — same for every listing in this app, so it's
// not a database column. Mirrors property-site-template's brokerage block.
//
// logos: four official variants of the same mark — red/white/black are the
// same wide mark+wordmark lockup recolored (pixel-identical shape across
// all three); square is a distinct composition (mark stacked above the
// wordmark, both white, on a solid brand-red tile) built from the same
// source elements. See public/images/brokerage-logo*.png. `logo` stays
// the default (red, wide) for every context that doesn't offer a variant
// picker (dashboard, login, 404, listing sites, flyers). Only the
// agent-site Navbar/Footer let an agent pick among the four, via
// agent_sites.logo_variant (see adaptAgentSite.js).
const logos = {
  red: "/images/brokerage-logo.png",
  white: "/images/brokerage-logo-white.png",
  black: "/images/brokerage-logo-black.png",
  square: "/images/brokerage-logo-square.png",
};

const brokerage = {
  name: "The Agency",
  logo: logos.red, // red mark + wordmark, used everywhere except agent sites
  logos,
  address: {
    line1: "112 S. Broadway",
    city: "Edmond",
    state: "OK",
    zip: "73034",
  },
  disclaimer:
    "This office is independently owned and operated. Equal Housing Opportunity.",
};

export default brokerage;

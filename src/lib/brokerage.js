// Brokerage-wide constant — same for every listing in this app, so it's
// not a database column. Mirrors property-site-template's brokerage block.
//
// logos: three official-color variants of the same mark (recolored from
// the same source file, so the shape is pixel-identical across all three —
// see public/images/brokerage-logo*.png). `logo` stays the default (red)
// for every context that doesn't offer a variant picker (dashboard,
// login, 404, listing sites, flyers). Only the agent-site Navbar/Footer
// let an agent pick among the three, via agent_sites.logo_variant (see
// adaptAgentSite.js).
const logos = {
  red: "/images/brokerage-logo.png",
  white: "/images/brokerage-logo-white.png",
  black: "/images/brokerage-logo-black.png",
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

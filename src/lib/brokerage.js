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
  // The specific franchise-disclosure line, distinct from the generic
  // `disclaimer` above — used only in the Brokerage Site's own footer
  // (see brokerage-site/Footer.jsx) per request, not the shared line
  // agent sites/listing sites/flyers already show. Kept verbatim
  // (including the all-caps) rather than normalized to sentence case,
  // since franchise disclosure language is often required conspicuous.
  franchiseDisclaimer:
    "THIS OFFICE IS AN INDEPENDENTLY OWNED AND OPERATED FRANCHISEE OF THE AGENCY REAL ESTATE FRANCHISING, LLC.",
};

export default brokerage;

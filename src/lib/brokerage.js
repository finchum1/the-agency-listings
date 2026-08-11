// Brokerage-wide constant — same for every listing in this app, so it's
// not a database column. Mirrors property-site-template's brokerage block.
const brokerage = {
  name: "The Agency",
  logo: "/images/brokerage-logo.png", // red mark + wordmark, used in header + footer
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

// One title + description per marketing page. Used two ways: client-side
// by MarketingNav (so real browsers and Googlebot get the right tab title
// and snippet as soon as the page renders) and server-side by
// api/meta-custom-domain.js's ?marketing= branch (so AI crawlers, link
// previews and anything else that doesn't run JavaScript see them in the
// raw HTML too). Titles stay under ~60 characters and descriptions under
// ~160 so search results don't truncate them.
export const MARKETING_META = {
  "/": {
    title: "The Agency — One Dashboard for Real Estate Websites & Deals",
    description:
      "Brokerage and agent websites, property sites, leads, pipeline and transactions — everything an Oklahoma real estate office runs on, in one dashboard.",
  },
  "/brokerage-website": {
    title: "Brokerage Website with Full MLS Home Search | The Agency",
    description:
      "The office's own front door: IDX home search across the whole market, draw-a-boundary map search, the office's listings, and a lead-capture home valuation form.",
  },
  "/agent-websites": {
    title: "Agent Websites for Real Estate Agents | The Agency",
    description:
      "Every agent gets their own website with a bio, listings, blog, areas of expertise and testimonials — on The Agency's trusted brand, live in minutes.",
  },
  "/property-websites": {
    title: "Single-Property Websites for Every Listing | The Agency",
    description:
      "Fill out a form and a full property site goes live: photo gallery, hero video, open houses and a contact form that reaches the agent directly.",
  },
  "/people": {
    title: "Real Estate CRM: Leads, Pipeline & Transactions | The Agency",
    description:
      "Track leads, your pipeline and every transaction on simple boards — one-tap call and text, follow-up reminders, notes, and buyer and seller closing checklists.",
  },
  "/upcoming": {
    title: "Upcoming Listings & Buyer Needs Tracker | The Agency",
    description:
      "Track coming-soon listings before they're public and keep a shared list of what buyers want, so the whole office can make the match.",
  },
};

export function marketingMetaFor(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  return { path, meta: MARKETING_META[path] || MARKETING_META["/"] };
}

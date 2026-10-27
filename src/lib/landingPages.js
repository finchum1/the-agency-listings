// The three landing pages on an agent's site (Sellers, Home Value, Buyers) and the three cards that lead to them from the home page.
// agent_sites.landing (adapted as site.landing) holds the agent's own settings; anything missing falls back to the defaults here.
//   { order: ["sellers","value","buyers"], menu: true, comps_task: true,
//     sellers: { on: true, title: "", blurb: "", photo_url: "" }, value: {...}, buyers: {...} }
// The photos are from The Agency's seller and buyer guides until the agent has their own (see public/landing).

export const LANDING_KEYS = ["sellers", "value", "buyers"];

export const LANDING_DEFAULTS = {
  sellers: {
    path: "/sellers",
    nav: "Sellers",
    kind: "Sellers",
    eyebrow: "For sellers",
    title: "Selling your home",
    blurb: "Your next chapter starts here. The whole journey in plain English: prep, pricing, showings, offers and closing day.",
    cta: "Read the seller's guide",
    photo: "/landing/seller-backyard.jpg",
  },
  value: {
    path: "/home-value",
    nav: "Home Value",
    kind: "Home Value",
    eyebrow: "Free · 1 business day",
    title: "What's your home worth?",
    blurb: "{first} pulls real comparables and sends you a custom valuation. A person, not a robot estimate.",
    cta: "Get my home value",
    photo: "/landing/kitchen.jpg",
  },
  buyers: {
    path: "/buyers",
    nav: "Buyers",
    kind: "Buyers",
    eyebrow: "For buyers",
    title: "Buying a home",
    blurb: "Let's go shopping. Pre-approval, the search, the offer and the keys, plus a wish-list worksheet to start with.",
    cta: "Read the buyer's guide",
    photo: "/landing/buyers-family.jpg",
  },
};

const clean = (v) => (typeof v === "string" ? v.trim() : "");

/** The agent's settings merged over the defaults: { order, menu, compsTask, cards: [{ key, on, path, nav, kind, eyebrow, title, blurb, cta, photo }] }. */
export function resolveLanding(landing, agentFirstName = "") {
  const l = landing && typeof landing === "object" ? landing : {};
  const saved = Array.isArray(l.order) ? l.order.filter((k) => LANDING_KEYS.includes(k)) : [];
  const order = [...new Set([...saved, ...LANDING_KEYS])];
  const first = clean(agentFirstName) || "Your agent";
  const cards = order.map((key) => {
    const d = LANDING_DEFAULTS[key];
    const mine = l[key] && typeof l[key] === "object" ? l[key] : {};
    return {
      key,
      on: mine.on !== false,
      path: d.path,
      nav: d.nav,
      kind: d.kind,
      eyebrow: d.eyebrow,
      title: clean(mine.title) || d.title,
      blurb: clean(mine.blurb) || d.blurb.replace("{first}", first),
      cta: d.cta,
      photo: clean(mine.photo_url) || d.photo,
    };
  });
  return { order, menu: l.menu !== false, compsTask: l.comps_task !== false, cards };
}

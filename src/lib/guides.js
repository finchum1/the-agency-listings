// The four downloadable guides (Sellers, Buyers, Home Value, Relocation) as plain data, built from the same words as the pages in
// src/components/agent-site/landing/content.js so there is one place to edit them. api/guide-pdf.js lays them out as a branded PDF.
//
// A guide is { slug, page, title, subtitle, intro, sections } and each section is { eyebrow, heading, lead?, blocks }. Block types:
//   steps     [{ title, tag?, body }]   numbered, the long way through a process
//   cards     [{ title, body }]         short ideas side by side
//   bullets   ["…"]                     a plain list
//   checklist ["…"]                     the same, with check boxes
//   text      "paragraph"               a paragraph
//   quote     "line"                    one line set large
//   faq       [{ q, a }]
// The voice is the agent's own ("I"), like the pages. Nothing here quotes a price, a statistic or a rule that could go out of date.
import {
  BUYER_STEPS,
  CLOSING_CHECKLIST,
  CLOSING_STEPS,
  LENDER_REVIEWS,
  LOAN_DONTS,
  OFFER_OPTIONS,
  OFFER_STEPS,
  RELOCATION_FAQ,
  RELOCATION_STEPS,
  SELLER_COSTS,
  SELLER_PREP,
  SELLER_STEPS,
} from "../components/agent-site/landing/content.js";

export const GUIDES = {
  sellers: {
    slug: "sellers",
    page: "sellers",
    title: "The Seller's Guide",
    subtitle: "From the first conversation to the closing table",
    noun: "seller's guide",
    intro: "Selling a home is one of the biggest financial moves you will make. This guide walks you through each step, what to expect and where I come in, so there are no surprises.",
    sections: [
      { eyebrow: "The process", heading: "Eight steps from listing to closing", lead: "Every sale is a little different, but most follow this path.", blocks: [{ type: "steps", items: SELLER_STEPS }] },
      { eyebrow: "Before you list", heading: "Get your home ready", lead: "A little work before the sign goes up pays off at the negotiating table.", blocks: [{ type: "cards", items: SELLER_PREP }] },
      {
        eyebrow: "Pricing strategy",
        heading: "Pricing is an art and a science",
        blocks: [
          { type: "text", text: "We understand market conditions locally and nationally, but the method goes beyond bedroom counts and square footage. It is the intangibles that are the specialty: the architectural details, the nuances of a floor plan, and what they mean for the overall value of your home." },
          { type: "text", text: "For a home that has been sitting, we create urgency and justify the price, which may mean lowering it or raising it. Each property is unique. The mission is to make your home the best in its category." },
          { type: "quote", text: "The price must be right." },
        ],
      },
      { eyebrow: "Offers", heading: "When the offers arrive", lead: "You have three choices for every offer.", blocks: [{ type: "cards", items: OFFER_OPTIONS.map(({ label, title, body }) => ({ title: `${label}: ${title}`, body })) }] },
      { eyebrow: "At closing", heading: "What you may pay", lead: "Your own costs depend on your sale. Expect some of these:", blocks: [{ type: "bullets", items: SELLER_COSTS }] },
      { eyebrow: "Under contract", heading: "Your closing checklist", lead: "These steps run alongside each other once an offer is accepted.", blocks: [{ type: "checklist", items: CLOSING_CHECKLIST }] },
    ],
  },
  buyers: {
    slug: "buyers",
    page: "buyers",
    title: "The Buyer's Guide",
    subtitle: "Eight steps to your keys",
    noun: "buyer's guide",
    intro: "Buying a home can seem daunting. You do not have to do it alone. This guide covers each step, what to expect and how I help along the way.",
    sections: [
      { eyebrow: "The process", heading: "Eight steps to your keys", blocks: [{ type: "steps", items: BUYER_STEPS }] },
      {
        eyebrow: "Financing",
        heading: "Money talks: get pre-approved first",
        blocks: [
          { type: "text", text: "Pre-approval is a full loan approval, not just an opinion letter. I connect you with a mortgage broker who tells you how much a bank will lend, explains your financing options and your down payment, and puts you in a stronger position in the seller's eyes." },
          { type: "text", text: "Here is what a lender looks at:" },
          { type: "cards", items: LENDER_REVIEWS },
        ],
      },
      { eyebrow: "While you are in the loan process", heading: "Please don't…", lead: "Until you close, keep your finances exactly as they are.", blocks: [{ type: "cards", items: LOAN_DONTS }] },
      { eyebrow: "Making the offer", heading: "Not too high. Not too low. Just right.", blocks: [{ type: "steps", items: OFFER_STEPS }] },
      { eyebrow: "Closing", heading: "Looks like we made it", blocks: [{ type: "steps", items: CLOSING_STEPS }] },
    ],
  },
  "home-value": {
    slug: "home-value",
    page: "home_value",
    title: "What's Your Home Worth?",
    subtitle: "How a home's value is worked out, and what you can do about it",
    noun: "home value guide",
    intro: "A computer estimate is a guess. A real valuation looks at the homes around yours, what makes yours different and what the market is doing right now. Here is how I do it, and how you can prepare.",
    sections: [
      {
        eyebrow: "How it works",
        heading: "Three steps to a real number",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "You tell me about your home", body: "Just the address to start. A few details about the home, such as the bedrooms and baths, the updates, and anything a buyer would care about, help me get closer." },
              { title: "I pull the comparables", body: "Recent sales of homes like yours, adjusted for what makes yours different: more space, a pool, a newer kitchen, a bigger lot or a busier street." },
              { title: "We talk it through", body: "You get your number and an honest plan: sell now, prep first, or wait." },
            ],
          },
        ],
      },
      {
        eyebrow: "What moves the number",
        heading: "What affects your home's value",
        blocks: [
          {
            type: "cards",
            items: [
              { title: "Recent sales nearby", body: "The most reliable guide is what similar homes close to yours actually sold for, not what they were listed for." },
              { title: "Size, layout and age", body: "Square footage, how the rooms flow, and the age and condition of the big-ticket items such as the roof and the systems." },
              { title: "Updates and condition", body: "A refreshed kitchen and baths, flooring, paint and curb appeal can change how a buyer feels in the first minute." },
              { title: "Location and lot", body: "The street, the schools, the commute and the lot all count, sometimes more than the house." },
              { title: "The market right now", body: "How many homes are for sale, how quickly they sell and what buyers can afford change the number from season to season." },
              { title: "Timing and strategy", body: "The same home can sell very differently depending on when and how it is priced and shown." },
            ],
          },
        ],
      },
      {
        eyebrow: "Before the valuation",
        heading: "Make it easy to see your home at its best",
        blocks: [
          { type: "checklist", items: ["Write down the updates you have made and roughly when", "Gather receipts or paperwork for the roof, systems and any major work", "Note what you love about the home and the neighborhood", "Tidy the rooms and clear the counters for the walk-through", "Think about your timeline: when would you like to move?"] },
        ],
      },
      { eyebrow: "Next", heading: "What happens after", blocks: [{ type: "text", text: "You get a valuation you can understand, with the comparable homes behind it. If you decide to sell, we plan the preparation, the pricing and the marketing together. If you are not ready, there is no obligation: now you know where you stand." }] },
    ],
  },
  relocation: {
    slug: "relocation",
    page: "relocation",
    title: "Moving to Oklahoma",
    subtitle: "A guide for relocating buyers",
    noun: "relocation guide",
    intro: "Moving somewhere new is easier with someone on the ground. This guide shows how a long-distance move works, from the first conversation to your first weeks in the home.",
    sections: [
      { eyebrow: "The process", heading: "From the first question to the keys", blocks: [{ type: "steps", items: RELOCATION_STEPS }] },
      { eyebrow: "Good to know", heading: "Questions I hear most", blocks: [{ type: "faq", items: RELOCATION_FAQ }] },
    ],
  },
};

export const GUIDE_SLUGS = Object.keys(GUIDES);

// The looks a guide's cover and accents can take. `key` is a website theme name (the same palettes as src/index.css; api/_lib/visitors.js has the colors the
// PDF uses), "site" follows whatever the agent's website uses. `dark` and `accent` are only for the little swatch in the picker. A guide's choice is saved in
// agent_sites.landing.guide_themes ({ sellers: "velvet", ... }); a ?theme= on the PDF address overrides it.
export const GUIDE_THEMES = [
  { key: "site", label: "Match my website" },
  { key: "classic", label: "Iron", dark: "#1C1C1B", accent: "#D8091B" },
  { key: "red", label: "Agency Red", dark: "#D8091B", accent: "#1C1C1B" },
  { key: "velvet", label: "Velvet", dark: "#470300", accent: "#D8091B" },
  { key: "chambray", label: "Chambray", dark: "#C2D7E6", accent: "#D8091B" },
  { key: "brownstone", label: "Brownstone", dark: "#906F57", accent: "#F5F1E9" },
  { key: "linen", label: "Ecru", dark: "#F5F1E9", accent: "#D8091B" },
];
export const GUIDE_THEME_KEYS = GUIDE_THEMES.map((t) => t.key).filter((k) => k !== "site");

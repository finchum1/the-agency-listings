// Starter templates for an agent site: a layout, color theme, header, footer, button shape and home section order that go together, set in one click
// from the site editor (nothing is saved until the agent saves). The colors are the brand's own themes (see THEMES in SiteForm.jsx); the agent's
// photo, logo, accent color and fonts stay as they are. "layout" keys have a hero in components/agent-site/layouts/Concepts.jsx.
export const SITE_TEMPLATES = [
  {
    key: "luxury",
    label: "Luxury minimal",
    note: "Quiet and high-end: a full-screen photo, a centered headline and three outlined buttons.",
    settings: {
      layout: "luxury",
      theme: "dark",
      header_style: "stacked",
      footer_style: "centered",
      button_style: "square",
      home_sections: ["listings", "areas", "cards", "bio", "testimonials", "blog"],
    },
  },
  {
    key: "warm",
    label: "Warm editorial",
    note: "Soft and personal: a centered headline with one word in color, pill buttons and a floating menu.",
    settings: {
      layout: "warm",
      theme: "linen",
      header_style: "minimal",
      footer_style: "cta",
      button_style: "pill",
      home_sections: ["bio", "listings", "areas", "testimonials", "cards", "blog"],
    },
  },
  {
    key: "guide",
    label: "Guide cards",
    note: "Airy and helpful: a headline with buying and selling guides, then the buyer and seller cards right away.",
    settings: {
      layout: "guide",
      theme: "classic",
      header_style: "classic",
      footer_style: "wide",
      button_style: "square",
      home_sections: ["cards", "bio", "listings", "testimonials", "areas", "blog"],
    },
  },
];

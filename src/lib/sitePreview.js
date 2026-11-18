// Previewing an agent site in another layout or color theme without changing it. A preview address carries
// ?preview_layout=editorial&preview_theme=dark; the site renders with those instead of its saved ones, but nothing is saved
// and the page isn't counted as a visit. The choice is also remembered in window.name (which survives in-page navigation
// but is private to that one tab or frame), so clicking through About, Listings and so on keeps the same look.
// The Latchpoint Mac app has ONE web view for everything, so window.name never gets a fresh start there: a preview opened once would stay on
// that site for good (and turn off its light / dark switch). The memory therefore carries the time it was last used and lapses after
// MEMORY_MS of not previewing; a memory with no time (made before this) counts as lapsed.
export const LAYOUT_OPTIONS = [
  { value: "classic", label: "Classic", description: "Full-screen photo hero, then tidy sections. The original look." },
  { value: "editorial", label: "Minimal editorial", description: "Light and airy, like a magazine: big quiet headlines and thin rules." },
  { value: "bold", label: "Bold statement", description: "Oversized uppercase type, full-bleed photos and solid color blocks." },
  { value: "portrait", label: "Portrait split", description: "Leads with the agent: a tall portrait beside their name and a way to connect." },
  { value: "listings", label: "Listings first", description: "A short banner, then the listings right away. For agents who sell a lot of homes." },
  { value: "luxury", label: "Luxury minimal", description: "A full-screen photo, a centered headline and three outlined buttons." },
  { value: "warm", label: "Warm editorial", description: "A centered headline with one word in color, and pill buttons." },
  { value: "guide", label: "Guide cards", description: "A light headline with buying and selling guides, then the buyer and seller cards." },
];
export const THEME_OPTIONS = [
  { value: "classic", label: "Classic", swatches: ["#F5F1E9", "#1C1C1B", "#D8091B"] },
  { value: "dark", label: "Dark", swatches: ["#1C1C1B", "#262625", "#D8091B"] },
  { value: "sand", label: "Sand", swatches: ["#EBE3D6", "#1C1C1B", "#D8091B"] },
  { value: "red", label: "Red", swatches: ["#FFFFFF", "#D8091B", "#1C1C1B"] },
  { value: "linen", label: "Linen", swatches: ["#FFFFFF", "#F5F1E9", "#D8091B"] },
  { value: "velvet", label: "Velvet", swatches: ["#F5F1E9", "#470300", "#FFFFFF"] },
  { value: "velvet-night", label: "Velvet Night", swatches: ["#470300", "#260100", "#D8091B"] },
  { value: "chambray", label: "Chambray", swatches: ["#FAF8F4", "#C2D7E6", "#D8091B"] },
  { value: "brownstone", label: "Brownstone", swatches: ["#F5F1E9", "#906F57", "#D8091B"] },
];
export const HEADER_OPTIONS = [
  { value: "classic", label: "Classic bar" },
  { value: "floating", label: "Floating pill" },
  { value: "centered", label: "Centered logo" },
  { value: "centered_pill", label: "Centered, floating" },
  { value: "stacked", label: "Stacked" },
  { value: "minimal", label: "Minimal" },
];
export const FOOTER_OPTIONS = [
  { value: "classic", label: "Three columns" },
  { value: "centered", label: "Centered" },
  { value: "cta", label: "Call to action" },
  { value: "wide", label: "Four columns" },
  { value: "slim", label: "Slim bar" },
];
const LAYOUTS = LAYOUT_OPTIONS.map((l) => l.value);
const HEADERS = HEADER_OPTIONS.map((h) => h.value);
const FOOTERS = FOOTER_OPTIONS.map((f) => f.value);
const THEMES = THEME_OPTIONS.map((t) => t.value);
const PREFIX = "lp-preview:";
const MEMORY_MS = 30 * 60 * 1000;

// Where this page's links should point while rendering a share-link preview (/preview/<token>/site); null otherwise.
let previewBase = null;
export const setPreviewBase = (base) => {
  previewBase = base;
};
export const getPreviewBase = () => previewBase;

/** The layout/theme to preview for this site from the address (or from this tab's memory), or null. `key` ties the memory to one site. */
export function readPreviewOverrides(search, key) {
  const params = new URLSearchParams(search || "");
  const layout = params.get("preview_layout");
  const theme = params.get("preview_theme");
  const header = params.get("preview_header");
  const footer = params.get("preview_footer");
  if ((layout && LAYOUTS.includes(layout)) || (theme && THEMES.includes(theme)) || (header && HEADERS.includes(header)) || (footer && FOOTERS.includes(footer))) {
    const found = {
      layout: LAYOUTS.includes(layout) ? layout : undefined,
      theme: THEMES.includes(theme) ? theme : undefined,
      header: HEADERS.includes(header) ? header : undefined,
      footer: FOOTERS.includes(footer) ? footer : undefined,
    };
    try {
      window.name = PREFIX + JSON.stringify({ key, ...found, at: Date.now() });
    } catch {
      /* the address still works without the memory */
    }
    return found;
  }
  try {
    if (window.name.startsWith(PREFIX)) {
      const saved = JSON.parse(window.name.slice(PREFIX.length));
      if (!(Date.now() - Number(saved.at) < MEMORY_MS)) {
        window.name = ""; // lapsed (or from before memories had a time): forget it
        return null;
      }
      if (saved.key === key) {
        window.name = PREFIX + JSON.stringify({ ...saved, at: Date.now() }); // still being used: keep it going
        return { layout: saved.layout, theme: saved.theme, header: saved.header, footer: saved.footer };
      }
    }
  } catch {
    /* no memory */
  }
  return null;
}

/** The query string for previewing a look: layout, colors, header and footer (any left out keep what the site has). */
export function previewQuery({ layout, theme, header, footer }) {
  const params = new URLSearchParams();
  if (layout) params.set("preview_layout", layout);
  if (theme) params.set("preview_theme", theme);
  if (header) params.set("preview_header", header);
  if (footer) params.set("preview_footer", footer);
  return params.toString();
}

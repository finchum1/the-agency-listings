// Previewing an agent site in another layout or color theme without changing it. A preview address carries
// ?preview_layout=editorial&preview_theme=dark; the site renders with those instead of its saved ones, but nothing is saved
// and the page isn't counted as a visit. The choice is also remembered in window.name (which survives in-page navigation
// but is private to that one tab or frame), so clicking through About, Listings and so on keeps the same look.
export const LAYOUT_OPTIONS = [
  { value: "classic", label: "Classic", description: "Full-screen photo hero, then tidy sections. The original look." },
  { value: "editorial", label: "Minimal editorial", description: "Light and airy, like a magazine: big quiet headlines and thin rules." },
  { value: "bold", label: "Bold statement", description: "Oversized uppercase type, full-bleed photos and solid color blocks." },
  { value: "portrait", label: "Portrait split", description: "Leads with the agent: a tall portrait beside their name and a way to connect." },
  { value: "listings", label: "Listings first", description: "A short banner, then the listings right away. For agents who sell a lot of homes." },
];
export const THEME_OPTIONS = [
  { value: "classic", label: "Classic", swatches: ["#f7f4ee", "#14130f", "#ed2127"] },
  { value: "dark", label: "Dark", swatches: ["#14130f", "#26241d", "#f2454b"] },
  { value: "sand", label: "Sand", swatches: ["#ddd0ba", "#0d0d0d", "#ed2127"] },
  { value: "red", label: "Red", swatches: ["#ffffff", "#ed2127", "#0d0d0d"] },
  { value: "linen", label: "Linen", swatches: ["#ffffff", "#f0ece4", "#ed2127"] },
];
const LAYOUTS = LAYOUT_OPTIONS.map((l) => l.value);
const THEMES = THEME_OPTIONS.map((t) => t.value);
const PREFIX = "lp-preview:";

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
  if ((layout && LAYOUTS.includes(layout)) || (theme && THEMES.includes(theme))) {
    const found = { layout: LAYOUTS.includes(layout) ? layout : undefined, theme: THEMES.includes(theme) ? theme : undefined };
    try {
      window.name = PREFIX + JSON.stringify({ key, ...found });
    } catch {
      /* the address still works without the memory */
    }
    return found;
  }
  try {
    if (window.name.startsWith(PREFIX)) {
      const saved = JSON.parse(window.name.slice(PREFIX.length));
      if (saved.key === key) return { layout: saved.layout, theme: saved.theme };
    }
  } catch {
    /* no memory */
  }
  return null;
}

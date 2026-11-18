// What an organization lets its agents pick for a site's logo color and accent color.
// Both lists come from organizations.brand (logos / accent_colors), so each brokerage stays on its own brand.
// The database enforces the same lists (multi-tenant-1f-brand-choices.sql), so the pickers can't drift from it.

// Preview-chip backdrop so a white or black logo is actually visible while picking.
const CHIP_BG = { white: "#14130f", black: "#f0eee9" };

const COLOR_NAMES = { "#d8091b": "Agency Red", "#1c1c1b": "Iron", "#ed2127": "Corporate Red (2025)", "#000000": "Black", "#ffffff": "White" };

const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** [{ value, label, chipBg, src }] for each logo the organization has uploaded. Empty when it has none. */
export function logoChoices(brand) {
  return Object.entries(brand?.logos || {})
    .filter(([, src]) => src)
    .map(([value, src]) => ({ value, label: titleCase(value), chipBg: CHIP_BG[value] || "#ffffff", src }));
}

/** Template default plus each of the organization's brand colors. */
export function accentChoices(brand) {
  const colors = (brand?.accentColors || []).map((hex) => {
    const value = String(hex).toLowerCase();
    return { value, label: COLOR_NAMES[value] || value.toUpperCase(), swatch: value };
  });
  return [{ value: "", label: "Template default", swatch: null }, ...colors];
}

/** The logo key a form should start on: its saved value if still offered, else the organization's default. */
export function validLogoVariant(brand, current) {
  const keys = Object.keys(brand?.logos || {});
  if (!keys.length || keys.includes(current)) return current;
  return keys.includes("red") ? "red" : keys[0];
}

// Themes whose header and footer are a solid dark brand color (Red, Velvet, Brownstone, and the two dark ones), so the white logo is always the one shown,
// whatever was picked. (The 2026 brand guide: no red mark on Iron or Velvet.)
export const WHITE_LOGO_THEMES = ["red", "velvet", "velvet-night", "brownstone", "dark"];
export const logoForTheme = (theme) => WHITE_LOGO_THEMES.includes(theme);
// Agent sites keep an Iron or dark bar behind the logo in every state, so Classic and Sand show the white logo too. (A property site's bar turns light
// on scroll in those themes, so there the agent's choice stands.)
const AGENT_SITE_WHITE_EXTRA = ["classic", "sand"];
// Chambray's header and footer are light blue, where the guide only allows Iron text: the Iron (black) mark is always the one shown.
export const BLACK_LOGO_THEMES = ["chambray"];
export const logoVariantForTheme = (theme, { agentSite = false } = {}) =>
  WHITE_LOGO_THEMES.includes(theme) || (agentSite && AGENT_SITE_WHITE_EXTRA.includes(theme)) ? "white" : BLACK_LOGO_THEMES.includes(theme) ? "black" : null;

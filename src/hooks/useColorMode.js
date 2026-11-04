import { useReducer } from "react";

// The light / dark switch on an agent site (agent_sites.color_toggle). When an agent turns it on, a visitor gets a button in the header that swaps the site
// between the agent's own color theme and the Dark one (an agent whose own theme is Dark swaps to Classic instead). The visitor's choice is kept in their
// browser, per site; until they choose, the site shows the agent's own theme, as designed. Not applied while previewing another theme.
//   useColorMode(site, { disabled })  ->  { site, colorMode: { enabled, isDark, toggle } }
// `site` is the raw agent_sites row; the returned `site` has the theme the visitor should see (the logo too, since a light-header theme needs the white mark).
const keyFor = (slug) => `as-color-mode:${slug}`;
const read = (slug) => {
  if (window.__asMode?.slug === slug) return window.__asMode.mode;
  try {
    const v = window.localStorage.getItem(keyFor(slug));
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
};

export function useColorMode(site, { disabled = false } = {}) {
  const [, refresh] = useReducer((n) => n + 1, 0);
  const enabled = Boolean(site?.color_toggle) && !disabled;
  if (!site || !enabled) return { site, colorMode: { enabled: false, isDark: site?.theme === "dark", toggle: () => {} } };

  const ownIsDark = site.theme === "dark";
  const mode = read(site.slug) || (ownIsDark ? "dark" : "light");
  const isDark = mode === "dark";
  const toggle = () => {
    try {
      window.localStorage.setItem(keyFor(site.slug), isDark ? "light" : "dark");
    } catch {
      // storage can be blocked; the switch then lasts until the page reloads
      window.__asMode = { slug: site.slug, mode: isDark ? "light" : "dark" };
    }
    refresh();
  };
  let shown = site;
  if (isDark && !ownIsDark) shown = { ...site, theme: "dark", ...(site.theme === "linen" ? { logo_variant: "white" } : {}) };
  if (!isDark && ownIsDark) shown = { ...site, theme: "classic" };
  return { site: shown, colorMode: { enabled: true, isDark, toggle } };
}

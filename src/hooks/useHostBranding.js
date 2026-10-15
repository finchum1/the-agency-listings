import { useEffect } from "react";

// On a brokerage's own dashboard domain the page still starts from The Agency's index.html (home-screen name, icon,
// theme color, install manifest). Re-brand those in place so "Add to Home Screen" never shows another organization's
// name or icon. The app is deliberately not installable as an app there yet (no service worker, no manifest): that
// needs per-organization icons; until a brokerage supplies one (organizations.brand.app_icon), no icon is shown.
export function useHostBranding(org) {
  useEffect(() => {
    if (!org) return;
    const brand = org.brand || {};
    const setMeta = (name, content) => {
      const el = document.querySelector(`meta[name="${name}"]`);
      if (el && content) el.setAttribute("content", content);
    };
    setMeta("apple-mobile-web-app-title", org.name);
    setMeta("theme-color", (brand.accent_colors || [])[0]);
    document.title = `${org.name} Dashboard`;
    document.querySelector('link[rel="manifest"]')?.remove();
    const icon = document.querySelector('link[rel="apple-touch-icon"]');
    if (icon) {
      if (brand.app_icon) icon.setAttribute("href", brand.app_icon);
      else icon.remove();
    }
  }, [org]);
}

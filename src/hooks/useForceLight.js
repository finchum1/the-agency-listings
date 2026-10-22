import { useEffect } from "react";

// The dashboard's dark mode is a `dark` class on <html>, applied before first paint on every page for anyone whose device
// prefers dark (see index.html). Public pages that are drawn light only (client vendor lists, seller reports) turn it off while
// they're showing, so components that carry dark: styles don't render dark boxes on a light page.
export function useForceLight() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.remove("dark");
    const prev = root.style.colorScheme;
    root.style.colorScheme = "light";
    return () => {
      root.style.colorScheme = prev;
      if (wasDark) root.classList.add("dark");
    };
  }, []);
}

import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// A client-side link to another page keeps the old scroll position, so a footer link on a long page opened the next
// page part-way down. Go to the top whenever the path changes, except for back/forward (the browser restores those)
// and for #section addresses (those scroll to their own section). Instant, because the site scrolls smoothly otherwise.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash, navType]);
  return null;
}

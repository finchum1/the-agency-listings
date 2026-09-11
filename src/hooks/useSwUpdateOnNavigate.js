import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { checkForSwUpdate } from "../lib/swUpdate";

// Client-side route changes (clicking around the dashboard — Listings ->
// a listing -> Flyer -> Print, all without ever leaving the tab) don't
// fire visibilitychange/focus/pageshow, so main.jsx's own update polling
// never runs during them. This is the gap that made a regular browser
// tab keep showing a stale build across several deploys in a row during
// active use, while a fresh incognito tab (no cached service worker at
// all) always showed the latest. Checking on every route change covers
// exactly that "actively using the app" case the other triggers miss.
export default function useSwUpdateOnNavigate() {
  const location = useLocation();
  useEffect(() => {
    checkForSwUpdate();
  }, [location.pathname]);
}

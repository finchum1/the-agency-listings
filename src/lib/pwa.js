// True when the app is running as an installed home-screen app rather than
// in a browser tab. iOS reports it via navigator.standalone; everything
// else via the display-mode media query.
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

import { isStandalone } from "../lib/pwa";

// Installed home-screen app only (see the inline script in index.html,
// which pushes the page down by the safe-area height): a fixed, opaque
// strip behind the phone's clock and battery, so scrolling content never
// shows through it. Dark in both themes because the status bar text is
// white; in dark mode it matches the dashboard header exactly.
export default function StandaloneStatusBar() {
  if (!isStandalone()) return null;
  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-[1000] h-[env(safe-area-inset-top)] bg-[#1c1a17] dark:bg-[#1a1a1a] print:hidden"
    />
  );
}

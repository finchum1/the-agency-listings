// A deal's panel and the Deals overview behind it are separate pieces of the page. When a task is ticked, added or removed, or a draft is sent
// or dropped in the panel, it announces that here so the overview's "needs your attention" list reloads instead of waiting for the panel to close.
const EVENT = "deal-work-changed";

export const announceDealWork = () => window.dispatchEvent(new Event(EVENT));

/** Calls `fn` each time deal work changes. Returns the function that stops listening (what a useEffect hands back). */
export function onDealWork(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

// Open a dashboard address. A page reads ?new=1, ?deal=, ?person= and the like only when it first loads, so an address on the page you are already
// on is opened with a fresh load instead of a client-side step.
export function dashboardGo(navigate, url) {
  const target = new URL(url, window.location.origin);
  if (target.pathname === window.location.pathname) window.location.assign(`${target.pathname}${target.search}`);
  else navigate(`${target.pathname}${target.search}`);
}

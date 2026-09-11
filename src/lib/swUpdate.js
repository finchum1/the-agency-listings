// A tiny mutable slot connecting main.jsx's service worker registration
// (set up once, imperatively, outside the React tree) to parts of the
// app that want to trigger an update check — specifically, every SPA
// route change (see useSwUpdateOnNavigate.js). Client-side navigation
// fires none of the browser-level signals (visibilitychange, focus,
// pageshow) main.jsx's own polling relies on, so without this, someone
// who opens the dashboard once and then just clicks around inside it —
// the normal way anyone actually uses it — could go a long time without
// ever picking up a new deploy, even while actively using the app.
let checker = () => {};

export function setSwUpdateChecker(fn) {
  checker = fn;
}

export function checkForSwUpdate() {
  checker();
}

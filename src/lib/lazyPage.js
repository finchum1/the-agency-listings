import { lazy } from "react";

// A page loaded on demand. After a deploy, a tab that is still running the old build asks for page files that no longer exist;
// the first time that happens, reload to pick up the new build instead of showing a broken page.
const RELOAD_KEY = "chunkReload";
export function lazyPage(load) {
  return lazy(() =>
    load().then(
      (mod) => {
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch {
          // storage blocked: nothing to reset
        }
        return mod;
      },
      (err) => {
        try {
          if (!sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            return new Promise(() => {});
          }
        } catch {
          // storage blocked: fall through to the error
        }
        throw err;
      },
    ),
  );
}

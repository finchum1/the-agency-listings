import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { isAppHost } from './lib/appHosts.js'
import { setSwUpdateChecker } from './lib/swUpdate.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Only register the PWA service worker on the dashboard's own host — this
// same bundle also serves every agent's/listing's own custom domain (see
// App.jsx's isAppHost() branch), and installing a service worker there
// would put an unwanted "Add to Home Screen" prompt in front of a random
// visitor to someone's listing site, not the agents this was built for.
if (isAppHost(window.location.hostname)) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // The browser's own "check for a new service worker" logic
        // normally only fires on a fresh navigation/page load — but an
        // installed PWA is usually just resumed from the background, not
        // reloaded, so it can sit on a stale build for a long time (an
        // agent reported exactly this after a deploy). Poll explicitly on
        // every plausible "the app is back in front of someone" signal —
        // iOS's standalone home-screen mode is known to be inconsistent
        // about which of these actually fires on a given resume (and it
        // suspends setInterval timers entirely once backgrounded, so the
        // 5-minute poll below is a best-effort fallback for Android/
        // desktop more than something iOS can rely on), so this
        // deliberately layers several redundant triggers rather than
        // trusting just one.
        //
        // A real gap found live: none of visibilitychange/focus/pageshow
        // fire for client-side (React Router) navigation, so someone who
        // opens the dashboard once and then just clicks around inside it
        // — normal usage — could go a long time without a single check,
        // even mid-session across several deploys (a fresh incognito tab
        // always showed the latest build; a regular tab kept lagging
        // behind). checkForUpdate is exposed via swUpdate.js so
        // useSwUpdateOnNavigate.js (App.jsx) can call it on every route
        // change too — that's the trigger that actually covers active use.
        //
        // registerType: "autoUpdate" (vite.config.js) means any update
        // found here applies and reloads automatically, no prompt needed.
        const checkForUpdate = () => registration.update();
        setSwUpdateChecker(checkForUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        window.addEventListener('focus', checkForUpdate);
        window.addEventListener('pageshow', checkForUpdate);
        setInterval(checkForUpdate, 5 * 60 * 1000);
      },
    });
  })
}

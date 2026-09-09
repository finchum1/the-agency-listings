import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { isAppHost } from './lib/appHosts.js'

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
        // agent reported exactly this after a deploy). Poll explicitly:
        // once whenever the app becomes visible again (covers the common
        // "reopen from the home screen" case) and hourly as a fallback
        // for an app left open continuously. registerType: "autoUpdate"
        // (vite.config.js) means any update found here applies and
        // reloads automatically, no prompt needed.
        const checkForUpdate = () => registration.update();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        setInterval(checkForUpdate, 60 * 60 * 1000);
      },
    });
  })
}

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
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // injectRegister: false — this one index.html/bundle also serves
      // every agent's/listing's own custom domain (see App.jsx's
      // isAppHost() branch), not just the dashboard. Auto-registering a
      // service worker on someone's personal listing site would be an
      // unwanted install prompt for a random visitor, not "the dashboard"
      // this was actually asked for. Registration is called manually,
      // gated by isAppHost(), in src/main.jsx instead.
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: {
        name: 'The Agency Dashboard',
        short_name: 'The Agency',
        description: 'The Agency — agent dashboard and listings',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f4ee',
        theme_color: '#ed2127',
        // "any maskable" — the source mark (favicon-512.png) runs nearly
        // edge-to-edge, which is fine for a plain favicon but gets clipped
        // by Android's adaptive-icon mask and other OS-level icon shapes.
        // pwa-192/512.png are regenerated with the mark scaled to the
        // standard 80% safe zone, padded back out with the exact brand
        // red (#ed2127) so there's no seam — safe under any mask shape,
        // and still looks correct unmasked.
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      // Precaches the built app shell (JS/CSS/svg/png/ico) — content-
      // hashed filenames, so cache-first for these is always correct: a
      // new build gets new hashes, never collides with a stale cached
      // one. No runtimeCaching rules for /api/* or Supabase — reads/
      // writes always hit the network live. A dashboard showing stale
      // cached data (listings, leads, agent info) would be worse than no
      // offline support at all.
      //
      // index.html is deliberately EXCLUDED from that precache and
      // handled by its own NetworkFirst runtimeCaching rule below
      // instead. Root-caused live: precached HTML is served cache-first
      // by the SW's own fetch handler on every navigation, including a
      // plain browser refresh — before any of the app's own JS (the
      // update-on-navigation checker, autoUpdate's reload) ever gets a
      // chance to run, since that JS IS what the stale HTML would load.
      // A refresh could keep re-serving however many builds-old HTML the
      // currently-active SW happened to precache, until something else
      // (an unrelated navigation, a background poll) happened to catch
      // the update first — which is exactly the "goes back a couple
      // updates" behavior reported live. Network-first for the shell
      // document itself closes that gap: a plain refresh now always
      // tries the network first for the current build's real asset
      // hashes, falling back to the last cached copy only if offline.
      workbox: {
        globPatterns: ['**/*.{js,css,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})

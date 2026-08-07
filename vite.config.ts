import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Lives in a /dress folder of the Revnox site repo, served at
// https://www.revnoxmedia.com/dress/. Everything derives from this one value.
export default defineConfig({
  base: '/dress/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Sartor — Wardrobe',
        short_name: 'Sartor',
        description: 'Your personal AI wardrobe manager',
        theme_color: '#FAF7F2',
        background_color: '#FAF7F2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // the WASM/onnx assets of background-removal are fetched from CDN at
        // runtime; cache app shell + supabase images for offline viewing
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The ML runtimes are only needed when the user actually reaches for
        // background removal or selfie extraction. Keep them out of the install
        // payload and let them load (and cache) on first use.
        globIgnores: ['**/ort*', '**/*.wasm', '**/transformers*'],
        // NOTE: for cross-origin requests Workbox only applies a RegExp that
        // matches from the START of the URL. A mid-string pattern silently
        // never fires, which is how these rules were dead on arrival.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sartor-images',
              // <img> requests are no-cors, so the response is opaque (status 0)
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sartor-data',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})

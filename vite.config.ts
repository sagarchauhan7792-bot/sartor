import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: repo name — Sartor deploys to GitHub Pages at /sartor/
export default defineConfig({
  base: '/sartor/',
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
        // onnxruntime assets (used by background removal) are huge; load them
        // on demand instead of precaching the app shell with 24MB of WASM
        globIgnores: ['**/ort*', '**/*.wasm'],
        runtimeCaching: [
          {
            urlPattern: /supabase\.co\/storage\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sartor-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /supabase\.co\/rest\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sartor-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
})

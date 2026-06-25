import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA NeuroBoost — site statique servi par Cloudflare Pages.
export default defineConfig({
  root: 'src/renderer',
  publicDir: 'public',
  base: '/',
  resolve: { alias: { '@': resolve('src/renderer/src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'logo-mark.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      manifest: {
        name: 'NeuroBoost',
        short_name: 'NeuroBoost',
        description: "App gamifiée pour cerveaux TDAH — vaincre l'inertie une mission à la fois",
        lang: 'fr',
        theme_color: '#0f0a1e',
        background_color: '#0f0a1e',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
  build: {
    outDir: resolve('dist'),
    emptyOutDir: true
  }
})

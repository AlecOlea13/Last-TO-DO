import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: "Control Pipsa",
        short_name: "Pipsa",
        description: "Sistema de gestión de flota Pipsa Montacargas.",
        theme_color: "#0a0c10",
        background_color: "#0a0c10",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        icons: [
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
      navigateFallback: "/index.html",
      globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"], // ← quita png
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // ← 3 MB
    }
    })
  ],
})
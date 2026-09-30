import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        'icons/control-pipsa-favicon-64.png',
        'icons/control-pipsa-app-icon-192.png',
        'icons/control-pipsa-app-icon-512.png',
      ],
      manifest: {
        name: "Control Pipsa",
        short_name: "Control Pipsa",
        description: "Sistema de gestión de flota Pipsa Montacargas.",
        theme_color: "#071317",
        background_color: "#071317",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        icons: [
          {
            src: "icons/control-pipsa-app-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "icons/control-pipsa-app-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      }
    })
  ],
})
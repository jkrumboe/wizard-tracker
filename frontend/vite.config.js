import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "localhost",
    port: 3000, 
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
  },  
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Wizard Tracker",
        short_name: "WizTracker",
        description: "Track your Wizard card game stats and performance",
        theme_color: "#4A90E2",
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
})


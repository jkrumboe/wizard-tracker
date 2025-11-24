import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import fs from 'fs'

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
const APP_VERSION = packageJson.version

// https://vitejs.dev/config/
export default defineConfig({
  envDir: '../', // Look for .env files in the root directory
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'),
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2', 'recharts'],
          'dnd-vendor': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities', '@dnd-kit/modifiers'],
          'utils': ['axios', 'dexie', 'uuid', 'jwt-decode'],
        },
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Source maps for debugging (disable in production for smaller build)
    sourcemap: false,
  },
  server: {
    host: "localhost",
    port: 3000, 
    strictPort: true,
    hmr: {
      protocol: "ws",
      host: "localhost",
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'service-worker.js',
      injectRegister: 'auto',
      // Add devOptions to test SW in dev mode
      devOptions: {
        enabled: false
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        injectionPoint: 'self.__WB_MANIFEST',
        maximumFileSizeToCacheInBytes: 3145728,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        ignoreURLParametersMatching: [/^v/],
        navigateFallback: null,
        sourcemap: false,
        // Handle precache installation with better error recovery
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache all JS/CSS assets with network-first strategy
            urlPattern: /\.(?:js|css)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        maximumFileSizeToCacheInBytes: 3145728, // 3MB
      },
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      manifest: {
        name: "KeepWiz",
        short_name: "WizTracker",
        description: "Track your Wizard card game stats and performance",
        theme_color: "#111827",
        background_color: "#111827",
        start_url: "/",
        scope: "/",
        capture_links: "existing-client",
        display: "standalone",
        icons: [
          {
            src: 'logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
      },
    }),
    // Post-process to inject version in service worker after build
    {
      name: 'inject-sw-version',
      enforce: 'post',
      writeBundle() {
        // Inject version into the service worker in dist folder
        // VitePWA with injectManifest outputs to dist/service-worker.js
        const distSwPath = './dist/service-worker.js'
        if (fs.existsSync(distSwPath)) {
          let swContent = fs.readFileSync(distSwPath, 'utf-8')
          swContent = swContent.replace(
            /"__APP_VERSION__"/g,
            `"${APP_VERSION}"`
          )
          fs.writeFileSync(distSwPath, swContent)
          console.log(`✓ Injected version ${APP_VERSION} into service worker`)
        } else {
          console.warn(`⚠️  Service worker not found at ${distSwPath}`)
        }
      }
    }
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
})


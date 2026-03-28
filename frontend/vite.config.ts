/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:8000'
const backendProxyWsTarget = backendProxyTarget.replace(/^http/, 'ws')

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  /** Канонический origin прод-сайта: id и start_url в манифесте (критерии installability в Chrome). Переопределение: VITE_PWA_APP_ORIGIN */
  const pwaOrigin = (env.VITE_PWA_APP_ORIGIN || 'https://antexpress.ru').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        // Сразу активировать SW — иначе страница может долго не считаться «под контролем» SW и Chrome не показывает установку
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icons/*.png', 'OS_LOGO.png'],
        manifest: {
          id: `${pwaOrigin}/`,
          name: 'AntExpress',
          short_name: 'AntExpress',
          description: 'AntExpress — Мониторинг и задачи',
          lang: 'ru',
          dir: 'ltr',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          categories: ['business', 'productivity'],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/media\//, /^\/downloads\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    envPrefix: ['VITE_', 'TAURI_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['src/api/**/*.ts', 'src/components/gantt/**/*.tsx', 'src/pages/GanttPage.tsx'],
        exclude: ['src/test/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*'],
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
        '/media': {
          target: backendProxyTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: backendProxyWsTarget,
          ws: true,
        },
      },
    },
    build: {
      target: ['es2021', 'chrome100', 'safari13'],
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/') ||
              id.includes('/react-router-dom/')
            ) {
              return 'react-core'
            }
            return undefined
          },
        },
      },
    },
  }
})

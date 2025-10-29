// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      devOptions: { enabled: false },
      manifest: {
        name: 'FootEra',
        short_name: 'FootEra',
        start_url: '/login',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#169c36',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,

        // Só assets versionados; HTML fica fora do precache
        globPatterns: ['**/*.{js,css,ico,svg,webp,woff2,png}'],

        // NÃO precachear imagens pesadas de usuarios
        globIgnores: ['**/assets/usuarios/**'],

        // (opcional) aumenta o limite p/ evitar warning em outros PNGs
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB

        // HTML sempre pela rede primeiro (evita tela branca pós-deploy)
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 },
            },
          },
          {
            // assets gerados pelo Vite
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
})

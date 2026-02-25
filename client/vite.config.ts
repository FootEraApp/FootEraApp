// client/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: "auto",

      devOptions: {
        enabled: true,
        type: "module",
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,

        // ✅ não deixa o service worker interferir em chamadas da API
        navigateFallbackDenylist: [/^\/api\//],

        // ✅ garante que /api sempre é rede (nunca cache)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: {
              cacheName: "api-no-cache",
            },
          },
        ],
      },

      manifest: {
        name: "FootEra",
        short_name: "FootEra",
        start_url: "/login",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#169c36",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { host: true },
});
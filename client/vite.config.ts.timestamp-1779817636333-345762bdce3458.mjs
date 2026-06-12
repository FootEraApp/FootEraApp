// vite.config.ts
import { defineConfig } from "file:///C:/Users/carol/OneDrive/Documentos/Estagio%20Footera/footera%20app/FootEraApp-app/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/carol/OneDrive/Documentos/Estagio%20Footera/footera%20app/FootEraApp-app/client/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath, URL } from "node:url";
import { VitePWA } from "file:///C:/Users/carol/OneDrive/Documentos/Estagio%20Footera/footera%20app/FootEraApp-app/client/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/carol/OneDrive/Documentos/Estagio%20Footera/footera%20app/FootEraApp-app/client/vite.config.ts";
var vite_config_default = defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: false,
      devOptions: { enabled: false },
      workbox: {
        maximumFileSizeToCacheInBytes: 5e6,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
            options: { cacheName: "api-no-cache" }
          }
        ]
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
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      }
    })
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)) }
  },
  server: { host: true }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjYXJvbFxcXFxPbmVEcml2ZVxcXFxEb2N1bWVudG9zXFxcXEVzdGFnaW8gRm9vdGVyYVxcXFxmb290ZXJhIGFwcFxcXFxGb290RXJhQXBwLWFwcFxcXFxjbGllbnRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGNhcm9sXFxcXE9uZURyaXZlXFxcXERvY3VtZW50b3NcXFxcRXN0YWdpbyBGb290ZXJhXFxcXGZvb3RlcmEgYXBwXFxcXEZvb3RFcmFBcHAtYXBwXFxcXGNsaWVudFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvY2Fyb2wvT25lRHJpdmUvRG9jdW1lbnRvcy9Fc3RhZ2lvJTIwRm9vdGVyYS9mb290ZXJhJTIwYXBwL0Zvb3RFcmFBcHAtYXBwL2NsaWVudC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGJhc2U6IFwiL1wiLFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgc3RyYXRlZ2llczogXCJnZW5lcmF0ZVNXXCIsXHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcblxyXG4gICAgICAvLyB2b2NcdTAwRUEgcmVnaXN0cmEgbm8gbWFpbi50c3ggKHNvbWVudGUgUFJPRClcclxuICAgICAgaW5qZWN0UmVnaXN0ZXI6IGZhbHNlLFxyXG5cclxuICAgICAgLy8gTlx1MDBDM08gaGFiaWxpdGEgU1cgbm8gZGV2XHJcbiAgICAgIGRldk9wdGlvbnM6IHsgZW5hYmxlZDogZmFsc2UgfSxcclxuXHJcbiAgICAgIHdvcmtib3g6IHtcclxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNTAwMDAwMCxcclxuICAgICAgICBjbGVhbnVwT3V0ZGF0ZWRDYWNoZXM6IHRydWUsXHJcbiAgICAgICAgY2xpZW50c0NsYWltOiB0cnVlLFxyXG4gICAgICAgIHNraXBXYWl0aW5nOiB0cnVlLFxyXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2tEZW55bGlzdDogWy9eXFwvYXBpXFwvL10sXHJcblxyXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46ICh7IHVybCB9OiB7IHVybDogVVJMIH0pID0+IHVybC5wYXRobmFtZS5zdGFydHNXaXRoKFwiL2FwaS9cIiksXHJcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya09ubHlcIixcclxuICAgICAgICAgICAgb3B0aW9uczogeyBjYWNoZU5hbWU6IFwiYXBpLW5vLWNhY2hlXCIgfSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogXCJGb290RXJhXCIsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogXCJGb290RXJhXCIsXHJcbiAgICAgICAgc3RhcnRfdXJsOiBcIi9sb2dpblwiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiI2ZmZmZmZlwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMxNjljMzZcIixcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTUxMi5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbi01MTIucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIiB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7IFwiQFwiOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoXCIuL3NyY1wiLCBpbXBvcnQubWV0YS51cmwpKSB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7IGhvc3Q6IHRydWUgfSxcclxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUFvYyxTQUFTLG9CQUFvQjtBQUNqZSxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlLFdBQVc7QUFDbkMsU0FBUyxlQUFlO0FBSHlRLElBQU0sMkNBQTJDO0FBS2xWLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLGNBQWM7QUFBQTtBQUFBLE1BR2QsZ0JBQWdCO0FBQUE7QUFBQSxNQUdoQixZQUFZLEVBQUUsU0FBUyxNQUFNO0FBQUEsTUFFN0IsU0FBUztBQUFBLFFBQ1AsK0JBQStCO0FBQUEsUUFDL0IsdUJBQXVCO0FBQUEsUUFDdkIsY0FBYztBQUFBLFFBQ2QsYUFBYTtBQUFBLFFBQ2IsMEJBQTBCLENBQUMsVUFBVTtBQUFBLFFBRXJDLGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVksQ0FBQyxFQUFFLElBQUksTUFBb0IsSUFBSSxTQUFTLFdBQVcsT0FBTztBQUFBLFlBQ3RFLFNBQVM7QUFBQSxZQUNULFNBQVMsRUFBRSxXQUFXLGVBQWU7QUFBQSxVQUN2QztBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFFQSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixXQUFXO0FBQUEsUUFDWCxTQUFTO0FBQUEsUUFDVCxrQkFBa0I7QUFBQSxRQUNsQixhQUFhO0FBQUEsUUFDYixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUM1RCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sV0FBVyxNQUFNLFlBQVk7QUFBQSxVQUM1RCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxlQUFlO0FBQUEsUUFDdkY7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTyxFQUFFLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDLEVBQUU7QUFBQSxFQUNqRTtBQUFBLEVBQ0EsUUFBUSxFQUFFLE1BQU0sS0FBSztBQUN2QixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=

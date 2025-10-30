import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

export default defineConfig({
  root: "client",            
  plugins: [
    react(),
    legacy({
      targets: [
        "defaults",
        "not IE 11",
        "Android >= 6",
        "iOS >= 12"
      ],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
    },
  },
  build: {
    target: ["es2019", "chrome80", "firefox78", "safari13"],
    outDir: "dist",
    emptyOutDir: true,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
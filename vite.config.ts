import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client", 
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "./src"),
      "hooks": path.resolve(__dirname, "client", "src", "hooks"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:3001", 
    },
    port: 5173,
  },
});

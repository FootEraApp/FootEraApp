import { defineConfig } from "@playwright/test";
import path from "node:path";

const authDir = path.join(process.cwd(), "tests", "e2e", ".auth");

export default defineConfig({
  testDir: path.join(process.cwd(), "tests", "e2e"),
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "admin",
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
      use: { storageState: path.join(authDir, "admin.json") },
    },
  ],
});

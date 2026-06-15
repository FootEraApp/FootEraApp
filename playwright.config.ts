import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "npm run dev:client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
    projects: [
    {
      name: "public",
      testMatch: /routes-public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "setup-admin",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "admin",
      testMatch: /admin\.smoke\.spec\.ts/,
      dependencies: ["setup-admin"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/admin.json",
      },
    },

    {
      name: "setup-users",
      testMatch: /user\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "atleta",
      testMatch: /user\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/atleta.json",
      },
    },

    {
      name: "professor",
      testMatch: /user\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/professor.json",
      },
    },
    {
      name: "professor-creator",
      testMatch: /creator\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/professor.json",
      },
    },

    {
      name: "clube",
      testMatch: /user\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/clube.json",
      },
    },
    {
      name: "clube-creator",
      testMatch: /creator\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/clube.json",
      },
    },

    {
      name: "escola",
      testMatch: /user\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/escola.json",
      },
    },
    {
      name: "escola-creator",
      testMatch: /creator\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/escola.json",
      },
    },

    {
      name: "olheiro",
      testMatch: /user\.smoke\.spec\.ts/,
      dependencies: ["setup-users"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/olheiro.json",
      },
    },
  ],
});
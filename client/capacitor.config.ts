import type { CapacitorConfig } from "@capacitor/cli";

const isLocal =
  (globalThis as any).process?.env?.CAPACITOR_ENV === "development";

const config: CapacitorConfig = {
  appId: "br.app.footera",
  appName: "FootEra",
  webDir: "dist",

  server: isLocal
    ? {
        androidScheme: "http",
        cleartext: true,
      }
    : {
        androidScheme: "https",
        cleartext: false,
      },
};

export default config;
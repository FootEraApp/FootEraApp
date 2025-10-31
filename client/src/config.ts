// client/src/config.ts
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const isDev =
  typeof import.meta !== "undefined"
    ? (import.meta as any).env.DEV
    : process.env.NODE_ENV !== "production";

const strip = (s?: string) => (s ?? "").replace(/\/+$/, "");

const API_BASE =
  strip(viteEnv?.VITE_API_URL) ||
  (typeof window !== "undefined"
    ? (location.hostname.endsWith("app.br")
        ? "https://api.footera.app.br"
        : "http://localhost:3001")
    : (isDev ? "http://localhost:3001" : ""));

export const API = { BASE_URL: API_BASE };

const FRONTEND_BASE =
  strip(viteEnv?.VITE_FRONTEND_URL) ||
  (typeof window !== "undefined"
    ? window.location.origin
    : (isDev ? "http://localhost:5173" : ""));

export const APP = { FRONTEND_BASE_URL: FRONTEND_BASE };

export function appUrl(path: string = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP.FRONTEND_BASE_URL}${p}`;
}

export const FLAGS = { DESAFIOS_ENABLED: false };

export default { API, APP, appUrl };
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const VITE_API_URL =
  viteEnv?.VITE_API_URL ??
  (typeof process !== "undefined" ? process.env.VITE_API_URL : undefined) ??
  "http://localhost:3001";

const VITE_FRONTEND_URL =
  viteEnv?.VITE_FRONTEND_URL ??
  (typeof process !== "undefined" ? process.env.VITE_FRONTEND_URL : undefined) ??
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");

const VITE_APP_URL =
  viteEnv?.VITE_APP_URL ??
  (typeof process !== "undefined" ? process.env.VITE_APP_URL : undefined) ??
  "http://192.168.18.8:3001";

export const API = {
  BASE_URL: VITE_API_URL,
  UPLOADS_URL: `${VITE_API_URL}/uploads`,
};

export const APP = {
  BASE_URL: VITE_APP_URL,
  FRONTEND_BASE_URL: VITE_FRONTEND_URL,
};

export function appUrl(path: string = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return new URL(p, APP.FRONTEND_BASE_URL).toString();
}

export default { API, APP, appUrl };
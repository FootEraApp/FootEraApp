// client/src/config.ts
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const isDev =
  typeof import.meta !== "undefined"
    ? (import.meta as any).env.DEV
    : process.env.NODE_ENV !== "production";

const stripTrailingSlash = (url?: string) => (url ?? "").replace(/\/+$/, "");

// Em dev, se não tiver env, usa localhost; em prod, NÃO fazemos fallback.
const API_BASE = stripTrailingSlash(
  viteEnv?.VITE_API_URL ?? (isDev ? "http://localhost:3001" : "")
);

if (!isDev && !API_BASE) {
  console.error("VITE_API_URL não definida em produção!");
}

const FRONTEND_BASE = stripTrailingSlash(
  viteEnv?.VITE_FRONTEND_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : isDev
      ? "http://localhost:5173"
      : "")
);

export const API = {
  // Ex.: https://api.footera.app.br   (sem /api e sem / no final)
  BASE_URL: API_BASE,
  UPLOADS_URL: API_BASE ? `${API_BASE}/uploads` : "",
};

export const APP = {
  FRONTEND_BASE_URL: FRONTEND_BASE || "http://localhost:5173",
};

export function appUrl(path: string = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP.FRONTEND_BASE_URL}${p}`;
}

export default { API, APP, appUrl };

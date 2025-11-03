// client/src/config.ts
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const isDev =
  typeof import.meta !== "undefined"
    ? !!(import.meta as any).env.DEV
    : process.env.NODE_ENV !== "production";

const stripTrailingSlash = (url?: string) => (url ?? "").replace(/\/+$/, "");

function inferApiFromHost(): string {
  if (isDev) return "http://localhost:3001";
  if (typeof window === "undefined") return "";
  const { protocol, hostname, host } = window.location;

  if (/^api\./i.test(hostname)) return `${protocol}//${host}`;

  return `${protocol}//api.${hostname}`;
}

let API_BASE = stripTrailingSlash(viteEnv?.VITE_API_URL || inferApiFromHost());

if (typeof window !== "undefined" && window.location.protocol === "https:" && API_BASE.startsWith("http://")) {
  API_BASE = API_BASE.replace(/^http:\/\//i, "https://");
}

if (!isDev && !API_BASE) {
  console.error("VITE_API_URL não definida e inferência falhou em produção.");
}

const FRONTEND_BASE = stripTrailingSlash(
  viteEnv?.VITE_FRONTEND_URL ??
    (typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : isDev
      ? "http://localhost:5173"
      : "")
);

export const API = {
  BASE_URL: API_BASE,
  REST: `${API_BASE}/api`,
  UPLOADS_URL: API_BASE ? `${API_BASE}/uploads` : "",
} as const;

export const APP = {
  FRONTEND_BASE_URL: FRONTEND_BASE || "http://localhost:5173",
} as const;

export function appUrl(path: string = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP.FRONTEND_BASE_URL}${p}`;
}

export const FLAGS = {
  DESAFIOS_ENABLED: false,
} as const;

export default { API, APP, appUrl };

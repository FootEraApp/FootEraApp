// server/config.ts
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const nodeEnv =
  typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : undefined;

const isDev =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? !!(import.meta as any).env.DEV
    : typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

const strip = (s?: string) => (s ?? "").replace(/\/+$/, "");
const env = (key: string): string | undefined => {
  return viteEnv?.[`VITE_${key}`] ?? viteEnv?.[key] ?? nodeEnv?.[key];
};

function inferApiFromHost(): string {
  if (isDev) {
    const isAndroid =
      typeof navigator !== "undefined" &&
      /Android/i.test(navigator.userAgent);

    return isAndroid
      ? "https://api.footera.app.br"
      : "http://localhost:3001";
  }

  if (typeof window === "undefined") {
    return (
      env("BACKEND_URL") ||
      env("API_BASE_URL") ||
      env("APP_URL") ||
      "https://api.footera.app.br"
    );
  }

  const { protocol, hostname, host } = window.location;

  if (/^api\./i.test(hostname)) return `${protocol}//${host}`;

  const root = hostname.replace(/^www\./i, "");
  return `${protocol}//api.${root}`;
}

let API_BASE = strip(
  viteEnv?.VITE_API_URL ||
    env("BACKEND_URL") ||
    env("API_BASE_URL") ||
    env("APP_URL") ||
    inferApiFromHost()
);

const isLocalApi =
  /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i.test(API_BASE);

if (
  typeof window !== "undefined" &&
  window.location.protocol === "https:" &&
  /^http:\/\//i.test(API_BASE) &&
  !isLocalApi
) {
  API_BASE = API_BASE.replace(/^http:\/\//i, "https://");
}

if (!isDev && !API_BASE) {
  console.error("VITE_API_URL não definida e inferência falhou em produção.");
}

export const SERVER = {
  PORT: env("PORT") ?? "3001",
  NODE_ENV: env("NODE_ENV") ?? "development",
  CLIENT_BASE_URL: strip(
    env("CLIENT_BASE_URL") ||
      env("FRONTEND_URL") ||
      "http://localhost:5173"
  ),
} as const;

export const API = {
  BASE_URL: API_BASE,
  REST: API_BASE ? `${API_BASE}/api` : "",
  UPLOADS_URL: API_BASE ? `${API_BASE}/uploads` : "",
} as const;

const FRONTEND_BASE = strip(
  viteEnv?.VITE_FRONTEND_URL ??
    env("FRONTEND_URL") ??
    env("CLIENT_BASE_URL") ??
    (typeof window !== "undefined"
      ? window.location.origin
      : isDev
      ? "http://localhost:5173"
      : "https://footera.app.br")
);

export const APP = {
  FRONTEND_BASE_URL: FRONTEND_BASE || "http://localhost:5173",
  FRONTEND_URL: FRONTEND_BASE || "http://localhost:5173",
  BACKEND_URL: API_BASE || "http://localhost:3001",
} as const;

export function appUrl(path: string = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP.FRONTEND_BASE_URL}${p}`;
}

export const MESSAGES = {
  PAGAMENTOS_EM_REFORMULACAO:
    "Estamos reformulando a página de assinaturas e pagamentos no momento.",
} as const;

export const FLAGS = {
  DESAFIOS_ENABLED: false,
  LEARNING_ENABLED: true,
  PAGAMENTOS_ENABLED: true,
  FORMADORES_ENABLED: false,

  PAGAMENTOS_SHOW_LEARNING_PLANS: true,
  PAGAMENTOS_SHOW_METODOLOGIAS_AVULSAS: true,
  PAGAMENTOS_SHOW_METODOLOGIAS_LEARNING: true,
} as const;

export default {
  SERVER,
  API,
  APP,
  appUrl,
  MESSAGES,
  FLAGS,
};
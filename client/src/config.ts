const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const strip = (s?: string) => (s ?? "").replace(/\/+$/, "");

const mode = viteEnv?.MODE || "development";
const isLocalMode = mode === "development" || mode === "local";

function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as any;
  const platform = w.Capacitor?.getPlatform?.();

  return (
    window.location.protocol === "capacitor:" ||
    platform === "android" ||
    platform === "ios"
  );
}

function inferApiFromHost(): string {
  if (typeof window === "undefined") return "";

  const isNative = isCapacitorNative();

  if (isLocalMode) {
    return isNative
      ? "http://10.0.2.2:3001"
      : "http://localhost:3001";
  }

  const { protocol, hostname, host } = window.location;

  if (/^api\./i.test(hostname)) {
    return `${protocol}//${host}`;
  }

  const root = hostname.replace(/^www\./i, "");
  return `${protocol}//api.${root}`;
}

const envWebApi = strip(viteEnv?.VITE_API_URL);
const envAndroidApi = strip(viteEnv?.VITE_ANDROID_API_URL);

let API_BASE = isLocalMode && isCapacitorNative()
  ? envAndroidApi || "http://10.0.2.2:3001"
  : envWebApi || inferApiFromHost();

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

console.log("[CONFIG API]", {
  mode,
  isLocalMode,
  isNative: typeof window !== "undefined" ? isCapacitorNative() : false,
  API_BASE,
});

export const API = {
  BASE_URL: API_BASE,
  REST: API_BASE ? `${API_BASE}/api` : "",
  UPLOADS_URL: API_BASE ? `${API_BASE}/uploads` : "",
} as const;

const FRONTEND_BASE = strip(
  viteEnv?.VITE_FRONTEND_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : isLocalMode
      ? "http://localhost:5173"
      : "https://footera.app.br")
);

export const APP = {
  FRONTEND_BASE_URL: FRONTEND_BASE || "http://localhost:5173",
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
  TUTORIAL_ENABLED: false,

  PAGAMENTOS_SHOW_LEARNING_PLANS: true,
  PAGAMENTOS_SHOW_METODOLOGIAS_AVULSAS: true,
  PAGAMENTOS_SHOW_METODOLOGIAS_LEARNING: true,
} as const;

export default { API, APP, appUrl };
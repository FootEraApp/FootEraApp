// client/src/config.ts
const viteEnv =
  typeof import.meta !== "undefined" && (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : undefined;

const isDev =
  typeof import.meta !== "undefined"
    ? !!(import.meta as any).env.DEV
    : process.env.NODE_ENV !== "production";

const strip = (s?: string) => (s ?? "").replace(/\/+$/, "");

function inferApiFromHost(): string {
  // Dev: sempre localhost:3001
  if (isDev) return "http://localhost:3001";

  // SSR/Build sem window
  if (typeof window === "undefined") return "";

  const { protocol, hostname, host } = window.location;

  // Se já estiver em api.<domínio>, usa como está
  if (/^api\./i.test(hostname)) return `${protocol}//${host}`;

  // Normaliza www.
  const root = hostname.replace(/^www\./i, "");
  return `${protocol}//api.${root}`;
}

// --- API ---
let API_BASE = strip(viteEnv?.VITE_API_URL || inferApiFromHost());

// Evita mixed content: se a página é https e a API ficou http, sobe para https.
if (typeof window !== "undefined" && window.location.protocol === "https:" && /^http:\/\//i.test(API_BASE)) {
  API_BASE = API_BASE.replace(/^http:\/\//i, "https://");
}

if (!isDev && !API_BASE) {
  console.error("VITE_API_URL não definida e inferência falhou em produção.");
}

export const API = {
  BASE_URL: API_BASE,
  REST: API_BASE ? `${API_BASE}/api` : "",
  UPLOADS_URL: API_BASE ? `${API_BASE}/uploads` : "",
} as const;

// --- FRONTEND (APP) ---
const FRONTEND_BASE = strip(
  viteEnv?.VITE_FRONTEND_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : isDev
      ? "http://localhost:5173"
      : "https://footera.app.br")
);

export const APP = {
  FRONTEND_BASE_URL: FRONTEND_BASE || "http://localhost:5173",
} as const;

// Helpers
export function appUrl(path: string = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${APP.FRONTEND_BASE_URL}${p}`;
}

// Feature flags
export const FLAGS = {
  DESAFIOS_ENABLED: false,
} as const;

export default { API, APP, appUrl };

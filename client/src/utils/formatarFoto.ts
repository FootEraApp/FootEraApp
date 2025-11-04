import { API } from "../config.js";

const RX_DEV_HOST =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?/i;

function forceHttps(u: string): string {
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return u.replace(/^http:\/\//i, "https://");
  }
  return u;
}

export function formatarUrlFoto(
  foto: string | null | undefined,
  pasta: string = "usuarios"
): string {
  if (!foto) return "";

  let s = String(foto).trim();

  if (RX_DEV_HOST.test(s) && API.BASE_URL) {
    s = s.replace(RX_DEV_HOST, API.BASE_URL);
  }

  if (/^https?:\/\//i.test(s)) return forceHttps(s);
  if (/^(data:|blob:)/i.test(s)) return s;

  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("assets/")) return `/${s}`;

  if (s.startsWith("/uploads/")) return forceHttps(`${API.BASE_URL}${s}`);
  if (s.startsWith("uploads/"))  return forceHttps(`${API.BASE_URL}/${s}`);

  if (s.startsWith(`${pasta}/`)) return `/assets/${s}`;

  return `/assets/${pasta}/${s.replace(/^\/+/, "")}`;
}
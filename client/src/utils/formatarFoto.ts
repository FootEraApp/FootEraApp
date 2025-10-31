// client/src/utils/formatarFoto.ts
import { API } from "@/config.js";

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

  const s = String(foto).trim();

  if (/^(https?:|data:|blob:)/i.test(s)) return forceHttps(s);

  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("assets/")) return `/${s}`;

  if (s.startsWith("/uploads/")) return forceHttps(`${API.BASE_URL}${s}`);
  if (s.startsWith("uploads/"))  return forceHttps(`${API.BASE_URL}/${s}`);

  if (s.startsWith(`${pasta}/`)) return `/assets/${s}`;

  return `/assets/${pasta}/${s.replace(/^\/+/, "")}`;
}

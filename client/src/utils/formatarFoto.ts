import { API } from "@/config.js";

export function formatarUrlFoto(
  foto: string | null | undefined,
  pasta: string = "usuarios"
): string {
  if (!foto) return "";

  const s = String(foto).trim();

  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("assets/")) return `/${s}`;
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/"))   return `${API.BASE_URL}/${s}`;
  if (s.startsWith(`${pasta}/`)) return `/assets/${s}`;

  return `/assets/${pasta}/${s}`;
}
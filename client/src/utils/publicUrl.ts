import { API } from "@/config.js";

const RX_LOCALHOST = /^https?:\/\/localhost:3001/i;

export function publicImgUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const s = String(path).trim();
  if (/^data:|^blob:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s.replace(RX_LOCALHOST, API.BASE_URL);
  if (s.startsWith("/uploads")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;
  if (s.startsWith("/assets/") || s.startsWith("assets/")) return s.startsWith("/") ? s : `/${s}`;
  return s;
}
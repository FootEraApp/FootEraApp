import { API, APP } from "@/config.js";

export function publicImgUrl(raw?: string | null): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) return s;

  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/"))  return `${API.BASE_URL}/${s}`;
  if (s.startsWith("/assets/"))  return `${APP.FRONTEND_BASE_URL}${s}`;
  if (s.startsWith("assets/"))   return `${APP.FRONTEND_BASE_URL}/${s}`;

  return null;
}
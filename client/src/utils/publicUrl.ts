import { API, APP } from "@/config.js";

export function publicImgUrl(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/uploads/")) return `${API.BASE_URL}${u}`;
  if (u.startsWith("/assets/")) return `${APP.FRONTEND_BASE_URL}${u}`;
  if (u.startsWith("assets/")) return `${APP.FRONTEND_BASE_URL}/${u}`;

  return `${APP.FRONTEND_BASE_URL}/assets/${u.replace(/^\/+/, "")}`;
}
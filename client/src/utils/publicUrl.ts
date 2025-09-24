import { API, APP } from "@/config.js";

export function publicImgUrl(raw?: string | null): string | null {
  if (!raw) return null;
  let u = String(raw).trim();
  if (!u) return null;

  if (/^(https?:)?\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:")) return u;

  u = u.replace(/\\/g, "/").replace(/\/{2,}/g, "/");

  if (u.startsWith("/uploads/")) return `${API.BASE_URL}${u}`;
  if (u.startsWith("uploads/"))  return `${API.BASE_URL}/${u}`;
  if (u.startsWith("/assets/"))  return `${APP.FRONTEND_BASE_URL}${u}`;
  if (u.startsWith("assets/"))   return `${APP.FRONTEND_BASE_URL}/${u}`;

  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(u)) {
    return `${API.BASE_URL}/uploads/${u.replace(/^\/+/, "")}`;
  }

  return `${API.BASE_URL}/uploads/${u.replace(/^\/+/, "")}`;
}
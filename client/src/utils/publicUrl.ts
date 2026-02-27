import { API, APP } from "../config.js";

const RX_DEV_HOST =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?/i;

function stripSlashEnd(s: string) {
  return s.replace(/\/+$/, "");
}

export function publicImgUrl(path: string | null | undefined): string | null {
  if (!path) return null;

  const s0 = String(path).trim();
  if (!s0) return null;
  if (/^data:|^blob:/i.test(s0)) return s0;

  if (/^https?:\/\//i.test(s0)) {
    return s0.replace(RX_DEV_HOST, stripSlashEnd(API.BASE_URL));
  }

  const s = s0.startsWith("/") ? s0 : `/${s0}`;

  if (s.startsWith("/uploads/")) return `${stripSlashEnd(API.BASE_URL)}${s}`;
  if (s.startsWith("/assets/")) return `${stripSlashEnd(APP.FRONTEND_BASE_URL)}${s}`;

  return `${stripSlashEnd(APP.FRONTEND_BASE_URL)}${s}`;
}
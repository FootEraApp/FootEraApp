import { API } from "../config.js";

export function formatarUrlFoto(
  src: string | File | null | undefined,
  pasta: string = "usuarios"
): string {
  if (!src) return "";

  if (typeof File !== "undefined" && src instanceof File) {
    return URL.createObjectURL(src);
  }

  const s = String(src);

  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/") || s.startsWith("/assets/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("assets/")) return `${API.BASE_URL}/${s}`;
  if (s.startsWith("/usuarios/")) return `${API.BASE_URL}/uploads${s}`;

  const clean = s.replace(/^\/+/, "");
  const folder = (pasta || "").replace(/^\/+|\/+$/g, "");
  return `${API.BASE_URL}/uploads/${folder ? folder + "/" : ""}${clean}`;
}

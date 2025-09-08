import { API } from "@/config.js";

type Pasta = "usuarios" | "desafios" | "escolas" | "clubes" | "treinos" | "misc";

export function formatarUrlFoto(raw?: string | null, pastaPadrao: Pasta = "usuarios"): string {
  const fallback = `${API.BASE_URL}/assets/default-user.png`;
  if (!raw) return fallback;

  let v = String(raw).trim();

  if (/^https?:\/\//i.test(v)) return v;
  v = v.replace(/^\/+/, "");
  v = v.replace(/^public\//i, "");
  v = v.replace(/^assets\//i, "");

  if (v.startsWith("assets/")) return `${API.BASE_URL}/${v}`;
  const temPasta = /^(usuarios|desafios|escolas|clubes|treinos)\//i.test(v);
  const temExt = /\.[a-z0-9]{3,4}$/i.test(v);
  
  if (!temExt) v += ".jpg";
  const caminho = temPasta ? v : `${pastaPadrao}/${v}`;
  return `${API.BASE_URL}/assets/${caminho}`;
}
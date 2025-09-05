// client/src/utils/formatarFoto.ts
import { API } from "@/config.js";

type Pasta = "usuarios" | "desafios" | "escolas" | "clubes" | "treinos" | "misc";

export function formatarUrlFoto(raw?: string | null, pastaPadrao: Pasta = "usuarios"): string {
  // fallback genérico
  const fallback = `${API.BASE_URL}/assets/default-user.png`;
  if (!raw) return fallback;

  let v = String(raw).trim();

  // URL absoluta já pronta
  if (/^https?:\/\//i.test(v)) return v;

  // tira barras iniciais
  v = v.replace(/^\/+/, "");

  // remove prefixos comuns
  v = v.replace(/^public\//i, "");
  v = v.replace(/^assets\//i, "");

  // se já vier /assets/... mantenha
  if (v.startsWith("assets/")) return `${API.BASE_URL}/${v}`;

  // detecta se já tem a pasta na frente
  const temPasta = /^(usuarios|desafios|escolas|clubes|treinos)\//i.test(v);

  // se não tiver extensão, assume .jpg
  const temExt = /\.[a-z0-9]{3,4}$/i.test(v);
  if (!temExt) v += ".jpg";

  const caminho = temPasta ? v : `${pastaPadrao}/${v}`;
  return `${API.BASE_URL}/assets/${caminho}`;
}

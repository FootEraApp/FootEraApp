// client/src/utils/formatarFoto.ts (ou .js)
import { API } from "../config";

export function formatarUrlFoto(foto?: string | File | null): string {
  // Nada? usa placeholder local do front
  if (!foto) return "/img/avatar-placeholder.png";

  // Se veio File (input file), usa blob local (preview)
  if (typeof foto !== "string") return URL.createObjectURL(foto);

  let s = foto.trim();

  // Já é absoluto / data / blob?
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    // corrige legado absoluto com /assets/usuarios → /uploads
    s = s.replace(/\/assets\/usuarios\//, "/uploads/");
    return s;
  }

  // Corrige legado relativo com /assets/usuarios → /uploads
  s = s.replace(/^\/?assets\/usuarios\//, "/uploads/");

  // Se começar com /uploads, prefixa com a API
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;

  // Se começar com uploads/, idem
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;

  // Se só veio o nome do arquivo, joga em /uploads
  return `${API.BASE_URL}/uploads/${s.replace(/^\/+/, "")}`;
}

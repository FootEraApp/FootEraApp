import { API } from "@/config.js";

const RX_DEV_HOST = /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(?::\d+)?/i;

export function formatarUrlFoto(
  foto: string | null | undefined,
  pasta: string = "usuarios"
): string {
  if (!foto) return "";

  let s = String(foto).trim();

  // troca base antiga de dev por produção
  if (RX_DEV_HOST.test(s)) s = s.replace(RX_DEV_HOST, API.BASE_URL);
  
  // já é absoluta ou data/blob
  if (/^(https?:|data:|blob:)/i.test(s)) return s;

  // assets estáticos
  if (s.startsWith("/assets/")) return s;
  if (s.startsWith("assets/")) return `/${s}`;

  // uploads do backend
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/"))   return `${API.BASE_URL}/${s}`;

  // imagens empacotadas na pasta /assets/<pasta>/*
  if (s.startsWith(`${pasta}/`)) return `/assets/${s}`;

  return `/assets/${pasta}/${s}`;
}
import sanitizeHtml from "sanitize-html";
import leo from "leo-profanity";

const loadDict = leo.loadDictionary as unknown as (lang: string) => void;
try { loadDict("pt-br"); } catch {}
try { loadDict("pt"); } catch {}

export const MOD = {
  MAX_DESC_LEN: 2000,
  MAX_COMMENT_LEN: 800,
  ALLOWED_IMG: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  ALLOWED_VID: ["video/mp4", "video/webm"],
  ALLOWED_HOSTS: new Set<string>([process.env.APP_HOST || "", process.env.CDN_HOST || ""].filter(Boolean)),
};

export function sanitizeText(input: string, max = MOD.MAX_DESC_LEN) {
  const clean = sanitizeHtml(String(input || ""), {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  })
    .replace(/\r\n/g, "\n")
    .trim();
  return clean.length > max ? clean.slice(0, max) : clean;
}

const contatoRegex =
  /(https?:\/\/(wa\.me|chat\.whatsapp\.com)\/\S+)|(\b\d{2}\s?9?\d{4}[-\s]?\d{4}\b)|([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

export function basicModerationFails(text: string): string | null {
  const lower = (text || "").toLowerCase();
  if (leo.check(lower)) return "Conteúdo com palavrões/ofensas.";
  if (contatoRegex.test(lower)) return "Não é permitido divulgar contatos (telefone, e-mail, WhatsApp) aqui.";
  return null;
}

export function isHttpsUrl(u?: string) {
  try {
    const url = new URL(u!);
    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function normalizeIncomingMediaUrl(u: string, reqHost: string) {
  if (!u) return "";
  const s = String(u).trim();
  if (s.startsWith("/uploads/")) return s;
  if (isHttpsUrl(s)) {
    const url = new URL(s);
    if (url.host === reqHost || MOD.ALLOWED_HOSTS.has(url.host)) {
      return url.pathname.startsWith("/uploads/") ? url.pathname : s;
    }
  }
  return "";
}

export function isAllowedMime(m: string) {
  return MOD.ALLOWED_IMG.includes(m) || MOD.ALLOWED_VID.includes(m);
}

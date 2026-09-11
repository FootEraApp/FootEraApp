import { appUrl } from "../config.js";

function ref(value: string) {
  return encodeURIComponent(
    String(value || "")
      .replace(/^@/, "")
      .trim()
  );
}

export const PUBLIC_PATHS = {
  profile: (username: string) =>
    `/profile/${ref(username)}`,

  post: (id: string) =>
    `/post/${ref(id)}`,

  organizacao: (username: string) =>
    `/organizacao/${ref(username)}`,

  turma: (id: string) =>
    `/turma/${ref(id)}`,

  treino: (id: string) =>
    `/treino/${ref(id)}`,

  evento: (id: string) =>
    `/evento/${ref(id)}`,

  metodologia: (id: string) =>
    `/metodologia/${ref(id)}`,

  desafio: (id: string) =>
    `/desafio/${ref(id)}`,

  join: (token: string) =>
    `/join/${ref(token)}`,
} as const;

export function publicAppUrl(
  path: string
) {
  return appUrl(path);
}

const DEEP_LINK_PATHS = [
  /^\/profile\/[^/]+\/?$/i,
  /^\/post\/[^/]+\/?$/i,
  /^\/organizacao\/[^/]+\/?$/i,
  /^\/turma\/[^/]+\/?$/i,
  /^\/treino\/[^/]+\/?$/i,
  /^\/evento\/[^/]+\/?$/i,
  /^\/metodologia\/[^/]+\/?$/i,
  /^\/desafio\/[^/]+\/?$/i,
  /^\/join\/[^/]+\/?$/i,

  // Compatibilidade com links antigos
  /^\/perfil\/[^/]+\/?$/i,
  /^\/eventos\/[^/]+\/?$/i,
  /^\/metodologias\/[^/]+\/?$/i,
  /^\/desafios\/[^/]+\/?$/i,
  /^\/treinos\/unico\/?$/i,
];

export function deepLinkPathFromUrl(
  rawUrl: string
): string | null {
  try {
    const url = new URL(rawUrl);

    const host =
      url.hostname.toLowerCase();

    if (
      host !== "footera.app.br" &&
      host !== "www.footera.app.br"
    ) {
      return null;
    }

    const path =
      url.pathname || "/";

    const permitido =
      DEEP_LINK_PATHS.some(
        (regex) =>
          regex.test(path)
      );

    if (!permitido) {
      return null;
    }

    return `${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
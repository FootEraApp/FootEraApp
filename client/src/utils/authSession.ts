import {
  syncSocketAuth,
} from "../services/socket.js";

export type AuthSessionResponse = {
  usuario?: {
    id?: string;
    nomeDeUsuario?: string;
    tipo?: string;
    plano?: string;
  };
  id?: string;
  nomeDeUsuario?: string;
  tipo?: string;
  token?: string;
  tipoUsuarioId?: string | number | null;
  plano?: string;
  olheiro?: { id?: string };
  professor?: { id?: string };
  clube?: { id?: string };
  escolinha?: { id?: string };
  atleta?: { id?: string };
};

const SESSION_KEYS = [
  "token",
  "usuarioId",
  "nomeUsuario",
  "tipoUsuario",
  "usuarioTipoRaw",
  "tipoUsuarioId",
  "plano",
] as const;

const MAP_TIPO: Record<string, string> = {
  admin: "admin",
  atleta: "atleta",
  professor: "professor",
  clube: "clube",
  escolinha: "escolinha",
  escola: "escola",
  olheiro: "olheiro",
  learning: "learning",
  federacao: "federacao",
  marca: "marca",
};

export function applyAuthSession(
  data: AuthSessionResponse,
  opts: { lembrar: boolean }
): { usuarioId: string; isAdmin: boolean } {
  const usuario = data.usuario ?? {};
  const usuarioId = String(usuario.id ?? data.id ?? "");
  const usuarioNome = String(usuario.nomeDeUsuario ?? data.nomeDeUsuario ?? "");
  const token = String(data.token ?? "");

  if (!token || !usuarioId) {
    throw new Error("Resposta inválida do servidor (token/usuarioId ausente).");
  }

  const store = opts.lembrar ? localStorage : sessionStorage;

  SESSION_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });

  store.setItem("token", token);
  store.setItem("usuarioId", usuarioId);
  if (usuarioNome) store.setItem("nomeUsuario", usuarioNome);

  const rawTipo = String(usuario.tipo ?? data.tipo ?? "").toLowerCase();
  const isAdmin = rawTipo === "admin";

  store.setItem("tipoUsuario", isAdmin ? "admin" : MAP_TIPO[rawTipo] ?? "atleta");
  store.setItem("usuarioTipoRaw", rawTipo);

  const tipoUsuarioId =
    data.tipoUsuarioId ||
    data?.olheiro?.id ||
    data?.professor?.id ||
    data?.clube?.id ||
    data?.escolinha?.id ||
    data?.atleta?.id ||
    null;

  if (tipoUsuarioId) store.setItem("tipoUsuarioId", String(tipoUsuarioId));

  const plano = String(usuario.plano ?? data.plano ?? "FREE");
  store.setItem("plano", plano);
  syncSocketAuth(token);

  return { usuarioId, isAdmin };
}

export function salvarRetornoAuth(
  destino?: string
) {
  const valor =
    destino ||
    (
      `${window.location.pathname}` +
      `${window.location.search}` +
      `${window.location.hash}`
    );

  if (
    valor.startsWith("/") &&
    !valor.startsWith("//")
  ) {
    sessionStorage.setItem(
      "footera:returnTo",
      valor
    );
  }
}

export function consumirRetornoAuth(
  fallback = "/perfil"
) {
  const valor =
    sessionStorage.getItem(
      "footera:returnTo"
    );

  sessionStorage.removeItem(
    "footera:returnTo"
  );

  if (
    !valor ||
    !valor.startsWith("/") ||
    valor.startsWith("//")
  ) {
    return fallback;
  }

  return valor;
}
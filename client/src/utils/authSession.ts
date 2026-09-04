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

export type PendingAuthAction =
  | {
      type: "FOLLOW_PROFILE";
      perfilId: string;
    }
  | {
      type: "LIKE_POST";
      postId: string;
    }
  | {
      type: "COMMENT_POST";
      postId: string;
      texto?: string;
    }
  | {
      type: "REPOST_POST";
      postId: string;
    }
  | {
    type: "OPEN_EVENT_CONVOCATION";
    eventoId: string;
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

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("footera:auth-changed", {
        detail: {
          authenticated: true,
          usuarioId,
        },
      })
    );
  }

  return { usuarioId, isAdmin };
}

export function clearAuthSession() {
  SESSION_KEYS.forEach((k) => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });

  syncSocketAuth(null);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("footera:auth-changed", {
        detail: {
          authenticated: false,
        },
      })
    );
  }
}

const RETURN_TO_KEY =
  "footera:returnTo";

const PENDING_ACTION_KEY =
  "footera:pendingAuthAction";

const PENDING_ACTION_TTL_MS =
  30 * 60 * 1000;

function caminhoAtual(): string {
  if (
    typeof window === "undefined"
  ) {
    return "/perfil";
  }

  return (
    `${window.location.pathname}` +
    `${window.location.search}` +
    `${window.location.hash}`
  );
}

export function normalizarReturnTo(
  destino?: unknown
): string | null {
  const raw =
    String(destino ?? "").trim();

  if (!raw) {
    return null;
  }

  if (
    !raw.startsWith("/") ||
    raw.startsWith("//")
  ) {
    return null;
  }

  if (raw.includes("\\")) {
    return null;
  }

  if (
    /[\u0000-\u001F\u007F]/.test(raw)
  ) {
    return null;
  }

  try {
    const decoded =
      decodeURIComponent(raw);

    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      decoded.includes("\\")
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return raw;
}

export function salvarRetornoAuth(
  destino?: string
): string | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  const seguro =
    normalizarReturnTo(
      destino || caminhoAtual()
    );

  try {
    if (!seguro) {
      sessionStorage.removeItem(
        RETURN_TO_KEY
      );

      return null;
    }

    sessionStorage.setItem(
      RETURN_TO_KEY,
      seguro
    );

    return seguro;
  } catch {
    return null;
  }
}

export function consumirRetornoAuth(
  fallback = "/perfil"
): string {
  const fallbackSeguro =
    normalizarReturnTo(fallback) ||
    "/perfil";

  if (
    typeof window === "undefined"
  ) {
    return fallbackSeguro;
  }

  let valor: string | null = null;

  try {
    valor =
      sessionStorage.getItem(
        RETURN_TO_KEY
      );

    sessionStorage.removeItem(
      RETURN_TO_KEY
    );
  } catch {
    return fallbackSeguro;
  }

  const seguro =
    normalizarReturnTo(valor);

  if (!seguro) {
    limparAcaoPendenteAuth();

    return fallbackSeguro;
  }

  return seguro;
}

function identificadorValido(
  valor: unknown
): string | null {
  const id =
    String(valor ?? "").trim();

  if (
    !id ||
    id.length > 200
  ) {
    return null;
  }

  if (
    !/^[A-Za-z0-9._:-]+$/.test(id)
  ) {
    return null;
  }

  return id;
}

function validarAcaoPendente(
  valor: any
): PendingAuthAction | null {
  if (
    !valor ||
    typeof valor !== "object"
  ) {
    return null;
  }

  const type =
    String(valor.type || "");

  if (type === "FOLLOW_PROFILE") {
    const perfilId =
      identificadorValido(
        valor.perfilId
      );

    if (!perfilId) return null;

    return {
      type,
      perfilId,
    };
  }

  if (type === "LIKE_POST") {
    const postId =
      identificadorValido(
        valor.postId
      );

    if (!postId) return null;

    return {
      type,
      postId,
    };
  }

  if (type === "COMMENT_POST") {
    const postId =
      identificadorValido(
        valor.postId
      );

    if (!postId) return null;

    const texto =
      String(
        valor.texto ?? ""
      )
        .trim()
        .slice(0, 2000);

    return {
      type,
      postId,
      ...(texto
        ? { texto }
        : {}),
    };
  }

  if (type === "REPOST_POST") {
    const postId =
      identificadorValido(
        valor.postId
      );

    if (!postId) return null;

    return {
      type,
      postId,
    };
  }

  if (
    type ===
    "OPEN_EVENT_CONVOCATION"
  ) {
    const eventoId =
      identificadorValido(
        valor.eventoId
      );

    if (!eventoId) {
      return null;
    }

    return {
      type,
      eventoId,
    };
  }

  return null;
}

export function salvarAcaoPendenteAuth(
  action?: PendingAuthAction | null
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  const segura =
    validarAcaoPendente(action);

  try {
    if (!segura) {
      sessionStorage.removeItem(
        PENDING_ACTION_KEY
      );

      return;
    }

    sessionStorage.setItem(
      PENDING_ACTION_KEY,
      JSON.stringify({
        createdAt: Date.now(),
        action: segura,
      })
    );
  } catch {}
}

export function lerAcaoPendenteAuth():
  PendingAuthAction | null {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      sessionStorage.getItem(
        PENDING_ACTION_KEY
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    const createdAt =
      Number(
        parsed?.createdAt ?? 0
      );

    if (
      !createdAt ||
      Date.now() - createdAt >
        PENDING_ACTION_TTL_MS
    ) {
      sessionStorage.removeItem(
        PENDING_ACTION_KEY
      );

      return null;
    }

    const action =
      validarAcaoPendente(
        parsed?.action
      );

    if (!action) {
      sessionStorage.removeItem(
        PENDING_ACTION_KEY
      );

      return null;
    }

    return action;
  } catch {
    try {
      sessionStorage.removeItem(
        PENDING_ACTION_KEY
      );
    } catch {}

    return null;
  }
}

export function limparAcaoPendenteAuth() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    sessionStorage.removeItem(
      PENDING_ACTION_KEY
    );
  } catch {}
}

export function limparFluxoAuthPendente() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    sessionStorage.removeItem(
      RETURN_TO_KEY
    );

    sessionStorage.removeItem(
      PENDING_ACTION_KEY
    );
  } catch {}
}
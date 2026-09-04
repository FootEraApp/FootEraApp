import { API } from "../config.js";
import { toast } from "@/lib/toast";
import { readToken } from "../utils/auth.js";

export interface Usuario {
  id: string;
  nome: string;
  nomeDeUsuario?: string;
  foto?: string | null;
  tipo: string;
  destaque?: boolean | null;
  verified?: boolean | null;
}

export interface Comentarios {
  id: string;
  conteudo: string;
  dataCriacao: string;
  usuarioId: string;
  usuario?: { id?: string; nome: string; foto?: string | null };
}

export type VisibilidadePostagem =
  | "PUBLICO"
  | "LOGADO"
  | "SEGUIDORES"
  | "PRIVADO";

export type PostagemComUsuario = {
  id: string;
  conteudo: string;
  dataCriacao: string;
  usuario: {
    id: string;
    nome: string;
    nomeDeUsuario?: string | null;
    foto?: string | null;
    tipo?: string;
    destaque?: boolean | null;
    verified?: boolean | null;
  };
  imagemUrl?: string | null;
  videoUrl?: string | null;
  tipoMidia?: "Imagem" | "Video" | "Documento" | null;
  curtidas: { usuarioId: string }[];
  comentarios: Comentarios[];
  compartilhamentos?: number | null;
  reposts?: number | null;
  totalCurtidas?: number;
  visibilidade?: VisibilidadePostagem;
  repostOf?: PostagemComUsuario | null;
};

export type PostId = string;

export interface CriarPostInput {
  descricao?: string;
  imagemUrl?: string;
  videoUrl?: string;
  arquivo?: File | null;
  visibilidade?:
    VisibilidadePostagem;
}

export type FiltroFeed = "todos" | "seguindo" | "favoritos" | "meus";

const AUTH_STORAGE_KEYS = [
  "token",
  "usuarioId",
  "nomeUsuario",
  "tipoUsuario",
  "usuarioTipoRaw",
  "tipoUsuarioId",
  "plano",
] as const;

function clearStoredAuth() {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

async function throwResponseError(
  response: Response,
  fallback: string
): Promise<never> {
  const body = await response.text().catch(() => "");
  const error: any = new Error(body || fallback);
  error.status = response.status;
  throw error;
}

function readBearerToken():
  string | null {
  const raw =
    readToken();

  if (!raw) {
    return null;
  }

  return raw.startsWith(
    "Bearer "
  )
    ? raw
    : `Bearer ${raw}`;
}

function pickToken():
  string {
  const token =
    readBearerToken();

  if (!token) {
    const error: any = new Error(
      "Sem token. Faça login novamente."
    );
    error.status = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  return token;
}

const auth = () => ({
  Authorization:
    pickToken(),
});

const optionalAuth = ():
  {
    Authorization?: string;
  } => {
  const token =
    readBearerToken();

  return token
    ? {
        Authorization:
          token,
      }
    : {};
};

async function optionalGet(
  url: string
): Promise<Response> {
  const headers =
    optionalAuth();

  let response =
    await fetch(url, {
      headers,
    });

  /*
   * Pode existir um token antigo
   * ou expirado no navegador.
   *
   * Como esta é uma rota pública,
   * tentamos novamente como visitante.
   */
  if (
    response.status === 401 &&
    headers.Authorization
  ) {
    // A API recusou a sessão armazenada. Como esta é uma rota pública,
    // limpa apenas as chaves de autenticação e repete como visitante.
    clearStoredAuth();
    response = await fetch(url);
  }

  return response;
}

interface FeedMeta {
  adsEnabled: boolean;
  adEveryN: number | null;
  adsRemainingToday: number;
}

interface FeedApiResponse {
  items: PostagemComUsuario[];
  meta?: FeedMeta;
}

export async function getFeedPosts(
  filtro: FiltroFeed = "todos"
): Promise<PostagemComUsuario[]> {
  const params: Record<string, string> = {};
  if (filtro && filtro !== "todos") {
    params.filtro = filtro;
  }

  const qs = new URLSearchParams(params).toString();
  const url = `${API.BASE_URL}/api/feed${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await optionalGet(url);
  } catch (e) {
    console.error("Erro de rede ao carregar feed:", e);
    throw e;
  }

  if (!res.ok) throw new Error(`Falha ao carregar feed (${res.status})`);

  const json = await res.json();

  if (Array.isArray(json)) {
    return json as PostagemComUsuario[];
  }

  const typed = json as FeedApiResponse;
  return Array.isArray(typed.items) ? typed.items : [];
}

export async function likePost(postId: string) {
  const response = await fetch(`${API.BASE_URL}/api/feed/${postId}/like`, {
    method: "POST",
    headers: auth(),
  });

  if (!response.ok) {
    await throwResponseError(response, "Não foi possível curtir.");
  }
}

export async function comentarPost(postId: string, texto: string) {
  const res = await fetch(`${API.BASE_URL}/api/comentarios`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ postagemId: postId, conteudo: texto }),
  });

  if (!res.ok) {
    await throwResponseError(res, "Erro ao comentar");
  }

  return res.json(); 
}

export async function deletarPost(postId: string) {
  const r = await fetch(`${API.BASE_URL}/api/feed/posts/${postId}`, {
    method: "DELETE",
    headers: auth(),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Erro ao deletar");
  }
}

export type RepostResponse =
  | { ok: true; action: "repost"; post: PostagemComUsuario }
  | { ok: true; action: "unrepost"; id: string }
  | { ok: boolean; action?: string; post?: PostagemComUsuario; id?: string };

export async function repostPost(postId: string, comentario = ""): Promise<RepostResponse> {
  const payload = { comentario: String(comentario ?? "").trim() };

  const r = await fetch(`${API.BASE_URL}/api/feed/${postId}/repost`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    await throwResponseError(r, `Erro ao repostar (${r.status})`);
  } 

  return r.json();
}

export async function compartilharPost(postId: string) {
  const link = `${window.location.origin}/post/${postId}`;
  const bearer = readBearerToken();

  try {
    if (navigator.share) {
      await navigator.share({
        title: "FootEra",
        url: link,
      });
    } else {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return;
    }

    console.error("Erro ao compartilhar link:", error);
    toast.error("Não foi possível compartilhar o link.");
    return;
  }

  // Registrar o compartilhamento é um efeito secundário.
  // Visitante pode compartilhar normalmente sem autenticação.
  if (bearer) {
    void fetch(`${API.BASE_URL}/api/feed/post/${postId}/compartilhar`, {
      method: "POST",
      headers: { Authorization: bearer },
    }).catch((error) => {
      console.error("Erro ao registrar compartilhamento:", error);
    });
  }
}

export async function getPostById(
  id: string
): Promise<PostagemComUsuario> {
  const response =
    await optionalGet(
      `${API.BASE_URL}/api/feed/post/visualizar/${id}`
    );

  if (!response.ok) {
    const data =
      await response
        .json()
        .catch(() => ({}));

    const message =
      data?.message ||
      data?.error ||
      (
        response.status === 403
          ? "Esta publicação não está disponível."
          : response.status === 404
          ? "Publicação não encontrada."
          : "Não foi possível carregar a publicação."
      );

    const error: any =
      new Error(message);

    error.status =
      response.status;

    error.code =
      data?.code;

    throw error;
  }

  const raw =
    await response.json();

  return {
    ...raw,

    compartilhamentos:
      Number(
        raw?.compartilhamentos ?? 0
      ),

    curtidas:
      Array.isArray(raw?.curtidas)
        ? raw.curtidas
        : [],

    comentarios:
      Array.isArray(raw?.comentarios)
        ? raw.comentarios
        : [],
  } as PostagemComUsuario;
}

export async function criarPost({
  descricao = "",
  imagemUrl,
  videoUrl,
  arquivo,
  visibilidade = "LOGADO",
}: CriarPostInput) {
  const POST_URL = `${API.BASE_URL}/api/feed/post`;
  const hasDescricao = !!descricao && descricao.trim().length > 0;
  const hasImagem = !!imagemUrl && imagemUrl.trim().length > 0;
  const hasVideo = !!videoUrl && videoUrl.trim().length > 0;

  if (arquivo instanceof File) {
    const fd = new FormData();
    if (hasDescricao) fd.append("descricao", descricao.trim());
    fd.append("arquivo", arquivo);
    fd.append("visibilidade", visibilidade);
    const res = await fetch(POST_URL, {
      method: "POST",
      headers: auth(),
      body: fd,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Falha ao enviar arquivo");
    }
    return res.json();
  }

  if (hasDescricao || hasImagem || hasVideo) {
    const payload: any = { visibilidade, };
    if (hasDescricao) payload.descricao = descricao.trim();
    if (hasImagem) payload.imagemUrl = imagemUrl;
    if (hasVideo) payload.videoUrl = videoUrl;

    const res = await fetch(POST_URL, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Falha ao criar postagem");
    }
    return res.json();
  }

  throw new Error(
    "Escreva algo, selecione uma conquista ou anexe uma mídia (URL/arquivo)."
  );
}

export async function deletarComentario(comentarioId: string) {
  const r = await fetch(`${API.BASE_URL}/api/comentarios/${comentarioId}`, {
    method: "DELETE",
    headers: auth(),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Erro ao apagar comentário");
  }
}
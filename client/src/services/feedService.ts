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
  repostOf?: PostagemComUsuario | null;
};

export type PostId = string;

export interface CriarPostInput {
  descricao?: string;
  imagemUrl?: string;
  videoUrl?: string;
  arquivo?: File | null;
}

export type FiltroFeed = "todos" | "seguindo" | "favoritos" | "meus";

function pickToken(): string {
  const raw = readToken();
  if (!raw) {
    throw new Error("Sem token. Faça login novamente.");
  }
  return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
}

const auth = () => ({ Authorization: pickToken() });

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
    res = await fetch(url, { headers: auth() });
  } catch (e) {
    console.error("Erro de rede ao carregar feed:", e);
    throw e;
  }

  if (res.status === 401) {
    console.warn("[FEED] 401 em", url, "– provavelmente token inválido/expirado");
    return [];
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
  await fetch(`${API.BASE_URL}/api/feed/${postId}/like`, {
    method: "POST",
    headers: auth(),
  });
}

export async function comentarPost(postId: string, texto: string) {
  const res = await fetch(`${API.BASE_URL}/api/comentarios`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ postagemId: postId, conteudo: texto }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Erro ao comentar");
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
    const msg = await r.text().catch(() => "");
    throw new Error(msg || `Erro ao repostar (${r.status})`);
  } 

  return r.json();
}

export async function compartilharPost(postId: string) {
  const link = `${window.location.origin}/post/${postId}`;
  try {
    await navigator.clipboard.writeText(link);
    await fetch(`${API.BASE_URL}/api/feed/post/${postId}/compartilhar`, {
      method: "POST",
      headers: auth(),
    });
    toast.success("Link copiado para a área de transferência!");
  } catch (error) {
    console.error("Erro ao copiar link:", error);
    toast.error("Não foi possível copiar o link.");
  }
}

export async function getPostById(id: string): Promise<PostagemComUsuario> {
  const response = await fetch(
    `${API.BASE_URL}/api/feed/post/visualizar/${id}`,
    {
      headers: auth(),
    }
  );
  if (!response.ok) throw new Error("Erro ao buscar post");

  const raw = await response.json();
  return {
    ...raw,
    compartilhamentos: Number(raw?.compartilhamentos ?? 0),
    curtidas: Array.isArray(raw.curtidas) ? raw.curtidas : [],
    comentarios: Array.isArray(raw.comentarios) ? raw.comentarios : [],
  } as PostagemComUsuario;
}

export async function criarPost({
  descricao = "",
  imagemUrl,
  videoUrl,
  arquivo,
}: CriarPostInput) {
  const POST_URL = `${API.BASE_URL}/api/feed/post`;
  const hasDescricao = !!descricao && descricao.trim().length > 0;
  const hasImagem = !!imagemUrl && imagemUrl.trim().length > 0;
  const hasVideo = !!videoUrl && videoUrl.trim().length > 0;

  if (arquivo instanceof File) {
    const fd = new FormData();
    if (hasDescricao) fd.append("descricao", descricao.trim());
    fd.append("arquivo", arquivo);
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
    const payload: any = {};
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
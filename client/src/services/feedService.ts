import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export interface Usuario {
  id: string;
  nome: string;
  foto?: string;
  tipo: string;
}

export interface Comentarios {
  id: string;
  conteudo: string;
  dataCriacao: string;
  usuario: { nome: string; foto?: string };
}

export type PostagemComUsuario = {
  id: string;
  conteudo: string;
  dataCriacao: string;
  usuario: { id: string; nome: string; foto?: string | null; tipo?: string };
  imagemUrl?: string | null;
  videoUrl?: string | null;
  tipoMidia?: "Imagem" | "Video" | "Documento" | null;
  curtidas: { usuarioId: string }[];
  comentarios: {
    id: string;
    conteudo: string;
    dataCriacao: string;
    usuario?: { nome: string; foto?: string | null };
  }[];
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

const auth = () => ({ Authorization: `Bearer ${Storage.token || ""}` });

export async function getFeedPosts(filtro: FiltroFeed = "todos"): Promise<PostagemComUsuario[]> {
  const qs = new URLSearchParams({ filtro });
  const res = await fetch(`${API.BASE_URL}/api/feed?${qs.toString()}`, {
    headers: auth(),
  });
  if (!res.ok) throw new Error(`Falha ao carregar feed (${res.status})`);
  return res.json();
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
  if (!res.ok) throw new Error("Erro ao comentar");
}

export async function deletarPost(postId: string) {
  const r = await fetch(`${API.BASE_URL}/api/feed/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${Storage.token || ""}` },
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(msg || "Erro ao deletar");
  }
}

export async function repostPost(postId: string, comentario = "") {
  const r = await fetch(`${API.BASE_URL}/api/feed/${postId}/repost`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify({ comentario }),
  });
  if (!r.ok) throw new Error("Erro ao repostar");
  return r.json();
}

export async function compartilharPost(postId: string) {
  const link = `${window.location.origin}/post/${postId}`;
  try {
    await navigator.clipboard.writeText(link);
    await fetch(`${API.BASE_URL}/api/post/${postId}/compartilhar`, { method: "POST" });
    alert("Link copiado para a área de transferência!");
  } catch (error) {
    console.error("Erro ao copiar link:", error);
    alert("Não foi possível copiar o link.");
  }
}

export async function getPostById(id: string): Promise<PostagemComUsuario> {
  const token = Storage.token;
  const response = await fetch(`${API.BASE_URL}/api/post/visualizar/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  const token = Storage.token;
  const POST_URL = `${API.BASE_URL}/api/post`;

  const hasDescricao = !!descricao && descricao.trim().length > 0;
  const hasImagem = !!imagemUrl && imagemUrl.trim().length > 0;
  const hasVideo  = !!videoUrl && videoUrl.trim().length > 0;

  if (arquivo instanceof File) {
    const fd = new FormData();
    if (hasDescricao) fd.append("descricao", descricao.trim());
    fd.append("arquivo", arquivo);
    const res = await fetch(POST_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
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
    if (hasVideo)  payload.videoUrl = videoUrl;

    const res = await fetch(POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || "Falha ao criar postagem");
    }
    return res.json();
  }

  throw new Error("Escreva algo, selecione uma conquista ou anexe uma mídia (URL/arquivo).");
}

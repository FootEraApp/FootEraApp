//client/src/service/feedService
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { apiGet } from "./api.js";

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

export interface PostagemComUsuario {
  id: string;
  conteudo: string;
  tipoMidia?: string;
  imagemUrl?: string;
  videoUrl?: string;
  dataCriacao: string;
  usuario: Usuario;
  curtidas: { usuarioId: string }[];
  comentarios: Comentarios[];
  compartilhamentos: number;
}

export type PostId = string;

export interface CriarPostInput {
  descricao?: string;
  imagemUrl?: string;
  videoUrl?: string;
  arquivo?: File | null;
}

export async function getFeedPosts(
  filtro: "todos" | "seguindo" | "favoritos" | "meus" = "todos",
  onUnauthorized?: () => void
): Promise<PostagemComUsuario[]> {
  try {
    const res = await apiGet(`/api/feed?filtro=${filtro}`, onUnauthorized);
    const data = await res.json();

    return data.map((post: any) => ({
      ...post,
      curtidas: Array.isArray(post.curtidas) ? post.curtidas : [],
      comentarios: Array.isArray(post.comentarios) ? post.comentarios : [],
      usuario: post.usuario || {
        id: "",
        nome: "Usuário desconhecido",
        tipo: "Desconhecido",
        foto: "/default-user.png",
      },
      compartilhamentos: Number(post?.compartilhamentos ?? 0),
    })) as PostagemComUsuario[];
  } catch (error) {
    console.error("Erro ao buscar posts do feed:", error);
    return [];
  }
}

export async function likePost(postId: string) {
  const token = Storage.token;
  const response = await fetch(`${API.BASE_URL}/api/post/${postId}/like`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Erro ao curtir post: ${response.statusText}`);
  return response.json();
}

export async function comentarPost(postId: string, conteudo: string) {
  const token = Storage.token;
  const response = await fetch(`${API.BASE_URL}/api/post/${postId}/comentario`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conteudo }),
  });
  if (!response.ok) throw new Error(`Erro ao comentar post: ${response.statusText}`);
  return response.json();
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

export async function deletarPost(postId: PostId): Promise<boolean> {
  const token = Storage.token;
  const res = await fetch(`${API.BASE_URL}/api/posts/${postId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Falha ao apagar post");
  }
  return true;
}

export async function criarPost({
  descricao = "",
  imagemUrl,
  videoUrl,
  arquivo,
}: CriarPostInput) {
  const token = Storage.token;

  const POST_URL = `${API.BASE_URL}/api/post`;

  if ((imagemUrl && imagemUrl.trim()) || (videoUrl && videoUrl.trim())) {
    const res = await fetch(POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ descricao, imagemUrl, videoUrl }),
    });
    if (!res.ok) throw new Error("Falha ao criar postagem");
    return res.json();
  }

  if (arquivo instanceof File) {
    const fd = new FormData();
    if (descricao) fd.append("descricao", descricao);
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

  throw new Error("Informe uma URL de mídia ou selecione um arquivo.");
}

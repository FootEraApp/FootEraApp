import axios from "axios";

export interface Usuario {
  id: string;
  nome: string;
  foto?: string;
  tipo: string;
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
  comentarios: { id: string }[];
}


export async function getFeedPosts(): Promise<PostagemComUsuario[]> {
  const token = localStorage.getItem("token");

    const response = await fetch("http://localhost:3001/api/feed", {
    headers: {
        Authorization: `Bearer ${token}`,
    },
    });

    if (!response.ok) {
        throw new Error(`Erro ao buscar feed: ${response.statusText}`);
    }
    

  const data = await response.json();
  return data.posts;
}

export async function likePost(postId: string) {
  await axios.post(`/api/posts/${postId}/like`);
}

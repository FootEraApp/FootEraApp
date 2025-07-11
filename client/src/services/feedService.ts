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
try {
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

  const postsCompletos = data.map((post: any) => ({
      ...post,
      curtidas: Array.isArray(post.curtidas) ? post.curtidas : [],
      comentarios: Array.isArray(post.comentarios) ? post.comentarios : [],
      usuario: post.usuario || {
        id: "",
        nome: "Usuário desconhecido",
        tipo: "Desconhecido",
        foto: "/default-user.png",
      },
    }));

    return postsCompletos;
} catch (error) {
  console.error("Erro ao buscar posts do feed:", error); 
  return []; 
}
}  

export async function likePost(postId: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`http://localhost:3001/api/post/posts/${postId}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao curtir post: ${response.statusText}`);
  }

  return response.json();
}

export async function comentarPost(postId: string, conteudo: string) {
  const token = localStorage.getItem("token");
  const usuarioId = localStorage.getItem("usuarioId"); 

  await fetch(`http://localhost:3001/api/posts/${postId}/comentario`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ conteudo, usuarioId }),
  });
}

export async function compartilharPost(postId: string) {
  const link = `${window.location.origin}/post/${postId}`;
  try {
    await navigator.clipboard.writeText(link);
    alert("Link copiado para a área de transferência!");
  } catch (error) {
    console.error("Erro ao copiar link:", error);
    alert("Não foi possível copiar o link.");
  }
}

export async function getPostById(id: string): Promise<PostagemComUsuario> {
  const token = localStorage.getItem("token");
  const response = await fetch(`http://localhost:3001/api/posts/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Erro ao buscar post");

  return response.json();
}

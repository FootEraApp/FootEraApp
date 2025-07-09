import React, { useEffect, useState } from "react";
import { FaHeart, FaRegHeart, FaRegCommentDots, FaShare } from "react-icons/fa";
import { getFeedPosts, likePost, PostagemComUsuario } from "../services/feedService"; // Crie este arquivo!
import { formatDistanceToNow } from "date-fns";

interface Usuario {
  id: string;
  nome: string;
  foto?: string;
  tipo: string;
}

interface Postagem {
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

function PaginaFeed(): JSX.Element {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const userId = "idDoUsuarioLogado"; // Pegue do contexto real

  useEffect(() => {
  async function carregarFeed() {
    try {
      const dados = await getFeedPosts();
      if (Array.isArray(dados)) {
        setPosts(dados);
      } else {
        console.error("Resposta inesperada do getFeedPosts:", dados);
        setPosts([]);
      }
    } catch (error) {
      console.error("Erro ao carregar feed:", error);
      setPosts([]); // evita quebra da tela
    }
  }
    carregarFeed();
  }, []);

  const handleLike = async (postId: string) => {
    await likePost(postId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              curtidas: p.curtidas.some((c) => c.usuarioId === userId)
                ? p.curtidas.filter((c) => c.usuarioId !== userId)
                : [...p.curtidas, { usuarioId: userId }],
            }
          : p
      )
    );
  };

  return (
    <div className="px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold mb-4">Feed de Postagens</h1>
      {Array.isArray(posts) && posts.map((post) => {
        const jaCurtiu = post.curtidas.some((c) => c.usuarioId === userId);
        return (
          <div
            key={post.id}
            className="bg-white rounded-2xl shadow-md p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <img
                src={post.usuario.foto || "/default-user.png"}
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">{post.usuario.nome}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(post.dataCriacao), {
                    addSuffix: true
                  })}
                </p>
              </div>
            </div>

            <div>
              <p className="text-gray-800 font-medium">{post.conteudo}</p>
              {post.tipoMidia === "Imagem" && post.imagemUrl && (
                <img
                  src={post.imagemUrl}
                  alt="Post"
                  className="mt-2 rounded-lg"
                />
              )}
              {post.tipoMidia === "Video" && post.videoUrl && (
                <video
                  controls
                  className="w-full mt-2 rounded-lg"
                  src={post.videoUrl}
                />
              )}
            </div>

            <div className="flex justify-between text-gray-600 mt-2 px-2">
              <button
                className="flex items-center gap-1"
                onClick={() => handleLike(post.id)}
              >
                {jaCurtiu ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
                <span>{post.curtidas.length}</span>
              </button>

              <button className="flex items-center gap-1">
                <FaRegCommentDots />
                <span>{post.comentarios.length}</span>
              </button>

              <button className="flex items-center gap-1">
                <FaShare />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PaginaFeed;

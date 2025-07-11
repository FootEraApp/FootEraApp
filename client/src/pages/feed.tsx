import React, { useEffect, useState } from "react";
import { FaHeart, FaRegHeart, FaRegCommentDots, FaShare } from "react-icons/fa";
import { getFeedPosts, likePost, PostagemComUsuario, comentarPost, compartilharPost } from "../services/feedService"; 
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

interface Usuario {
  id: string;
  nome: string;
  foto?: string;
  tipo: string;
}

function PaginaFeed(): JSX.Element {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [mostrarInputPorPost, setMostrarInputPorPost] = useState<Record<string, boolean>>({});
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>({});
  const userId = "idDoUsuarioLogado"; // Pegue do contexto real

  useEffect(() => {
    async function carregarFeed() {
      const dados = await getFeedPosts();
      if (!dados) {
        console.warn("Resposta inesperada do getFeedPosts:", dados);
        return;
      }
      setPosts(dados);
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

  const handleComentario = async (postId: string, texto: string) => {
    if (texto.trim()) {
      await comentarPost(postId, texto);
      const dados = await getFeedPosts();
      setPosts(dados);
      setComentarioTextoPorPost((prev) => ({ ...prev, [postId]: "" }));
    }
  };

  const handleCompartilhar = async (postId: string) => {
    const link = `${window.location.origin}/postagens/${postId}`;
    await navigator.clipboard.writeText(link);
    alert("Link copiado!");
  };

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-center">Feed de Postagens</h1>

      {Array.isArray(posts) &&
        posts.map((post) => {
          const curtidas = post.curtidas || [];
          const jaCurtiu = curtidas.some((c) => c.usuarioId === userId);
          const mostrarInput = mostrarInputPorPost[post.id] || false;
          const comentarioTexto = comentarioTextoPorPost[post.id] || "";

          return (
            <div key={post.id} className="bg-white rounded-2xl shadow-md p-4 space-y-3">
              <div className="flex items-center gap-2">
                <img
                  src={
                    post.usuario.nome === "Usuario Teste"
                      ? "/assets/footera-logo.png"
                      : post.usuario.foto?.startsWith("http")
                        ? post.usuario.foto
                        : post.usuario.foto
                        ? `/assets/usuarios/${post.usuario.foto}`
                        : `/assets/usuarios/default-user.png}`
                  }
                  alt="avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold">{post.usuario.nome}</p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(post.dataCriacao), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-gray-800 font-medium">{post.conteudo}</p>
                {post.tipoMidia === "Imagem" && (
                  <img 
                   src={
                     post.imagemUrl?.startsWith("http")
                     ? post.imagemUrl
                     : `/assets/posts/${post.imagemUrl || "fallback.png" || "/assets/Ranking-treino.png" }`
                   }
                  alt="Post" 
                  className="mt-2 rounded-lg" />
                )}
                {post.tipoMidia === "Video" && post.videoUrl && (
                  <video controls className="w-full mt-2 rounded-lg" src={post.videoUrl} />
                )}
              </div>

              <div className="flex justify-between text-gray-600 mt-2 px-2">
                <button className="flex items-center gap-1" onClick={() => handleLike(post.id)}>
                  {jaCurtiu ? <FaHeart className="text-red-600" /> : <FaRegHeart />}
                  <span>{post.curtidas?.length || 0}</span>
                </button>

                <button
                  className="flex items-center gap-1"
                  onClick={() =>
                    setMostrarInputPorPost((prev) => ({
                      ...prev,
                      [post.id]: !prev[post.id],
                    }))
                  }
                >
                  <FaRegCommentDots />
                  <span>{post.comentarios?.length || 0}</span>
                </button>

                <button
                  className="flex items-center gap-1"
                  onClick={() => handleCompartilhar(post.id)}
                >
                  <FaShare />
                </button>
              </div>

              {mostrarInput && (
                <input
                  type="text"
                  value={comentarioTexto}
                  onChange={(e) =>
                    setComentarioTextoPorPost((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleComentario(post.id, comentarioTexto);
                  }}
                  placeholder="Adicionar um comentário..."
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              )}
            </div>
          );
        })}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          Feed
        </Link>
        <Link href="/search" className="hover:underline">
          Explorar
        </Link>
        <Link href="/post" className="hover:underline">
          Publicar
        </Link>
        <Link href="/treinos" className="hover:underline">
          Treinos
        </Link>
        <Link href="/perfil" className="hover:underline">
          Perfil
        </Link>
      </nav>
    </div>
  );
}

export default PaginaFeed;
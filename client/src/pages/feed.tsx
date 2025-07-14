import React, { useEffect, useState } from "react";
import {
  FaHeart,
  FaRegHeart,
  FaRegCommentDots,
  FaShare,
  FaPaperPlane,
  FaTrash,
} from "react-icons/fa";
import {
  getFeedPosts,
  likePost,
  comentarPost,
  compartilharPost,
  PostagemComUsuario,
} from "../services/feedService";
import { format } from "date-fns";
import { Link } from "wouter";

function PaginaFeed(): JSX.Element {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [mostrarInputPorPost, setMostrarInputPorPost] = useState<Record<string, boolean>>({});
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>({});
  const userId = localStorage.getItem("usuarioId") ?? "";

  useEffect(() => {
    async function carregarFeed() {
      const dados = await getFeedPosts();
      if (!dados) return;
      setPosts(dados);
    }
    carregarFeed();
  }, []);

  const handleLike = async (postId: string) => {
    try {
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
    } catch (error) {
      console.error("Erro ao curtir post:", error);
    }
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
    await compartilharPost(postId);
  };

  const excluirPost = async (postId: string) => {
    const confirmacao = confirm("Deseja mesmo excluir?");
    if (!confirmacao) return;

    await fetch(`http://localhost:3001/api/post/posts/${postId}`, {
      method: "DELETE",
    });

    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-center">Feed de Postagens</h1>

      {posts.map((post) => {
        const curtidas = post.curtidas || [];
        const jaCurtiu = curtidas.some((c) => c.usuarioId === userId);
        const mostrarInput = mostrarInputPorPost[post.id] || false;
        const comentarioTexto = comentarioTextoPorPost[post.id] || "";

        return (
          <div key={post.id} className="bg-white rounded-2xl shadow-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={
                  post.usuario.foto?.startsWith("http")
                    ? post.usuario.foto
                    : `/assets/usuarios/${post.usuario.foto || "default-user.png"}`
                }
                alt="avatar"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">{post.usuario.nome}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(post.dataCriacao), "dd/MM, HH:mm")}
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
                      : `/assets/${post.imagemUrl || "fallback.png"}`
                  }
                  alt="Post"
                  className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                />
              )}
              {post.tipoMidia === "Video" && post.videoUrl && (
                <video controls className="w-full mt-2 rounded-lg" src={post.videoUrl} />
              )}
            </div>

            <div className="flex justify-between text-gray-600 mt-2 px-2">
              <button className="flex items-center gap-1" onClick={() => handleLike(post.id)}>
                {jaCurtiu ? <FaHeart className="text-black" /> : <FaRegHeart />} <span>{curtidas.length}</span>
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
                <FaRegCommentDots /> <span>{post.comentarios?.length || 0}</span>
              </button>

              <button className="flex items-center gap-1" onClick={() => handleCompartilhar(post.id)}>
                <FaShare />
              </button>

              <button onClick={() => excluirPost(post.id)} className="text-red-600">
                <FaTrash />
              </button>
            </div>

            {mostrarInput && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={comentarioTexto}
                  onChange={(e) =>
                    setComentarioTextoPorPost((prev) => ({
                      ...prev,
                      [post.id]: e.target.value,
                    }))
                  }
                  placeholder="Adicione um comentário..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <button onClick={() => handleComentario(post.id, comentarioTexto)}>
                  <FaPaperPlane className="text-green-800" />
                </button>
              </div>
            )}

            {post.comentarios?.length > 0 && (
              <div className="mt-2 space-y-2">
                {post.comentarios.map((comentario) => (
                  <div key={comentario.id} className="flex gap-2 items-start">
                    <img
                      src={
                        comentario.usuario?.foto?.startsWith("http")
                          ? comentario.usuario.foto
                          : `/assets/usuarios/${comentario.usuario?.foto || "default-user.png"}`
                      }
                      alt="avatar"
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="bg-gray-100 rounded-lg px-3 py-2 w-full">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span className="font-semibold">{comentario.usuario?.nome}</span>
                        <span>{format(new Date(comentario.dataCriacao), "dd/MM, HH:mm")}</span>
                      </div>
                      <p className="text-sm text-gray-800">{comentario.conteudo}</p>
                    </div>
                  </div>
                ))}
              </div>
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

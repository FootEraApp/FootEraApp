import React, { useEffect, useState } from "react";
import {
  FaHeart,
  FaRegHeart,
  FaRegCommentDots,
  FaShare,
  FaPaperPlane,
} from "react-icons/fa";
import Storage from "../../../server/utils/storage";
import { Volleyball, User, CirclePlus, Search, House, CircleX } from "lucide-react";
import { API } from "../config";
import {
  getFeedPosts,
  likePost,
  comentarPost,
  PostagemComUsuario,
} from "../services/feedService";
import { format } from "date-fns";
import { Link } from "wouter";
import { formatarUrlFoto } from "@/utils/formatarFoto";
import { useLocation } from "wouter";
import { logout } from "@/utils/session";

function PaginaFeed(): JSX.Element {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [mostrarInputPorPost, setMostrarInputPorPost] = useState<Record<string, boolean>>({});
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>({});
  const userId = Storage.usuarioId || "";

  const [modalAberto, setModalAberto] = useState(false);
  const [linkCompartilhado, setLinkCompartilhado] = useState("");

  const [comentariosModalAberto, setComentariosModalAberto] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState<PostagemComUsuario | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    (async () => {
      const dados = await getFeedPosts(() => navigate("/login"));
      setPosts(dados);
    })();
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

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

  const handleCompartilhar = (postId: string) => {
  const link = `${window.location.origin}/post/${postId}`;
  setLinkCompartilhado(link);
  setModalAberto(true);
  };

  const abrirModalComentarios = (post: PostagemComUsuario) => {
  setPostSelecionado(post);
  setComentariosModalAberto(true);
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
          <div key={post.id} className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <img
                src={formatarUrlFoto(post.usuario.foto)}
                alt={post.usuario.nome}
                className="w-10 h-10 rounded-full"
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

              {post.tipoMidia === "Imagem" && post.imagemUrl && (
                <img
                  src={
                    formatarUrlFoto(post.imagemUrl)
                  }
                  alt="Post"
                  className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                />
              )}

              {post.tipoMidia === "Video" && post.videoUrl && (
                <video controls className="w-full mt-2 rounded-lg">
                  <source
                    src={
                      post.videoUrl.startsWith("http")
                        ? post.videoUrl
                        : `${API.BASE_URL}${post.videoUrl}`
                    }
                    type="video/mp4"
                  />
                  Seu navegador não suporta vídeo.
                </video>
              )}
            </div>

            <div className="flex justify-between text-gray-600 mt-2 px-2">
              <button className="flex items-center gap-1" onClick={() => handleLike(post.id)}>
                {jaCurtiu ? <FaHeart className="text-black" /> : <FaRegHeart />}{" "}
                <span>{curtidas.length}</span>
              </button>

              <button
                className="flex items-center gap-1"
                onClick={() => abrirModalComentarios(post)}
              >
                <FaRegCommentDots /> <span>{post.comentarios?.length || 0}</span>
              </button>

              <button className="flex items-center gap-1" onClick={() => handleCompartilhar(post.id)}>
                <FaShare />
              </button>

            </div>

            {mostrarInput && (
              <>
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

                {post.comentarios?.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {post.comentarios.map((comentario) => (
                      <div key={comentario.id} className="flex gap-2 items-start">
                        <img
                          src={
                            formatarUrlFoto(comentario.usuario?.foto)
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
              </>
            )}
          </div>
        );
      })}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House /> 
        </Link>
        <Link href="/explorar" className="hover:underline">
          <Search /> 
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus /> 
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball /> 
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User /> 
        </Link>
        <button onClick={handleLogout} title="Sair">
          🚪
        </button>
      </nav>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Postagem</h2>

            <input
              type="text"
              value={linkCompartilhado}
              readOnly
              onFocus={(e) => e.target.select()}
              className="w-full border rounded px-3 py-2 text-sm mb-3"
            />

            <button
              className="w-full bg-green-700 text-white py-2 rounded mb-4 hover:bg-green-800"
              onClick={() => {
                navigator.clipboard.writeText(linkCompartilhado);
                alert("Link copiado para a área de transferência!");
              }}
            >
              Copiar Link
            </button>

            <div className="flex justify-between items-center space-x-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(linkCompartilhado)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 text-white py-2 px-4 rounded hover:bg-green-600 text-sm text-center flex-1"
              >
                WhatsApp
              </a>

              <a
                href={`mailto:?subject=Veja esta postagem&body=${encodeURIComponent(linkCompartilhado)}`}
                className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 text-sm text-center flex-1"
              >
                Email
              </a>

              <a
                href={linkCompartilhado}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 text-sm text-center flex-1"
              >
                FootEra
              </a>

            </div>

            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
            >
              <CircleX />
            </button>
          </div>
        </div>
      )}

      {comentariosModalAberto && postSelecionado && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-center">Comentários</h2>

            <div className="space-y-2 mb-4">
              {postSelecionado.comentarios.map((comentario) => (
                <div key={comentario.id} className="flex gap-2 items-start">
                  <img
                    src={
                      formatarUrlFoto(comentario.usuario?.foto)
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

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={comentarioTextoPorPost[postSelecionado.id] || ""}
                onChange={(e) =>
                  setComentarioTextoPorPost((prev) => ({
                    ...prev,
                    [postSelecionado.id]: e.target.value,
                  }))
                }
                placeholder="Adicione um comentário..."
                className="w-full border rounded px-3 py-2 text-sm"
              />
              <button
                onClick={() =>
                  handleComentario(postSelecionado.id, comentarioTextoPorPost[postSelecionado.id] || "")
                }
              >
                <FaPaperPlane className="text-green-800" />
              </button>
            </div>

            <button
              onClick={() => setComentariosModalAberto(false)}
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaginaFeed;
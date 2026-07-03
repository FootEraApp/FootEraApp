import React, { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { useRoute, useLocation } from "wouter";
import { getPostById, PostagemComUsuario, likePost, comentarPost } from "../services/feedService.js";
import { format } from "date-fns";
import { FaHeart, FaRegHeart, FaTrash, FaShare } from "react-icons/fa";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import { CircleX, Volleyball, User, CirclePlus, Search, House } from "lucide-react";
import PostImage from "../components/PostImage.js";
import { publicImgUrl } from "@/utils/publicUrl.js";
import { FaRetweet } from "react-icons/fa";
import { repostPost } from "../services/feedService.js";

function PostUnico(): JSX.Element {
  const [match, params] = useRoute<{ id: string }>("/post/:id");
  const [post, setPost] = useState<PostagemComUsuario | null>(null);
  const [comentario, setComentario] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [, setLocation] = useLocation();
  const [modalAberto, setModalAberto] = useState(false);

  const token = Storage.token || "";
  const usuarioId = Storage.usuarioId || "";
  useEffect(() => {
    if (!match || !params?.id) return;

    async function fetchPost() {
      try {
        const postUnico = await getPostById(params!.id);
        setPost(postUnico);
      } catch (error) {
        console.error("Erro ao buscar post:", error);
        setPost(null);
      }
    }
    fetchPost();
  }, [match, params?.id]);

  async function handleCurtir() {
    if (!post?.id) return;
    try {
      await likePost(post.id);
      const atualizado = await getPostById(post.id);
      if (atualizado) setPost(atualizado);
    } catch (err) {
      console.error("Erro ao curtir o post:", err);
    }
  }

  async function handleComentarioSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comentario.trim() || !post?.id) return;
    try {
      setCarregando(true);
      await comentarPost(post.id, comentario);
      setComentario("");
      const atualizado = await getPostById(post.id);
      if (atualizado) setPost(atualizado);
    } catch (err) {
      console.error("Erro ao comentar:", err);
    } finally {
      setCarregando(false);
    }
  }

  async function handleExcluirPost() {
    if (!post?.id || !confirm("Tem certeza que deseja excluir esta postagem?")) return;
    try {
      const response = await fetch(`${API.BASE_URL}/api/feed/posts/${post.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        console.error("Erro ao excluir:", data);
        toast.error("Erro ao excluir a postagem.");
        return;
      }

      toast.success("Postagem excluída com sucesso.");
      setLocation("/feed");
    } catch (err) {
      console.error("Erro ao excluir a postagem:", err);
      toast.error("Erro ao excluir a postagem.");
    }
  }

  async function handleRepost() {
    if (!post?.id) return;
    const comentario = prompt("Adicionar um comentário (opcional):") ?? "";
    try {
      await repostPost(post.id, comentario);
      toast.success("Repost publicado no seu perfil!");
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível repostar.");
    }
  }

  if (!match) return <p className="text-center mt-10">Post não encontrado na URL.</p>;
  if (!post) return <p className="text-center mt-10">Carregando postagem...</p>;

  const imgSrc   = publicImgUrl(post.imagemUrl ?? null);
  const videoSrc = publicImgUrl(post.videoUrl ?? null);

  const linkCompartilhado = `${APP.FRONTEND_BASE_URL}/post/${post.id}`;
  const jaCurtiu = post.curtidas.some((c) => c.usuarioId === usuarioId);

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-2">{post.usuario.nome}</h2>
      <p className="text-gray-600 mb-2">
        {format(new Date(post.dataCriacao), "dd/MM, HH:mm")}
      </p>
      {post.repostOf && (
        <p className="text-xs text-gray-500 -mt-1 mb-2">
          Repostou de <strong>{post.repostOf.usuario?.nome || "Usuário"}</strong>
        </p>
      )}
      {post.repostOf ? (
      <>
        {post.conteudo?.trim() && (
          <p className="mb-3">{post.conteudo}</p>
        )}

        <div className="border rounded-xl p-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-1">
            <img
              src={publicImgUrl(post.repostOf.usuario?.foto) || `${APP.FRONTEND_BASE_URL}/assets/usuarios/default-user.png`}
              alt="avatar original"
              className="w-7 h-7 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold">{post.repostOf.usuario?.nome}</p>
              <p className="text-[11px] text-gray-500">
                {format(new Date(post.repostOf.dataCriacao), "dd/MM, HH:mm")}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-800 whitespace-pre-line">
            {post.repostOf.conteudo}
          </p>

          {post.repostOf.imagemUrl && (
            <div className="mt-2">
              <PostImage src={publicImgUrl(post.repostOf.imagemUrl) ?? undefined} />
            </div>
          )}

          {post.repostOf.videoUrl && (
            <video controls className="w-full mt-2 rounded-lg">
              <source src={publicImgUrl(post.repostOf.videoUrl) ?? ""} type="video/mp4" />
            </video>
          )}
        </div>
      </>
    ) : (
      <>
        <p className="mb-4">{post.conteudo}</p>

        {post.tipoMidia === "Imagem" && post.imagemUrl && (
          <PostImage src={publicImgUrl(post.imagemUrl) ?? undefined} />
        )}

        {post.tipoMidia === "Video" && post.videoUrl && (
          <video controls className="w-full rounded-lg">
            <source src={publicImgUrl(post.videoUrl) ?? ""} type="video/mp4" />
          </video>
        )}
      </>
    )}
      
      <div className="mt-4 flex items-center gap-4 text-xl">
        <button onClick={handleCurtir} className="text-black-500 hover:text-black-600">
          {jaCurtiu ? <FaHeart /> : <FaRegHeart />}
        </button>
        <span className="text-sm">{post.curtidas.length}</span>

        {post.usuario.id === usuarioId && (
          <button onClick={handleExcluirPost} className="text-black-700 hover:text-black-800 ml-auto">
            <FaTrash />
          </button>
        )}

        <button onClick={() => setModalAberto(true)} className="text-black-600 hover:text-black-800 ml-auto">
          <FaShare />
        </button>
        <button onClick={handleRepost} className="text-black-600 hover:text-black-800">
          <FaRetweet />
        </button>
        <span className="text-sm">{post.reposts ?? post.compartilhamentos ?? 0}</span>
      </div>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Comentários:</h3>
        {post.comentarios?.map((comentario) => (
          <div key={comentario.id} className="mt-2 p-2 bg-gray-100 rounded-lg">
            <p className="text-sm font-semibold">{comentario.usuario?.nome}</p>
            <p className="text-sm">{comentario.conteudo}</p>
          </div>
        ))}

        <form onSubmit={handleComentarioSubmit} className="mt-4">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="w-full p-2 border rounded mb-2"
            placeholder="Escreva um comentário..."
          />
          <button
            type="submit"
            disabled={carregando}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {carregando ? "Enviando..." : "Comentar"}
          </button>
        </form>
      </div>

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
                toast.success("Link copiado!");
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
                className="text-gray-800 hover:underline text-sm text-center flex-1"
              >
                Ver no FootEra
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
    </div>
  );
}

export default PostUnico;
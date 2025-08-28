// client/src/pages/feed.tsx
import React, { useEffect, useState, useMemo } from "react";
import { FaHeart, FaRegHeart, FaRegCommentDots, FaShare, FaPaperPlane, FaTrash } from "react-icons/fa";
import { Volleyball, User, CirclePlus, Search, House, CircleX, Send, CircleCheck } from "lucide-react";
import { getFeedPosts, likePost, comentarPost, compartilharPost, PostagemComUsuario, deletarPost } from "../services/feedService.js";
import { format } from "date-fns";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import { formatarUrlFoto } from "@/utils/formatarFoto";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

const token = Storage.token;

async function getUsuariosMutuos(token: string): Promise<Usuario[]> {
  const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erro ao buscar usuários mútuos");
  return await res.json();
}

// Normaliza URLs de mídia (legado /assets -> /uploads, relativo -> absoluto na API)
function normalizeMediaUrl(raw?: string | null): string {
  let s = (raw || "").trim();
  if (!s) return "";

  // absoluto/data/blob -> só corrige /assets -> /uploads
  if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
    return s.replace(/\/assets\/usuarios\//, "/uploads/").replace(/\/assets\//, "/uploads/");
  }

  // relativo legado /assets/... -> /uploads/...
  s = s.replace(/^\/?assets\/usuarios\//, "/uploads/").replace(/^\/?assets\//, "/uploads/");

  // prefixa API quando necessário
  if (s.startsWith("/uploads/")) return `${API.BASE_URL}${s}`;
  if (s.startsWith("uploads/")) return `${API.BASE_URL}/${s}`;

  // se veio só um nome, joga em /uploads/
  if (!s.startsWith("/")) s = `/${s}`;
  return `${API.BASE_URL}/uploads${s}`;
}

function BottomSheet({
  open,
  onClose,
  heightPct = 40,
  children,
  ariaLabel = "Painel",
}: {
  open: boolean;
  onClose: () => void;
  heightPct?: number; // 30-40 recomendado
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    // trava o scroll do body
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* sheet (full no mobile, limitado no desktop) */}
      <div
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        className="
          absolute bottom-0 z-50 transform transition-transform duration-300 ease-out
          left-0 right-0
          md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-[1160px] md:w-full
        "
        style={{ height: `${heightPct}vh` }}
      >
        <div
          className="bg-white rounded-t-2xl shadow-2xl h-full flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* “pegador” */}
          <div className="w-full flex justify-center pt-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>
          {/* conteúdo rolável */}
          <div className="h-full px-4 pb-4 pt-2 flex flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PaginaFeed(): JSX.Element {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [mostrarInputPorPost, setMostrarInputPorPost] = useState<Record<string, boolean>>({});
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>({});
  const userId = Storage.usuarioId as string | null;

  const [modalAberto, setModalAberto] = useState(false);
  const [linkCompartilhado, setLinkCompartilhado] = useState("");
  const [comentariosModalAberto, setComentariosModalAberto] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState<PostagemComUsuario | null>(null);

  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [enviandoDM, setEnviandoDM] = useState(false);

  const [idCompartilhado, setIdCompartilhado] = useState<string | null>(null);

  useEffect(() => {
    async function carregarFeed() {
      const dados = await getFeedPosts();
      if (!dados) return;
      setPosts(dados);
    }
    carregarFeed();
  }, []);

  const handleLike = async (postId: string) => {
    if (!userId) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }
    try {
      await likePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                curtidas: p.curtidas.some((c) => c.usuarioId === userId)
                  ? p.curtidas.filter((c) => c.usuarioId !== userId)
                  : [...p.curtidas, { usuarioId: userId as string }],
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
    const link = `${APP.FRONTEND_BASE_URL}/post/${postId}`;
    setLinkCompartilhado(link);
    setIdCompartilhado(postId);
    setModalAberto(true);

    try {
      setCarregandoMutuos(true);
      setSelecionados(new Set());
      const token = Storage.token || "";
      const lista = await getUsuariosMutuos(token);
      setUsuariosMutuos(lista);
    } catch (e) {
      console.error(e);
      alert("Não foi possível carregar seus contatos.");
    } finally {
      setCarregandoMutuos(false);
    }
  };

  const handleApagar = async (postId: string) => {
    if (!window.confirm("Apagar esta postagem? Essa ação não pode ser desfeita.")) return;
    try {
      await deletarPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e: any) {
      alert(e?.message || "Não foi possível apagar a postagem.");
    }
  };

  const abrirModalComentarios = (post: PostagemComUsuario) => {
    setPostSelecionado(post);
    setComentariosModalAberto(true);
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const enviarCompartilhamentoPorDM = async () => {
    if (selecionados.size === 0) return;
    const token = Storage.token;

    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map((paraId) =>
          fetch(`${API.BASE_URL}/api/mensagem`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              paraId,
              conteudo: idCompartilhado,
              tipo: "POST",
            }),
          })
        )
      );

      alert("Post compartilhado por mensagem!");
      setModalAberto(false);
    } catch (e) {
      console.error(e);
      alert("Falha ao enviar mensagens.");
    } finally {
      setEnviandoDM(false);
    }
  };

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-center">Feed de Postagens</h1>

      {posts.map((post) => {
        const curtidas = post.curtidas || [];
        const jaCurtiu = curtidas.some((c) => c.usuarioId === userId);
        const mostrarInput = mostrarInputPorPost[post.id] || false;
        const comentarioTexto = comentarioTextoPorPost[post.id] || "";

        const avatarAutor = formatarUrlFoto(post.usuario.foto);
        const srcImagem = post.tipoMidia === "Imagem" ? normalizeMediaUrl(post.imagemUrl) : "";
        const srcVideo = post.tipoMidia === "Video" ? normalizeMediaUrl(post.videoUrl) : "";

        return (
          <div key={post.id} className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src={avatarAutor}
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
              {((post as any).usuarioId === userId || post?.usuario?.id === userId) && (
                <button
                  onClick={() => handleApagar(post.id)}
                  title="Apagar postagem"
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <FaTrash />
                </button>
              )}
            </div>

            <div>
              <p className="text-gray-800 font-medium">{post.conteudo}</p>

              {post.tipoMidia === "Imagem" && srcImagem && (
                <img
                  src={srcImagem}
                  alt="Post"
                  className="mt-2 rounded-lg max-h-72 w-auto mx-auto object-contain"
                />
              )}

              {post.tipoMidia === "Video" && srcVideo && (
                <video controls className="w-full mt-2 rounded-lg">
                  <source src={srcVideo} type="video/mp4" />
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
                          src={formatarUrlFoto(comentario.usuario?.foto)}
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
        <Link href="/feed" className="hover:underline"><House /></Link>
        <Link href="/explorar" className="hover:underline"><Search /></Link>
        <Link href="/post" className="hover:underline"><CirclePlus /></Link>
        <Link href="/treinos" className="hover:underline"><Volleyball /></Link>
        <Link href="/perfil" className="hover:underline"><User /></Link>
      </nav>

<BottomSheet open={modalAberto} onClose={() => setModalAberto(false)} heightPct={40} ariaLabel="Compartilhar postagem">
  <h2 className="text-base font-bold mb-3 text-center">Compartilhar Postagem</h2>

  <div className="mb-3">
    <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>

    <div className="flex gap-3 overflow-x-auto pb-1">
      {carregandoMutuos && (
        <span className="text-sm text-gray-500">Carregando contatos...</span>
      )}
      {!carregandoMutuos && usuariosMutuos.length === 0 && (
        <span className="text-sm text-gray-500">Você ainda não tem contatos mútuos.</span>
      )}
      {usuariosMutuos.map((u) => {
        const selecionado = selecionados.has(u.id);
        const fotoSrc = formatarUrlFoto(u.foto);
        return (
          <button
            key={u.id}
            onClick={() => toggleSelecionado(u.id)}
            title={u.nome}
            className={`relative shrink-0 rounded-full border-2 ${
              selecionado ? "border-green-600" : "border-transparent"
            }`}
          >
            <img src={fotoSrc} alt={u.nome} className="w-14 h-14 rounded-full object-cover" />
            {selecionado && (
              <span className="absolute -bottom-1 -right-1 bg-white rounded-full">
                <CircleCheck className="w-5 h-5 text-green-600" />
              </span>
            )}
          </button>
        );
      })}
    </div>

    <button
      disabled={selecionados.size === 0 || enviandoDM}
      onClick={enviarCompartilhamentoPorDM}
      className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded 
        ${selecionados.size === 0 || enviandoDM ? "bg-gray-300 text-gray-600" : "bg-green-700 text-white hover:bg-green-800"}`}
    >
      <Send className="w-4 h-4" />
      {enviandoDM ? "Enviando..." : `Enviar para ${selecionados.size} contato(s)`}
    </button>
  </div>

  <div className="border-t my-3" />

  <input
    type="text"
    value={linkCompartilhado}
    readOnly
    onFocus={(e) => e.target.select()}
    className="w-full border rounded px-3 py-2 text-sm mb-3"
  />

  <button
    className="w-full bg-green-700 text-white py-2 rounded mb-3 hover:bg-green-800"
    onClick={() => {
      navigator.clipboard.writeText(linkCompartilhado);
      alert("Link copiado!");
    }}
  >
    Copiar Link
  </button>

  <div className="flex justify-between items-center gap-2">
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

    <button
      onClick={() => (window.location.href = linkCompartilhado)}
      className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 text-sm text-center flex-1"
    >
      FootEra
    </button>
  </div>
</BottomSheet>

<BottomSheet
  open={comentariosModalAberto && !!postSelecionado}
  onClose={() => setComentariosModalAberto(false)}
  heightPct={50}
  ariaLabel="Comentários da postagem"
>
  {postSelecionado && (
    <div className="mx-auto w-full h-full max-w-[1110px]">
      {/* CARD ocupa toda a altura disponível do sheet */}
      <div className="bg-white border rounded-2xl shadow-md h-full flex flex-col overflow-hidden">
        {/* HEADER (fixo) */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold">Comentários</h2>
          <button
            onClick={() => setComentariosModalAberto(false)}
            className="text-gray-500 hover:text-gray-800"
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* LISTA (rolável) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
          {postSelecionado.comentarios.length === 0 && (
            <p className="text-sm text-gray-500">Seja o primeiro a comentar!</p>
          )}

          {postSelecionado.comentarios.map((comentario) => (
            <div key={comentario.id} className="flex gap-3">
              <img
                src={formatarUrlFoto(comentario.usuario?.foto)}
                alt={comentario.usuario?.nome || "avatar"}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1 bg-gray-50 border rounded-xl px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">
                    {comentario.usuario?.nome}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {format(new Date(comentario.dataCriacao), "dd/MM, HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-gray-800 mt-1">{comentario.conteudo}</p>
              </div>
            </div>
          ))}
        </div>

        {/* COMPOSER (fixo no rodapé do card) */}
        <div className="border-t bg-gray-50 px-3 py-3 shrink-0 sticky bottom-0">
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
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
            />
            <button
              onClick={() =>
                handleComentario(
                  postSelecionado.id,
                  comentarioTextoPorPost[postSelecionado.id] || ""
                )
              }
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 bg-green-700 text-white hover:bg-green-800"
              title="Enviar"
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
</BottomSheet>


    </div>
  );
}

export default PaginaFeed;

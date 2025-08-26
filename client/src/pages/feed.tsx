import React, { useEffect, useState } from "react";
import { FaHeart, FaRegHeart, FaRegCommentDots, FaShare, FaPaperPlane, FaTrash, FaLink } from "react-icons/fa";
import { Volleyball, User, CirclePlus, Search, House, CircleX, Send, CircleCheck } from "lucide-react";
import { getFeedPosts, likePost, comentarPost, compartilharPost, PostagemComUsuario, deletarPost} from "../services/feedService.js";
import { format } from "date-fns";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

async function getUsuariosMutuos(token: string): Promise<Usuario[]> {
  const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erro ao buscar usuários mútuos");
  return await res.json();
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
  const [filtro, setFiltro] = useState<"todos"|"seguindo"|"favoritos"| "meus">("todos");

  useEffect(() => {
    async function carregar() {
      const dados = await getFeedPosts(filtro);
      if (!dados) return;
      setPosts(dados);
    }
    carregar();
  }, [filtro]);

  const handleLike = async (postId: string) => {
      if(!userId) {
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
                  : [...p.curtidas, { usuarioId: userId as string}],
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
      const dados = await getFeedPosts(filtro);
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
      setPosts(prev => prev.filter(p => p.id !== postId));
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
      <h1 className="text-2xl font-bold mb-4 text-center text-green-800">Feed de Postagens</h1>
       <div className="flex gap-2 justify-center mb-4">
        {(["todos","seguindo","favoritos", "meus"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filtro === f ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-green-700 border-green-700"
            }`}
          >
            {f === "todos" ? "Todos" :
             f === "seguindo" ? "Seguindo" :
             f === "favoritos" ? "Favoritos" : "Meus"}
          </button>
        ))}
      </div>

      {posts.length === 0 && (
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 text-center text-gray-600">
        <p>
          {{
            todos: "Nenhuma postagem encontrada.",
            seguindo: "Você ainda não segue ninguém — ou ninguém que você segue postou ainda.",
            favoritos: "Você não tem nenhum usuário favoritado.",
            meus: "Você ainda não postou nada.",
          }[filtro]}
        </p>

        {filtro === "seguindo" || filtro === "favoritos" ? (
          <Link href="/explorar" className="text-green-700 underline mt-2 inline-block">
            Explorar perfis
          </Link>
        ) : filtro === "meus" ? (
          <Link href="/post" className="text-green-700 underline mt-2 inline-block">
            Criar minha primeira postagem
          </Link>
        ) : null}
      </div>
    )}

      {posts.map((post) => {
        const curtidas = post.curtidas || [];
        const jaCurtiu = curtidas.some((c) => c.usuarioId === userId);
        const mostrarInput = mostrarInputPorPost[post.id] || false;
        const comentarioTexto = comentarioTextoPorPost[post.id] || "";

        return (
          <div key={post.id} className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-4 space-y-3">
           <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src={
                  post.usuario.foto?.startsWith("http")
                    ? post.usuario.foto
                    : `${API.BASE_URL}${post.usuario.foto || "default-user.png"}`
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

              {post.tipoMidia === "Imagem" && post.imagemUrl && (
                <img
                  src={
                    post.imagemUrl?.startsWith("http")
                      ? post.imagemUrl
                      : `${API.BASE_URL}${post.imagemUrl}`
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
                            comentario.usuario?.foto?.startsWith("http")
                              ? comentario.usuario.foto
                              : `${API.BASE_URL}${comentario.usuario?.foto || "default-user.png"}`
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
      </nav>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Postagem</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {carregandoMutuos && (
                  <span className="text-sm text-gray-500">Carregando contatos...</span>
                )}

                {!carregandoMutuos && usuariosMutuos.length === 0 && (
                  <span className="text-sm text-gray-500">Você ainda não tem contatos mútuos.</span>
                )}

                {usuariosMutuos.map((u) => {
                  const selecionado = selecionados.has(u.id);
                  const fotoSrc = u.foto?.startsWith("http")
                    ? u.foto
                    : `${API.BASE_URL}${u.foto || "default-user.png"}`;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${
                        selecionado ? "border-green-600" : "border-transparent"
                      }`}
                    >
                      <img
                        src={fotoSrc}
                        alt={u.nome}
                        className="w-14 h-14 rounded-full object-cover"
                      />
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

              <button
                onClick={() => (window.location.href = linkCompartilhado)}
                className="bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-900 text-sm text-center flex-1"
              >
                FootEra
              </button>
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
                      comentario.usuario?.foto?.startsWith("http")
                        ? comentario.usuario.foto
                        : `${API.BASE_URL}${comentario.usuario?.foto || "default-user.png"}`
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
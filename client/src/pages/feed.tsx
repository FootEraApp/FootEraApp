import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaHeart,
  FaRegHeart,
  FaRegCommentDots,
  FaShare,
  FaPaperPlane,
  FaTrash,
} from "react-icons/fa";
import {
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  Send,
  CircleCheck,
  Trophy,
} from "lucide-react";
import {
  getFeedPosts,
  likePost,
  comentarPost,
  PostagemComUsuario,
  deletarPost,
  repostPost,
} from "../services/feedService.js";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import { publicImgUrl } from "@/utils/publicUrl.js";
import socket from "@/services/socket.js";
import {
  ALL_ACHIEVEMENTS,
  type AchievementLite,
  type Tier,
} from "../lib/achievementsCatalog.js";
import { FaRetweet } from "react-icons/fa";

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

function HeaderSliderLite({
  title,
  start,
}: {
  title: string;
  start: "feed" | "desafios";
}) {
  const [, setLocation] = useLocation();
  const [pos, setPos] = useState(start === "feed" ? 0 : 1);
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const widthRef = useRef(0);
  const startX = useRef(0);
  const startPos = useRef(0);

  useEffect(() => {
    const update = () => {
      widthRef.current = wrapRef.current?.clientWidth || window.innerWidth;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    setPos(start === "feed" ? 0 : 1);
  }, [start]);

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const onDown: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    setDragging(true);
    startX.current = e.clientX;
    startPos.current = pos;
  };
  const onMove: React.PointerEventHandler<HTMLButtonElement> = (e) => {
    if (!dragging) return;
    const w = widthRef.current || window.innerWidth;
    setPos(clamp01(startPos.current + (e.clientX - startX.current) / w));
  };
  const onUp: React.PointerEventHandler<HTMLButtonElement> = () => {
    setDragging(false);
    const target = pos >= 0.5 ? "desafios" : "feed";
    setPos(target === "desafios" ? 1 : 0);
    if (target !== start) setTimeout(() => setLocation(`/${target}`), 100);
  };

  const px = Math.round(pos * (widthRef.current || 0));
  const houseOpacity = 1 - pos;
  const trophyOpacity = pos;

  return (
    <div ref={wrapRef} className="relative h-16 sm:h-20 -mx-4 px-4 sm:mx-0 mb-2">
      <div className="absolute inset-0 z-0">
        <div
          className={`absolute inset-y-2 left-0 right-0 rounded-full border overflow-hidden ${
            dragging
              ? "bg-green-100/70 border-green-200 shadow-inner"
              : "bg-transparent border-transparent"
          }`}
        />
        <div
          className="absolute inset-y-2 left-0 rounded-full bg-green-200/60 transition-[width,opacity] duration-150"
          style={{ width: `${px}px`, opacity: dragging ? 1 : 0 }}
        />
      </div>

      <div className="relative z-10 h-full flex items-center justify-center pointer-events-none">
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>

      <button
        aria-label="Trocar entre Feed e Desafios (arraste)"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white shadow-lg border active:scale-[0.98] touch-none"
        style={{
          left: Math.max(6, Math.min(px - 20, (widthRef.current || 0) - 46)),
          transition: dragging ? "none" : "left 140ms ease",
        }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <House className="absolute" style={{ opacity: houseOpacity }} />
          <Trophy className="absolute text-yellow-600" style={{ opacity: trophyOpacity }} />
        </div>
      </button>
    </div>
  );
}

type ParsedAchievement = {
  ach?: AchievementLite;
  headTitle?: string;
  headDesc?: string;
  userMsg?: string;
};

function parseAchievement(conteudo: string): ParsedAchievement | null {
  if (!conteudo) return null;

  const lines = conteudo.split(/\n+/);
  const head = (lines[0] || "").trim();
  const rest = lines.slice(1).join("\n").trim();

  const isHeadAchievement = /^🏆\s*Conquista:/i.test(head);

  const idMatch = rest.match(/\[([^\]]+)\]/);
  const achId = idMatch?.[1]?.trim();
  const ach: AchievementLite | undefined = achId
    ? (ALL_ACHIEVEMENTS as AchievementLite[]).find((a: AchievementLite) => a.id === achId)
    : undefined;

  if (!isHeadAchievement && !achId) return null;

  let headTitle: string | undefined;
  let headDesc: string | undefined;
  const m = head.match(/^🏆\s*Conquista:\s*(.+?)\s+—\s+(.+)$/);
  if (m) {
    headTitle = m[1];
    headDesc = m[2];
  }

  const userMsg = achId ? rest.replace(/\[[^\]]+\]\s*/, "").trim() : rest;
  return { ach, headTitle, headDesc, userMsg };
}

function TierPill({ tier }: { tier?: Tier }) {
  if (!tier) return null;
  const map: Record<Tier, string> = {
    bronze: "bg-amber-100 text-amber-800 border-amber-200",
    prata: "bg-gray-100 text-gray-700 border-gray-300",
    ouro: "bg-yellow-100 text-yellow-800 border-yellow-200",
    platina: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${map[tier] || ""}`}>
      {tier[0].toUpperCase() + tier.slice(1)}
    </span>
  );
}

function AchievementShareCard({ parsed }: { parsed: ParsedAchievement }) {
  const icon = parsed.ach?.icon || "🏆";
  const title = parsed.ach?.title || parsed.headTitle || "Conquista";
  const desc = parsed.ach?.description || parsed.headDesc || "";
  const tier = parsed.ach?.tier;

  return (
    <div className="mt-1 rounded-xl border border-yellow-200 bg-yellow-50/60 p-3">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center text-xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-yellow-900 truncate">Conquista: {title}</h4>
            <TierPill tier={tier} />
          </div>
          {!!desc && <p className="text-sm text-yellow-900/90 mt-0.5">{desc}</p>}
          {!!parsed.userMsg && (
            <p className="text-sm text-gray-700 mt-2 italic">“{parsed.userMsg}”</p>
          )}
        </div>
      </div>
    </div>
  );
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
  heightPct?: number;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        className="absolute bottom-0 z-50 transform transition-transform duration-300 ease-out left-0 right-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-[1160px] md:w-full"
        style={{ height: `${heightPct}vh` }}
      >
        <div
          className="bg-white rounded-t-2xl shadow-2xl h-full flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full flex justify-center pt-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>
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
  const [filtro, setFiltro] = useState<"todos" | "seguindo" | "favoritos" | "meus">("todos");

  useEffect(() => {
    async function carregar() {
      const dados = await getFeedPosts(filtro);
      if (!dados) return;

      const uid = Storage.usuarioId;
      const filtrado =
        filtro === "todos" && uid
          ? dados.filter((p) => p.usuario?.id !== uid && (p as any).usuarioId !== uid)
          : filtro === "meus" && uid
          ? dados.filter((p) => p.usuario?.id === uid || (p as any).usuarioId === uid)
          : dados;

      const unicos = Array.from(new Map(filtrado.map((p) => [p.id, p])).values());
      setPosts(unicos);
    }
    carregar();
  }, [filtro]);

  useEffect(() => {
    const onNovoPost = (novo: PostagemComUsuario) => {
      setPosts((prev) => {
        if (filtro === "meus" && novo.usuario?.id !== Storage.usuarioId) return prev;
        if (filtro === "todos" && novo.usuario?.id === Storage.usuarioId) return prev;
        if (prev.some((p) => p.id === novo.id)) return prev;

        return [novo, ...prev];
      });
    };

    socket.on("feed:novoPost", onNovoPost as any);
    return () => {
      socket.off("feed:novoPost", onNovoPost as any);
    };
  }, [filtro]);

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
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (e: any) {
      alert(e?.message || "Não foi possível apagar a postagem.");
    }
  };

  const handleRepost = async (postId: string) => {
    if (!userId) return alert("Sessão expirada. Faça login novamente.");
    const comentario = prompt("Adicionar um comentário (opcional):") ?? "";
    try {
      const novo = await repostPost(postId, comentario);
      setPosts((prev) => (prev.some((p) => p.id === novo.id) ? prev : [novo, ...prev]));
    } catch (e) {
      console.error(e);
      alert("Não foi possível repostar.");
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
      <HeaderSliderLite title="Feed de Postagens" start="feed" />

      <div className="flex gap-2 justify-center mb-4">
        {(["todos", "seguindo", "favoritos", "meus"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-sm border ${
              filtro === f
                ? "bg-green-700 text-white border-green-700"
                : "bg-white text-green-700 border-green-700"
            }`}
          >
            {f === "todos"
              ? "Todos"
              : f === "seguindo"
              ? "Seguindo"
              : f === "favoritos"
              ? "Favoritos"
              : "Meus"}
          </button>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 text-center text-gray-600">
          <p>
            {{
              todos: "Nenhuma postagem encontrada.",
              seguindo:
                "Você ainda não segue ninguém — ou ninguém que você segue postou ainda.",
              favoritos: "Você não tem nenhum usuário favoritado.",
              meus: "Você ainda não postou nada.",
            }[filtro]}
          </p>

          {filtro === "seguindo" || filtro === "favoritos" ? (
            <Link
              href="/explorar"
              className="text-green-700 underline mt-2 inline-block"
            >
              Explorar perfis
            </Link>
          ) : filtro === "meus" ? (
            <Link
              href="/post"
              className="text-green-700 underline mt-2 inline-block"
            >
              Criar minha primeira postagem
            </Link>
          ) : null}
        </div>
      )}

      {posts.map((post) => {
        const curtidas = post.curtidas || [];
        const jaCurtiu = curtidas.some((c) => c.usuarioId === Storage.usuarioId);
        const mostrarInput = mostrarInputPorPost[post.id] || false;
        const comentarioTexto = comentarioTextoPorPost[post.id] || "";

        const imgSrc = publicImgUrl(post.imagemUrl) ?? undefined;
        const videoSrc = publicImgUrl(post.videoUrl) ?? undefined;

        const parsed = parseAchievement(post.conteudo);
        const isAchievement = !!parsed;

        return (
          <div
            key={post.id}
            className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img
                  src={
                    publicImgUrl(post.usuario.foto) ||
                    `${APP.FRONTEND_BASE_URL}/assets/default-user.png`
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
              {((post as any).usuarioId === Storage.usuarioId ||
                post?.usuario?.id === Storage.usuarioId) && (
                <button
                  onClick={() => handleApagar(post.id)}
                  title="Apagar postagem"
                  className="text-red-600 hover:text-red-800 p-2"
                >
                  <FaTrash />
                </button>
              )}
            </div>

            {post.repostOf && (
              <div className="text-xs text-gray-500 -mt-1">
                Repostou de{" "}
                <strong>{post.repostOf.usuario?.nome || "Usuário"}</strong>
              </div>
            )}

            <div>
              {post.repostOf ? (
                <>
                  {(() => {
                    const comment = (post.conteudo || "").replace(/\u200B\d+$/, "");
                    return comment.trim() ? (
                      <p className="text-gray-800 font-medium whitespace-pre-line mb-2">
                        {comment}
                      </p>
                    ) : null;
                  })()}

                  <div className="border rounded-xl p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <img
                        src={
                          publicImgUrl(post.repostOf.usuario?.foto) ||
                          `${APP.FRONTEND_BASE_URL}/assets/default-user.png`
                        }
                        alt="avatar original"
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-sm font-semibold">
                          {post.repostOf.usuario?.nome}
                        </p>
                        <p className="text[11px] text-gray-500">
                          {format(
                            new Date(post.repostOf.dataCriacao),
                            "dd/MM, HH:mm"
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-800 whitespace-pre-line">
                      {post.repostOf.conteudo}
                    </p>

                    {publicImgUrl(post.repostOf.imagemUrl) && (
                      <img
                        src={publicImgUrl(post.repostOf.imagemUrl) ?? undefined}
                        alt="Post original"
                        className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                      />
                    )}

                    {publicImgUrl(post.repostOf.videoUrl) && (
                      <video controls className="w-full mt-2 rounded-lg">
                        <source
                          src={publicImgUrl(post.repostOf.videoUrl) ?? ""}
                          type="video/mp4"
                        />
                      </video>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {!isAchievement && (
                    <p className="text-gray-800 font-medium whitespace-pre-line">
                      {post.conteudo}
                    </p>
                  )}

                  {isAchievement && parsed && (
                    <AchievementShareCard parsed={parsed} />
                  )}

                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt="Post"
                      className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                    />
                  )}

                  {videoSrc && (
                    <video controls className="w-full mt-2 rounded-lg">
                      <source src={videoSrc} type="video/mp4" />
                    </video>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-between text-gray-600 mt-2 px-2">
              <button
                className="flex items-center gap-1"
                onClick={() => handleLike(post.id)}
              >
                {jaCurtiu ? (
                  <FaHeart className="text-black" />
                ) : (
                  <FaRegHeart />
                )}{" "}
                <span>{curtidas.length}</span>
              </button>

              <button
                className="flex items-center gap-1"
                onClick={() => abrirModalComentarios(post)}
              >
                <FaRegCommentDots />{" "}
                <span>{post.comentarios?.length || 0}</span>
              </button>

              <button
                className="flex items-center gap-1"
                onClick={() => handleCompartilhar(post.id)}
              >
                <FaShare />
              </button>

              <button
                className="flex items-center gap-1"
                onClick={() => handleRepost(post.id)}
                title="Repostar"
              >
                <FaRetweet />
              </button>
              <span className="ml-1 text-sm">
                {(post as any).reposts ?? (post as any).compartilhamentos ?? 0}
              </span>
            </div>

            {mostrarInputPorPost[post.id] && (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={comentarioTextoPorPost[post.id] || ""}
                    onChange={(e) =>
                      setComentarioTextoPorPost((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    placeholder="Adicione um comentário..."
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() =>
                      handleComentario(
                        post.id,
                        comentarioTextoPorPost[post.id] || ""
                      )
                    }
                  >
                    <FaPaperPlane className="text-green-800" />
                  </button>
                </div>

                {post.comentarios?.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {post.comentarios.map((comentario) => (
                      <div key={comentario.id} className="flex gap-2 items-start">
                        <img
                          src={
                            publicImgUrl(comentario.usuario?.foto) ||
                            `${APP.FRONTEND_BASE_URL}/assets/default-user.png`
                          }
                          alt="avatar"
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="bg-gray-100 rounded-lg px-3 py-2 w-full">
                          <div className="flex justify-between text-sm text-gray-600">
                            <span className="font-semibold">
                              {comentario.usuario?.nome}
                            </span>
                            <span>
                              {format(
                                new Date(comentario.dataCriacao),
                                "dd/MM, HH:mm"
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800">
                            {comentario.conteudo}
                          </p>
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

      <BottomSheet
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        heightPct={40}
        ariaLabel="Compartilhar postagem"
      >
        <h2 className="text-base font-bold mb-3 text-center">
          Compartilhar Postagem
        </h2>

        <div className="mb-3">
          <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {carregandoMutuos && (
              <span className="text-sm text-gray-500">
                Carregando contatos...
              </span>
            )}
            {!carregandoMutuos && usuariosMutuos.length === 0 && (
              <span className="text-sm text-gray-500">
                Você ainda não tem contatos mútuos.
              </span>
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
              ${
                selecionados.size === 0 || enviandoDM
                  ? "bg-gray-300 text-gray-600"
                  : "bg-green-700 text-white hover:bg-green-800"
              }`}
          >
            <Send className="w-4 h-4" />
            {enviandoDM
              ? "Enviando..."
              : `Enviar para ${selecionados.size} contato(s)`}
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
            href={`mailto:?subject=Veja esta postagem&body=${encodeURIComponent(
              linkCompartilhado
            )}`}
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
            <div className="bg-white border rounded-2xl shadow-md h-full flex flex-col overflow-hidden">
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

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
                {postSelecionado.comentarios.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Seja o primeiro a comentar!
                  </p>
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
                          {format(
                            new Date(comentario.dataCriacao),
                            "dd/MM, HH:mm"
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 mt-1">
                        {comentario.conteudo}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

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

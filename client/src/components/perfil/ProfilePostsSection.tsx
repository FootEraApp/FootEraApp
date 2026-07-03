import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { publicImgUrl } from "../../utils/publicUrl.js";
import { FaHeart, FaRegCommentDots, FaRetweet, FaShare } from "react-icons/fa";
import { APP, API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import axios from "axios";
import { X } from "lucide-react";
import { getFeedPosts, deletarComentario, compartilharPost, likePost, comentarPost, repostPost, type PostagemComUsuario } from "../../services/feedService.js";
import Avatar from "../shared/Avatar.js";

type ConquistaDB = {
  id: string;
  titulo: string;
  descricao: string | null;
  icone: string | null;
  tier?: string | null;
};

type ParsedAchievement = {
  conquistaId?: string;
  headTitle?: string;
  headDesc?: string;
  userMsg?: string;
};

function parseAchievement(conteudo: string): ParsedAchievement | null {
  if (!conteudo) return null;

  const lines = conteudo.split(/\n+/);
  const head = (lines[0] || "").trim();
  const rest = lines.slice(1).join("\n").trim();
  const all = `${head}\n${rest}`.trim();
  const isHeadAchievement = /^🏆\s*Conquista(\s*\([^)]+\))?\s*:/i.test(head);
  const idMatch = all.match(/\[([^\]]+)\]/);
  const conquistaId = idMatch?.[1]?.trim();

  if (!isHeadAchievement && !conquistaId) return null;

  let headTitle: string | undefined;
  let headDesc: string | undefined;

  const m = head.match(/^🏆\s*Conquista(?:\s*\([^)]+\))?\s*:\s*(.+?)(?:\s+—\s+(.+))?\s*(?:🏆|$)/);
  if (m) {
    headTitle = m[1]?.trim();
    headDesc = m[2]?.trim();
  }

  let userMsg = rest.replace(/\[[^\]]+\]/g, "").trim();
  userMsg = userMsg
    .replace(/grupo\s*:\s*.*$/gim, "")
    .replace(/tier\s*:\s*.*$/gim, "")
    .replace(/[•·]/g, "")
    .trim();

  return { conquistaId, headTitle, headDesc, userMsg };
}

function TierPill({ tier }: { tier?: string | null }) {
  if (!tier) return null;

  const map: Record<string, string> = {
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

function AchievementShareCard({
  parsed,
  conquista,
}: {
  parsed: ParsedAchievement;
  conquista: ConquistaDB | null;
}) {
  const icon = conquista?.icone || "🏆";
  const title = conquista?.titulo || parsed.headTitle || "Conquista";
  const desc = conquista?.descricao || parsed.headDesc || "";
  const tier = conquista?.tier ?? null;

  return (
    <div className="mt-1 rounded-xl border border-yellow-200 bg-yellow-50/60 p-3">
      <div className="flex gap-3 items-start">
        <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center text-xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-yellow-900 truncate">
              Conquista: {title}
            </h4>
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

function ownerIdOfPost(p: PostagemComUsuario, fallbackAny: any): string {
  const fromUsuario = String(p?.usuario?.id ?? "").trim();
  if (fromUsuario) return fromUsuario;

  const fromAlt = String(
    fallbackAny?.usuarioId ?? fallbackAny?.autorId ?? fallbackAny?.userId ?? ""
  ).trim();

  return fromAlt;
}

function midiaImg(url?: string | null) {
  const u = publicImgUrl(url ?? null);
  return u || null;
}
function midiaVideo(url?: string | null) {
  const u = publicImgUrl(url ?? null);
  return u || null;
}

function cleanText(s?: string | null) {
  return String(s ?? "").replace(/\u200B/g, "").trim();
}

function username(u?: any) {
  const h = u?.nomeDeUsuario ? `@${u.nomeDeUsuario}` : "";
  return h || u?.nome || "Usuário";
}

function getRootPost(p: PostagemComUsuario): PostagemComUsuario {
  let cur: any = p;
  while (cur?.repostOf) cur = cur.repostOf;
  return cur as PostagemComUsuario;
}

function getParentPost(p: PostagemComUsuario): PostagemComUsuario | null {
  return (p as any).repostOf ?? null;
}

export default function ProfilePostsSection({ usuarioId }: { usuarioId: string }) {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);
  const [conquistasById, setConquistasById] = useState<Record<string, ConquistaDB>>({});
  const [comentandoPostId, setComentandoPostId] = useState<string | null>(null);
  const [comentarioTexto, setComentarioTexto] = useState("");
  const [repostandoId, setRepostandoId] = useState<string | null>(null);
  const [curtindoId, setCurtindoId] = useState<string | null>(null);
  const [comentariosModalAberto, setComentariosModalAberto] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState<PostagemComUsuario | null>(null);
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>({});
  const [repostsByMe, setRepostsByMe] = useState<Set<string>>(new Set());

  const token =
    (Storage as any)?.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

  async function handleApagarComentario(comentarioId: string, postId: string) {
    try {
      await deletarComentario(comentarioId);

      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : { ...p, comentarios: (p.comentarios || []).filter((c: any) => c.id !== comentarioId) }
        )
      );

      setPostSelecionado((prev) => {
        if (!prev || prev.id !== postId) return prev;
        return {
          ...prev,
          comentarios: (prev.comentarios || []).filter((c: any) => c.id !== comentarioId),
        };
      });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível apagar o comentário.");
    }
  }

  async function toggleCurtir(postId: string) {
    try {
      setCurtindoId(postId);
      await likePost(postId);

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;

          const me = String(Storage.usuarioId || "").trim();
          const curtidas = Array.isArray(p.curtidas) ? [...p.curtidas] : [];
          const jaCurti = curtidas.some((c) => String(c.usuarioId) === me);

          return {
            ...p,
            curtidas: jaCurti
              ? curtidas.filter((c) => String(c.usuarioId) !== me)
              : [...curtidas, { usuarioId: me }],
          };
        })
      );
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível curtir.");
    } finally {
      setCurtindoId(null);
    }
  }

  async function enviarComentarioNoModal(postId: string) {
    const txt = String(comentarioTextoPorPost[postId] || "").trim();
    if (!txt) return;

    try {
      const novoComentario = await comentarPost(postId, txt);

      setComentarioTextoPorPost((prev) => ({ ...prev, [postId]: "" }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comentarios: [...(p.comentarios || []), novoComentario as any] }
            : p
        )
      );

      setPostSelecionado((prev) => {
        if (!prev || prev.id !== postId) return prev;
        return { ...prev, comentarios: [...(prev.comentarios || []), novoComentario as any] };
      });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível comentar.");
    }
  }

  async function repostar(post: PostagemComUsuario) {
    const meId = String(Storage.usuarioId || "").trim();
    const root = getRootPost(post);
    const rootId = String(root?.id || post.id).trim();
    const jaRepostei = repostsByMe.has(rootId);

    try {
      setRepostandoId(rootId);

      const resp = await repostPost(rootId, ""); 

      setRepostsByMe((prev) => {
        const next = new Set(prev);
        if (jaRepostei) next.delete(rootId);
        else next.add(rootId);
        return next;
      });

      setPosts((prev) => {
        const next = [...prev];
        if (resp?.action === "unrepost") {
          return next
            .filter((p) => {
              const anyP = p as any;
              const dono = ownerIdOfPost(p, anyP);
              const r = getRootPost(p);
              const rid = String(r?.id || p.id).trim();

              if (dono === meId && p.repostOf && rid === rootId) return false;
              return true;
            })
            .map((p) => {
              const r = getRootPost(p);
              const rid = String(r?.id || p.id).trim();
              if (rid !== rootId) return p;

              const base = Number(p.reposts ?? 0);
              return { ...p, reposts: Math.max(0, base - 1) };
            });
        }

        const mapped = next.map((p) => {
          const r = getRootPost(p);
          const rid = String(r?.id || p.id).trim();
          if (rid !== rootId) return p;

          const base = Number(p.reposts ?? 0);
          return { ...p, reposts: base + 1 };
        });

        if (resp?.action === "repost" && resp?.post) {
          const already = mapped.some((p) => String(p.id) === String(resp.post!.id));
          if (!already) {
            mapped.unshift(resp.post as any);
          }
        }

        return mapped;
      });
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível repostar.");
    } finally {
      setRepostandoId(null);
    }
  }

  async function carregarConquista(conquistaId: string) {
    const id = String(conquistaId || "").trim();
    if (!id) return;
    if (conquistasById[id]) return;

    const token =
      (Storage as any)?.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const base =
      (API?.BASE_URL ? String(API.BASE_URL).replace(/\/+$/, "") : "") || "";

    try {
      const { data } = await axios.get<{ conquista: ConquistaDB | null }>(
        `${base}/api/conquistas/id/${id}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      if (data?.conquista) {
        setConquistasById((prev) => ({ ...prev, [id]: data.conquista! }));
      }
    } catch (e) {
      console.error("Falha ao carregar conquista:", id, e);
    }
  }

  async function apagarPost(postId: string) {
    const token = Storage.token;
    if (!token) {
      toast.error("Você precisa estar logado para apagar.");
      return;
    }

    const ok = confirm("Tem certeza que deseja apagar esta postagem?");
    if (!ok) return;

    try {
      setDeletandoId(postId);

      await axios.delete(`${API.BASE_URL}/api/feed/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Não foi possível apagar agora."
      );
    } finally {
      setDeletandoId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingPosts(true);

        const alvo = String(usuarioId || "").trim();
        const isOwn = alvo === String(Storage.usuarioId || "").trim();

        let dados = await getFeedPosts(isOwn ? "meus" : "todos");

        dados = (dados || []).filter((p) => {
          const anyP = p as any;
          const dono = ownerIdOfPost(p, anyP);

          const reposterId = String(
            anyP?.reposterId ??
              anyP?.repostUserId ??
              anyP?.repostById ??
              anyP?.usuarioRepostId ??
              ""
          ).trim();

          return dono === alvo || reposterId === alvo;
        });

        dados.sort(
          (a, b) =>
            new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
        );

        if (!cancelled) setPosts(dados);

        const meId = String(Storage.usuarioId || "").trim();
        const s = new Set<string>();

        for (const p of dados) {
          const anyP = p as any;
          const dono = ownerIdOfPost(p, anyP);

          if (p.repostOf && dono === meId) {
            const root = getRootPost(p);
            if (root?.id) s.add(String(root.id));
          }
        }

        if (!cancelled) setRepostsByMe(s);

        const ids = new Set<string>();
        for (const p of dados) {
          const parsed = parseAchievement(p.conteudo || "");
          if (parsed?.conquistaId) ids.add(parsed.conquistaId);
        }
        ids.forEach((id) => carregarConquista(id));
      } catch (e) {
        console.error("Erro ao carregar postagens do perfil:", e);
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [usuarioId]);

  const FALLBACK_AVATAR = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

  return (
    <div className="max-w-3xl mx-auto px-4 mt-4 pb-10">
      <div className="pt-3 pb-2">
        <h2 className="text-green-900 font-bold text-lg px-4 mb-2">
          Minhas postagens
        </h2>

        {loadingPosts && (
          <p className="text-sm text-gray-500 px-4">Carregando postagens...</p>
        )}

        {!loadingPosts && posts.length === 0 && (
          <p className="text-sm text-gray-500 px-4">Nenhuma postagem ainda.</p>
        )}

        <div className="space-y-4 px-4 mt-2">
          {posts.map((post) => {
            const anyP = post as any;
            const dono = ownerIdOfPost(post, anyP);
            const me = String(Storage.usuarioId || "").trim();
            const jaCurtiu = (post.curtidas || []).some((c: any) =>
              String(c?.usuarioId ?? c?.userId ?? c?.id) === me
            );
            const isMyProfile = String(usuarioId || "").trim() === me;
            const root = getRootPost(post);
            const rootId = String(root?.id || post.id).trim();
            const jaRepostei = repostsByMe.has(rootId);
            const repostCount = Number(post.reposts ?? root?.reposts ?? 0);
            const reposterId = String(
              anyP?.reposterId ??
                anyP?.repostUserId ??
                anyP?.repostById ??
                anyP?.usuarioRepostId ??
                ""
            ).trim();

            const canDelete = isMyProfile && (dono === me || reposterId === me);
            const parsed = parseAchievement(post.conteudo || "");
            const isAchievement = !!parsed;
            const conquista = parsed?.conquistaId ? (conquistasById[parsed.conquistaId] ?? null) : null;
            const imgSrc = midiaImg(post.imagemUrl);
            const videoSrc = midiaVideo(post.videoUrl);
            const ro = post.repostOf ?? null;

            return (
              <div
                key={post.id}
                className="bg-stone-50 rounded-2xl shadow-md p-4 space-y-3"
              >
               <div className="flex items-center gap-2">
                <Avatar
                  foto={post?.usuario?.foto}
                  alt={post?.usuario?.nome || "Usuário"}
                  className="w-10 h-10"
                />

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {post?.usuario?.nome || "Usuário"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(post.dataCriacao), "dd/MM, HH:mm")}
                  </p>
                </div>

                {canDelete && (
                  <button
                    onClick={() => apagarPost(post.id)}
                    disabled={deletandoId === post.id}
                    className="ml-auto p-2 rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                    title="Apagar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
                <div>
                  {ro ? (
                    <>
                      {!!cleanText(post.conteudo) && (
                        <p className="text-gray-800 font-medium whitespace-pre-line mb-2">
                          {cleanText(post.conteudo)}
                        </p>
                      )}

                      {(() => {
                        const parent = getParentPost(post); 
                        const root = getRootPost(post);     
                        const parentComment = parent ? cleanText(parent.conteudo) : "";
                        const rootText = cleanText(root.conteudo);
                        const rootImg = midiaImg(root.imagemUrl);
                        const rootVideo = midiaVideo(root.videoUrl);

                        return (
                          <div className="border border-gray-200 rounded-2xl p-4 bg-white">
                            <p className="text-sm text-gray-500 mb-2">
                              Repostou de{" "}
                              <span className="text-green-900 font-medium">
                                {username(ro.usuario)}
                              </span>
                            </p>

                            {!!parentComment && (
                              <div className="mb-3 text-sm text-gray-700">
                                <span className="font-semibold">{username(parent?.usuario)}</span>{" "}
                                <span className="text-gray-600">comentou:</span>{" "}
                                <span className="italic">“{parentComment}”</span>
                              </div>
                            )}

                            <div className="border rounded-xl p-3 bg-gray-50">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar
                                  foto={root.usuario?.foto}
                                  alt={root.usuario?.nome || "avatar"}
                                  className="w-7 h-7"
                                />

                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {root.usuario?.nome || "Usuário"}{" "}
                                    <span className="text-gray-500 font-normal">
                                      ({username(root.usuario)})
                                    </span>
                                  </p>

                                  <p className="text-[11px] text-gray-500">
                                    {format(new Date(root.dataCriacao), "dd/MM, HH:mm")}
                                  </p>
                                </div>
                              </div>

                              {!!rootText && (
                                <p className="text-sm text-gray-800 whitespace-pre-line">
                                  {rootText}
                                </p>
                              )}

                              {rootImg && (
                                <img
                                  src={rootImg}
                                  alt="Post principal"
                                  className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                                />
                              )}

                              {rootVideo && (
                                <video controls className="w-full mt-2 rounded-lg">
                                  <source src={rootVideo} type="video/mp4" />
                                </video>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {!isAchievement && (
                        <p className="text-gray-800 font-medium whitespace-pre-line">
                          {post.conteudo}
                        </p>
                      )}
                      
                      {isAchievement && parsed && (
                        <AchievementShareCard parsed={parsed} conquista={conquista} />
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

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleCurtir(post.id)}
                      disabled={curtindoId === post.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full border ${
                        jaCurtiu ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-200 text-gray-700"
                      }`}
                    >
                      <FaHeart className={jaCurtiu ? "opacity-100" : "opacity-60"} />
                      <span>{(post.curtidas || []).length}</span>
                    </button>

                    <button
                      onClick={() => {
                        setPostSelecionado(post);
                        setComentariosModalAberto(true);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white border-gray-200 text-gray-700"
                    >
                      <FaRegCommentDots />
                      <span>{(post.comentarios || []).length}</span>
                    </button>

                    <button
                      onClick={() => repostar(post)}
                      disabled={repostandoId === rootId}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full border ${
                        jaRepostei
                          ? "bg-red-50 border-red-200 text-red-600"
                          : "bg-white border-gray-200 text-gray-700"
                      }`}
                      title={jaRepostei ? "Despublicar" : "Republicar"}
                    >
                      <FaRetweet className={jaRepostei ? "opacity-100" : "opacity-60"} />
                      <span>{repostCount}</span>
                    </button>

                    <button
                      onClick={() => compartilharPost(post.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-full border bg-white border-gray-200 text-gray-700"
                    >
                      <FaShare />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {comentariosModalAberto && postSelecionado && (
            <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center">
              <div className="bg-white w-full sm:w-[560px] rounded-t-2xl sm:rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-bold text-green-900">Comentários</h3>
                  <button
                    onClick={() => {
                      setComentariosModalAberto(false);
                      setPostSelecionado(null);
                    }}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-[55vh] overflow-y-auto px-4 py-3 space-y-3">
                  {(postSelecionado.comentarios || []).length === 0 && (
                    <p className="text-sm text-gray-500">Seja o primeiro a comentar!</p>
                  )}

                  {(postSelecionado.comentarios || []).map((c: any) => {
                    const isMine = String(c.usuarioId) === String(Storage.usuarioId);
                    return (
                      <div key={c.id} className="flex gap-3">
                        <Avatar
                          foto={c.usuario?.foto}
                          alt={c.usuario?.nome || "avatar"}
                          className="w-9 h-9"
                        />

                        <div className="flex-1 bg-gray-50 border rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-800">
                              {c.usuario?.nome || "Usuário"}
                            </span>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-gray-500">
                                {format(new Date(c.dataCriacao), "dd/MM, HH:mm")}
                              </span>

                              {isMine && (
                                <button
                                  onClick={() => handleApagarComentario(c.id, postSelecionado.id)}
                                  className="text-gray-400 hover:text-red-600"
                                  title="Apagar comentário"
                                  aria-label="Apagar comentário"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-sm text-gray-800 mt-1">{c.conteudo}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t bg-gray-50 px-3 py-3">
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          enviarComentarioNoModal(postSelecionado.id);
                        }
                      }}
                      placeholder="Adicione um comentário..."
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                    />

                    <button
                      onClick={() => enviarComentarioNoModal(postSelecionado.id)}
                      className="inline-flex items-center justify-center rounded-lg px-3 py-2 bg-green-700 text-white hover:bg-green-800"
                      title="Enviar"
                    >
                      ➤
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
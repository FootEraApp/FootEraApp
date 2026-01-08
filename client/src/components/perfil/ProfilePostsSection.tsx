import { useEffect, useState } from "react";
import { format } from "date-fns";
import { publicImgUrl } from "../../utils/publicUrl.js";
import { FaHeart, FaRegCommentDots } from "react-icons/fa";
import { getFeedPosts, type PostagemComUsuario } from "../../services/feedService.js";
import { APP, API } from "../../config.js";
import {
  ALL_ACHIEVEMENTS,
  type AchievementLite,
  type Tier,
} from "../../lib/achievementsCatalog.js";
import Storage from "../../../../server/utils/storage.js";
import axios from "axios";
import { X } from "lucide-react";

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
    ? (ALL_ACHIEVEMENTS as AchievementLite[]).find((a) => a.id === achId)
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

export default function ProfilePostsSection({ usuarioId }: { usuarioId: string }) {
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  async function apagarPost(postId: string) {
    const token = Storage.token;
    if (!token) {
      alert("Você precisa estar logado para apagar.");
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
      alert(
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
    <div className="max-w-3xl mx-auto px-4 -mt-2 pb-10">
      <div className="pt-2 pb-2">
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
            const isMyProfile = String(usuarioId || "").trim() === me;

            const reposterId = String(
              anyP?.reposterId ??
                anyP?.repostUserId ??
                anyP?.repostById ??
                anyP?.usuarioRepostId ??
                ""
            ).trim();

            const canDelete = isMyProfile && (dono === me || reposterId === me);
            const curtidas = post.curtidas || [];
            const comentarios = post.comentarios || [];
            const parsed = parseAchievement(post.conteudo || "");
            const isAchievement = !!parsed;
            const avatarSrc = publicImgUrl(post?.usuario?.foto) || FALLBACK_AVATAR;
            const imgSrc = midiaImg(post.imagemUrl);
            const videoSrc = midiaVideo(post.videoUrl);
            const ro = post.repostOf ?? null; 
            const roImg = ro ? midiaImg(ro.imagemUrl) : null;
            const roVideo = ro ? midiaVideo(ro.videoUrl) : null;

            return (
              <div
                key={post.id}
                className="bg-white rounded-2xl shadow-md p-4 space-y-3"
              >
               <div className="flex items-center gap-2">
                <img
                  src={avatarSrc}
                  alt={post?.usuario?.nome || "Usuário"}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if ((img as any).dataset?.fallbackApplied) return;
                    (img as any).dataset.fallbackApplied = "1";
                    img.src = FALLBACK_AVATAR;
                  }}
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
                      {post.conteudo && (
                        <p className="text-gray-800 font-medium whitespace-pre-line mb-2">
                          {post.conteudo}
                        </p>
                      )}

                      <div className="border border-gray-200 rounded-2xl p-4 bg-white">
                        <p className="text-sm text-gray-500 mb-2">
                          Repostou de{" "}
                          <span className="text-green-900 font-medium">
                            {ro.usuario?.nome || "Usuário"}
                          </span>
                        </p>

                        {!!ro.conteudo && (
                          <p className="text-sm text-gray-800 whitespace-pre-line">
                            {ro.conteudo}
                          </p>
                        )}

                        {roImg && (
                          <img
                            src={roImg}
                            alt="Post original"
                            className="mt-3 rounded-2xl max-h-72 w-full object-cover"
                          />
                        )}

                        {roVideo && (
                          <video controls className="w-full mt-3 rounded-2xl">
                            <source src={roVideo} type="video/mp4" />
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

                <div className="flex items-center gap-4 text-gray-600 text-sm px-1">
                  <div className="flex items-center gap-1">
                    <FaHeart />
                    <span>{curtidas.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FaRegCommentDots />
                    <span>{comentarios.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
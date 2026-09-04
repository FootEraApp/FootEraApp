import { toast } from "@/lib/toast";
import React, { useEffect, useRef, useState } from "react";
import {
  FaHeart,
  FaRegHeart,
  FaRegCommentDots,
  FaShare,
  FaPaperPlane,
  FaTrash,
  FaRetweet,
} from "react-icons/fa";
import {
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
  deletarComentario,
  type RepostResponse,
} from "../services/feedService.js";
import { format } from "date-fns";
import { Link, useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import { publicImgUrl } from "../utils/publicUrl.js";
import socket from "../services/socket.js";
import { http } from "../services/http.js";
import { TreinosApi } from "../utils/treinosApi.js";
import BottomNav from "@/components/layout/BottomNav.js";
import Avatar from "../components/shared/Avatar.js";
import { useAuthGate } from "../context/AuthGateContext.js";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

async function getUsuariosMutuos(): Promise<Usuario[]> {
  const { data } = await http.get<Usuario[]>("/api/seguidores/mutuos");
  return data;
}

const ENABLE_TOP_HOME_BUTTON = false;

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
  const {
    requireAuth,
  } = useAuthGate();

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
    if (target !== start) setTimeout(() => setLocation(`/${target}`), 120);
  };

  const px = Math.round(pos * (widthRef.current || 0));
  const houseOpacity = 1 - pos;
  const trophyOpacity = pos;

  return (
    <div
      ref={wrapRef}
      className="relative h-16 sm:h-20 -mx-4 mb-2"
    >
      <div className="absolute inset-0 bg-green-900 z-0" />

      <div className="relative z-10 h-full">
        <div className="h-full flex items-center justify-center pointer-events-none">
          {title && (
            <h1 className="text-lg sm:text-xl font-extrabold tracking-wide text-white">
              {title}
            </h1>
          )}
        </div>

        <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
          <button
            type="button"
            aria-label="Abrir mensagens"
            onClick={() => {
              if (
                requireAuth({
                  message:
                    "Entre na FootEra para acessar suas mensagens.",
                })
              ) {
                setLocation(
                  "/mensagens"
                );
              }
            }}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-green-700/70 bg-green-800/80 text-white shadow-md hover:bg-green-700 hover:border-green-500 active:scale-95 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute inset-0">
          <div
            className={`absolute inset-y-2 left-0 right-0 rounded-full border overflow-hidden transition-colors duration-150 ${
              dragging
                ? "bg-green-100/70 border-green-200 shadow-inner"
                : "bg-transparent border-transparent"
            }`}
          />
          <div
            className="absolute inset-y-2 left-0 rounded-full bg-green-200/60 transition-[width,opacity] duration-150"
            style={{ width: `${px}px`, opacity: dragging ? 1 : 0 }}
          />
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-green-800/70 text-xs sm:text-sm transition-opacity duration-150 ${
              dragging ? "opacity-100" : "opacity-0"
            }`}
          >
            <House className="w-4 h-4" />
            <span className="hidden sm:inline">Feed</span>
          </div>
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-yellow-700/80 text-xs sm:text-sm transition-opacity duration-150 ${
              dragging ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="hidden sm:inline">Desafios</span>
            <Trophy className="w-4 h-4" />
          </div>
        </div>

        {ENABLE_TOP_HOME_BUTTON && (
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
              <Trophy
                className="absolute text-yellow-600"
                style={{ opacity: trophyOpacity }}
              />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

type AgendaTipo = "TREINO" | "DESAFIO" | "EVENTO" | "JOGO" | "PENEIRA" | "OUTRO";

type AgendaItem = {
  id: string;
  tipo: AgendaTipo;
  titulo: string;
  inicio: string;
  fim?: string | null;
  origem: string;
};

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
  tier?: string;
  grupo?: string;
};

function parseAchievement(
  conteudo: string
): ParsedAchievement | null {
  if (!conteudo) return null;

  const lines =
    conteudo.split(/\n+/);

  const head =
    (lines[0] || "").trim();

  const rest =
    lines
      .slice(1)
      .join("\n")
      .trim();

  const all =
    `${head}\n${rest}`.trim();

  const isHeadAchievement =
    /^🏆\s*Conquista(?:\s*\([^)]+\))?\s*:/i.test(
      head
    );

  const idMatch =
    all.match(/\[([^\]]+)\]/);

  const conquistaId =
    idMatch?.[1]?.trim();

  if (
    !isHeadAchievement &&
    !conquistaId
  ) {
    return null;
  }

  let headTitle:
    | string
    | undefined;

  let headDesc:
    | string
    | undefined;

  const m =
    head.match(
      /^🏆\s*Conquista(?:\s*\([^)]+\))?\s*:\s*(.+?)(?:\s+—\s+(.+))?\s*(?:🏆|$)/
    );

  if (m) {
    headTitle =
      m[1]?.trim();

    headDesc =
      m[2]?.trim();
  }

  const tierMatch =
    all.match(
      /tier:\s*([a-zç]+)/i
    );

  const grupoMatch =
    all.match(
      /grupo:\s*([a-z0-9 _-]+)/i
    );

  const tier =
    tierMatch?.[1]
      ?.trim()
      .toLowerCase();

  const grupo =
    grupoMatch?.[1]?.trim();

  let userMsg =
    rest
      .replace(
        /\[[^\]]+\]/g,
        ""
      )
      .trim();

  userMsg =
    userMsg
      .replace(
        /grupo\s*:\s*.*$/gim,
        ""
      )
      .replace(
        /tier\s*:\s*.*$/gim,
        ""
      )
      .replace(
        /[•·]/g,
        ""
      )
      .trim();

  return {
    conquistaId,
    headTitle,
    headDesc,
    userMsg,
    tier,
    grupo,
  };
}

function TierPill({ tier }: { tier?: string | null }) {
  if (!tier) return null;

  const t = String(tier).toLowerCase();
  const map: Record<string, string> = {
    bronze: "bg-amber-100 text-amber-800 border-amber-200",
    prata: "bg-gray-100 text-gray-700 border-gray-300",
    ouro: "bg-yellow-100 text-yellow-800 border-yellow-200",
    platina: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border ${map[t] || "bg-gray-100 text-gray-700 border-gray-300"}`}>
      {t ? t[0].toUpperCase() + t.slice(1) : ""}
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
  const tier =
    conquista?.tier ??
    parsed.tier ??
    null;

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

          {!!desc && (
            <p className="text-sm text-yellow-900/90 mt-0.5">{desc}</p>
          )}

          {!!parsed.userMsg && (
            <p className="text-sm text-gray-700 mt-2 italic">
              “{parsed.userMsg}”
            </p>
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
  children?: React.ReactNode;
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

function cleanText(s?: string | null) {
  return String(s ?? "").replace(/\u200B/g, "").trim();
}

function username(u?: any) {
  const h = u?.nomeDeUsuario ? `@${u.nomeDeUsuario}` : "";
  return h || u?.nome || "Usuário";
}

function getRepostChain(p: PostagemComUsuario): PostagemComUsuario[] {
  const chain: PostagemComUsuario[] = [];
  let cur: any = p;

  while (cur?.repostOf) {
    chain.push(cur.repostOf as PostagemComUsuario);
    cur = cur.repostOf;
  }

  return chain;
}

function isPostUsuarioDestaque(p: PostagemComUsuario): boolean {
  const usuario = (p as any)?.usuario;

  return Boolean(
    usuario?.destaque === true ||
      usuario?.perfilDestaque === true ||
      usuario?.isDestaque === true
  );
}

function getPostDateMs(p: PostagemComUsuario): number {
  const raw =
    (p as any)?.createdAt ??
    (p as any)?.criadoEm ??
    (p as any)?.dataCriacao ??
    (p as any)?.updatedAt ??
    null;

  const ms = raw ? new Date(raw).getTime() : 0;

  return Number.isFinite(ms) ? ms : 0;
}

function sortPostsDestaquePrimeiro(
  arr: PostagemComUsuario[]
): PostagemComUsuario[] {
  return [...arr].sort((a, b) => {
    const ad = isPostUsuarioDestaque(a) ? 1 : 0;
    const bd = isPostUsuarioDestaque(b) ? 1 : 0;

    if (ad !== bd) return bd - ad;

    return getPostDateMs(b) - getPostDateMs(a);
  });
}

function PaginaFeed(): JSX.Element {
  const [, setLocation] = useLocation();
  const [posts, setPosts] = useState<PostagemComUsuario[]>([]);
  const [mostrarInputPorPost, setMostrarInputPorPost] = useState<Record<string, boolean>>({});
  const [comentarioTextoPorPost, setComentarioTextoPorPost] = useState<Record<string, string>>(
    {}
  );
  const [modalAberto, setModalAberto] = useState(false);
  const [linkCompartilhado, setLinkCompartilhado] = useState("");
  const [comentariosModalAberto, setComentariosModalAberto] = useState(false);
  const [postSelecionado, setPostSelecionado] = useState<PostagemComUsuario | null>(null);
  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [idCompartilhado, setIdCompartilhado] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "seguindo" | "favoritos">("todos");
  const [agendaFeed, setAgendaFeed] = useState<AgendaItem[]>([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [conquistasById, setConquistasById] = useState<Record<string, ConquistaDB>>({});
  const [carregandoPosts, setCarregandoPosts] = useState(true);
  const [erroFeed, setErroFeed] = useState(false);
  const {
    requireAuth,
    openAuthGate,
    handleAuthError,
  } = useAuthGate();

  const selecionarFiltro = (target: "todos" | "seguindo" | "favoritos") => {
    setFiltro(target);
  };

  const userId = Storage.usuarioId as string | null;
  const tipoUsuario =
    (Storage as any).tipoUsuario ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";

  React.useEffect(() => {
    setModalAberto(false);
    setComentariosModalAberto(false);
    setPostSelecionado(null);

    document
      .querySelectorAll(
        ".backdrop, .overlay, .modal, [data-state='open'], [data-radix-dialog-overlay]"
      )
      .forEach((el) => {
        (el as HTMLElement).remove();
      });
  }, []);

  useEffect(() => {
    if (tipoUsuario !== "ATLETA") {
      setAgendaFeed([]);
      setCarregandoAgenda(false);
      return;
    }

    (async () => {
      try {
        setCarregandoAgenda(true);

        const hoje = new Date();
        const daqui7 = new Date();
        daqui7.setDate(hoje.getDate() + 7);

        const rows = await TreinosApi.getCalendario(hoje, daqui7);

        const normalizados: AgendaItem[] = (Array.isArray(rows) ? rows : []).map(
          (item: any) => ({
            id: item.id,
            tipo: (item.tipo as AgendaTipo) ?? "OUTRO",
            titulo: item.titulo ?? "Atividade",
            inicio: item.inicio ?? item.start ?? item.data ?? new Date().toISOString(),
            fim: item.fim ?? item.end ?? item.dataFim ?? null,
            origem: item.origem ?? "API",
          })
        );

        normalizados.sort((a, b) => a.inicio.localeCompare(b.inicio));
        setAgendaFeed(normalizados);
      } catch (e) {
        console.error("Erro ao carregar agenda do feed:", e);
        setAgendaFeed([]);
      } finally {
        setCarregandoAgenda(false);
      }
    })();
  }, [tipoUsuario]);

  const carregarFeed = React.useCallback(async () => {
    try {
      setCarregandoPosts(true);
      setErroFeed(false);

      const usuarioLogadoId = Storage.usuarioId as string | null;

      let dados: PostagemComUsuario[] = await getFeedPosts(filtro);

      if (usuarioLogadoId) {
        dados = dados.filter((p) => p.usuario?.id !== usuarioLogadoId);
      }

      const unicos: PostagemComUsuario[] = Array.from(
        new Map<string, PostagemComUsuario>(
          dados.map((p) => [p.id, p] as const)
        ).values()
      );

      const ordenados = sortPostsDestaquePrimeiro(unicos);

      setPosts(ordenados);

      const ids = new Set<string>();
      for (const p of ordenados) {
        const parsed = parseAchievement(p.conteudo || "");
        if (parsed?.conquistaId) ids.add(parsed.conquistaId);
      }
      ids.forEach(
        (id) =>
          carregarConquista(id)
      );
    } catch (e) {
      console.error("Falha ao carregar feed:", e);
      setPosts([]);
      setErroFeed(true);
    } finally {
      setCarregandoPosts(false);
    }
  }, [filtro]);

  useEffect(() => {
    carregarFeed();
  }, [carregarFeed]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const onNovoPost = (
      novo: PostagemComUsuario
    ) => {
      setPosts((prev) => {
        if (
          novo.usuario?.id ===
          Storage.usuarioId
        ) {
          return prev;
        }

        if (
          prev.some(
            (p) =>
              p.id === novo.id
          )
        ) {
          return prev;
        }

        return sortPostsDestaquePrimeiro(
          [
            novo,
            ...prev,
          ]
        );
      });
    };

    socket.on(
      "feed:novoPost",
      onNovoPost as any
    );

    return () => {
      socket.off(
        "feed:novoPost",
        onNovoPost as any
      );
    };
  }, [userId]);

  const carregarConquista = async (conquistaId: string) => {
    const id = String(conquistaId || "").trim();
    if (!id) return;
    if (conquistasById[id]) return;

    try {
      const { data } = await http.get<{ conquista: ConquistaDB | null }>(
        `/api/conquistas/id/${id}`
      );

      if (data?.conquista) {
        setConquistasById((prev) => ({ ...prev, [id]: data.conquista! }));
      }
    } catch (e) {
      console.error("Falha ao carregar conquista:", id, e);
    }
  };

  const handleApagarComentario = async (comentarioId: string, postId: string) => {
    if (
      !requireAuth({
        message:
          "Entre na FootEra para apagar este comentário.",
      })
    ) {
      return;
    }

    try {
      await deletarComentario(comentarioId);

      setPostSelecionado((prev) => {
        if (!prev || prev.id !== postId) return prev;

        return {
          ...prev,
          comentarios: (prev.comentarios || []).filter(
            (c) => c.id !== comentarioId
          ),
        };
      });

      setPosts((prev) =>
        prev.map((p) =>
          p.id !== postId
            ? p
            : {
                ...p,
                comentarios: (p.comentarios || []).filter(
                  (c) => c.id !== comentarioId
                ),
              }
        )
      );
    } catch (e: any) {
      if (
        handleAuthError(e, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      toast.error(
        e?.message ||
          "Não foi possível apagar o comentário."
      );
    }
  };

  const handleLike = async (postId: string) => {
    if (
      !requireAuth({
        message:
          "Entre na FootEra para curtir esta publicação.",
      })
    ) {
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
    } catch (error: any) {
      if (
        handleAuthError(error, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      console.error("Erro ao curtir post:", error);
      toast.error("Não foi possível curtir esta publicação.");
    }
  };

  const handleComentario = async (postId: string, texto: string) => {
    if (
      !requireAuth({
        message:
          "Entre na FootEra para comentar nesta publicação.",
      })
    ) {
      return;
    }

    const conteudo = String(texto || "").trim();
    if (!conteudo) return;

    try {
      const novoComentario = await comentarPost(postId, conteudo);

      setComentarioTextoPorPost((prev) => ({ ...prev, [postId]: "" }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, comentarios: [...(p.comentarios || []), novoComentario] }
            : p
        )
      );

      setPostSelecionado((prev) => {
        if (!prev || prev.id !== postId) return prev;
        return { ...prev, comentarios: [...(prev.comentarios || []), novoComentario] };
      });
    } catch (e: any) {
      if (
        handleAuthError(e, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      console.error("Erro ao comentar:", e);
      toast.error("Não foi possível comentar.");
    }
  };

  const handleCompartilhar =
    async (
      postId: string
    ) => {
      const link =
        `${APP.FRONTEND_BASE_URL}/post/${postId}`;

      setLinkCompartilhado(
        link
      );

      setIdCompartilhado(
        postId
      );

      setModalAberto(true);

      // Visitante pode compartilhar
      // externamente, mas não por DM.
      if (!userId) {
        setUsuariosMutuos([]);
        setSelecionados(
          new Set()
        );

        return;
      }

      try {
        setCarregandoMutuos(
          true
        );

        setSelecionados(
          new Set()
        );

        const lista =
          await getUsuariosMutuos();

        setUsuariosMutuos(
          lista
        );
      } catch (e) {
        console.error(e);

        toast.error(
          "Não foi possível carregar seus contatos."
        );
      } finally {
        setCarregandoMutuos(
          false
        );
      }
    };

  const handleApagar = async (postId: string) => {
    if (
      !requireAuth({
        message:
          "Entre na FootEra para apagar esta postagem.",
      })
    ) {
      return;
    }

    if (
      !window.confirm(
        "Apagar esta postagem? Essa ação não pode ser desfeita."
      )
    ) {
      return;
    }

    try {
      await deletarPost(postId);
      setPosts((prev) =>
        prev.filter((p) => p.id !== postId)
      );
    } catch (e: any) {
      if (
        handleAuthError(e, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      toast.error(
        e?.message ||
          "Não foi possível apagar a postagem."
      );
    }
  };

  const handleRepost = async (postId: string) => {
    if (
      !requireAuth({
        message:
          "Entre na FootEra para repostar esta publicação.",
      })
    ) {
      return;
    }

    const comentario = prompt("Adicionar um comentário (opcional):") ?? "";

    try {
      const resp: RepostResponse = await repostPost(postId, comentario);

      if (resp.ok && resp.action === "repost" && resp.post) {
        const novoPost = resp.post;

        setPosts((prev) =>
          prev.some((p) => p.id === novoPost.id)
            ? prev
            : sortPostsDestaquePrimeiro([novoPost, ...prev])
        );
        return;
      }

      if (resp.ok && resp.action === "unrepost") {
        if (resp.id) {
          setPosts((prev) => prev.filter((p) => p.id !== resp.id));
        }
        return;
      }

      console.warn("Resposta inesperada no repost:", resp);
    } catch (e: any) {
      if (
        handleAuthError(e, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      console.error(e);
      toast.error("Não foi possível repostar.");
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
    if (
      !requireAuth({
        message:
          "Entre na FootEra para enviar esta publicação por mensagem.",
      })
    ) {
      return;
    }

    if (selecionados.size === 0) return;

    const token = Storage.token;

    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map(async (paraId) => {
          const resp = await fetch(`${API.BASE_URL}/api/mensagem`, {
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
          });

          if (!resp.ok) {
            const body = await resp.json().catch(() => ({}));

            const error: any = new Error(
              body?.message ||
                body?.error ||
                "Falha ao enviar a publicação por mensagem."
            );

            error.status = resp.status;
            error.code = body?.code;

            throw error;
          }
        })
      );

      toast.success("Post compartilhado por mensagem!");
      setModalAberto(false);
    } catch (e: any) {
      if (
        handleAuthError(e, {
          message:
            "Sua sessão expirou. Entre novamente para continuar.",
        })
      ) {
        return;
      }

      console.error(e);
      toast.error(
        e?.message ||
          "Falha ao enviar mensagens."
      );
    } finally {
      setEnviandoDM(false);
    }
  };

  return (
    <div className="px-4 pt-0 pb-24 space-y-6">
      <HeaderSliderLite title="Feed de Postagens" start="feed" />
        <div className="max-w-xl mx-auto flex gap-2 justify-start mb-4 px-1">
          <button
            onClick={() => selecionarFiltro("todos")}
            className={`px-3 py-1 rounded-full text-xs sm:text-sm border transition
              ${
                filtro === "todos"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-green-700 border-green-200"
              }`}
          >
            Ver tudo
          </button>

          {userId && (
            <>
          <button
            onClick={() => selecionarFiltro("seguindo")}
            className={`px-3 py-1 rounded-full text-xs sm:text-sm border transition
              ${
                filtro === "seguindo"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-green-700 border-green-200"
              }`}
          >
            Seguindo
          </button>

          <button
            onClick={() => selecionarFiltro("favoritos")}
            className={`px-3 py-1 rounded-full text-xs sm:text-sm border transition
              ${
                filtro === "favoritos"
                  ? "bg-green-700 text-white border-green-700"
                  : "bg-white text-green-700 border-green-200"
              }`}
          >
            Favoritos
          </button>
            </>
          )}
        </div>

      {carregandoPosts && (
        <div className="max-w-xl mx-auto space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-white shadow-md animate-pulse" />
          ))}
        </div>
      )}

      {!carregandoPosts && erroFeed && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 text-center text-gray-600">
          <p>Não foi possível carregar o feed agora. Verifique sua conexão e tente de novo.</p>
          <button
            type="button"
            onClick={() => carregarFeed()}
            className="mt-3 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 transition"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!carregandoPosts && !erroFeed && posts.length === 0 && (
        <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6 text-center text-gray-600">
          <p>
            {{
              todos: userId
                ? "Ainda não há publicações para você ver."
                : "Ainda não há publicações públicas disponíveis para visitantes.",
              seguindo:
                "Você ainda não segue ninguém — ou ninguém que você segue postou ainda.",
              favoritos: "Você não tem nenhum usuário favoritado.",
            }[filtro]}
          </p>

          {(filtro === "seguindo" || filtro === "favoritos") && (
            <Link
              href="/explorar"
              className="text-green-700 underline mt-2 inline-block"
            >
              Explorar perfis
            </Link>
          )}
        </div>
      )}

      {!carregandoPosts && !erroFeed && posts.map((post) => {
        const curtidas = post.curtidas || [];
        const jaCurtiu = curtidas.some((c) => c.usuarioId === Storage.usuarioId);
        const totalCurtidas =
          typeof (
            post as any
          ).totalCurtidas ===
          "number"
            ? (post as any)
                .totalCurtidas
            : curtidas.length;
        const imgSrc = publicImgUrl(post.imagemUrl) ?? undefined;
        const videoSrc = publicImgUrl(post.videoUrl) ?? undefined;
        const parsed = parseAchievement(post.conteudo);
        const isAchievement = !!parsed;
        const conquista = parsed?.conquistaId ? (conquistasById[parsed.conquistaId] ?? null) : null;

        return (
          <div
            key={post.id}
            className="max-w-xl mx-auto bg-white rounded-2xl shadow-md p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href={`/perfil/${post.usuario.id}`}
                  title={`Ver perfil de ${post.usuario.nome}`}
                  className="shrink-0"
                >
                  <Avatar
                    foto={post.usuario.foto}
                    alt={post.usuario.nome}
                    className="w-10 h-10 cursor-pointer"
                  />
                </Link>
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
                Repostou de <strong>{username(post.repostOf.usuario)}</strong>
              </div>
            )}

            <div>
              {post.repostOf ? (
                  <>
                    {(() => {
                      const clean = cleanText(post.conteudo);

                      return clean ? (
                        <p className="text-gray-800 font-medium whitespace-pre-line mb-2">
                          {clean}
                        </p>
                      ) : null;
                    })()}

                    {(() => {
                      const chain = getRepostChain(post); 
                      const root = chain.length ? chain[chain.length - 1] : null;
                      const intermediarios = chain.slice(0, -1);

                      return (
                        <div className="border rounded-xl p-3 bg-gray-50 space-y-2">
                          {intermediarios.map((item, idx) => {
                            const texto = cleanText(item.conteudo);
                            if (!texto) return null;

                            return (
                              <div key={`${item.id}-${idx}`} className="text-sm text-gray-700">
                                <span className="font-semibold">{username(item.usuario)}</span>{" "}
                                <span className="text-gray-600">repostou:</span>{" "}
                                <span className="italic">“{texto}”</span>
                              </div>
                            );
                          })}

                          {root && (
                            <div className="border rounded-xl p-3 bg-white">
                              <div className="flex items-center gap-2 mb-1">
                                <Link
                                  href={`/perfil/${root.usuario?.id ?? ""}`}
                                  title={`Ver perfil de ${root.usuario?.nome ?? "Usuário"}`}
                                  className="shrink-0"
                                >
                                  <Avatar
                                    foto={root.usuario?.foto}
                                    alt={root.usuario?.nome || "avatar original"}
                                    className="w-7 h-7 cursor-pointer"
                                  />
                                </Link>

                                <div className="min-w-0">
                                  <p className="text-sm font-semibold truncate">
                                    {root.usuario?.nome}{" "}
                                    <span className="text-gray-500 font-normal">
                                      ({username(root.usuario)})
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    {format(new Date(root.dataCriacao), "dd/MM, HH:mm")}
                                  </p>
                                </div>
                              </div>

                              {!!cleanText(root.conteudo) && (
                                <p className="text-sm text-gray-800 whitespace-pre-line">
                                  {cleanText(root.conteudo)}
                                </p>
                              )}

                              {publicImgUrl(root.imagemUrl) && (
                                <img
                                  src={publicImgUrl(root.imagemUrl) ?? undefined}
                                  alt="Post original"
                                  className="mt-2 rounded-lg max-h-72 w-auto mx-auto"
                                />
                              )}

                              {publicImgUrl(root.videoUrl) && (
                                <video controls className="w-full mt-2 rounded-lg">
                                  <source src={publicImgUrl(root.videoUrl) ?? ""} type="video/mp4" />
                                </video>
                              )}
                            </div>
                          )}
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
                <span>{totalCurtidas}</span>
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
                <span>
                  {(post as any).reposts ?? (post as any).compartilhamentos ?? 0}
                </span>
              </button>
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
                        <Link
                          href={`/perfil/${comentario.usuarioId ?? ""}`}
                          title={`Ver perfil de ${comentario.usuario?.nome ?? "Usuário"}`}
                          className="shrink-0"
                        >
                          <Avatar
                            foto={comentario.usuario?.foto}
                            alt={comentario.usuario?.nome || "avatar"}
                            className="w-8 h-8 cursor-pointer"
                          />
                        </Link>
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

      <BottomNav active="feed" />

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
          {!userId ? (
            <button
              type="button"
              onClick={() =>
                openAuthGate({
                  message:
                    "Entre na FootEra para compartilhar esta publicação com seus contatos.",
                })
              }
              className="w-full rounded-lg border border-green-700 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
            >
              Entre para enviar por mensagem
            </button>
          ) : (
            <>
              <p className="text-sm text-gray-700 mb-2">
                Enviar por mensagem:
              </p>

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

                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${
                        selecionado
                          ? "border-green-600"
                          : "border-transparent"
                      }`}
                    >
                      <Avatar
                        foto={u.foto}
                        alt={u.nome}
                        className="w-14 h-14"
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
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded ${
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
            </>
          )}
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
            toast.success("Link copiado!");
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
                    <Link
                      href={`/perfil/${comentario.usuarioId ?? ""}`}
                      title={`Ver perfil de ${
                        comentario.usuario?.nome ?? "Usuário"
                      }`}
                      className="shrink-0"
                    >
                      <Avatar
                        foto={comentario.usuario?.foto}
                        alt={comentario.usuario?.nome || "avatar"}
                        className="w-9 h-9 flex-shrink-0 cursor-pointer"
                      />
                    </Link>
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
                        {String(comentario.usuarioId) === String(Storage.usuarioId) && (
                          <button
                            onClick={() => handleApagarComentario(comentario.id, postSelecionado.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Apagar comentário"
                            aria-label="Apagar comentário"
                          >
                            ✕
                          </button>
                        )}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleComentario(
                          postSelecionado.id,
                          comentarioTextoPorPost[postSelecionado.id] || ""
                        );
                      }
                    }}
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
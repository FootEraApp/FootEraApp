import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import { Share2, User, UserPlus, Search, Users, Trash, ArrowLeft, Send } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import socket from "../services/socket.js";
import { ModalGrupos } from "../components/modal/ModalGrupos.js";
import { ModalDesafiosGrupo } from "../components/modal/ModalDesafiosGrupos.js";
import { MensagemItemGrupo } from "../components/chat/GroupDesafioCards.js";
import CardAtletaShield from "../components/cards/CardAtletaShield.js";
import * as htmlToImage from "html-to-image";
import { publicImgUrl } from "../utils/publicUrl.js";
import { FLAGS } from "../config.js";
import BottomNav from "@/components/layout/BottomNav.js";
import { ModalAdicionarMembrosGrupo } from "../components/mensagens/ModalAdicionarMembrosGrupo.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

function getAvatarSrc(foto?: string | null) {
  if (!foto || !foto.trim()) return AVATAR_FALLBACK;
  if (foto.startsWith("http://") || foto.startsWith("https://")) return foto;
  return `${API.BASE_URL}${foto}`;
}

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

interface Mensagem {
  id: string;
  deId: string;
  paraId: string;
  conteudo: string;
  tipo: "NORMAL" | "POST" | "DESAFIO" | "USUARIO" | "CARD";
  criadaEm: string;
  clientMsgId?: string;
  pending?: boolean;
}

interface Grupo {
  id: string;
  nome: string;
  descricao?: string | null;
  ultimaMensagem?: string | null;
  ultimaMensagemTipo?: string | null;
  ultimaMensagemEm?: string | null;
}

interface MensagemGrupo {
  id: string;
  grupoId: string;
  usuarioId: string;
  conteudo: string;
  criadaEm: string;
  usuario?: Usuario;
  tipo:
    | "NORMAL"
    | "DESAFIO"
    | "POST"
    | "USUARIO"
    | "CONQUISTA"
    | "GRUPO_DESAFIO"
    | "GRUPO_DESAFIO_BONUS";
  conteudoJson?: any;
  desafioEmGrupoId?: string | null;
  clientMsgId?: string;
  pending?: boolean;
}

interface Postagem {
  id: string;
  conteudo: string;
  imagemUrl?: string;
  videoUrl?: string;
  usuario: Usuario;
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  imagemUrl?: string | null;
  nivel?: string | null;
  pontuacao?: number | null;
  categoria?: string[];
  createdAt: string;
}

type ChatTarget = { tipo: "usuario"; usuario: Usuario } | { tipo: "grupo"; grupo: Grupo };

type GrupoMembro = {
  id: string;
  nome: string;
  foto?: string | null;
  tipo: "ADMIN" | "MEMBRO";
  isOwner?: boolean;
};

type GrupoDetalhe = {
  id: string;
  nome: string;
  descricao?: string | null;
  ownerId: string;
  meuTipo: "ADMIN" | "MEMBRO";
  membros: GrupoMembro[];
};

export default function PaginaMensagens() {
  const [, navigate] = useLocation();
  const [showSidebar, setShowSidebar] = useState(false);
  const usuarioId: string | null = Storage.usuarioId;
  const token: string = Storage.token || "";
  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [alvo, setAlvo] = useState<ChatTarget | null>(null);
  const [isAtleta, setIsAtleta] = useState(
    String(Storage?.tipoSalvo ?? "").toLowerCase() === "atleta"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  const totalUnread = Object.values(unreadByUser).reduce((a, b) => a + b, 0);
  const fetchPrivSeqRef = useRef(0);
  const fetchGrupoSeqRef = useRef(0);
  const [grupoDetalhe, setGrupoDetalhe] = useState<GrupoDetalhe | null>(null);
  const [mostrarInfoGrupo, setMostrarInfoGrupo] = useState(false);
  const [carregandoGrupoDetalhe, setCarregandoGrupoDetalhe] = useState(false);
  const [modalAdicionarMembrosAberto, setModalAdicionarMembrosAberto] = useState(false);

  type PresencaUI = {
    isOnline: boolean | null;
    lastSeenAt: string | null;
    privacyBlocked: boolean;
  };

  const [presencas, setPresencas] = useState<Record<string, PresencaUI>>({});

  const fetchPresencaUsuario = async (userId: string, force = false) => {
    if (!token) return;
    if (!force && presencas[userId]) return;

    try {
      const res = await fetch(`${API.BASE_URL}/api/presenca/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();

      setPresencas(prev => ({
        ...prev,
        [userId]: {
          isOnline: data?.isOnline ?? null,
          lastSeenAt: data?.lastSeenAt ?? null,
          privacyBlocked: !!data?.privacyBlocked,
        },
      }));
    } catch {}
  };

  const fetchUnreadByUser = async () => {
    try {
      const r = await fetch(`${API.BASE_URL}/api/mensagem/unread-by-user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const arr: { userId: string; count: number }[] = await r.json();
      const map = Object.fromEntries(arr.map(x => [x.userId, x.count]));
      setUnreadByUser(map);
    } catch {}
  };

  const markReadFromUser = async (otherId: string) => {
    try {
      await fetch(`${API.BASE_URL}/api/mensagem/mark-read/${otherId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    setUnreadByUser(prev => ({ ...prev, [otherId]: 0 }));
  };

  const lastGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!alvo) return;

    if (alvo.tipo === "usuario") {
      const key = `conversa_${usuarioId}_${alvo.usuario.id}`;
      setMensagensPrivadas(safeLoad<Mensagem>(key));
      setTemMaisPriv(true);
      carregarMensagensPrivadas(alvo.usuario.id, false);
      markReadFromUser(alvo.usuario.id);
    } else {
        if (lastGroupRef.current && lastGroupRef.current !== alvo.grupo.id) {
        socket.emit("leaveGroup", lastGroupRef.current);
      }
      lastGroupRef.current = alvo.grupo.id;
      socket.emit("joinGroup", alvo.grupo.id);
      const key = `conversa_grupo_${alvo.grupo.id}`;
      setMensagensGrupo(safeLoad<MensagemGrupo>(key));
      setTemMaisGrupo(true);
      carregarMensagensDoGrupo(alvo.grupo.id, false);
    }
    setNovaMensagem("");
  }, [alvo, usuarioId, token]);

  useEffect(() => {
    if (!token) return;
    fetchUnreadByUser();
  }, [token]);

  useEffect(() => {
    if (!Storage.token) return;
    const tipo = (Storage.tipoSalvo || "").toLowerCase();
    setIsAtleta(tipo === "atleta");
  }, []);

  useEffect(() => {
    const tipo = String(Storage?.tipoSalvo ?? "").toLowerCase();
    if (tipo !== "atleta" || !Storage.token) return;

    fetch(`${API.BASE_URL}/api/perfil/me/posicao-atual`, {
      headers: { Authorization: `Bearer ${Storage.token}` },
    })
      .then(r => setIsAtleta(r.ok)) 
      .catch(() => setIsAtleta(true));
  }, []);

  function selecionarAlvo(novo: ChatTarget) {
    setAlvo(novo);

    localStorage.setItem(
      "mensagens_last_target",
      JSON.stringify(
        novo.tipo === "usuario"
          ? { tipo: "usuario", id: novo.usuario.id }
          : { tipo: "grupo", id: novo.grupo.id }
      )
    );

    if (novo.tipo === "usuario") {
      saveRecentUser(novo.usuario);
      markReadFromUser(novo.usuario.id);
      setGrupoDetalhe(null);
      setMostrarInfoGrupo(false);
    } else {
      carregarDetalheGrupo(novo.grupo.id);
      setMostrarInfoGrupo(false);
    }

    setShowSidebar(false);
  }

  const [mensagensPrivadas, setMensagensPrivadas] = useState<Mensagem[]>([]);
  const [temMaisPriv, setTemMaisPriv] = useState(true);
  const [carregandoMaisPriv, setCarregandoMaisPriv] = useState(false);
  const [mensagensGrupo, setMensagensGrupo] = useState<MensagemGrupo[]>([]);
  const [temMaisGrupo, setTemMaisGrupo] = useState(true);
  const [carregandoMaisGrupo, setCarregandoMaisGrupo] = useState(false);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [postsCache, setPostsCache] = useState<Record<string, Postagem>>({});
  const [usuariosCache, setUsuariosCache] = useState<Record<string, Usuario>>({});
  const [desafiosCache, setDesafiosCache] = useState<Record<string, Desafio>>({});
  const [lastMsgByUser, setLastMsgByUser] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [lastMsgAtByUser, setLastMsgAtByUser] = useState<Record<string, number>>({});
  const [lastMsgAtByGroup, setLastMsgAtByGroup] = useState<Record<string, number>>({});
  const [lastMsgByGroup, setLastMsgByGroup] = useState<Record<string, string>>({});

  const abrirModal = () => setModalAberto(true);
  const fecharModal = () => setModalAberto(false);

  const [modalDesafiosAberto, setModalDesafiosAberto] = useState(false);
  const fecharModalDesafios = () => setModalDesafiosAberto(false);

  const pendingOpenRef = useRef(false);
  const RECENTS_KEY = "mensagens_recent_usuarios";

  
  function initials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "U";
  }

  function nomeUsuarioByIdSync(id: string) {
    const cached = usuariosCache[id];
    if (cached?.nome) return cached.nome;

    const u = usuariosMutuos.find(x => x.id === id);
    if (u?.nome) return u.nome;

    return null;
  }

  async function ensureUsuarioNome(id: string) {
    if (!id) return null;
    if (usuariosCache[id]?.nome) return usuariosCache[id].nome;

    try {
      const res = await fetch(`${API.BASE_URL}/api/usuarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;

      const u: Usuario = await res.json();
      setUsuariosCache(prev => ({ ...prev, [id]: u }));
      setUsuariosMutuos(prev =>
        prev.some(p => p.id === u.id) ? prev : [u, ...prev]
      );
      return u.nome || null;
    } catch {
      return null;
    }
  }

  function formatPreviewFromMsg(msg: { tipo: string; conteudo: string }) {
    const tipo = String(msg.tipo || "").toUpperCase();
    const conteudo = String(msg.conteudo || "");

    if (tipo === "CARD") return "📇 Card compartilhado";
    if (tipo === "POST") return "📰 Post compartilhado";
    if (tipo === "DESAFIO") return "🏆 Desafio compartilhado";

    if (tipo === "USUARIO") {
      const nome = nomeUsuarioByIdSync(conteudo);
      return nome ? `👤 Perfil: ${nome}` : "👤 Perfil compartilhado";
    }

    if (conteudo.startsWith("NOVO_TREINO:")) return "🏋️ Novo treino";
    if (conteudo.includes("[CONVOCACAO_EVENTO:")) return "📣 Convocação de evento";
    if (conteudo.startsWith("data:image/")) return "🖼️ Imagem";

    return conteudo.replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function Avatar({ src, name, className = "w-10 h-10" }:{
    src?: string | null; name?: string; className?: string
  }) {
    const [broken, setBroken] = useState(false);
    const ok = !!src && typeof src === "string" && !broken;

    if (ok) {
      const url = publicImgUrl(src) ?? undefined; 
      if (url) {
        return (
          <img
            src={url}
            className={`${className} rounded-full object-cover border`}
            onError={() => setBroken(true)}
          />
        );
      }
    }

    const fallbackUrl = AVATAR_FALLBACK;

    return (
      <img
        src={fallbackUrl}
        className={`${className} rounded-full object-cover border bg-white`}
        alt={name ? `Avatar de ${name}` : "Avatar"}
        draggable={false}
        onError={() => setBroken(true)}
      />
    );
  }

  const loadRecentUsers = (): Usuario[] => {
    try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]"); } catch { return []; }
  };

  const saveRecentUser = (u: Usuario) => {
    try {
      const cur = loadRecentUsers();
      const next = [u, ...cur.filter(x => x.id !== u.id)].slice(0, 50);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {}
  };

  const mergeUnique = (a: Usuario[], b: Usuario[]) => {
    const m = new Map<string, Usuario>();
    [...a, ...b].forEach(u => m.set(u.id, u));
    return Array.from(m.values());
  };

  const [meuCardDados, setMeuCardDados] = useState<{
    atletaId: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    ovr: number;
    perf: number;
    disc: number;
    resp: number;
  } | null>(null);

  const compactMsgs = <T extends { tipo: string; conteudo: any }>(arr: T[]) =>
    arr.slice(-80).map((m) => {
      const clone: any = { ...m };

      if (clone.tipo === "CARD" && typeof clone.conteudo === "string") {
        if (clone.conteudo.startsWith("data:image/")) {
          clone.conteudo = "__IMG_DATAURL_OMITTED__";
        }
      } else if (typeof clone.conteudo === "string" && clone.conteudo.length > 2000) {
        clone.conteudo = clone.conteudo.slice(0, 2000);
      }

      delete clone.pending;
      delete clone.clientMsgId;
      return clone as T;
    });

  const safeSave = (key: string, value: any[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(compactMsgs(value)));
    } catch (e) {
      console.warn("LocalStorage quota:", e);
      try {
        localStorage.setItem(key, JSON.stringify(compactMsgs(value).slice(-30)));
      } catch {}
    }
  };

  const safeLoad = <T = any>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  const cardRef = useRef<HTMLDivElement | null>(null);
  const alvoRef = useRef<ChatTarget | null>(null);
  
  useEffect(() => { alvoRef.current = alvo; }, [alvo]);

  useEffect(() => {
    return () => {
      if (lastGroupRef.current) {
        socket.emit("leaveGroup", lastGroupRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (alvo?.tipo === "grupo" && alvo.grupo?.id) {
      carregarDetalheGrupo(alvo.grupo.id);
    } else {
      setGrupoDetalhe(null);
      setMostrarInfoGrupo(false);
    }
  }, [alvo]);

  const recarregarMensagensDoGrupoAtual = async () => {
    const current = alvoRef.current;
    if (current?.tipo === "grupo") {
      await carregarMensagensDoGrupo(current.grupo.id, false);
    }
  };

  async function toDataUrlWithAuth(url: string): Promise<string> {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Imagem ${url} -> ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function formatLastSeen(lastSeenAt?: string | null) {
    if (!lastSeenAt) return "Offline";

    const diff = Date.now() - new Date(lastSeenAt).getTime();
    const min = Math.floor(diff / 60000);

    if (min < 1) return "Agora";
    if (min < 60) return `há ${min} min`;

    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;

    const d = Math.floor(h / 24);
    return `há ${d}d`;
  }

  const renderSidebarContent = () => {
    const term = searchTerm.trim().toLowerCase();
    const gruposFiltradosBase = term
      ? grupos.filter((g) => g.nome.toLowerCase().includes(term))
      : grupos;

    const gruposFiltrados = [...gruposFiltradosBase].sort((a, b) => {
      const ta = lastMsgAtByGroup[a.id] ?? 0;
      const tb = lastMsgAtByGroup[b.id] ?? 0;
      return tb - ta;
    });

    const usuariosFiltradosBase = term
      ? usuariosMutuos.filter((u) => u.nome.toLowerCase().includes(term))
      : usuariosMutuos;

    const usuariosFiltrados = [...usuariosFiltradosBase].sort((a, b) => {
      const ta = lastMsgAtByUser[a.id] ?? 0;
      const tb = lastMsgAtByUser[b.id] ?? 0;
      return tb - ta; 
    });

    return (
      <div className="p-4 overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <button
            onClick={abrirModal}
            title="Criar/gerenciar grupos"
            className="p-1 rounded hover:bg-gray-100"
          >
            <UserPlus size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar usuários ou grupos..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-full focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700"
            />
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <Users size={16} />{" "}
            <span className="text-sm font-semibold">Grupos</span>
          </div>
          {gruposFiltrados.length === 0 && (
            <p className="text-xs text-gray-500">
              {term
                ? "Nenhum grupo encontrado."
                : "Você ainda não participa de grupos."}
            </p>
          )}
          {gruposFiltrados.map((g) => {
            const selecionado =
              alvo?.tipo === "grupo" && alvo.grupo.id === g.id;
            return (
              <div
                key={g.id}
                className={`p-3 mb-2 rounded-lg cursor-pointer border shadow-sm transition ${
                  selecionado
                    ? "bg-green-50 border-green-300"
                    : "hover:bg-gray-50 bg-white"
                }`}
                onClick={() => selecionarAlvo({ tipo: "grupo", grupo: g })}
              >
                <div className="font-medium text-sm">{g.nome}</div>
                <div className="text-xs text-gray-500 line-clamp-1">
                  {lastMsgByGroup[g.id] || g.ultimaMensagem || g.descricao || "Sem mensagens ainda."}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <User size={16} />{" "}
            <span className="text-sm font-semibold">Usuários</span>
            {totalUnread > 0 && (
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-green-800 text-white">
                {totalUnread}
              </span>
            )}
          </div>

          {usuariosFiltrados.length === 0 && (
            <p className="text-xs text-gray-500">
              {term
                ? "Nenhum usuário encontrado."
                : "Nenhum contato disponível ainda."}
            </p>
          )}

          {usuariosFiltrados.map((u) => {
            const selecionado =
              alvo?.tipo === "usuario" && alvo.usuario.id === u.id;
            const unread = unreadByUser[u.id] || 0;

            return (
              <div
              key={u.id}
              className={`flex items-center gap-3 p-3 mb-3 rounded-lg border shadow-sm transition ${
                selecionado
                  ? "bg-green-50 border-green-300"
                  : "hover:bg-gray-50 bg-white"
              }`}
              data-testid="usuario-list-item"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/perfil/${u.id}`);
                }}
                className="shrink-0 cursor-pointer"
                title={`Ver perfil de ${u.nome}`}
              >
                <Avatar src={u.foto} name={u.nome} className="w-12 h-12" />
              </button>

              <button
                type="button"
                onClick={() => selecionarAlvo({ tipo: "usuario", usuario: u })}
                className="flex items-center flex-1 min-w-0 text-left"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">
                      {u.nome}
                    </span>

                    {(() => {
                      const p = presencas[u.id];
                      if (!p || p.privacyBlocked) return null;

                      const label = p.isOnline
                        ? "Online"
                        : formatLastSeen(p.lastSeenAt);

                      let dotClass = "bg-red-500";
                      if (p.isOnline) {
                        dotClass = "bg-green-500";
                      } else if (p.lastSeenAt) {
                        dotClass = "bg-gray-400";
                      }

                      return (
                        <span className="shrink-0 flex items-center gap-1 text-[11px] text-gray-500">
                          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                          <span>{label}</span>
                        </span>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-gray-500 truncate">
                    {lastMsgByUser[u.id] || ""}
                  </div>
                </div>
              </button>

              {unread > 0 && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-700 text-white shrink-0">
                  {unread}
                </span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    );
  };

  const compartilharPerfilNoChat = async () => {
    if (!isAtleta) return;
    if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;

    try {
      const base = (meuCardDados ?? await getMeuPerfilEBonus());
      if (!base) { alert("Não consegui montar seu card agora."); return; }

      const payload = {
        kind: "card-shield",
        atleta: {
          atletaId: base.atletaId ?? "",
          nome: base.nome,
          foto: base.foto ?? null,  
          posicao: base.posicao ?? null,
          idade: null
        },
        ovr: base.ovr, perf: base.perf, disc: base.disc, resp: base.resp,
        size: { w: 300, h: 420 }, goldenMinOVR: 88
      };
      const encoded = "CARD_JSON:" + btoa(encodeURIComponent(JSON.stringify(payload)));

      const clientMsgId = genClientId();

      setMensagensPrivadas(prev => [
        ...prev,
        {
          id: clientMsgId,
          clientMsgId,
          pending: true,
          criadaEm: new Date().toISOString(),
          conteudo: encoded,
          deId: usuarioId!, 
          paraId: alvo.usuario.id,
          tipo: "CARD",
        }
      ]);

      setLastMsgByUser(prev => ({
        ...prev,
        [alvo.usuario.id]: formatPreviewFromMsg({ tipo: "CARD", conteudo: encoded }),
      }));

      const resp = await fetch(`${API.BASE_URL}/api/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paraId: alvo.usuario.id, tipo: "CARD", conteudo: encoded, clientMsgId }),
      });

      let fotoData = base.foto; 
      if (fotoData && !fotoData.startsWith("data:")) {
        try {
          const resolvedUrl = publicImgUrl(fotoData) ?? fotoData;
          fotoData = await toDataUrlWithAuth(resolvedUrl);
        } catch {
          fotoData = null; 
        }
      }

      setMeuCardDados({ ...base, foto: fotoData });

      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const node = cardRef.current;
      if (!node) { alert("Falha ao preparar o card para captura."); return; }

      const dataUrl = await htmlToImage.toPng(node, {
        cacheBust: false,
        pixelRatio: 2,
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
      });

      if (resp.ok) {
        const saved: Mensagem = await resp.json();
        reconcilePrivadaByClientId(saved);
      } else {
        console.error("POST /api/mensagem (CARD) falhou:", resp.status, await resp.text());
        alert("Não consegui enviar o card agora.");
        setMensagensPrivadas(prev => prev.filter(m => m.clientMsgId !== clientMsgId));
      }
    } catch (err) {
      console.error("Falha ao compartilhar card:", err);
      alert("Não foi possível compartilhar seu card agora.");
    }
  };

  useEffect(() => {
    if (!token) return;

    const tick = () => {
      usuariosMutuos.forEach(u => {
        fetch(`${API.BASE_URL}/api/presenca/${u.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (!data) return;

            setPresencas(prev => ({
              ...prev,
              [u.id]: {
                isOnline: data?.isOnline ?? null,
                lastSeenAt: data?.lastSeenAt ?? null,
                privacyBlocked: !!data?.privacyBlocked,
              },
            }));
          })
          .catch(() => {});
      });
    };

    tick(); 
    const i = setInterval(tick, 30_000);
    return () => clearInterval(i);
  }, [token, usuariosMutuos]);

  useEffect(() => {
    if (!alvo || alvo.tipo !== "usuario" || !usuarioId) return;
    const key = `conversa_${usuarioId}_${alvo.usuario.id}`;
    safeSave(key, mensagensPrivadas);
  }, [mensagensPrivadas, alvo, usuarioId]);

  useEffect(() => {
    if (!alvo || alvo.tipo !== "grupo") return;
    const key = `conversa_grupo_${alvo.grupo.id}`;
    safeSave(key, mensagensGrupo);
  }, [mensagensGrupo, alvo]);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      if (usuarioId) socket.emit("join", usuarioId);
      const cur = alvoRef.current;
      if (cur?.tipo === "grupo") socket.emit("joinGroup", cur.grupo.id);
    });

    socket.on("novaMensagem", (mensagem: Mensagem) => {
      const current = alvoRef.current;

      if (mensagem.paraId === usuarioId) {
        const abertoComEsse = current?.tipo === "usuario" && current.usuario.id === mensagem.deId;

        if (!abertoComEsse) {
          setUnreadByUser(prev => ({
            ...prev,
            [mensagem.deId]: (prev[mensagem.deId] || 0) + 1,
          }));
        } else {
          markReadFromUser(mensagem.deId);
        }
      }

      const otherId = mensagem.deId === usuarioId ? mensagem.paraId : mensagem.deId;
      setLastMsgAtByUser(prev => ({
        ...prev,
        [otherId]: new Date(mensagem.criadaEm).getTime(),
      }));

      setLastMsgByUser(prev => ({
        ...prev,
        [otherId]: formatPreviewFromMsg({ tipo: mensagem.tipo, conteudo: mensagem.conteudo })
      }));

      if (String(mensagem.tipo).toUpperCase() === "USUARIO") {
        const idCompartilhado = String(mensagem.conteudo || "");
        ensureUsuarioNome(idCompartilhado).then((nome) => {
          if (nome) {
            setLastMsgByUser(p => ({
              ...p,
              [otherId]: `👤 Perfil: ${nome}`
            }));
          }
        });
      }

      if (current?.tipo !== "usuario") return;
      const curId = current.usuario.id;
      const relevante =
        (mensagem.deId === curId && mensagem.paraId === usuarioId) ||
        (mensagem.deId === usuarioId && mensagem.paraId === curId);
      if (!relevante) return;

      const replaced = reconcilePrivadaByClientId(mensagem);
      if (!replaced) {
        setMensagensPrivadas(prev => {
          const exists =
            prev.some(m => m.id === mensagem.id) ||
            (!!mensagem.clientMsgId && prev.some(m => m.clientMsgId === mensagem.clientMsgId));
          if (exists) return prev;
          return [...prev, { ...mensagem, pending: false }];
        });
      }
    });

    socket.on("novaMensagemGrupo", (mensagem: MensagemGrupo) => {

      setLastMsgByGroup(prev => ({
        ...prev,
        [mensagem.grupoId]: formatPreviewFromMsg({
          tipo: mensagem.tipo,
          conteudo: mensagem.conteudo,
        }),
      }));

      const current = alvoRef.current;
      if (!(current?.tipo === "grupo" && mensagem.grupoId === current.grupo.id)) return;

      setLastMsgAtByGroup(prev => ({
        ...prev,
        [mensagem.grupoId]: new Date(mensagem.criadaEm).getTime(),
      }));

      setLastMsgByGroup((prev) => ({
        ...prev,
        [mensagem.grupoId]: formatPreviewFromMsg({
          tipo: mensagem.tipo,
          conteudo: mensagem.conteudo,
        }),
      }));

      const replaced = reconcileGrupoByClientId(mensagem);
      if (!replaced) {
        setMensagensGrupo(prev => {
          const exists =
            prev.some(m => m.id === mensagem.id) ||
            (!!mensagem.clientMsgId && prev.some(m => m.clientMsgId === mensagem.clientMsgId));
          if (exists) return prev;
          return [...prev, { ...mensagem, pending: false }];
        });
      }
    });

    socket.on("mensagemDeletada", ({ id }: { id: string }) => {
      setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
      setMensagensGrupo(prev => prev.filter(m => m.id !== id));
    });

    return () => {
      socket.off("connect");
      socket.off("novaMensagem");
      socket.off("novaMensagemGrupo");
      socket.off("mensagemDeletada");
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [gruposRes, convRes, contatosRes] = await Promise.all([
          fetch(`${API.BASE_URL}/api/grupos/me`, { headers }),
          fetch(`${API.BASE_URL}/api/mensagem/conversas`, { headers }),
          fetch(`${API.BASE_URL}/api/mensagem/contatos-relacionados`, { headers }),
        ]);

        if (!gruposRes.ok) throw new Error(await gruposRes.text());
        const meusGrupos: Grupo[] = await gruposRes.json();

        let conv = { totalNaoLidas: 0, conversas: [] as Array<{ id: string; nome: string; foto?: string | null; naoLidas: number; }> };
        if (convRes.ok) conv = await convRes.json();

        setLastMsgByGroup(
          Object.fromEntries(
            meusGrupos.map((g) => [
              g.id,
              g.ultimaMensagem
                ? formatPreviewFromMsg({
                    tipo: g.ultimaMensagemTipo || "NORMAL",
                    conteudo: g.ultimaMensagem,
                  })
                : "",
            ])
          )
        );

        setLastMsgAtByGroup(
          Object.fromEntries(
            meusGrupos.map((g) => [
              g.id,
              g.ultimaMensagemEm ? new Date(g.ultimaMensagemEm).getTime() : 0,
            ])
          )
        );

        setLastMsgAtByUser(
          Object.fromEntries(
            (conv.conversas || []).map((c: any) => [
              c.id,
              c.ultimaMensagemEm ? new Date(c.ultimaMensagemEm).getTime() : 0,
            ])
          )
        );

        setLastMsgByUser(
          Object.fromEntries(
            (conv.conversas || []).map((c: any) => [
              c.id,
              formatPreviewFromMsg({
                tipo: c.ultimaMensagemTipo || "NORMAL",
                conteudo: c.ultimaMensagem,
              }),
            ])
          )
        );

        (conv.conversas || []).forEach((c: any) => {
          const t = String(c.ultimaMensagemTipo || "").toUpperCase();
          if (t !== "USUARIO") return;

          const idCompartilhado = String(c.ultimaMensagem || "");
          if (!idCompartilhado) return;

          ensureUsuarioNome(idCompartilhado).then((nome) => {
            if (!nome) return;
            setLastMsgByUser(prev => ({
              ...prev,
              [c.id]: `👤 Perfil: ${nome}`,
            }));
          });
        });

        const contatosRelacionados: Usuario[] = contatosRes.ok
          ? await contatosRes.json()
          : [];

        const recentes = loadRecentUsers();

        const fromConversas: Usuario[] = conv.conversas.map((c) => ({
          id: c.id,
          nome: c.nome,
          foto: c.foto,
        }));

        let base = mergeUnique(
          mergeUnique(recentes, fromConversas),
          contatosRelacionados
        );

        if (base.length === 0 && usuarioId) {
          base = [
            {
              id: usuarioId,
              nome: "Minhas notas (teste)",
              foto: null,
            },
          ];
        }

        setUsuariosMutuos(base);
        setGrupos(meusGrupos);
        setLastMsgAtByGroup(() => {
          const entries = (meusGrupos || []).map((g) => {
            const key = `conversa_grupo_${g.id}`;
            const cached = safeLoad<MensagemGrupo>(key);
            const last = cached.length ? cached[cached.length - 1] : null;
            return [g.id, last ? new Date(last.criadaEm).getTime() : 0] as const;
          });
          return Object.fromEntries(entries);
        });

        setUnreadByUser((prev) => ({
          ...prev,
          ...Object.fromEntries(conv.conversas.map((c) => [c.id, c.naoLidas])),
        }));
      } catch (e) {
        console.error("Erro ao carregar sidebar:", e);
      }
    })();
  }, [token]);

  const carregarPostPorId = async (postId: string) => {
    if (postsCache[postId]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/post/visualizar/${postId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro ao buscar post");
      const post: Postagem = await res.json();
      setPostsCache((prev) => ({ ...prev, [postId]: post }));
    } catch (err) {
      console.error("Erro ao carregar post:", err);
    }
  };
  const carregarUsuarioPorId = async (id: string) => {
    if (usuariosCache[id]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/usuarios/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro ao buscar usuário");
      const usuario: Usuario = await res.json();
      setUsuariosCache((prev) => ({ ...prev, [id]: usuario }));
    } catch (err) {
      console.error("Erro ao carregar usuário:", err);
    }
  };
  const carregarDesafioPorId = async (desafioId: string) => {
    if (!FLAGS.DESAFIOS_ENABLED) return;
    if (!desafioId || desafiosCache[desafioId]) return;
    try {
      const res = await fetch(`${API.BASE_URL}/api/desafios/${desafioId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro ao buscar desafio");
      const data: Desafio = await res.json();
      setDesafiosCache((prev) => ({ ...prev, [desafioId]: data }));
    } catch (err) {
      console.error("Erro ao carregar desafio:", err);
    }
  };
  useEffect(() => {
    mensagensPrivadas.forEach((m) => {
      if (m.tipo === "POST") carregarPostPorId(m.conteudo);
      if (m.tipo === "USUARIO") carregarUsuarioPorId(m.conteudo);
      if (m.tipo === "DESAFIO") carregarDesafioPorId(m.conteudo);
    });
  }, [mensagensPrivadas]);

  const limite = 20;

  useEffect(() => {
    if (pendingOpenRef.current) return;
    try {
      const raw = localStorage.getItem("mensagens_open_target");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!(data && data.tipo === "usuario" && typeof data.id === "string")) return;

      const alvoId = data.id as string;

      const u = usuariosMutuos.find((x) => x.id === alvoId);
      if (u) {
        saveRecentUser(u);
        setAlvo({ tipo: "usuario", usuario: u });
        pendingOpenRef.current = true;
        localStorage.removeItem("mensagens_open_target");
        return;
      }

      (async () => {
        try {
          const resp = await fetch(`${API.BASE_URL}/api/usuarios/${alvoId}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) throw new Error();
          const usuario = (await resp.json()) as Usuario;

          saveRecentUser(usuario);
          setUsuariosMutuos((prev) => {
            if (prev.some((p) => p.id === usuario.id)) return prev;
            return [usuario, ...prev];
          });
          setAlvo({ tipo: "usuario", usuario });
        } finally {
          pendingOpenRef.current = true;
          localStorage.removeItem("mensagens_open_target");
        }
      })();
    } catch {}
  }, [usuariosMutuos, token]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mensagens_last_target");
      if (!raw) return;
      const last = JSON.parse(raw) as { tipo: "usuario" | "grupo"; id: string };

      if (last.tipo === "usuario") {
        const u = usuariosMutuos.find(x => x.id === last.id);
        if (u) { setAlvo({ tipo: "usuario", usuario: u }); return; }
        (async () => {
          const r = await fetch(`${API.BASE_URL}/api/usuarios/${last.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (r.ok) {
            const usuario: Usuario = await r.json();
            setUsuariosMutuos(prev => prev.some(p => p.id === usuario.id) ? prev : [usuario, ...prev]);
            setAlvo({ tipo: "usuario", usuario });
          }
        })();
      } else {
        const g = grupos.find(x => x.id === last.id);
        if (g) setAlvo({ tipo: "grupo", grupo: g });
      }
    } catch {}
  }, [usuariosMutuos, grupos, token]);

  useEffect(() => {
    usuariosMutuos.forEach(u => {
      fetchPresencaUsuario(u.id);
    });
  }, [usuariosMutuos, token]);

  async function sairDoGrupo(grupoId: string) {
    try {
      const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}/sair`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao sair do grupo");
      }

      alert("Você saiu do grupo.");
      setGrupoDetalhe(null);
      setMostrarInfoGrupo(false);
      // aqui você pode limpar o grupo selecionado ou voltar pra lista
    } catch (err: any) {
      alert(err.message || "Erro ao sair do grupo");
    }
  }

  async function alterarTipoMembroDoGrupo(
    grupoId: string,
    membroId: string,
    tipo: "ADMIN" | "MEMBRO"
  ) {
    try {
      const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}/membros/${membroId}/tipo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tipo }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao alterar cargo do membro");
      }

      await carregarDetalheGrupo(grupoId);
    } catch (err: any) {
      alert(err.message || "Erro ao alterar cargo do membro");
    }
  }

  async function removerMembroDoGrupo(grupoId: string, membroId: string) {
    try {
      const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}/membros/${membroId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao remover membro");
      }

      await carregarDetalheGrupo(grupoId);
    } catch (err: any) {
      alert(err.message || "Erro ao remover membro");
    }
  }

  async function adicionarMembrosNoGrupo(grupoId: string, membros: string[]) {
    try {
      const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}/membros`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ membros }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao adicionar membros");
      }

      await carregarDetalheGrupo(grupoId);
    } catch (err: any) {
      alert(err.message || "Erro ao adicionar membros");
    }
  }

  async function carregarMensagensPrivadas(otherId: string, append: boolean) {
    const mySeq = ++fetchPrivSeqRef.current;
    try {
      const base = append ? mensagensPrivadas : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;

      const query = new URLSearchParams({
        otherId,
        limit: String(limite),
        ...(ultimoId ? { cursor: ultimoId } : {}),
      });

          const res = await fetch(`${API.BASE_URL}/api/mensagem?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      const novas: Mensagem[] = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.mensagens)
        ? json.mensagens
        : [];

      if (!Array.isArray(novas)) {
        setTemMaisPriv(false);
        return;
      }

      const stillSame =
        mySeq === fetchPrivSeqRef.current &&
        alvoRef.current?.tipo === "usuario" &&
        alvoRef.current.usuario.id === otherId;
      if (!stillSame) return;

      if (novas.length < limite) setTemMaisPriv(false);

      const novasOrdenadas = [...novas].reverse();
      setMensagensPrivadas(prev => {
        const combined = append ? [...novasOrdenadas, ...prev] : [...novasOrdenadas];
        const next = Array.from(new Map(combined.map(m => [m.id, m])).values())
          .sort((a,b)=> new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime());
        safeSave(`conversa_${usuarioId}_${otherId}`, next);
        return next;
      });
    } catch (e) { console.error(e); }
  }

  async function carregarDetalheGrupo(grupoId: string) {
    try {
      setCarregandoGrupoDetalhe(true);

      const res = await fetch(`${API.BASE_URL}/api/grupos/${grupoId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Erro ao carregar grupo");

      const data = await res.json();
      setGrupoDetalhe(data);
    } catch (err) {
      console.error(err);
      setGrupoDetalhe(null);
    } finally {
      setCarregandoGrupoDetalhe(false);
    }
  }

  async function carregarMensagensDoGrupo(grupoId: string, append: boolean) {
    const mySeq = ++fetchGrupoSeqRef.current;

    try {
      const base = append ? mensagensGrupo : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;
      const query = new URLSearchParams({ limit: String(limite), ...(ultimoId ? { cursor: ultimoId } : {}) });

      const res = await fetch(
        `${API.BASE_URL}/api/mensagem/grupos/${grupoId}?${query.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await res.json();
      const novas: MensagemGrupo[] = Array.isArray(json)
        ? json
        : Array.isArray(json.items)
        ? json.items
        : Array.isArray(json.mensagens)
        ? json.mensagens
        : [];

      if (!append && novas.length > 0) {
        const maisRecente = novas[0];
        setLastMsgByGroup((prev) => ({
          ...prev,
          [grupoId]: formatPreviewFromMsg({
            tipo: maisRecente.tipo,
            conteudo: maisRecente.conteudo,
          }),
        }));
      }

      if (!Array.isArray(novas)) {
        setTemMaisGrupo(false);
        return;
      }

      const stillSame =
        mySeq === fetchGrupoSeqRef.current &&
        alvoRef.current?.tipo === "grupo" &&
        alvoRef.current.grupo.id === grupoId;
      if (!stillSame) return;

      if (novas.length < limite) setTemMaisGrupo(false);

      const novasOrdenadas = [...novas].reverse();
      setMensagensGrupo((prev) => {
        const combined = append ? [...novasOrdenadas, ...prev] : [...prev, ...novasOrdenadas];
        const map = new Map<string, MensagemGrupo>();
        combined.forEach((m) => map.set(m.id, m));
        const next = Array.from(map.values()).sort(
          (a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime()
        );
        const key = `conversa_grupo_${grupoId}`;
        safeSave(key, next);
        return next;
      });
    } catch (err) {
      console.error("Erro ao carregar mensagens do grupo:", err);
    }
  }

  async function getMeuPerfilEBonus(): Promise<{
    atletaId: string | null;
    nome: string;
    foto?: string | null;
    posicao?: string | null;
    ovr: number;
    perf: number;
    disc: number;
    resp: number;
  } | null> {
    try {
      const perfilRes = await fetch(`${API.BASE_URL}/api/perfil/${usuarioId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!perfilRes.ok) return null;
      const perfilJson = await perfilRes.json();

      const nome = perfilJson?.usuario?.nome ?? "";
      const fotoPath = perfilJson?.usuario?.foto ?? null;
      const foto = fotoPath ? publicImgUrl(fotoPath) : null;

      const posRes = await fetch(`${API.BASE_URL}/api/perfil/me/posicao-atual`, { headers: { Authorization: `Bearer ${token}` } });
      const posJson = posRes.ok ? await posRes.json() : null;
      const posicao = posJson?.posicao ?? null;
      const atletaId = posJson?.atletaId ?? null;

      const pontosRes = await fetch(`${API.BASE_URL}/api/perfil/${usuarioId}/pontuacao`, { headers: { Authorization: `Bearer ${token}` } });
      const w = pontosRes.ok ? await pontosRes.json() : null;

      const perf = Number(w?.performance ?? 0);
      const disc = Number(w?.disciplina ?? 0);
      const resp = Number(w?.responsabilidade ?? 0);
      const ovr = Math.round((perf + disc + resp) / 3);

      return { atletaId, nome, foto, posicao, ovr, perf, disc, resp };
    } catch {
      return null;
    }
  }

  const genClientId = () => `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  function reconcilePrivadaByClientId(incoming: Mensagem) {
    if (!incoming.clientMsgId) return false;
    let replaced = false;
    setMensagensPrivadas(prev => {
      const idx = prev.findIndex(m => m.clientMsgId === incoming.clientMsgId);
      if (idx === -1) return prev;
      const clone = [...prev];
      clone[idx] = { ...incoming, pending: false };
      replaced = true;
      return clone;
    });
    return replaced;
  }

  function reconcileGrupoByClientId(incoming: MensagemGrupo) {
    if (!incoming.clientMsgId) return false;
    let replaced = false;
    setMensagensGrupo(prev => {
      const idx = prev.findIndex(m => m.clientMsgId === incoming.clientMsgId);
      if (idx === -1) return prev;
      const clone = [...prev];
      clone[idx] = { ...incoming, pending: false };
      replaced = true;
      return clone;
    });
    return replaced;
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (top >= 50 || !alvo) return;

    if (alvo.tipo === "usuario" && temMaisPriv && !carregandoMaisPriv) {
      setCarregandoMaisPriv(true);
      carregarMensagensPrivadas(alvo.usuario.id, true).finally(() => setCarregandoMaisPriv(false));
    }
    if (alvo.tipo === "grupo" && temMaisGrupo && !carregandoMaisGrupo) {
      setCarregandoMaisGrupo(true);
      carregarMensagensDoGrupo(alvo.grupo.id, true).finally(() => setCarregandoMaisGrupo(false));
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !alvo) return;
    if (!usuarioId) { alert("Sessão expirada. Faça login novamente."); return; }

    if (alvo.tipo === "usuario") {
      const clientMsgId = genClientId();
      const otm: Mensagem = {
        id: clientMsgId,
        clientMsgId,
        pending: true,
        criadaEm: new Date().toISOString(),
        conteudo: novaMensagem,
        deId: usuarioId!,
        paraId: alvo.usuario.id,
        tipo: "NORMAL",
      };
      setMensagensPrivadas(prev => [...prev, otm]);
      setLastMsgByUser(prev => ({
        ...prev,
        [alvo.usuario.id]: formatPreviewFromMsg({ tipo: otm.tipo, conteudo: otm.conteudo })
      }));
      setLastMsgAtByUser(prev => ({
        ...prev,
        [alvo.usuario.id]: Date.now(),
      }));
      setUnreadByUser(prev => ({ ...prev, [alvo.usuario.id]: 0 }));

      try {
        const payload = { paraId: alvo.usuario.id, conteudo: novaMensagem, tipo: "NORMAL" as const, clientMsgId };
        const resp = await fetch(`${API.BASE_URL}/api/mensagem`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          const saved: Mensagem = await resp.json();
          reconcilePrivadaByClientId(saved);
        } else {
          console.error("POST /api/mensagem falhou:", resp.status, await resp.text());
          setMensagensPrivadas(prev =>
            prev.map(m =>
              m.clientMsgId === clientMsgId ? { ...m, pending: false } : m
            )
          );
          alert("Não foi possível enviar a mensagem agora.");
        }
      } catch (e) {
        console.error("POST /api/mensagem erro:", e);
        setMensagensPrivadas(prev =>
          prev.map(m =>
            m.clientMsgId === clientMsgId ? { ...m, pending: false } : m
          )
        );
        alert("Não foi possível enviar a mensagem agora.");
      }
      setNovaMensagem("");
    } else {
      const clientMsgId = genClientId();
      const otm: MensagemGrupo = {
        id: clientMsgId,
        clientMsgId,
        pending: true,
        criadaEm: new Date().toISOString(),
        conteudo: novaMensagem,
        grupoId: alvo.grupo.id,
        usuarioId: usuarioId!,
        tipo: "NORMAL",
      };
      setMensagensGrupo(prev => [...prev, otm]);

      setLastMsgAtByGroup(prev => ({
        ...prev,
        [alvo.grupo.id]: Date.now(),
      }));

      setLastMsgByGroup((prev) => ({
        ...prev,
        [alvo.grupo.id]: formatPreviewFromMsg({
          tipo: "NORMAL",
          conteudo: novaMensagem,
        }),
      }));

      try {
        const payload = { conteudo: novaMensagem, clientMsgId };
        const resp = await fetch(`${API.BASE_URL}/api/mensagem/grupos/${alvo.grupo.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const saved: MensagemGrupo = await resp.json();
          reconcileGrupoByClientId(saved);
        } else {
          console.error("POST /api/mensagem/grupos falhou:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("POST /api/mensagem/grupos erro:", e);
      }
      setNovaMensagem("");
    }
  };

  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

  function parseConvocacaoEvento(text: string) {
  if (typeof text !== "string") return null;
  if (!text.includes("[CONVOCACAO_EVENTO:")) return null;

  const linkMatch = text.match(/🔗\s*Link:\s*(\/eventos\/[^\s]+)/i);
  const link = linkMatch?.[1] ?? null;
  const tituloMatch = text.match(/📣\s*Convocação:\s*(.+)/i);
  const papelMatch  = text.match(/✅\s*Você foi convocado como\s*(.+)\.?/i);
  const dataMatch   = text.match(/🗓️\s*Data\/Hora:\s*(.+)/i);

  return {
    link,
    titulo: tituloMatch?.[1]?.trim() ?? "Evento",
    papel:  papelMatch?.[1]?.trim() ?? "",
    data:   dataMatch?.[1]?.trim() ?? "",
    raw: text,
  };
}

function stripConvocacaoTag(text: string) {
  return String(text).replace(/^\[CONVOCACAO_EVENTO:[^\]]+\]\s*\n?/, "");
}

  const deletarMensagem = async (id: string) => {
    try {
      const msgPriv = mensagensPrivadas.find(m => m.id === id);
      const msgGrp  = mensagensGrupo.find(m => m.id === id);
      const pending = (msgPriv && msgPriv.pending) || (msgGrp && msgGrp.pending);

      if (pending || id.startsWith("c_") || !isUuid(id)) {
        setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
        setMensagensGrupo(prev => prev.filter(m => m.id !== id));
        return;
      }

      const res = await fetch(`${API.BASE_URL}/api/mensagem/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Falha no delete");

      setMensagensPrivadas(prev => prev.filter(m => m.id !== id));
      setMensagensGrupo(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error("Erro ao apagar mensagem:", err);
      alert("Não foi possível apagar a mensagem.");
    }
  };

  const renderizarMensagemGrupoWhats = (msg: MensagemGrupo) => {
    const isMine = msg.usuarioId === usuarioId;
    const wrap = isMine ? "self-end items-end" : "self-start items-start";
    const bubble = isMine ? "bg-green-900 text-white rounded-2xl rounded-tr-none" : "bg-[#E8ECF7] text-[#0F172A] rounded-2xl rounded-tl-none";
    const ts = isMine ? "text-[11px] text-gray-500 text-right mt-1" : "text-[11px] text-gray-500 mt-1";

    const Shell = (children: React.ReactNode): JSX.Element => (
      <div className={`max-w-[75%] flex flex-col ${wrap}`}>
        <div className={`${bubble} px-3 py-2 shadow-sm relative`}>
          {children}
          {isMine && (
            <button
              onClick={() => deletarMensagem(msg.id)}
              className="absolute -top-2 -right-2 bg-white/80 text-gray-700 hover:text-red-600 p-1 rounded-full shadow"
              title="Apagar"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
        <div className={ts}>
          {new Date(msg.criadaEm).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );

    if (!FLAGS.DESAFIOS_ENABLED && (
      msg.tipo === "GRUPO_DESAFIO" || msg.tipo === "GRUPO_DESAFIO_BONUS"
    )) {
      return Shell(<p className="text-sm opacity-80">Conteúdo de desafio está temporariamente indisponível.</p>);
    }

    if (msg.tipo === "GRUPO_DESAFIO" || msg.tipo === "GRUPO_DESAFIO_BONUS" || msg.tipo === "DESAFIO" || msg.tipo === "POST" || msg.tipo === "USUARIO") {
      return Shell(
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
          <MensagemItemGrupo msg={msg} meId={usuarioId} />
        </div>
      );
    }
    if (typeof msg.conteudo === "string" && msg.conteudo.includes("[CONVOCACAO_EVENTO:")) {
      const parsed = parseConvocacaoEvento(msg.conteudo);

      if (parsed?.link) {
        return Shell(
          <div
            onClick={() => navigate(parsed.link!)}
            className="cursor-pointer bg-white/90 border border-green-700 rounded-xl p-3 flex flex-col gap-2 hover:bg-green-50"
          >
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-white font-bold">
                📣
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-green-900 truncate">
                  {parsed.titulo}
                </p>
                {parsed.papel && (
                  <p className="text-xs text-green-900/80 truncate">
                    {parsed.papel}
                  </p>
                )}
              </div>
            </div>

            {parsed.data && (
              <p className="text-[12px] text-gray-600">
                🗓️ {parsed.data}
              </p>
            )}

            <button className="mt-1 text-xs px-3 py-1 bg-green-800 text-white rounded-lg self-start">
              Ver evento
            </button>

            <p className="text-[12px] text-gray-600 whitespace-pre-wrap break-words">
              {stripConvocacaoTag(parsed.raw).replace(/🔗\s*Link:\s*\/eventos\/[^\s]+/i, "").trim()}
            </p>
          </div>
        );
      }

      return Shell(
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {stripConvocacaoTag(msg.conteudo)}
        </p>
      );
    }

    return Shell(<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>);
  };

  const renderizarMensagemPrivadaWhats = (msg: Mensagem) => {
    const isMine = msg.deId === usuarioId;
    const wrap = isMine ? "self-end items-end" : "self-start items-start";
    const bubble = isMine ? "bg-green-900 text-white rounded-2xl rounded-tr-none" : "bg-[#E8ECF7] text-[#0F172A] rounded-2xl rounded-tl-none";
    const ts = isMine ? "text-[11px] text-gray-500 text-right mt-1" : "text-[11px] text-gray-500 mt-1";

    const Shell = (children: React.ReactNode): JSX.Element => (
      <div className={`max-w-[75%] flex flex-col ${wrap}`}>
        <div className={`${bubble} px-3 py-2 shadow-sm relative`}>
          {children}
          {isMine && (
            <button
              onClick={() => deletarMensagem(msg.id)}
              className="absolute -top-2 -right-2 bg-white/80 text-gray-700 hover:text-red-600 p-1 rounded-full shadow"
              title="Apagar"
            >
              <Trash size={14} />
            </button>
          )}
        </div>
        <div className={ts}>
          {new Date(msg.criadaEm).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    );

    if (msg.tipo === "CARD") {
      if (msg.conteudo === "__PENDING_CARD__") {
        return Shell(<div className="w-56 h-72 bg-gray-200 rounded animate-pulse" />);
      }

     if (typeof msg.conteudo === "string" && msg.conteudo.startsWith("CARD_JSON:")) {
      try {
        const raw = decodeURIComponent(atob(msg.conteudo.slice("CARD_JSON:".length)));
        const data = JSON.parse(raw);
        return Shell(
          <CardAtletaShield
            atleta={data.atleta}
            ovr={data.ovr}
            perf={data.perf}
            disc={data.disc}
            resp={data.resp}
            size={data.size}
            goldenMinOVR={data.goldenMinOVR}
          />
        );
      } catch {}
    }

    const isDataUrl =
        typeof msg.conteudo === "string" && msg.conteudo.startsWith("data:image/");

        const path = isDataUrl ? msg.conteudo : publicImgUrl(msg.conteudo)!;

        return Shell(<img src={path} alt="Card do atleta" className="w-56 h-auto rounded" />);
    } 
      if (msg.tipo === "POST") {
        const post = postsCache[msg.conteudo];
        if (!post) return Shell(<div className="text-sm">Carregando post...</div>);

        const img = post.imagemUrl ? publicImgUrl(post.imagemUrl) : null;
        const video = !img && post.videoUrl ? publicImgUrl(post.videoUrl) : null;

        return Shell(
          <div onClick={() => navigate(`/post/${post.id}`)} className="cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Avatar src={post.usuario.foto} name={post.usuario.nome} className="w-8 h-8" />
              <span className="text-sm font-semibold">{post.usuario.nome}</span>
            </div>
            {img && <img src={img} className="w-60 max-h-48 object-cover rounded mb-2" />}
            {video && (
              <video controls className="w-60 max-h-48 rounded mb-2">
                <source src={video} />
              </video>
            )}
            <p className="text-sm whitespace-pre-wrap">{post.conteudo}</p>
          </div>
        );
      }

      if (msg.tipo === "USUARIO") {
        const u = usuariosCache[msg.conteudo];
        if (!u) return Shell(<div className="text-sm">Carregando usuário...</div>);
        return Shell(
          <div onClick={() => navigate(`/perfil/${u.id}`)} className="flex items-center gap-2 cursor-pointer">
            <Avatar src={u.foto} name={u.nome} className="w-12 h-12" />
            <div>
              <p className="text-sm font-semibold">{u.nome}</p>
              <p className="text-xs opacity-80">Ver perfil</p>
            </div>
          </div>
        );
      }

      if (msg.tipo === "DESAFIO") {
        if (!FLAGS.DESAFIOS_ENABLED) {
          return Shell(<div className="text-sm opacity-80">Desafio temporariamente indisponível.</div>);
        }

        const d = desafiosCache[msg.conteudo];
        if (!d) return Shell(<div className="text-sm">Carregando desafio...</div>);
        const imagemSrc = d.imagemUrl ? publicImgUrl(d.imagemUrl) : undefined;
        return Shell(
          <div onClick={() => navigate(`/desafios/${d.id}`)} className="cursor-pointer">
            <div className="flex items-center justify-between mb-2 gap-3">
              <h3 className="font-semibold text-sm">{d.titulo}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                {d.nivel ?? "—"}
              </span>
            </div>
            {imagemSrc && <img src={imagemSrc} className="w-60 h-36 object-cover rounded mb-2" />}
            <p className="text-sm opacity-90 mb-2">{d.descricao}</p>
            <div className="flex items-center justify-between text-[11px] opacity-75">
              <span>Pontos: {d.pontuacao ?? "-"}</span>
              <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
        );
      }

      if (typeof msg.conteudo === "string" && msg.conteudo.startsWith("NOVO_TREINO:")) {
        try {
          const [, treinoId, titulo] = msg.conteudo.split(":");

          return Shell(
            <div
              onClick={() => navigate(`/treinos?open=${treinoId}`)}
              className="cursor-pointer bg-white border border-green-700 rounded-xl p-3 flex flex-col gap-2 hover:bg-green-50"
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-white font-bold">
                  🏋️
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-green-900">Novo Treino Criado</p>
                  <p className="text-xs opacity-80">{titulo}</p>
                </div>
              </div>

              <button
                className="mt-1 text-xs px-3 py-1 bg-green-800 text-white rounded-lg self-start"
              >
                Ver treino
              </button>
            </div>
          );
        } catch (e) {
          console.warn("Erro ao parsear NOVO_TREINO:", e);
        }
      }
      return Shell(<p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>);
    };

    return (
      <div className="h-screen flex flex-col bg-transparent">
        <header className="sticky top-0 z-10 bg-green-900 text-white">
          <div className="relative h-14 flex items-center justify-center px-4">
            <Link
              href="/perfil"
              aria-label="Voltar para perfil"
              className="absolute left-3 inline-flex h-10 w-10 items-center justify-center
                rounded-full bg-white/10 text-white hover:bg-white/20
                focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <button
              onClick={() => setShowSidebar(true)}
              className="md:hidden absolute right-3 p-2 rounded-full hover:bg-white/10"
              title="Conversas"
            >
              <Send className="w-5 h-5" />
            </button>

            <h1 className="text-base font-semibold truncate">
              {alvo?.tipo === "usuario"
                ? alvo.usuario.nome
                : alvo?.tipo === "grupo"
                ? alvo.grupo.nome
                : "Conversas"}
            </h1>
          </div>
        </header>

      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:block w-80 border-r bg-white">
          {renderSidebarContent()}
        </aside>

        <div className={`md:hidden fixed inset-0 z-40 ${showSidebar ? "" : "pointer-events-none"}`}>
          <div
            onClick={() => setShowSidebar(false)}
            className={`absolute inset-0 bg-black/30 transition-opacity ${showSidebar ? "opacity-100" : "opacity-0"}`}
          />
          <aside
            className={`absolute left-0 top-0 h-full w-72 bg-white border-r shadow-xl transform transition-transform ${
              showSidebar ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {renderSidebarContent()}
          </aside>
        </div>

        <main className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b bg-transparent">
            <div className="text-sm text-green-900 font-medium">
              {alvo ? (alvo.tipo === "usuario" ? "Mensagem direta" : grupoDetalhe?.descricao?.trim() || "Grupo") : "Selecione uma conversa"}
            </div>

            <div className="flex items-center gap-2">
              {alvo?.tipo === "usuario" && isAtleta && (
                <button
                  onClick={compartilharPerfilNoChat}
                  className="flex items-center gap-1 text-green-800 hover:underline text-sm"
                  title="Compartilhar meu card nesta conversa"
                >
                  <Share2 size={16} /> Compartilhar meu card
                </button>
              )}

              {alvo?.tipo === "grupo" && (
                <button
                  type="button"
                  onClick={() => setMostrarInfoGrupo((v) => !v)}
                  className="px-3 py-2 text-xs rounded-lg border border-green-800 text-green-900 bg-white hover:bg-green-50"
                  title="Ver membros do grupo"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}

              {FLAGS.DESAFIOS_ENABLED && alvo?.tipo === "grupo" && (
                <button
                  onClick={() => setModalDesafiosAberto(true)}
                  className="px-3 py-2 text-xs rounded-lg bg-green-800 text-white hover:bg-green-700"
                >
                  Desafio em grupo
                </button>
              )}
            </div>
          </div>

          {alvo?.tipo === "grupo" && mostrarInfoGrupo && (
            <div className="border-b bg-white px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-800">Membros do grupo</h3>
                  <p className="text-xs text-zinc-500">
                    {grupoDetalhe?.membros?.length ?? 0} participante(s)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {grupoDetalhe?.meuTipo === "ADMIN" && (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold"
                      onClick={() => setModalAdicionarMembrosAberto(true)}
                    >
                      Adicionar
                    </button>
                  )}

                  {grupoDetalhe?.id && (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold border border-red-200"
                      onClick={() => sairDoGrupo(grupoDetalhe.id)}
                    >
                      Sair do grupo
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {carregandoGrupoDetalhe && (
                  <p className="text-sm text-zinc-500">Carregando membros...</p>
                )}

                {!carregandoGrupoDetalhe &&
                  grupoDetalhe?.membros?.map((membro) => (
                    <div
                      key={membro.id}
                      className="flex items-center justify-between gap-3 rounded-xl border p-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/perfil/${membro.id}`)}
                          className="shrink-0"
                          title={`Ver perfil de ${membro.nome}`}
                        >
                          <img
                            src={getAvatarSrc(membro.foto)}
                            alt={membro.nome}
                            className="w-10 h-10 rounded-full object-cover border"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = AVATAR_FALLBACK;
                            }}
                          />
                        </button>

                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{membro.nome}</div>
                          <div className="text-xs text-zinc-500">
                            {membro.isOwner
                              ? "Admin / Owner"
                              : membro.tipo === "ADMIN"
                              ? "Admin"
                              : "Membro"}
                          </div>
                        </div>
                      </div>

                      {grupoDetalhe?.meuTipo === "ADMIN" &&
                        !membro.isOwner &&
                        membro.id !== usuarioId && (
                          <div className="flex items-center gap-2">
                            {membro.tipo !== "ADMIN" ? (
                              <button
                                type="button"
                                className="px-2 py-1 rounded-md text-xs border border-blue-200 text-blue-700 bg-blue-50"
                                onClick={() => alterarTipoMembroDoGrupo(grupoDetalhe.id, membro.id, "ADMIN")}
                              >
                                Tornar admin
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="px-2 py-1 rounded-md text-xs border border-amber-200 text-amber-700 bg-amber-50"
                                onClick={() => alterarTipoMembroDoGrupo(grupoDetalhe.id, membro.id, "MEMBRO")}
                              >
                                Tornar membro
                              </button>
                            )}

                            <button
                              type="button"
                              className="px-2 py-1 rounded-md text-xs border border-red-200 text-red-700 bg-red-50"
                              onClick={() => removerMembroDoGrupo(grupoDetalhe.id, membro.id)}
                            >
                              Remover
                            </button>
                          </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div
            className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-4 pb-24 md:pb-6"
            onScroll={handleScroll}
          >
            <div
            key={alvo ? (alvo.tipo === "usuario" ? `u-${alvo.usuario.id}` : `g-${alvo.grupo.id}`) : "none"}
            className="mx-auto w-full sm:max-w-3xl space-y-3"
          >
            {alvo ? (
              <>
                {alvo.tipo === "usuario" &&
                  mensagensPrivadas.map((m) => <div key={m.id}>{renderizarMensagemPrivadaWhats(m)}</div>)}

                {alvo.tipo === "grupo" &&
                  mensagensGrupo.map((m) => <div key={m.id}>{renderizarMensagemGrupoWhats(m)}</div>)}

                {(carregandoMaisPriv || carregandoMaisGrupo) && (
                  <p className="text-center text-sm text-gray-400">Carregando mais...</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-gray-500">Selecione uma conversa para começar</p>
            )}
          </div>
          </div>

          <div className="sticky bottom-[64px] md:bottom-0 bg-transparent border-green-100 mb-10">
            <div className="mx-auto w-full sm:max-w-3xl px-3 sm:px-4 py-3 flex items-center gap-2">
              <input
                className="flex-1 bg-white border border-green-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    enviarMensagem();
                  }
                }}
                placeholder="Digite sua mensagem..."
              />
              <button
                onClick={enviarMensagem}
                className="shrink-0 bg-green-900 text-white p-3 rounded-xl hover:opacity-95 active:opacity-90"
                title="Enviar"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>
            </div>
          </div>
        </main>
      </div>

      <div style={{ position: "absolute", left: -99999, top: -99999 }}>
        <div ref={cardRef}>
          {meuCardDados && (
            <CardAtletaShield
              atleta={{
                atletaId: meuCardDados.atletaId ?? "",
                nome: meuCardDados.nome,
                foto: meuCardDados.foto,
                posicao: meuCardDados.posicao ?? undefined,
                idade: null,
              }}
              ovr={meuCardDados.ovr}
              perf={meuCardDados.perf}
              disc={meuCardDados.disc}
              resp={meuCardDados.resp}
              size={{ w: 300, h: 420 }}
              goldenMinOVR={88}
            />
          )}
        </div>
      </div>

      <BottomNav />

      <ModalGrupos aberto={modalAberto} onFechar={fecharModal} usuarioId={usuarioId ?? ""} token={token} />
      {FLAGS.DESAFIOS_ENABLED && alvo?.tipo === "grupo" && (
        <ModalDesafiosGrupo
          aberto={modalDesafiosAberto}
          onFechar={fecharModalDesafios}
          grupoId={alvo.grupo.id}
          token={token}
          onCriado={recarregarMensagensDoGrupoAtual}
        />
      )}
      {alvo?.tipo === "grupo" && (
      <ModalAdicionarMembrosGrupo
        aberto={modalAdicionarMembrosAberto}
        onFechar={() => setModalAdicionarMembrosAberto(false)}
        token={token}
        usuarioId={usuarioId ?? ""}
        grupoId={alvo.grupo.id}
        membrosAtuaisIds={grupoDetalhe?.membros?.map((m) => m.id) ?? []}
        onConfirmar={async (membrosIds) => {
          await adicionarMembrosNoGrupo(alvo.grupo.id, membrosIds);
          await carregarDetalheGrupo(alvo.grupo.id);
        }}
      />
    )}
    </div>
  );
}
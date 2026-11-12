import { toast } from "@/lib/toast";
import { useContext, useEffect, useState, useRef, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Share2, Mic, User, UserPlus, Search, Users, Trash, ArrowLeft, Send } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import socket from "../services/socket.js";
import { ModalGrupos } from "../components/modal/ModalGrupos.js";
import { ModalDesafiosGrupo } from "../components/modal/ModalDesafiosGrupos.js";
import { MensagemItemGrupo } from "../components/chat/GroupDesafioCards.js";
import AudioMensagem from "../components/chat/AudioMensagem.js";
import GravadorAudio from "../components/chat/GravadorAudio.js";
import CardAtletaShield from "../components/cards/CardAtletaShield.js";
import { publicImgUrl } from "../utils/publicUrl.js";
import { FLAGS } from "../config.js";
import BottomNav from "../components/layout/BottomNav.js";
import { ModalAdicionarMembrosGrupo } from "../components/mensagens/ModalAdicionarMembrosGrupo.js";
import AvatarSeguro from "../components/shared/Avatar.js";
import {
  UserContext,
} from "../context/UserContext.js";

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
  tipo:
    | "NORMAL"
    | "AUDIO"
    | "POST"
    | "DESAFIO"
    | "USUARIO"
    | "CARD";
  criadaEm: string;
  clientMsgId?: string;
  pending?: boolean;
  audioDuracaoMs?: number | null;
  contextoRemetente?: {
    key: string;
    kind:
      | "PERSONAL"
      | "ORGANIZATION";
    tipoUsuario:
      string;
    role?:
      string | null;
    profileId?:
      string | null;
    organizationId?:
      string | null;
    organizationType?:
      string | null;
    organizationRole?:
      string | null;
    legacyOrganizationId?:
      string | null;
  } | null;
}

interface Grupo {
  id: string;
  nome: string;
  descricao?: string | null;
  ownerId: string;
  totalMembros?: number;
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
    | "AUDIO"
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
  audioDuracaoMs?: number | null;
  contextoRemetente?: {
    key:
      string;

    kind:
      | "PERSONAL"
      | "ORGANIZATION";

    tipoUsuario:
      string;

    role?:
      string | null;

    profileId?:
      string | null;

    organizationId?:
      string | null;

    organizationType?:
      string | null;

    organizationRole?:
      string | null;

    legacyOrganizationId?:
      string | null;
  } | null;
}

interface Postagem {
  id: string;
  conteudo: string;
  imagemUrl?: string;
  videoUrl?: string;
  usuario: Usuario;
  organizacao?: {
    id: string;
    nome: string;
    tipo?: string | null;
  } | null;
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

type MensagemComData = { id: string; criadaEm: string };

type GrupoDeDia<T extends MensagemComData> = {
  chave: string;
  titulo: string;
  mensagens: T[];
};

function dataLocalDaMensagem(valor: string): Date | null {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function chaveDoDia(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function tituloDoDia(data: Date, agora: Date): string {
  const inicioDia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diaUTC = Date.UTC(inicioDia.getFullYear(), inicioDia.getMonth(), inicioDia.getDate());
  const hojeUTC = Date.UTC(inicioHoje.getFullYear(), inicioHoje.getMonth(), inicioHoje.getDate());
  const diasAtras = Math.round((hojeUTC - diaUTC) / 86_400_000);

  if (diasAtras === 0) return "Hoje";
  if (diasAtras === 1) return "Ontem";
  if (diasAtras >= 2 && diasAtras <= 6) {
    const diaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(data);
    return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(data);
}

function agruparMensagensPorDia<T extends MensagemComData>(
  mensagens: T[],
  agora: Date = new Date()
): GrupoDeDia<T>[] {
  const grupos: GrupoDeDia<T>[] = [];
  for (const mensagem of mensagens) {
    const data = dataLocalDaMensagem(mensagem.criadaEm);
    const chave = data ? chaveDoDia(data) : "data-invalida";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.chave === chave) {
      ultimo.mensagens.push(mensagem);
    } else {
      grupos.push({
        chave,
        titulo: data ? tituloDoDia(data, agora) : "Data indisponível",
        mensagens: [mensagem],
      });
    }
  }
  return grupos;
}

export default function PaginaMensagens() {
  const [, navigate] = useLocation();

  const userContext =
    useContext(
      UserContext
    );

  const activeContext =
    userContext
      ?.activeContext ??
    null;

  const activeTipoUsuario =
    String(
      userContext
        ?.activeTipoUsuario ??
      ""
    )
      .trim()
      .toLowerCase();

  const isAtleta =
    activeContext?.kind ===
      "PERSONAL" &&
    activeTipoUsuario ===
      "atleta" &&
    Boolean(
      userContext
        ?.activeTipoUsuarioId
    );

  const temSeletorContexto =
    Boolean(
      userContext?.isLoggedIn
    ) &&
    (
      userContext?.contexts
        ?.length ?? 0
    ) > 1;

  const [showSidebar, setShowSidebar] = useState(false);
  const usuarioId:
    string | null =
    userContext?.user?.id
      ? String(
          userContext.user.id
        )
      : Storage.usuarioId;
  const token: string = Storage.token || "";
  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [alvo, setAlvo] = useState<ChatTarget | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadByUser, setUnreadByUser] = useState<Record<string, number>>({});
  type PrivadaNaoLida = {
    userId: string;
    count: number;
    primeiraId: string | null;
  };

  const [divisorPrivadas, setDivisorPrivadas] =
    useState<{
      otherId: string;
      primeiraId: string;
      quantidade: number;
    } | null>(null);

  const [privadaProntaId, setPrivadaProntaId] =
    useState<string | null>(null);

  type GrupoNaoLido = {
    grupoId: string;
    count: number;
    primeiraId: string | null;
  };

  const [unreadByGroup, setUnreadByGroup] =
    useState<Record<string, GrupoNaoLido>>({});

  const [divisorNaoLidas, setDivisorNaoLidas] =
    useState<{
      grupoId: string;
      primeiraId: string;
      quantidade: number;
    } | null>(null);

  const scrollMensagensRef =
    useRef<HTMLDivElement | null>(null);

  const scrollPendenteRef =
    useRef<
      | { tipo: "fim"; conversa: string }
      | {
          tipo: "primeira-nao-lida";
          conversa: string;
          id: string;
        }
      | null
    >(null);
  const totalUnread = Object.values(unreadByUser).reduce((a, b) => a + b, 0);
  const fetchPrivSeqRef = useRef(0);
  const fetchGrupoSeqRef = useRef(0);
  const buscandoPrimeiraNaoLidaRef = useRef(false);
  const [grupoDetalhe, setGrupoDetalhe] = useState<GrupoDetalhe | null>(null);
  const [mostrarInfoGrupo, setMostrarInfoGrupo] = useState(false);
  const [carregandoGrupoDetalhe, setCarregandoGrupoDetalhe] = useState(false);
  const [modalAdicionarMembrosAberto, setModalAdicionarMembrosAberto] = useState(false);
  const [excluindoGrupoId, setExcluindoGrupoId] = useState<string | null>(null);

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

  const fetchUnreadByUser = async ():
    Promise<Record<string, PrivadaNaoLida> | null> => {
    if (!token) return null;

    try {
      const resposta = await fetch(
        `${API.BASE_URL}/api/mensagem/unread-by-user`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        return null;
      }

      const dados: PrivadaNaoLida[] =
        await resposta.json();

      const detalhes = Object.fromEntries(
        dados.map((item) => [
          item.userId,
          item,
        ])
      ) as Record<string, PrivadaNaoLida>;

      setUnreadByUser(
        Object.fromEntries(
          dados.map((item) => [
            item.userId,
            item.count,
          ])
        )
      );

      return detalhes;
    } catch (erro) {
      console.warn(
        "[mensagens] Falha ao consultar DMs não lidas:",
        erro
      );

      return null;
    }
  };

  const fetchUnreadByGroup = async () => {
    if (!token) return {};

    try {
      const resposta = await fetch(
        `${API.BASE_URL}/api/mensagem/unread-by-group`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) return {};

      const dados: GrupoNaoLido[] =
        await resposta.json();

      const mapa = Object.fromEntries(
        dados.map((item) => [
          item.grupoId,
          item,
        ])
      ) as Record<string, GrupoNaoLido>;

      setUnreadByGroup(mapa);

      return mapa;
    } catch (erro) {
      console.warn(
        "[mensagens] Erro ao buscar não lidas dos grupos:",
        erro
      );

      return {};
    }
  };

  const markReadFromUser = async (
    otherId: string
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const resposta = await fetch(
        `${API.BASE_URL}/api/mensagem/mark-read/${encodeURIComponent(otherId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) return false;

      setUnreadByUser(prev => ({
        ...prev,
        [otherId]: 0,
      }));

      window.dispatchEvent(
        new Event("mensagens:atualizar-badge")
      );

      return true;
    } catch (erro) {
      console.warn(
        "[mensagens] Falha ao marcar conversa como lida:",
        erro
      );

      return false;
    }
  };

  const markReadFromGroup = async (
    grupoId: string
  ): Promise<boolean> => {
    if (!token) return false;

    try {
      const resposta = await fetch(
        `${API.BASE_URL}/api/mensagem/grupos/${encodeURIComponent(
          grupoId
        )}/mark-read`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        console.warn(
          "[mensagens] Falha ao marcar grupo:",
          resposta.status
        );
        return false;
      }

      window.dispatchEvent(
        new Event("mensagens:atualizar-badge")
      );

      return true;
    } catch (erro) {
      console.warn(
        "[mensagens] Falha ao marcar grupo como lido:",
        erro
      );

      return false;
    }
  };

  const lastGroupRef = useRef<string | null>(null);

  useEffect(() => {
    ++fetchPrivSeqRef.current;
    ++fetchGrupoSeqRef.current;

    buscandoPrimeiraNaoLidaRef.current = false;
    setTemMaisNovasPriv(false);
    setTemMaisNovasGrupo(false);
    setCarregandoMaisNovas(false);

    if (!alvo) return;

    if (alvo.tipo === "usuario") {
      setDmPermitida(true);
      setPrivadaProntaId(null);
      setDivisorPrivadas(null);

      const key =
        `conversa_${usuarioId}_${alvo.usuario.id}`;

      setMensagensPrivadas(
        safeLoad<Mensagem>(key)
      );

      setTemMaisPriv(true);

      void abrirPrivadaComNaoLidas(
        alvo.usuario.id
      );
    } else {
        if (lastGroupRef.current && lastGroupRef.current !== alvo.grupo.id) {
        socket.emit("leaveGroup", lastGroupRef.current);
      }
      lastGroupRef.current = alvo.grupo.id;
      socket.emit("joinGroup", alvo.grupo.id);
      const key = `conversa_grupo_${alvo.grupo.id}`;
      setMensagensGrupo(safeLoad<MensagemGrupo>(key));
      setTemMaisGrupo(true);
      void abrirGrupoComNaoLidas(alvo.grupo.id);
    }
    setNovaMensagem("");
  }, [alvo, usuarioId, token]);

  useEffect(() => {
    if (!token) return;

    void fetchUnreadByUser();
    void fetchUnreadByGroup();

    const atualizar = () => {
      void fetchUnreadByUser();
      void fetchUnreadByGroup();
    };

    socket.on("badge:update", atualizar);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        atualizar();
      }
    };

    document.addEventListener(
      "visibilitychange",
      aoVoltar
    );

    return () => {
      socket.off("badge:update", atualizar);

      document.removeEventListener(
        "visibilitychange",
        aoVoltar
      );
    };
  }, [token]);

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
  const diasPrivados = useMemo(() => agruparMensagensPorDia(mensagensPrivadas), [mensagensPrivadas]);
  const diasGrupo = useMemo(() => agruparMensagensPorDia(mensagensGrupo), [mensagensGrupo]);
  const [temMaisNovasPriv, setTemMaisNovasPriv] = useState(false);
  const [temMaisNovasGrupo, setTemMaisNovasGrupo] = useState(false);
  const [carregandoMaisNovas, setCarregandoMaisNovas] = useState(false);
  const [carregandoMaisGrupo, setCarregandoMaisGrupo] = useState(false);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [
    dmPermitida,
    setDmPermitida,
  ] = useState(true);
  const [postsCache, setPostsCache] = useState<Record<string, Postagem>>({});
  const [usuariosCache, setUsuariosCache] = useState<Record<string, Usuario>>({});
  const [desafiosCache, setDesafiosCache] = useState<Record<string, Desafio>>({});
  const [lastMsgByUser, setLastMsgByUser] = useState<Record<string, string>>({});
  const [modalAberto, setModalAberto] = useState(false);
  const [lastMsgAtByUser, setLastMsgAtByUser] = useState<Record<string, number>>({});
  const [lastMsgAtByGroup, setLastMsgAtByGroup] = useState<Record<string, number>>({});
  const [lastMsgByGroup, setLastMsgByGroup] = useState<Record<string, string>>({});

  const abrirModal = () => setModalAberto(true);

  function fecharModal() {
    setModalAberto(false);
  }

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

    if (tipo === "AUDIO") {
      return "🎤 Mensagem de voz";
    }
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

  function Avatar({
    src,
    name,
    className = "w-10 h-10",
  }: {
    src?: string | null;
    name?: string;
    className?: string;
  }) {
    return (
      <AvatarSeguro
        foto={src}
        alt={name || "Avatar"}
        className={className}
        pasta="usuarios"
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
            const selecionado = alvo?.tipo === "grupo" && alvo.grupo.id === g.id;
            const unreadGrupo = unreadByGroup[g.id]?.count ?? 0;

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
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">
                        {g.nome}
                      </span>

                      {unreadGrupo > 0 && (
                        <span
                          className="shrink-0 rounded-full bg-green-700 px-2 py-0.5 text-[11px] font-bold text-white"
                          aria-label={`${unreadGrupo} mensagens não lidas`}
                        >
                          {unreadGrupo > 99
                            ? "99+"
                            : unreadGrupo}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 line-clamp-1">
                      {lastMsgByGroup[g.id] ||
                        g.ultimaMensagem ||
                        g.descricao ||
                        "Sem mensagens ainda."}
                    </div>
                  </div>

                  {g.ownerId === usuarioId && (
                    <button
                      type="button"
                      disabled={excluindoGrupoId === g.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void excluirGrupo(g);
                      }}
                      className="
                        shrink-0 p-1.5 rounded-md
                        text-red-600 hover:bg-red-50
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                      title="Apagar grupo"
                      aria-label={`Apagar grupo ${g.nome}`}
                    >
                      <Trash size={16} />
                    </button>
                  )}
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
    if (!dmPermitida) {
      toast.error(
        "Este usuário desativou mensagens diretas."
      );
      return;
    }

    try {
      const base = (meuCardDados ?? await getMeuPerfilEBonus());
      if (!base) { toast.error("Não consegui montar seu card agora."); return; }

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
      if (!node) { toast.error("Falha ao preparar o card para captura."); return; }

      if (resp.ok) {
        const saved: Mensagem = await resp.json();
        reconcilePrivadaByClientId(saved);
      } else {
        console.error("POST /api/mensagem (CARD) falhou:", resp.status, await resp.text());
        toast.error("Não consegui enviar o card agora.");
        setMensagensPrivadas(prev => prev.filter(m => m.clientMsgId !== clientMsgId));
      }
    } catch (err) {
      console.error("Falha ao compartilhar card:", err);
      toast.error("Não foi possível compartilhar seu card agora.");
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
    if (
      !divisorPrivadas ||
      temMaisNovasPriv ||
      alvo?.tipo !== "usuario" ||
      alvo.usuario.id !== divisorPrivadas.otherId ||
      privadaProntaId !== divisorPrivadas.otherId
    ) {
      return;
    }

    const primeiraCarregada = mensagensPrivadas.some(
      (mensagem) =>
        mensagem.id === divisorPrivadas.primeiraId
    );

    if (!primeiraCarregada) {
      return;
    }

    const timer = window.setTimeout(() => {
      const atual = alvoRef.current;

      if (
        atual?.tipo !== "usuario" ||
        atual.usuario.id !== divisorPrivadas.otherId ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const caixa = scrollMensagensRef.current;

      const divisor = caixa?.querySelector(
        `[data-primeira-nao-lida="${divisorPrivadas.primeiraId}"]`
      ) as HTMLElement | null;

      if (!caixa || !divisor) return;

      const area = caixa.getBoundingClientRect();
      const posicao = divisor.getBoundingClientRect();

      const divisorVisivel =
        posicao.bottom > area.top &&
        posicao.top < area.bottom;

      if (!divisorVisivel) return;

      void (async () => {
        const sucesso = await markReadFromUser(
          divisorPrivadas.otherId
        );

        if (!sucesso) return;

        const conversaAtual = alvoRef.current;

        if (
          conversaAtual?.tipo !== "usuario" ||
          conversaAtual.usuario.id !== divisorPrivadas.otherId
        ) {
          return;
        }

        setDivisorPrivadas(null);
        await fetchUnreadByUser();
      })();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [
    divisorPrivadas,
    temMaisNovasPriv,
    mensagensPrivadas,
    alvo,
    privadaProntaId,
  ]);

  useEffect(() => {
    if (
      alvo?.tipo !== "usuario" ||
      privadaProntaId !== alvo.usuario.id ||
      divisorPrivadas ||
      !mensagensPrivadas.length ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const ultimaMensagem =
      mensagensPrivadas[mensagensPrivadas.length - 1];

    if (
      ultimaMensagem.deId !== alvo.usuario.id ||
      ultimaMensagem.paraId !== usuarioId
    ) {
      return;
    }

    const caixa = scrollMensagensRef.current;
    if (!caixa) return;

    const distanciaDoFim =
      caixa.scrollHeight -
      caixa.scrollTop -
      caixa.clientHeight;

    if (distanciaDoFim > 120) return;

    const otherId = alvo.usuario.id;

    const timer = window.setTimeout(() => {
      if (
        alvoRef.current?.tipo !== "usuario" ||
        alvoRef.current.usuario.id !== otherId ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      void markReadFromUser(otherId);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    alvo,
    mensagensPrivadas,
    privadaProntaId,
    divisorPrivadas,
    usuarioId,
  ]);

  useEffect(() => {
    socket.connect();

    const onConnect = () => {
      if (usuarioId) {
        socket.emit(
          "join",
          usuarioId
        );
      }

      const cur =
        alvoRef.current;

      if (
        cur?.tipo ===
        "grupo"
      ) {
        socket.emit(
          "joinGroup",
          cur.grupo.id
        );
      }
    };

    const onNovaMensagem = (
      mensagem: Mensagem
    ) => {
      const current =
        alvoRef.current;

      if (
        mensagem.paraId ===
        usuarioId
      ) {
        const abertoComEsse =
          current?.tipo ===
            "usuario" &&
          current.usuario.id ===
            mensagem.deId;

        if (!abertoComEsse) {
          setUnreadByUser(
            (prev) => ({
              ...prev,

              [mensagem.deId]:
                (
                  prev[
                    mensagem.deId
                  ] || 0
                ) + 1,
            })
          );
        }
      }

      const otherId =
        mensagem.deId ===
        usuarioId
          ? mensagem.paraId
          : mensagem.deId;

      setLastMsgAtByUser(
        (prev) => ({
          ...prev,

          [otherId]:
            new Date(
              mensagem.criadaEm
            ).getTime(),
        })
      );

      setLastMsgByUser(
        (prev) => ({
          ...prev,

          [otherId]:
            formatPreviewFromMsg({
              tipo:
                mensagem.tipo,

              conteudo:
                mensagem.conteudo,
            }),
        })
      );

      if (
        String(
          mensagem.tipo
        ).toUpperCase() ===
        "USUARIO"
      ) {
        const idCompartilhado =
          String(
            mensagem.conteudo ||
              ""
          );

        ensureUsuarioNome(
          idCompartilhado
        ).then((nome) => {
          if (nome) {
            setLastMsgByUser(
              (prev) => ({
                ...prev,

                [otherId]:
                  `👤 Perfil: ${nome}`,
              })
            );
          }
        });
      }

      if (
        current?.tipo !==
        "usuario"
      ) {
        return;
      }

      const curId =
        current.usuario.id;

      const relevante =
        (
          mensagem.deId ===
            curId &&
          mensagem.paraId ===
            usuarioId
        ) ||
        (
          mensagem.deId ===
            usuarioId &&
          mensagem.paraId ===
            curId
        );

      if (!relevante) {
        return;
      }

      const replaced =
        reconcilePrivadaByClientId(
          mensagem
        );

      const caixa = scrollMensagensRef.current;

      const estaPertoDoFim =
        !caixa ||
        caixa.scrollHeight -
          caixa.scrollTop -
          caixa.clientHeight < 120;

      if (
        mensagem.deId === usuarioId ||
        estaPertoDoFim
      ) {
        scrollPendenteRef.current = {
          tipo: "fim",
          conversa: `u:${current.usuario.id}`,
        };
      }

      if (!replaced) {
        setMensagensPrivadas(
          (prev) => {
            const exists =
              prev.some(
                (m) =>
                  m.id ===
                  mensagem.id
              ) ||
              (
                !!mensagem.clientMsgId &&
                prev.some(
                  (m) =>
                    m.clientMsgId ===
                    mensagem.clientMsgId
                )
              );

            if (exists) {
              return prev;
            }

            return [
              ...prev,
              {
                ...mensagem,
                pending: false,
              },
            ];
          }
        );
      }
    };

    const onNovaMensagemGrupo = (
      mensagem: MensagemGrupo
    ) => {
      setLastMsgByGroup(
        (prev) => ({
          ...prev,

          [mensagem.grupoId]:
            formatPreviewFromMsg({
              tipo:
                mensagem.tipo,

              conteudo:
                mensagem.conteudo,
            }),
        })
      );

      const current =
        alvoRef.current;

      if (
        !(
          current?.tipo ===
            "grupo" &&
          mensagem.grupoId ===
            current.grupo.id
        )
      ) {
        return;
      }

      setLastMsgAtByGroup(
        (prev) => ({
          ...prev,

          [mensagem.grupoId]:
            new Date(
              mensagem.criadaEm
            ).getTime(),
        })
      );

      setLastMsgByGroup(
        (prev) => ({
          ...prev,

          [mensagem.grupoId]:
            formatPreviewFromMsg({
              tipo:
                mensagem.tipo,

              conteudo:
                mensagem.conteudo,
            }),
        })
      );

      const replaced =
        reconcileGrupoByClientId(
          mensagem
        );

      const caixa = scrollMensagensRef.current;

      const estaPertoDoFim =
        !caixa ||
        caixa.scrollHeight -
          caixa.scrollTop -
          caixa.clientHeight < 120;

      if (
        mensagem.usuarioId === usuarioId ||
        estaPertoDoFim
      ) {
        scrollPendenteRef.current = {
          tipo: "fim",
          conversa: `g:${mensagem.grupoId}`,
        };
      }

      if (!replaced) {
        setMensagensGrupo(
          (prev) => {
            const exists =
              prev.some(
                (m) =>
                  m.id ===
                  mensagem.id
              ) ||
              (
                !!mensagem.clientMsgId &&
                prev.some(
                  (m) =>
                    m.clientMsgId ===
                    mensagem.clientMsgId
                )
              );

            if (exists) {
              return prev;
            }

            return [
              ...prev,
              {
                ...mensagem,
                pending: false,
              },
            ];
          }
        );
      }
    };

    const onMensagemDeletada = ({
      id,
    }: {
      id: string;
    }) => {
      setMensagensPrivadas(
        (prev) =>
          prev.filter(
            (m) =>
              m.id !== id
          )
      );

      setMensagensGrupo(
        (prev) =>
          prev.filter(
            (m) =>
              m.id !== id
          )
      );
    };

    const onGrupoCriado = (
      novoGrupo: Grupo
    ) => {
      if (!novoGrupo?.id) {
        return;
      }

      setGrupos(
        (prev) => {
          const grupoJaExiste =
            prev.some(
              (grupo) =>
                grupo.id ===
                novoGrupo.id
            );

          if (
            grupoJaExiste
          ) {
            return prev.map(
              (grupo) =>
                grupo.id ===
                novoGrupo.id
                  ? {
                      ...grupo,
                      ...novoGrupo,
                    }
                  : grupo
            );
          }

          return [
            novoGrupo,
            ...prev,
          ];
        }
      );

      setLastMsgByGroup(
        (prev) => ({
          ...prev,
          [novoGrupo.id]:
            "",
        })
      );

      setLastMsgAtByGroup(
        (prev) => ({
          ...prev,
          [novoGrupo.id]:
            Date.now(),
        })
      );
    };

    const onGrupoRemovido = ({
      grupoId,
    }: {
      grupoId: string;
    }) => {
      removerGrupoDaInterface(
        grupoId
      );
    };

    socket.on(
      "connect",
      onConnect
    );

    socket.on(
      "novaMensagem",
      onNovaMensagem
    );

    socket.on(
      "novaMensagemGrupo",
      onNovaMensagemGrupo
    );

    socket.on(
      "mensagemDeletada",
      onMensagemDeletada
    );

    socket.on(
      "grupoCriado",
      onGrupoCriado
    );

    socket.on(
      "grupoRemovido",
      onGrupoRemovido
    );

    return () => {
      socket.off(
        "connect",
        onConnect
      );

      socket.off(
        "novaMensagem",
        onNovaMensagem
      );

      socket.off(
        "novaMensagemGrupo",
        onNovaMensagemGrupo
      );

      socket.off(
        "mensagemDeletada",
        onMensagemDeletada
      );

      socket.off(
        "grupoCriado",
        onGrupoCriado
      );

      socket.off(
        "grupoRemovido",
        onGrupoRemovido
      );
    };
  }, [
    usuarioId,
  ]);

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

        const fromConversas:
          Usuario[] =
          conv.conversas.map(
            (c) => ({
              id:
                c.id,

              nome:
                c.nome,

              foto:
                c.foto,
            })
          );

        let base =
          mergeUnique(
            fromConversas,
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
  }, [token, activeContext?.key]);

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
    if (
      pendingOpenRef.current ||
      !token
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const otherId =
      params.get("otherId");

    const grupoId =
      params.get("grupoId");

    if (!otherId && !grupoId) {
      return;
    }

    if (otherId) {
      const existente =
        usuariosMutuos.find(
          (u) =>
            u.id === otherId
        );

      if (existente) {
        selecionarAlvo({
          tipo: "usuario",
          usuario: existente,
        });

        pendingOpenRef.current =
          true;

        return;
      }

      void (async () => {
        try {
          const resp =
            await fetch(
              `${API.BASE_URL}/api/usuarios/${encodeURIComponent(
                otherId
              )}`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          if (!resp.ok) {
            return;
          }

          const usuario =
            (await resp.json()) as Usuario;

          setUsuariosMutuos(
            (prev) =>
              prev.some(
                (u) =>
                  u.id ===
                  usuario.id
              )
                ? prev
                : [
                    usuario,
                    ...prev,
                  ]
          );

          selecionarAlvo({
            tipo: "usuario",
            usuario,
          });
        } finally {
          pendingOpenRef.current =
            true;
        }
      })();

      return;
    }

    if (grupoId) {
      const grupo =
        grupos.find(
          (g) =>
            g.id === grupoId
        );

      if (!grupo) {
        return;
      }

      selecionarAlvo({
        tipo: "grupo",
        grupo,
      });

      pendingOpenRef.current =
        true;
    }
  }, [
    usuariosMutuos,
    grupos,
    token,
  ]);

  useEffect(() => {
    if (pendingOpenRef.current) return;
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("otherId") ||
      params.get("grupoId")
    ) {
      return;
    }
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
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("otherId") ||
      params.get("grupoId")
    ) {
      return;
    }
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

  function removerGrupoDaInterface(grupoId: string) {
    const alvoAtual = alvoRef.current;

    const grupoEstavaAberto =
      alvoAtual?.tipo === "grupo" &&
      alvoAtual.grupo.id === grupoId;

    setGrupos((prev) => prev.filter((grupo) => grupo.id !== grupoId));

    setLastMsgByGroup((prev) => {
      const next = { ...prev };
      delete next[grupoId];
      return next;
    });

    setLastMsgAtByGroup((prev) => {
      const next = { ...prev };
      delete next[grupoId];
      return next;
    });

    localStorage.removeItem(`conversa_grupo_${grupoId}`);

    try {
      const raw = localStorage.getItem("mensagens_last_target");

      if (raw) {
        const ultimoAlvo = JSON.parse(raw);

        if (
          ultimoAlvo?.tipo === "grupo" &&
          ultimoAlvo?.id === grupoId
        ) {
          localStorage.removeItem("mensagens_last_target");
        }
      }
    } catch {
      localStorage.removeItem("mensagens_last_target");
    }

    setGrupoDetalhe((prev) =>
      prev?.id === grupoId ? null : prev
    );

    if (grupoEstavaAberto) {
      socket.emit("leaveGroup", grupoId);

      if (lastGroupRef.current === grupoId) {
        lastGroupRef.current = null;
      }

      setAlvo(null);
      setMensagensGrupo([]);
      setNovaMensagem("");
      setGrupoDetalhe(null);
      setMostrarInfoGrupo(false);
      setModalAdicionarMembrosAberto(false);
      setShowSidebar(true);
    }
  }

  async function sairDoGrupo(grupoId: string) {
    const confirmou = window.confirm(
      "Deseja realmente sair deste grupo?"
    );

    if (!confirmou) return;

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/grupos/${grupoId}/sair`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao sair do grupo");
      }

      removerGrupoDaInterface(grupoId);

      toast.success("Você saiu do grupo.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao sair do grupo");
    }
  }

  async function excluirGrupo(grupo: Grupo) {
    const confirmou = window.confirm(
      `Deseja realmente apagar o grupo "${grupo.nome}"?\n\n` +
        "Todas as mensagens, membros e dados desse grupo serão apagados. " +
        "Essa ação não poderá ser desfeita."
    );

    if (!confirmou) return;

    try {
      setExcluindoGrupoId(grupo.id);

      const res = await fetch(
        `${API.BASE_URL}/api/grupos/${grupo.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao apagar o grupo");
      }

      removerGrupoDaInterface(grupo.id);

      toast.success("Grupo apagado com sucesso.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao apagar o grupo");
    } finally {
      setExcluindoGrupoId(null);
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
      toast.error(err.message || "Erro ao alterar cargo do membro");
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
      toast.error(err.message || "Erro ao remover membro");
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
      toast.error(err.message || "Erro ao adicionar membros");
    }
  }

  async function carregarMensagensPrivadas(
    otherId: string,
    append: boolean,
    limiteInicial?: number
  ) {
    const mySeq = ++fetchPrivSeqRef.current;
    try {
      const base = append ? mensagensPrivadas : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;

      const tamanhoPagina = append
        ? limite
        : limiteInicial ?? limite;

      const query = new URLSearchParams({
        otherId,
        limit: String(tamanhoPagina),
        ...(ultimoId ? { cursor: ultimoId } : {}),
      });

      const res = await fetch(`${API.BASE_URL}/api/mensagem?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      const podeEnviar =
        json?.meta?.permitirMensagens
          !== false;

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

      setDmPermitida(podeEnviar);
      setTemMaisPriv(novas.length >= tamanhoPagina);

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

  async function carregarAtePrimeiraNaoLida(
    tipo: "usuario" | "grupo",
    conversaId: string,
    primeiraId: string
  ): Promise<boolean> {
    buscandoPrimeiraNaoLidaRef.current = true;

    const seq =
      tipo === "usuario"
        ? ++fetchPrivSeqRef.current
        : ++fetchGrupoSeqRef.current;

    try {
      const query = new URLSearchParams({
        limit: "40",
        startAt: primeiraId,
        ...(tipo === "usuario"
          ? { otherId: conversaId }
          : {}),
      });

      const rota =
        tipo === "usuario"
          ? `/api/mensagem?${query.toString()}`
          : `/api/mensagem/grupos/${encodeURIComponent(
              conversaId
            )}?${query.toString()}`;

      const resposta = await fetch(
        `${API.BASE_URL}${rota}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        throw new Error(
          `Falha ao localizar primeira não lida: ${resposta.status}`
        );
      }

      const json = await resposta.json();

      const mensagens: Array<Mensagem | MensagemGrupo> =
        Array.isArray(json?.items)
          ? json.items
          : [];

      const atual = alvoRef.current;

      const conversaAindaAberta =
        tipo === "usuario"
          ? atual?.tipo === "usuario" &&
            atual.usuario.id === conversaId
          : atual?.tipo === "grupo" &&
            atual.grupo.id === conversaId;

      const seqAtual =
        tipo === "usuario"
          ? fetchPrivSeqRef.current
          : fetchGrupoSeqRef.current;

      if (
        !conversaAindaAberta ||
        seqAtual !== seq
      ) {
        return false;
      }

      if (
        !mensagens.some(
          (mensagem) => mensagem.id === primeiraId
        )
      ) {
        throw new Error(
          "Primeira mensagem não lida ausente na janela."
        );
      }

      const ordenadas = [...mensagens].sort(
        (a, b) =>
          new Date(a.criadaEm).getTime() -
            new Date(b.criadaEm).getTime() ||
          a.id.localeCompare(b.id)
      );

      if (tipo === "usuario") {
        setMensagensPrivadas(
          ordenadas as Mensagem[]
        );

        setTemMaisPriv(true);
        setTemMaisNovasPriv(
          json?.hasMoreNewer === true
        );

        setDmPermitida(
          json?.meta?.permitirMensagens !== false
        );
      } else {
        setMensagensGrupo(
          ordenadas as MensagemGrupo[]
        );

        setTemMaisGrupo(true);
        setTemMaisNovasGrupo(
          json?.hasMoreNewer === true
        );
      }

      return true;
    } catch (erro) {
      console.error(
        "[mensagens] Busca direta da primeira não lida:",
        erro
      );

      return false;
    } finally {
      const seqAindaAtual =
        tipo === "usuario"
          ? fetchPrivSeqRef.current === seq
          : fetchGrupoSeqRef.current === seq;

      if (seqAindaAtual) {
        buscandoPrimeiraNaoLidaRef.current = false;
      }
    }
  }

  async function carregarMensagensMaisNovas(
    tipo: "usuario" | "grupo",
    conversaId: string
  ) {
    if (carregandoMaisNovas) return;

    const atual = alvoRef.current;

    const conversaCorreta =
      tipo === "usuario"
        ? atual?.tipo === "usuario" &&
          atual.usuario.id === conversaId
        : atual?.tipo === "grupo" &&
          atual.grupo.id === conversaId;

    if (!conversaCorreta) return;

    const mensagensAtuais =
      tipo === "usuario"
        ? mensagensPrivadas
        : mensagensGrupo;

    const ultima =
      mensagensAtuais[mensagensAtuais.length - 1];

    if (!ultima) return;

    const seq =
      tipo === "usuario"
        ? ++fetchPrivSeqRef.current
        : ++fetchGrupoSeqRef.current;

    setCarregandoMaisNovas(true);

    try {
      const query = new URLSearchParams({
        newerThan: ultima.id,
        limit: "40",
        ...(tipo === "usuario"
          ? { otherId: conversaId }
          : {}),
      });

      const rota =
        tipo === "usuario"
          ? `/api/mensagem?${query.toString()}`
          : `/api/mensagem/grupos/${encodeURIComponent(
              conversaId
            )}?${query.toString()}`;

      const resposta = await fetch(
        `${API.BASE_URL}${rota}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!resposta.ok) {
        throw new Error(
          `Erro ao carregar mensagens recentes: ${resposta.status}`
        );
      }

      const json = await resposta.json();

      const novas: Array<Mensagem | MensagemGrupo> =
        Array.isArray(json?.items)
          ? json.items
          : [];

      const conversa = alvoRef.current;

      const continuaNaConversa =
        tipo === "usuario"
          ? conversa?.tipo === "usuario" &&
            conversa.usuario.id === conversaId
          : conversa?.tipo === "grupo" &&
            conversa.grupo.id === conversaId;

      const sequenciaAtual =
        tipo === "usuario"
          ? fetchPrivSeqRef.current
          : fetchGrupoSeqRef.current;

      if (
        !continuaNaConversa ||
        sequenciaAtual !== seq
      ) {
        return;
      }

      const temMais = json?.hasMoreNewer === true;

      if (tipo === "usuario") {
        setMensagensPrivadas((anteriores) => {
          const mapa = new Map(
            [...anteriores, ...(novas as Mensagem[])].map(
              (mensagem) => [mensagem.id, mensagem]
            )
          );

          return [...mapa.values()].sort(
            (a, b) =>
              new Date(a.criadaEm).getTime() -
                new Date(b.criadaEm).getTime() ||
              a.id.localeCompare(b.id)
          );
        });

        setTemMaisNovasPriv(temMais);
      } else {
        setMensagensGrupo((anteriores) => {
          const mapa = new Map(
            [...anteriores, ...(novas as MensagemGrupo[])].map(
              (mensagem) => [mensagem.id, mensagem]
            )
          );

          return [...mapa.values()].sort(
            (a, b) =>
              new Date(a.criadaEm).getTime() -
                new Date(b.criadaEm).getTime() ||
              a.id.localeCompare(b.id)
          );
        });

        setTemMaisNovasGrupo(temMais);
      }
    } catch (erro) {
      console.error(
        "[mensagens] Erro ao carregar mensagens recentes:",
        erro
      );

      toast.error(
        "Não foi possível carregar mais mensagens."
      );
    } finally {
      setCarregandoMaisNovas(false);
    }
  }

  async function abrirPrivadaComNaoLidas(
    otherId: string
  ) {
    const mapa = await fetchUnreadByUser();

    if (
      alvoRef.current?.tipo !== "usuario" ||
      alvoRef.current.usuario.id !== otherId
    ) {
      return;
    }

    const resumo = mapa?.[otherId];
    const quantidade = resumo?.count ?? 0;
    const primeiraId = resumo?.primeiraId;

    if (mapa && quantidade > 0 && primeiraId) {
      setDivisorPrivadas({
        otherId,
        primeiraId,
        quantidade,
      });

      scrollPendenteRef.current = {
        tipo: "primeira-nao-lida",
        conversa: `u:${otherId}`,
        id: primeiraId,
      };
    } else {
      setDivisorPrivadas(null);

      scrollPendenteRef.current = {
        tipo: "fim",
        conversa: `u:${otherId}`,
      };
    }

    let carregamentoConcluido = true;

    if (mapa && quantidade > 0 && primeiraId) {
      carregamentoConcluido =
        await carregarAtePrimeiraNaoLida(
          "usuario",
          otherId,
          primeiraId
        );
    } else {
      await carregarMensagensPrivadas(
        otherId,
        false,
        20
      );
    }

    if (!carregamentoConcluido) {
      toast.error(
        "Não foi possível localizar todas as mensagens novas. Tente novamente."
      );
      return;
    }

    if (
      alvoRef.current?.tipo !== "usuario" ||
      alvoRef.current.usuario.id !== otherId
    ) {
      return;
    }

    setPrivadaProntaId(otherId);

    if (mapa && quantidade === 0) {
      void markReadFromUser(otherId);
    }
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

  async function carregarMensagensDoGrupo(
    grupoId: string,
    append: boolean,
    limiteInicial?: number
  ) {
    const mySeq = ++fetchGrupoSeqRef.current;

    try {
      const base = append ? mensagensGrupo : [];
      const ultimoId = append && base.length > 0 ? base[0].id : undefined;
      const tamanhoPagina = append
        ? limite
        : limiteInicial ?? limite;

      const query = new URLSearchParams({
        limit: String(tamanhoPagina),
        ...(ultimoId ? { cursor: ultimoId } : {}),
      });

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

      setTemMaisGrupo(novas.length >= tamanhoPagina);

      const novasOrdenadas = [...novas].reverse();
      setMensagensGrupo((prev) => {
        const combined = append
          ? [...novasOrdenadas, ...prev]
          : novasOrdenadas;
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

  async function abrirGrupoComNaoLidas(
    grupoId: string
  ) {
    const mapa = await fetchUnreadByGroup();

    if (
      alvoRef.current?.tipo !== "grupo" ||
      alvoRef.current.grupo.id !== grupoId
    ) {
      return;
    }

    const resumo = mapa[grupoId];
    const quantidade = resumo?.count ?? 0;
    const primeiraId = resumo?.primeiraId;

    if (quantidade > 0 && primeiraId) {
      setDivisorNaoLidas({
        grupoId,
        primeiraId,
        quantidade,
      });

      scrollPendenteRef.current = {
        tipo: "primeira-nao-lida",
        conversa: `g:${grupoId}`,
        id: primeiraId,
      };
    } else {
      setDivisorNaoLidas(null);

      scrollPendenteRef.current = {
        tipo: "fim",
        conversa: `g:${grupoId}`,
      };
    }

    if (quantidade > 0 && primeiraId) {
      const encontrou =
        await carregarAtePrimeiraNaoLida(
          "grupo",
          grupoId,
          primeiraId
        );

      if (!encontrou) {
        toast.error(
          "Não foi possível localizar a primeira mensagem não lida deste grupo."
        );
      }

      return;
    }

    await carregarMensagensDoGrupo(
      grupoId,
      false,
      20
    );
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

  const handleScroll = async (
    e: React.UIEvent<HTMLDivElement>
  ) => {
    const caixa = e.currentTarget;

    if (buscandoPrimeiraNaoLidaRef.current) {
      return;
    }

    if (caixa.scrollTop >= 50 || !alvo) {
      return;
    }

    if (
      alvo.tipo === "usuario" &&
      temMaisPriv &&
      !carregandoMaisPriv
    ) {
      const otherId = alvo.usuario.id;

      const alturaAnterior = caixa.scrollHeight;
      const posicaoAnterior = caixa.scrollTop;

      setCarregandoMaisPriv(true);

      try {
        await carregarMensagensPrivadas(otherId, true);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (
              alvoRef.current?.tipo !== "usuario" ||
              alvoRef.current.usuario.id !== otherId
            ) {
              return;
            }

            caixa.scrollTop =
              posicaoAnterior +
              caixa.scrollHeight -
              alturaAnterior;
          });
        });
      } finally {
        setCarregandoMaisPriv(false);
      }

      return;
    }

    if (
      alvo.tipo === "grupo" &&
      temMaisGrupo &&
      !carregandoMaisGrupo
    ) {
      const grupoId = alvo.grupo.id;

      const alturaAnterior = caixa.scrollHeight;
      const posicaoAnterior = caixa.scrollTop;

      setCarregandoMaisGrupo(true);

      try {
        await carregarMensagensDoGrupo(grupoId, true);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (
              alvoRef.current?.tipo !== "grupo" ||
              alvoRef.current.grupo.id !== grupoId
            ) {
              return;
            }

            caixa.scrollTop =
              posicaoAnterior +
              caixa.scrollHeight -
              alturaAnterior;
          });
        });
      } finally {
        setCarregandoMaisGrupo(false);
      }
    }
  };

  useEffect(() => {
    const contenedor = scrollMensagensRef.current;
    const pendente = scrollPendenteRef.current;

    if (!contenedor || !pendente || !alvo) return;

    const conversaAtual =
      alvo.tipo === "grupo"
        ? `g:${alvo.grupo.id}`
        : `u:${alvo.usuario.id}`;

    if (pendente.conversa !== conversaAtual) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const caixa = scrollMensagensRef.current;
      if (!caixa) return;

      if (pendente.tipo === "fim") {
        caixa.scrollTop = caixa.scrollHeight;
        scrollPendenteRef.current = null;
        return;
      }

      const divisor = caixa.querySelector(
        `[data-primeira-nao-lida="${pendente.id}"]`
      ) as HTMLElement | null;

      if (!divisor) {
        return;
      }

      const top =
        divisor.getBoundingClientRect().top -
        caixa.getBoundingClientRect().top +
        caixa.scrollTop;

      caixa.scrollTop = Math.max(0, top - 12);
      scrollPendenteRef.current = null;
    });

    return () => cancelAnimationFrame(frame);
  }, [
    alvo,
    mensagensGrupo,
    mensagensPrivadas,
    divisorNaoLidas,
    divisorPrivadas,
  ]);

  useEffect(() => {
    if (
      !divisorNaoLidas ||
      temMaisNovasGrupo ||
      alvo?.tipo !== "grupo" ||
      alvo.grupo.id !== divisorNaoLidas.grupoId
    ) {
      return;
    }

    const primeiraCarregada = mensagensGrupo.some(
      (mensagem) =>
        mensagem.id === divisorNaoLidas.primeiraId
    );

    if (!primeiraCarregada) {
      return;
    }

    const timer = window.setTimeout(() => {
      const atual = alvoRef.current;

      if (
        atual?.tipo !== "grupo" ||
        atual.grupo.id !== divisorNaoLidas.grupoId ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      const caixa = scrollMensagensRef.current;

      const divisor = caixa?.querySelector(
        `[data-primeira-nao-lida="${divisorNaoLidas.primeiraId}"]`
      ) as HTMLElement | null;

      if (!caixa || !divisor) {
        return;
      }

      const area = caixa.getBoundingClientRect();
      const posicao = divisor.getBoundingClientRect();

      const divisorVisivel =
        posicao.bottom > area.top &&
        posicao.top < area.bottom;

      if (!divisorVisivel) {
        return;
      }

      void (async () => {
        const sucesso = await markReadFromGroup(
          divisorNaoLidas.grupoId
        );

        if (!sucesso) {
          return;
        }

        const conversaAtual = alvoRef.current;

        if (
          conversaAtual?.tipo !== "grupo" ||
          conversaAtual.grupo.id !== divisorNaoLidas.grupoId
        ) {
          return;
        }

        setDivisorNaoLidas(null);
        await fetchUnreadByGroup();
      })();
    }, 2000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    divisorNaoLidas,
    temMaisNovasGrupo,
    mensagensGrupo,
    alvo,
  ]);

  useEffect(() => {
    if (
      alvo?.tipo !== "grupo" ||
      divisorNaoLidas ||
      !mensagensGrupo.length ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    const ultimaMensagem =
      mensagensGrupo[mensagensGrupo.length - 1];

    if (ultimaMensagem.usuarioId === usuarioId) {
      return;
    }

    const caixa = scrollMensagensRef.current;

    if (!caixa) return;

    const distanciaDoFim =
      caixa.scrollHeight -
      caixa.scrollTop -
      caixa.clientHeight;

    if (distanciaDoFim > 120) {
      return;
    }

    const grupoId = alvo.grupo.id;

    const timer = window.setTimeout(() => {
      const atual = alvoRef.current;

      if (
        atual?.tipo === "grupo" &&
        atual.grupo.id === grupoId &&
        document.visibilityState === "visible"
      ) {
        void markReadFromGroup(grupoId).then(
          (sucesso) => {
            if (sucesso) {
              void fetchUnreadByGroup();
            }
          }
        );
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    alvo,
    mensagensGrupo,
    divisorNaoLidas,
    usuarioId,
  ]);

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !alvo) return;
    if (
      alvo.tipo === "usuario" &&
      !dmPermitida
    ) {
      toast.error(
        "Este usuário desativou mensagens diretas."
      );

      return;
    }
    if (!usuarioId) { toast.error("Sessão expirada. Faça login novamente."); return; }

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
      scrollPendenteRef.current = {
        tipo: "fim",
        conversa: `u:${alvo.usuario.id}`,
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
          const saved: Mensagem =
            await resp.json();

          reconcilePrivadaByClientId(
            saved
          );
        } else {
          const errorData =
            await resp
              .json()
              .catch(() => ({}));

          console.error(
            "POST /api/mensagem falhou:",
            resp.status,
            errorData
          );

          if (
            resp.status === 403 &&
            (
              errorData?.code ===
                "DM_DISABLED" ||
              String(
                errorData?.error || ""
              ).includes(
                "desativou mensagens"
              )
            )
          ) {
            setDmPermitida(false);

            setMensagensPrivadas(
              (prev) =>
                prev.filter(
                  (m) =>
                    m.clientMsgId !==
                    clientMsgId
                )
            );

            toast.error(
              "Este usuário desativou mensagens diretas."
            );

            return;
          }

          setMensagensPrivadas(
            (prev) =>
              prev.map((m) =>
                m.clientMsgId ===
                clientMsgId
                  ? {
                      ...m,
                      pending: false,
                    }
                  : m
              )
          );

          toast.error(
            errorData?.error ||
              "Não foi possível enviar a mensagem agora."
          );
        }
      } catch (e) {
        console.error("POST /api/mensagem erro:", e);
        setMensagensPrivadas(prev =>
          prev.map(m =>
            m.clientMsgId === clientMsgId ? { ...m, pending: false } : m
          )
        );
        toast.error("Não foi possível enviar a mensagem agora.");
      }
      setNovaMensagem("");
    } else {
      const clientMsgId = genClientId();

      const meuMembroNoGrupo = grupoDetalhe?.membros.find(
        (membro) => membro.id === usuarioId
      );

      const otm: MensagemGrupo = {
        id: clientMsgId,
        clientMsgId,
        pending: true,
        criadaEm: new Date().toISOString(),
        conteudo: novaMensagem,
        grupoId: alvo.grupo.id,
        usuarioId: usuarioId!,
        tipo: "NORMAL",
        usuario: {
          id: usuarioId!,
          nome: meuMembroNoGrupo?.nome ?? "Você",
          foto: meuMembroNoGrupo?.foto ?? null,
        },
      };
      scrollPendenteRef.current = {
        tipo: "fim",
        conversa: `g:${alvo.grupo.id}`,
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
      toast.error("Não foi possível apagar a mensagem.");
    }
  };

  const renderizarMensagemGrupoWhats = (msg: MensagemGrupo) => {
    const isMine = msg.usuarioId === usuarioId;

    const membroDoGrupo = grupoDetalhe?.membros.find(
      (membro) => membro.id === msg.usuarioId
    );

    const nomeRemetente =
      msg.usuario?.nome?.trim() ||
      membroDoGrupo?.nome?.trim() ||
      (isMine ? "Você" : "Usuário FootEra");

    const fotoRemetente =
      msg.usuario?.foto ??
      membroDoGrupo?.foto ??
      null;

    const bubble = isMine
      ? "bg-green-900 text-white rounded-2xl rounded-tr-none"
      : "bg-[#E8ECF7] text-[#0F172A] rounded-2xl rounded-tl-none";

    const horarioClass = isMine
      ? "text-[11px] text-gray-500 text-right mt-1"
      : "text-[11px] text-gray-500 mt-1";

    const Shell = (children: React.ReactNode): JSX.Element => (
      <div
        className={`w-full flex ${
          isMine ? "justify-end" : "justify-start"
        }`}
      >
        <div
          className={`flex items-start gap-2 max-w-[85%] ${
            isMine ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <button
            type="button"
            onClick={() => navigate(`/perfil/${msg.usuarioId}`)}
            className="shrink-0 mt-5 rounded-full"
            title={`Ver perfil de ${nomeRemetente}`}
            aria-label={`Ver perfil de ${nomeRemetente}`}
          >
            <Avatar
              src={fotoRemetente}
              name={nomeRemetente}
              className="w-9 h-9"
            />
          </button>

          <div
            className={`min-w-0 flex flex-col ${
              isMine ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`mb-1 px-1 text-[12px] font-semibold truncate max-w-full ${
                isMine ? "text-green-900 text-right" : "text-gray-700"
              }`}
            >
              {nomeRemetente}
            </div>

            <div
              className={`${bubble} max-w-full px-3 py-2 shadow-sm relative`}
            >
              {children}

              {isMine && (
                <button
                  type="button"
                  onClick={() => deletarMensagem(msg.id)}
                  className="
                    absolute -top-2 -right-2
                    bg-white/90 text-gray-700
                    hover:text-red-600
                    p-1 rounded-full shadow
                  "
                  title="Apagar mensagem"
                  aria-label="Apagar mensagem"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>
            <div className={horarioClass}>
              {new Date(msg.criadaEm).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>
    );

    if (msg.tipo === "AUDIO") {
      return Shell(
        <AudioMensagem
          id={msg.id}
          grupoId={msg.grupoId}
          token={token}
          duracaoMs={msg.audioDuracaoMs}
        />
      );
    }

    if (
      !FLAGS.DESAFIOS_ENABLED &&
      (
        msg.tipo === "GRUPO_DESAFIO" ||
        msg.tipo === "GRUPO_DESAFIO_BONUS"
      )
    ) {
      return Shell(
        <p className="text-sm opacity-80">
          Conteúdo de desafio está temporariamente indisponível.
        </p>
      );
    }

    if (
      msg.tipo === "GRUPO_DESAFIO" ||
      msg.tipo === "GRUPO_DESAFIO_BONUS" ||
      msg.tipo === "DESAFIO" ||
      msg.tipo === "POST" ||
      msg.tipo === "USUARIO"
    ) {
      return Shell(
        <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
          <MensagemItemGrupo msg={msg} meId={usuarioId} />
        </div>
      );
    }

    if (
      typeof msg.conteudo === "string" &&
      msg.conteudo.includes("[CONVOCACAO_EVENTO:")
    ) {
      const parsed = parseConvocacaoEvento(msg.conteudo);

      if (parsed?.link) {
        return Shell(
          <div
            onClick={() => navigate(parsed.link!)}
            className="
              cursor-pointer bg-white/90 border border-green-700
              rounded-xl p-3 flex flex-col gap-2
              hover:bg-green-50
            "
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

            <button
              type="button"
              className="mt-1 text-xs px-3 py-1 bg-green-800 text-white rounded-lg self-start"
            >
              Ver evento
            </button>

            <p className="text-[12px] text-gray-600 whitespace-pre-wrap break-words">
              {stripConvocacaoTag(parsed.raw)
                .replace(
                  /🔗\s*Link:\s*\/eventos\/[^\s]+/i,
                  ""
                )
                .trim()}
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

    return Shell(
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {msg.conteudo}
      </p>
    );
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

    if (msg.tipo === "AUDIO") {
      return Shell(
        <AudioMensagem
          id={msg.id}
          token={token}
          duracaoMs={msg.audioDuracaoMs}
        />
      );
    }

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

        const autorNome =
          post.organizacao?.nome ||
          post.usuario?.nome ||
          "Usuário";

        const autorFoto =
          post.organizacao
            ? null
            : post.usuario?.foto;

        const img = post.imagemUrl ? publicImgUrl(post.imagemUrl) : null;
        const video = !img && post.videoUrl ? publicImgUrl(post.videoUrl) : null;

        return Shell(
          <div onClick={() => navigate(`/post/${post.id}`)} className="cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <Avatar
                src={autorFoto}
                name={autorNome}
                className="w-8 h-8"
              />

              <div>
                <span className="text-sm font-semibold">
                  {autorNome}
                </span>

                {post.organizacao && (
                  <div className="text-[10px] font-semibold text-green-700">
                    Organização
                  </div>
                )}
              </div>
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
      <div className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-transparent">
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

        <main
          className={`flex-1 min-h-0 flex flex-col ${
            temSeletorContexto ? "pb-[108px]" : "pb-[52px]"
          }`}
        >
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
                          <Avatar
                            src={membro.foto}
                            name={membro.nome}
                            className="w-10 h-10"
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
            className="
              flex-1
              min-h-0
              min-w-0
              overflow-y-auto
              overscroll-contain
              px-3
              pl-3
              pr-4
              sm:pl-4
              sm:pr-5
              pt-4
              pb-6
              [scrollbar-gutter:stable]
            "
            onScroll={handleScroll}
            ref={scrollMensagensRef}
          >
            <div
            key={alvo ? (alvo.tipo === "usuario" ? `u-${alvo.usuario.id}` : `g-${alvo.grupo.id}`) : "none"}
            className="mx-auto w-full sm:max-w-3xl space-y-3"
          >
            {alvo ? (
              <>
                {alvo.tipo === "usuario" &&
                  diasPrivados.map((dia) => (
                    <section key={`priv-dia-${dia.chave}`} className="space-y-3">
                      <div
                        className="sticky top-2 z-20 my-3 flex justify-center pointer-events-none"
                        data-dia-chat={dia.chave}
                      >
                        <span className="rounded-full bg-white/95 px-4 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 backdrop-blur-sm">
                          {dia.titulo}
                        </span>
                      </div>
                      {dia.mensagens.map((m) => {
                        const mostrarDivisor =
                          divisorPrivadas?.otherId === alvo.usuario.id &&
                          divisorPrivadas.primeiraId === m.id;

                        return (
                          <div key={m.id} data-mensagem-id={m.id}>
                            {mostrarDivisor && (
                              <div
                                data-primeira-nao-lida={m.id}
                                className="my-4 flex justify-center scroll-mt-12"
                              >
                                <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-green-900 shadow-sm ring-1 ring-green-100">
                                  {divisorPrivadas.quantidade}{" "}
                                  {divisorPrivadas.quantidade === 1
                                    ? "mensagem não lida"
                                    : "mensagens não lidas"}
                                </span>
                              </div>
                            )}
                            {renderizarMensagemPrivadaWhats(m)}
                          </div>
                        );
                      })}
                    </section>
                  ))}

                {alvo.tipo === "grupo" &&
                  diasGrupo.map((dia) => (
                    <section key={`grupo-dia-${dia.chave}`} className="space-y-3">
                      <div
                        className="sticky top-2 z-20 my-3 flex justify-center pointer-events-none"
                        data-dia-chat={dia.chave}
                      >
                        <span className="rounded-full bg-white/95 px-4 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 backdrop-blur-sm">
                          {dia.titulo}
                        </span>
                      </div>
                      {dia.mensagens.map((m) => {
                        const mostrarDivisor =
                          divisorNaoLidas?.grupoId === alvo.grupo.id &&
                          divisorNaoLidas.primeiraId === m.id;

                        return (
                          <div key={m.id} data-mensagem-id={m.id}>
                            {mostrarDivisor && (
                              <div
                                data-primeira-nao-lida={m.id}
                                className="my-4 flex justify-center scroll-mt-12"
                              >
                                <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-green-900 shadow-sm ring-1 ring-green-100">
                                  {divisorNaoLidas.quantidade}{" "}
                                  {divisorNaoLidas.quantidade === 1
                                    ? "mensagem não lida"
                                    : "mensagens não lidas"}
                                </span>
                              </div>
                            )}
                            {renderizarMensagemGrupoWhats(m)}
                          </div>
                        );
                      })}
                    </section>
                  ))}

                  {alvo?.tipo === "usuario" &&
                    temMaisNovasPriv && (
                      <button
                        type="button"
                        disabled={carregandoMaisNovas}
                        onClick={() =>
                          void carregarMensagensMaisNovas(
                            "usuario",
                            alvo.usuario.id
                          )
                        }
                        className="mx-auto block rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
                      >
                        {carregandoMaisNovas
                          ? "Carregando..."
                          : "Carregar mensagens mais recentes"}
                      </button>
                    )}

                  {alvo?.tipo === "grupo" &&
                    temMaisNovasGrupo && (
                      <button
                        type="button"
                        disabled={carregandoMaisNovas}
                        onClick={() =>
                          void carregarMensagensMaisNovas(
                            "grupo",
                            alvo.grupo.id
                          )
                        }
                        className="mx-auto block rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 disabled:opacity-50"
                      >
                        {carregandoMaisNovas
                          ? "Carregando..."
                          : "Carregar mensagens mais recentes"}
                      </button>
                    )}

                    {alvo?.tipo === "usuario" &&
                      divisorPrivadas?.otherId === alvo.usuario.id &&
                      !temMaisNovasPriv && (
                        <button
                          type="button"
                          className="mx-auto block rounded-lg border px-4 py-2 text-xs text-gray-600"
                          onClick={async () => {
                            const otherId = alvo.usuario.id;
                            const ok = await markReadFromUser(otherId);

                            if (ok) {
                              setDivisorPrivadas(null);
                              await fetchUnreadByUser();
                            }
                          }}
                        >
                          Marcar conversa como lida
                        </button>
                      )}

                    {alvo?.tipo === "grupo" &&
                      divisorNaoLidas?.grupoId === alvo.grupo.id &&
                      !temMaisNovasGrupo && (
                        <button
                          type="button"
                          className="mx-auto block rounded-lg border px-4 py-2 text-xs text-gray-600"
                          onClick={async () => {
                            const grupoId = alvo.grupo.id;
                            const ok = await markReadFromGroup(grupoId);

                            if (ok) {
                              setDivisorNaoLidas(null);
                              await fetchUnreadByGroup();
                            }
                          }}
                        >
                          Marcar grupo como lido
                        </button>
                      )}

                {(carregandoMaisPriv || carregandoMaisGrupo) && (
                  <p className="text-center text-sm text-gray-400">Carregando mais...</p>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-gray-500">Selecione uma conversa para começar</p>
            )}
          </div>
          </div>

          <div
            className="
              relative
              z-10
              shrink-0
              bg-white
              border-t
              border-green-100
            "
          >
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
                disabled={
                  alvo?.tipo === "usuario" &&
                  !dmPermitida
                }

                placeholder={
                  alvo?.tipo === "usuario" &&
                  !dmPermitida
                    ? "Este usuário desativou mensagens diretas."
                    : "Digite sua mensagem..."
                }
              />
              <GravadorAudio
                key={
                  alvo?.tipo === "usuario"
                    ? `u:${alvo.usuario.id}`
                    : alvo?.tipo === "grupo"
                      ? `g:${alvo.grupo.id}`
                      : "sem-alvo"
                }
                disabled={
                  !alvo ||
                  (alvo.tipo === "usuario" && !dmPermitida)
                }
                onGravado={async (blob, duracaoMs) => {
                  const destino = alvoRef.current;

                  if (!destino || !usuarioId || !token) {
                    throw new Error(
                      "Sessão ou conversa indisponível."
                    );
                  }

                  if (
                    destino.tipo === "usuario" &&
                    !dmPermitida
                  ) {
                    throw new Error(
                      "Mensagens diretas desativadas."
                    );
                  }

                  const arquivo = new FormData();

                  const mime = blob.type.toLowerCase();

                  const extensao = mime.includes("mp4")
                    ? "m4a"
                    : mime.includes("ogg")
                      ? "ogg"
                      : "webm";

                  arquivo.append(
                    "audio",
                    blob,
                    `voz.${extensao}`
                  );

                  arquivo.append(
                    "audioDuracaoMs",
                    String(duracaoMs)
                  );

                  if (destino.tipo === "usuario") {
                    arquivo.append(
                      "paraId",
                      destino.usuario.id
                    );
                  }

                  const url =
                    destino.tipo === "usuario"
                      ? `${API.BASE_URL}/api/mensagem/audio`
                      : `${API.BASE_URL}/api/mensagem/grupos/${encodeURIComponent(
                          destino.grupo.id
                        )}/audio`;

                  const resposta = await fetch(url, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                    body: arquivo,
                  });

                  if (!resposta.ok) {
                    const dados = await resposta
                      .json()
                      .catch(() => null);

                    throw new Error(
                      dados?.error ||
                      dados?.code ||
                      `Falha no áudio (${resposta.status}).`
                    );
                  }

                  if (destino.tipo === "usuario") {
                    setLastMsgByUser((prev) => ({
                      ...prev,
                      [destino.usuario.id]:
                        "🎤 Mensagem de voz",
                    }));

                    scrollPendenteRef.current = {
                      tipo: "fim",
                      conversa: `u:${destino.usuario.id}`,
                    };

                    await carregarMensagensPrivadas(
                      destino.usuario.id,
                      false
                    );
                  } else {
                    setLastMsgByGroup((prev) => ({
                      ...prev,
                      [destino.grupo.id]:
                        "🎤 Mensagem de voz",
                    }));

                    scrollPendenteRef.current = {
                      tipo: "fim",
                      conversa: `g:${destino.grupo.id}`,
                    };

                    await carregarMensagensDoGrupo(
                      destino.grupo.id,
                      false
                    );
                  }
                }}
              />
              <button
                onClick={enviarMensagem}
                disabled={
                  alvo?.tipo === "usuario" &&
                  !dmPermitida
                }
                className={`
                  shrink-0
                  bg-green-900
                  text-white
                  p-3
                  rounded-xl
                  hover:opacity-95
                  active:opacity-90

                  ${
                    alvo?.tipo === "usuario" &&
                    !dmPermitida
                      ? "opacity-40 cursor-not-allowed"
                      : ""
                  }
                `}
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

      <ModalGrupos
        aberto={modalAberto}
        onFechar={fecharModal}
        usuarioId={usuarioId ?? ""}
        token={token}
        onGrupoCriado={(novoGrupo) => {
          setGrupos((prev) => [
            novoGrupo,
            ...prev.filter(
              (grupo) => grupo.id !== novoGrupo.id
            ),
          ]);

          setLastMsgByGroup((prev) => ({
            ...prev,
            [novoGrupo.id]: "",
          }));

          setLastMsgAtByGroup((prev) => ({
            ...prev,
            [novoGrupo.id]: Date.now(),
          }));

          setSearchTerm("");
        }}
      />
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
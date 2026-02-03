// client/src/components/profile/ProfileHeader
import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Users,
  Settings,
  Edit,
  Bell,
  Mail,
  CircleX,
  CircleCheck,
  Send,
  Eye,
  UserPlus,
  Share2,
} from "lucide-react";
import { Button } from "../ui/button.js";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { formatarUrlFoto } from "@/utils/formatarFoto.js";
import ScoreDeltaBadge from "./ScoreDeltaBadge.js";

interface Usuario {
  id: string;
  nome: string;
  foto?: string | null;
}

type Kpi = { label: string; value: number };

interface ProfileHeaderProps {
  nome: string;
  idade?: number;
  posicao?: string;
  time?: string;
  pontuacao?: number;
  scoreDelta?: number;
  scoreTitle?: string;
  kpis?: Kpi[];
  avatar?: string | null;
  foto?: string | null;
  isOwnProfile?: boolean;
  perfilId: string;
  perfilTipoProp?: string | null;
  perfilTipoIdProp?: string | null;
  conquistasCount?: number;
}

function pickAtletaId(payload: any, perfilId: string): string | null {
  return (
    payload?.atleta?.id ??
    payload?.atletaId ??
    payload?.tipoUsuarioId ??
    payload?.usuario?.tipoUsuarioId ??
    payload?.usuario?.atletaId ??
    null
  );
}

function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full leading-none flex items-center justify-center shadow">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function normalizeTipo(t: any): string {
  const raw = String(t ?? "")
    .trim()
    .toLowerCase();

  // remove acentos
  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // pega só a primeira “palavra” (ex.: "Professor Pro" -> "professor")
  const first = noAccents.split(/\s+/)[0] || "";

  // mapeia variações comuns
  if (first === "escola") return "escolinha";
  if (first === "coach") return "professor";

  return first;
}

const FALLBACK_AVATAR = "/assets/usuarios/footera-logo-fundo-verde.png";

const ONLINE_TTL_MS = 45_000; // tem que bater com o server/socket.ts

function timeAgoPtBR(dateLike?: string | Date | null): string {
  if (!dateLike) return "há algum tempo";

  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  const t = d.getTime();
  if (!t || Number.isNaN(t)) return "há algum tempo";

  const diff = Date.now() - t;

  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "agora";
  if (sec < 60) return `há ${sec}s`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;

  const day = Math.floor(hr / 24);
  if (day < 30) return `há ${day}d`;

  const mo = Math.floor(day / 30);
  if (mo < 12) return `há ${mo} mês${mo > 1 ? "es" : ""}`;

  const yr = Math.floor(mo / 12);
  return `há ${yr} ano${yr > 1 ? "s" : ""}`;
}

function computeOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false;
  const ms = new Date(lastSeenAt).getTime();
  if (!ms || Number.isNaN(ms)) return false;
  return Date.now() - ms <= ONLINE_TTL_MS;
}

export default function ProfileHeader({
  perfilId,
  nome,
  idade,
  posicao,
  time,
  pontuacao = 0,
  scoreTitle = "Pontuação FootEra",
  kpis,
  avatar,
  foto,
  isOwnProfile = false,
  scoreDelta,
  perfilTipoProp = null,
  perfilTipoIdProp = null,
  conquistasCount = 0,
}: ProfileHeaderProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [pontosTotal, setPontosTotal] = useState<number>(pontuacao ?? 0);
  const [ehFavorito, setEhFavorito] = useState(false);
  const [seguindo, setSeguindo] = useState<boolean | null>(null);
  const [treinoJunto, setTreinoJunto] = useState<boolean>(false);
  const [souSolicitanteTreino, setSouSolicitanteTreino] = useState<boolean | null>(null);
  const [temVinculoTreino, setTemVinculoTreino] = useState(false);
  const [observando, setObservando] = useState<boolean | null>(null);
  const [unreadDM, setUnreadDM] = useState<number>(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [alvoAtletaId, setAlvoAtletaId] = useState<string | null>(null);
  const [carregandoObs, setCarregandoObs] = useState(false);
  const [podeObservar, setPodeObservar] = useState(false);
  const [perfilTipo, setPerfilTipo] = useState<string | null>(perfilTipoProp ?? null);
  const [perfilTipoId, setPerfilTipoId] = useState<string | null>(perfilTipoIdProp ?? null);
  const [checouVinculo, setChecouVinculo] = useState(false);
  const [presenceOnline, setPresenceOnline] = useState<boolean | null>(null);
  const [presenceLastSeenAt, setPresenceLastSeenAt] = useState<string | null>(null);
  const [presencePrivacyBlocked, setPresencePrivacyBlocked] = useState<boolean>(false);
  const [isMutuoFollow, setIsMutuoFollow] = useState<boolean>(false);
  const [checouMutuoFollow, setChecouMutuoFollow] = useState<boolean>(false);
  
  const viewerTipo =
    (Storage as any).tipoSalvo ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";

  // -------------------- REGRA GLOBAL DO VÍNCULO (reutilizável) --------------------
  const viewerTipoNorm = normalizeTipo(viewerTipo);
  const alvoTipoNormGlobal = normalizeTipo(perfilTipo || perfilTipoProp);

  const tiposComVinculo = new Set(["atleta", "professor", "clube", "escolinha"]);

  const viewerPodeVinculo = tiposComVinculo.has(viewerTipoNorm);
  const alvoPodeVinculo = tiposComVinculo.has(alvoTipoNormGlobal);

  // ❌ Regra: Atleta NÃO pode vínculo com Atleta
  const atletaComAtleta =
    viewerTipoNorm === "atleta" && alvoTipoNormGlobal === "atleta";

  const podeChecarVinculo =
    viewerPodeVinculo && alvoPodeVinculo && !atletaComAtleta;


  // -------------------------------------------------------------------------------


  const viewerCanObserve = /olheiro|professor|clube|escolinha/i.test(String(viewerTipo));
  const obsKey = Storage.usuarioId && alvoAtletaId ? `obs_${Storage.usuarioId}_${alvoAtletaId}` : null;
    const meId = String(
    Storage.usuarioId ||
    localStorage.getItem("usuarioId") ||
    sessionStorage.getItem("usuarioId") ||
    ""
  ).trim();

  const isMe = meId && String(perfilId || "").trim() === meId;
  const storageKey = meId ? `tj_${meId}_${perfilId}` : `tj_${perfilId}`;
  const [confirmBox, setConfirmBox] = useState<{
    open: boolean;
    text: string;
    onYes: () => Promise<void> | void;
  } | null>(null);

  const podeVerPresenca =
  isOwnProfile || isMe || temVinculoTreino || isMutuoFollow;

  useEffect(() => {
    const token =
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const usuarioAlvoId = String(perfilId || "").trim();
    if (!token || !usuarioAlvoId) return;

    // ✅ se ainda não checou vínculos, espera
    if (!isOwnProfile && !isMe) {
      const aguardando = (!checouVinculo) || (!checouMutuoFollow);
      if (aguardando) return;

      // ✅ se não pode ver, zera e não chama API
      if (!podeVerPresenca) {
        setPresenceOnline(null);
        setPresenceLastSeenAt(null);
        setPresencePrivacyBlocked(true); // força esconder
        return;
      }
    }

    let alive = true;

    async function loadPresence() {
      try {
        const r = await fetch(
          `${API.BASE_URL}/api/presenca/${encodeURIComponent(usuarioAlvoId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!r.ok) return;

        const data = await r.json().catch(() => null as any);
        if (!alive || !data) return;

        const blocked = Boolean(data?.privacyBlocked);
        setPresencePrivacyBlocked(blocked);

        if (blocked) {
          setPresenceOnline(null);
          setPresenceLastSeenAt(null);
          return;
        }

        setPresenceOnline(Boolean(data?.isOnline));
        setPresenceLastSeenAt(
          data?.lastSeenAt ? new Date(data.lastSeenAt).toISOString() : null
        );
      } catch {}
    }

    loadPresence();
    const interval = setInterval(loadPresence, 20_000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [
    perfilId,
    isOwnProfile,
    isMe,
    podeVerPresenca,
    checouVinculo,
    checouMutuoFollow,
  ]);

  useEffect(() => {
    const onBadge = (e: Event) => {
      const d: any = (e as CustomEvent<any>).detail;

      const total =
        typeof d === "number"
          ? d
          : Number(d?.totalNotificacoes ?? d?.total ?? 0) || 0;

      setBadgeCount(total);
    };

    window.addEventListener("badge:update", onBadge as EventListener);
    return () => window.removeEventListener("badge:update", onBadge as EventListener);
  }, []);

  useEffect(() => {
    setPerfilTipo(perfilTipoProp ?? null);
  }, [perfilTipoProp]);

  useEffect(() => {
    setPerfilTipoId(perfilTipoIdProp ?? null);
  }, [perfilTipoIdProp]);

  useEffect(() => {
    if (isOwnProfile || !perfilId) {
      setPodeObservar(false);
      setAlvoAtletaId(null);
      setPerfilTipo(null);
      setPerfilTipoId(null);
      return;
    }

    if (perfilTipoIdProp || perfilTipoProp) {
      const tipoStr = String(perfilTipoProp || "").toLowerCase();

      setPerfilTipo(tipoStr || null);
      setPerfilTipoId(perfilTipoIdProp ?? null);

      const atletaIdGuess =
        tipoStr === "atleta" ? String(perfilTipoIdProp || "") : "";

      setAlvoAtletaId(atletaIdGuess ? atletaIdGuess : null);
      setPodeObservar(viewerCanObserve && tipoStr === "atleta");

      return;
    }

    const token = Storage.token;
    if (!token) return;

    fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(perfilId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;

        const id = pickAtletaId(data, perfilId);
        const tipoStr = (data?.tipo || data?.tipoUsuario || "").toString().toLowerCase();

        setPodeObservar(viewerCanObserve && tipoStr === "atleta");
        setAlvoAtletaId(id ?? null);
        setPerfilTipo(tipoStr || null);

        const tipoId =
          data?.tipoUsuarioId ??
          data?.professorId ??
          data?.clubeId ??
          data?.escolinhaId ??
          data?.atleta?.id ??
          data?.professor?.id ??
          data?.clube?.id ??
          data?.escolinha?.id ??
          data?.ownerId ??
          data?.id ??
          null;

        setPerfilTipoId(tipoId);
      })
      .catch(() => {
        setPodeObservar(false);
        setAlvoAtletaId(null);
        setPerfilTipo(null);
        setPerfilTipoId(null);
      });
  }, [perfilId, isOwnProfile, perfilTipoIdProp, perfilTipoProp]);

  useEffect(() => {
    setChecouVinculo(false);
  }, [perfilId]);

  useEffect(() => {
    setPresenceOnline(null);
    setPresenceLastSeenAt(null);
    setPresencePrivacyBlocked(false);
  }, [perfilId]);

  useEffect(() => {
    if (isOwnProfile || isMe) {
      setIsMutuoFollow(true);
      setChecouMutuoFollow(true);
      return;
  }

  const token =
    Storage.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const alvoId = String(perfilId || "").trim();
  if (!token || !alvoId) return;

  let alive = true;
  setChecouMutuoFollow(false);

  (async () => {
    try {
      const r = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!alive) return;

      const arr = r.ok ? await r.json().catch(() => []) : [];
      const ids = (Array.isArray(arr) ? arr : [])
        .map((x: any) => String(x?.id ?? x?.usuarioId ?? x).trim())
        .filter(Boolean);

      setIsMutuoFollow(ids.includes(alvoId));
      setChecouMutuoFollow(true);
    } catch {
      if (!alive) return;
      setIsMutuoFollow(false);
      setChecouMutuoFollow(true);
    }
  })();

  return () => {
    alive = false;
  };
}, [perfilId, isOwnProfile, isMe]);

useEffect(() => {
  if (isOwnProfile || isMe) return;

  const token =
    Storage.token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const usuarioAlvoId = String(perfilId || "").trim();

  if (!token || !usuarioAlvoId) return;

  // sempre reseta ao trocar de perfil / regras
  setChecouVinculo(false);
  setTemVinculoTreino(false);

  // espera os tipos existirem
  if (!alvoTipoNormGlobal || !viewerTipoNorm) return;

  // se não pode checar (regra), finaliza carregamento
  if (!podeChecarVinculo) {
    setTemVinculoTreino(false);
    setChecouVinculo(true);
    return;
  }

  let alive = true;

  (async () => {
    try {
      const qs = new URLSearchParams({ usuarioAlvoId }).toString();
      const url = `${API.BASE_URL}/api/solicitacoes-treino/vinculo?${qs}`;

      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!alive) return;

      if (!resp.ok) {
        setTemVinculoTreino(false);
        setChecouVinculo(true);
        return;
      }

      const body = await resp.json().catch(() => null as any);

      const vinculo = Boolean(
        body?.vinculo === true || body?.relacao || body?.relacaoId
      );

      setTemVinculoTreino(vinculo);
      setChecouVinculo(true);
    } catch {
      if (!alive) return;
      setTemVinculoTreino(false);
      setChecouVinculo(true);
    }
  })();

  return () => {
    alive = false;
  };
}, [
  perfilId,
  isOwnProfile,
  isMe,
  viewerTipoNorm,
  alvoTipoNormGlobal,
  podeChecarVinculo,
]);

  useEffect(() => {
    if (!isOwnProfile) return;

    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/mensagem/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          const count = typeof j === "number" ? j : j?.count ?? 0;
          setUnreadDM(count);
          return;
        }
      } catch {}

      try {
        const r = await fetch(`${API.BASE_URL}/api/mensagem/unread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const arr = await r.json();
          setUnreadDM(Array.isArray(arr) ? arr.length : 0);
          return;
        }
      } catch {}
      setUnreadDM(0);
    })();
  }, [isOwnProfile]);

  useEffect(() => {
    if (!perfilTipo && !perfilTipoProp) return;
    if (isOwnProfile || !perfilId) return;

    const alvoTipoNorm = String(perfilTipo || perfilTipoProp || "").toLowerCase();
    const alvoEhFormador = ["professor", "clube", "escolinha"].includes(alvoTipoNorm);

    if (!alvoEhFormador) {
      setTreinoJunto(false);
      setSouSolicitanteTreino(null);
      localStorage.removeItem(storageKey);
      return;
    }

    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const [rMinhas, rRecebidas] = await Promise.all([
          fetch(`${API.BASE_URL}/api/solicitacoes-treino/minhas`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API.BASE_URL}/api/solicitacoes-treino/recebidas`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const arrMinhas: any[] = rMinhas.ok ? await rMinhas.json() : [];
        const arrRecebidas: any[] = rRecebidas.ok ? await rRecebidas.json() : [];

        const isAtiva = (s: any) => {
          const st = String(s?.status || "").toLowerCase();
          return (
            st.includes("ativ") ||
            st.includes("pend") ||
            st.includes("aceit") ||
            st.includes("aprov") ||
            st.includes("solic") ||
            st.includes("aguard")
          );
        };

        const minhaComEsseUsuario = (arrMinhas || []).find((x: any) => {
          const envolvidos: string[] = [
            x.destinatarioId,
            x.usuarioId,
            x.userId,
          ].filter(Boolean);
          return envolvidos.includes(perfilId) && isAtiva(x);
        });

        const recebidaDesseUsuario = (arrRecebidas || []).find((x: any) => {
          const envolvidos: string[] = [
            x.remetenteId,
            x.usuarioId,
            x.userId,
          ].filter(Boolean);
          return envolvidos.includes(perfilId) && isAtiva(x);
        });

        if (minhaComEsseUsuario) {
          setTreinoJunto(true);
          setSouSolicitanteTreino(true);
          localStorage.setItem(storageKey, "1");
        } else if (recebidaDesseUsuario) {
          setTreinoJunto(true);
          setSouSolicitanteTreino(false);
          localStorage.removeItem(storageKey);
        } else {
          setTreinoJunto(false);
          setSouSolicitanteTreino(null);
          localStorage.removeItem(storageKey);
        }

      } catch {
        setTreinoJunto(false);
        setSouSolicitanteTreino(null);
        localStorage.removeItem(storageKey);
      }
    })();
  }, [perfilId, isOwnProfile, storageKey, perfilTipo, perfilTipoProp]);

  useEffect(() => {
    if (isOwnProfile) return;

    const token = Storage.token;
    const ownerId = Storage.tipoUsuarioId;
    const tipo =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    if (!token || !ownerId) return;

    if (!podeObservar) return;

    const alvo = alvoAtletaId || perfilId;
    if (!alvo) return;

    if (obsKey) {
      const cache = localStorage.getItem(obsKey);
      if (cache === "1") {
        setObservando(true);
      }
    }

    setCarregandoObs(true);

    const url = `${API.BASE_URL}/api/observados/status/${encodeURIComponent(
      alvo
    )}?ownerId=${encodeURIComponent(ownerId)}&tipo=${encodeURIComponent(
      tipo || ""
    )}`;

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const val = !!j?.observando;
        setObservando(val);
        if (obsKey) {
          if (val) localStorage.setItem(obsKey, "1");
          else localStorage.removeItem(obsKey);
        }
      })
      .catch(() => setObservando(false))
      .finally(() => setCarregandoObs(false));
  }, [podeObservar, isOwnProfile, alvoAtletaId, perfilId]);

  const iniciarChat = () => {
    const me = Storage.usuarioId;
    if (!me) {
      alert("Faça login para enviar mensagens.");
      return;
    }
    localStorage.setItem(
      "mensagens_open_target",
      JSON.stringify({ tipo: "usuario", id: perfilId })
    );
    try {
      const key = "mensagens_recent_usuarios";
      const atual: Usuario[] = JSON.parse(localStorage.getItem(key) || "[]");
      const novo: Usuario = {
        id: perfilId,
        nome,
        foto: foto ?? avatar ?? null,
      };
      const dedup = [novo, ...atual.filter((u) => u.id !== novo.id)].slice(
        0,
        50
      );
      localStorage.setItem(key, JSON.stringify(dedup));
    } catch {}
    window.location.href = "/mensagens";
  };

  useEffect(() => {
    setPontosTotal(pontuacao ?? 0);
  }, [pontuacao]);

  useEffect(() => {
    if (kpis && kpis.length) return;
    const token = Storage.token;
    if (!perfilId || !token) return;
    fetch(
      `${API.BASE_URL}/api/perfil/${encodeURIComponent(
        perfilId
      )}/pontuacao`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;

        const resolvedUserId = String(
          data?.usuario?.id ??
          data?.usuarioId ??
          data?.usuario?.usuarioId ??
          ""
        ).trim();

        const performance = Number(data.performance) || 0;
        const disciplina = Number(data.disciplina) || 0;
        const responsab = Number(data.responsabilidade) || 0;
        setPontosTotal(performance + disciplina + responsab);
      })
      .catch(() => {});
  }, [perfilId, kpis]);

  async function resolverAtletaIdSePreciso(): Promise<string | null> {
    if (alvoAtletaId) return alvoAtletaId;
    const token = Storage.token;
    if (!token) return null;

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/perfil/${encodeURIComponent(perfilId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (r.ok) {
        const data = await r.json();
        const id1 = pickAtletaId(data, perfilId);
        if (id1) {
          setAlvoAtletaId(id1);
          return id1;
        }
      }
    } catch {}

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/observados/resolve/${encodeURIComponent(
          perfilId
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (r.status === 404) {
        alert("Este perfil não tem cadastro de atleta.");
        return null;
      }
      if (!r.ok) return null;
      if (r.ok) {
        const j = await r.json();
        const id2 = j?.atletaId || j?.id || null;
        if (id2) {
          setAlvoAtletaId(id2);
          return id2;
        }
      }
    } catch {}

    return null;
  }

  function extrairIdsSeguindo(resp: any): string[] {
  const arr =
    (Array.isArray(resp) ? resp : null) ??
    (Array.isArray(resp?.ids) ? resp.ids : null) ??
    (Array.isArray(resp?.seguindo) ? resp.seguindo : null) ??
    (Array.isArray(resp?.items) ? resp.items : null) ??
    (Array.isArray(resp?.data) ? resp.data : null) ??
    [];

  return arr
    .map((x: any) => {
      if (!x) return "";
      return String(
        x.id ??
        x.usuarioId ??
        x.usuarioAlvoId ??
        x.seguidoUsuarioId ??
        x.seguidoId ??
        x.seguindoId ??
        x.seguido?.id ??
        x.usuario?.id ??
        x
      ).trim();
    })
    .filter(Boolean);
  }

  async function readBodySafe(r: Response) {
    try {
      return await r.json();
    } catch {
      return null;
    }
  }
  function isDuplicado(resp: Response, body: any) {
    if (resp.status === 400 || resp.status === 409) return true;
    const msg = (body?.error || body?.message || "")
      .toString()
      .toLowerCase();
    return (
      msg.includes("já segue") ||
      msg.includes("ja segue") ||
      msg.includes("já existe") ||
      msg.includes("pendente")
    );
  }

  async function deixarDeSeguir(alvoId: string) {
    const token = Storage.token;
    const r = await fetch(`${API.BASE_URL}/api/seguidores/`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seguidoUsuarioId: alvoId }),
    });
    return r.ok;
  }

  async function cancelarSolicitacaoTreino(usuarioAlvoId: string) {
    const token = Storage.token;
    if (!token) return false;

    let solicitacaoId: string | null = null;
    try {
      const r = await fetch(
        `${API.BASE_URL}/api/solicitacoes-treino/minhas`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (r.ok) {
        const arr = await r.json();
        const pend = (arr || []).find((x: any) => {
          const envolve = [
            x.destinatarioId,
            x.solicitanteId,
            x.usuarioId,
            x.userId,
          ].includes(usuarioAlvoId);
          const s = String(x.status || "");
          return /pend|solic|aguard|ativ|aprov|aceit/i.test(s);
        });
        solicitacaoId = pend?.id ?? null;
      }
    } catch {}

    if (solicitacaoId) {
      const del = await fetch(
        `${API.BASE_URL}/api/solicitacoes-treino/${encodeURIComponent(
          solicitacaoId
        )}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return del.ok || del.status === 204;
    }

    const delBody = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ destinatarioId: usuarioAlvoId }),
    });
    return delBody.ok || delBody.status === 204 || delBody.status === 404;
  }

  const carregarUsuariosMutuos = async () => {
    const token = Storage.token;
    setCarregandoMutuos(true);
    try {
      const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : [];
      setUsuariosMutuos(Array.isArray(data) ? data : []);
    } catch {
      setUsuariosMutuos([]);
    } finally {
      setCarregandoMutuos(false);
    }
  };

  const abrirModalCompartilhar = () => {
    setModalAberto(true);
    setSelecionados(new Set());
    carregarUsuariosMutuos();
  };

  const toggleSelecionado = (idUsuario: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      novo.has(idUsuario) ? novo.delete(idUsuario) : novo.add(idUsuario);
      return novo;
    });
  };

  const enviarCompartilhamentoPorDM = async () => {
    if (selecionados.size === 0) {
      alert("Selecione ao menos uma pessoa.");
      return;
    }
    const token = Storage.token;
    if (!token) {
      alert("Faça login para compartilhar.");
      return;
    }
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
              conteudo: perfilId,
              tipo: "USUARIO",
            }),
          })
        )
      );
      alert("Perfil compartilhado por mensagem!");
      setModalAberto(false);
    } finally {
      setEnviandoDM(false);
    }
  };

  const rawAvatar = String(foto ?? avatar ?? "").trim();
  const temAvatarValido =
    rawAvatar &&
    rawAvatar !== "null" &&
    rawAvatar !== "undefined" &&
    rawAvatar !== "0";

  const imageSrc = temAvatarValido
    ? formatarUrlFoto(rawAvatar, "usuarios")
    : FALLBACK_AVATAR;

const alvoUsuarioIdFavorito = isOwnProfile
  ? String(Storage.usuarioId ?? "").trim()
  : String(perfilId || "").trim();



  const conquistasTotal = Number(conquistasCount || 0) || 0;
  const conquistasHref = `/perfil/conquistas?usuarioId=${encodeURIComponent(
    String(perfilId || "")
  )}&tipo=${encodeURIComponent(String(perfilTipo || perfilTipoProp || ""))}`;

  const irConquistas = () => {
    try {
      localStorage.setItem(
        `conquistas_count_${perfilId}`,
        String(conquistasTotal)
      );
    } catch {}
    window.location.href = conquistasHref;
  };

  useEffect(() => {
    if (!perfilTipo && !perfilTipoProp) return;
    if (isOwnProfile || !perfilId) return;

    const token =
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    if (!token) return;

    const me = String(Storage.usuarioId || localStorage.getItem("usuarioId") || "");
    const cacheKey = me ? `follow_${me}_${perfilId}` : null;

    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached === "1") setSeguindo(true);
      if (cached === "0") setSeguindo(false);
    }

    let alive = true;

    (async () => {
      try {
        const r = await fetch(`${API.BASE_URL}/api/seguidores/seguindo`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!r.ok) {
          if (alive) {
            setSeguindo((v) => v ?? false);
          }
          return;
        }

        const j = await r.json().catch(() => null);
        const ids = extrairIdsSeguindo(j);

        const isSeguindo = ids.includes(String(perfilId).trim());

        if (!alive) return;
        setSeguindo(isSeguindo);

        if (cacheKey) localStorage.setItem(cacheKey, isSeguindo ? "1" : "0");
      } catch {
        if (alive) setSeguindo((v) => v ?? false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [perfilId, isOwnProfile, perfilTipo, perfilTipoProp]);

  useEffect(() => {
    if (!isOwnProfile) return;

    const token =
      Storage.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    if (!token) return;

    let alive = true;

    async function carregarBadge() {
      try {
        const r = await fetch(`${API.BASE_URL}/api/notificacoes/badge`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;

        const j = await r.json().catch(() => null);

        const total =
          Number(j?.totalNotificacoes ?? j?.total ?? 0) || 0;

        if (alive) setBadgeCount(total);
      } catch {}
    }

    carregarBadge();

    const onFocus = () => carregarBadge();
    window.addEventListener("focus", onFocus);

    const onVis = () => {
      if (document.visibilityState === "visible") carregarBadge();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isOwnProfile]);

  useEffect(() => {
    if (!alvoUsuarioIdFavorito) return;
    const token = Storage.token;
    if (!token) return;
    fetch(`${API.BASE_URL}/api/favoritos`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => setEhFavorito(ids.includes(alvoUsuarioIdFavorito)))
      .catch(() => {});
  }, [alvoUsuarioIdFavorito]);


  async function toggleFavorito() {
    if (!alvoUsuarioIdFavorito) return;
    const token = Storage.token;
    if (!token) {
      alert("Faça login para favoritar.");
      return;
    }
    await fetch(`${API.BASE_URL}/api/favoritos/${alvoUsuarioIdFavorito}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setEhFavorito((v) => !v);
  }


  const seguirUsuario = async (): Promise<boolean> => {
    const token = Storage.token;
    const seguidorUsuarioId = Storage.usuarioId;
    if (!token || !seguidorUsuarioId) {
      alert("Faça login para seguir.");
      return false;
    }

    const resp = await fetch(`${API.BASE_URL}/api/seguidores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seguidoUsuarioId: perfilId }),
    });

    if (resp.ok) return true;
    const body = await readBodySafe(resp);
    return isDuplicado(resp, body);
  };

  const me = String(Storage.usuarioId || localStorage.getItem("usuarioId") || "");
  const cacheKey = me ? `follow_${me}_${perfilId}` : null;

  const toggleSeguir = async () => {
    if (seguindo) {
      const ok = await deixarDeSeguir(perfilId);
      if (ok) {
        setSeguindo(false);
        if (cacheKey) localStorage.setItem(cacheKey, "0");
      }
      return;
    }

    const ok = await seguirUsuario();
    if (ok) {
      setSeguindo(true);
      if (cacheKey) localStorage.setItem(cacheKey, "1");
    }
  };

  const solicitarTreino = async (): Promise<boolean> => {
    const token = Storage.token;
    if (!token) {
      alert("Faça login para solicitar treino.");
      return false;
    }

    const resp = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ destinatarioId: perfilId }),
    });

    if (resp.ok) return true;
    const body = await readBodySafe(resp);
    return isDuplicado(resp, body);
  };

  const toggleTreino = async () => {
    if (temVinculoTreino) {
      alert("Vocês já possuem vínculo de treinamento.");
      return;
    }

    if (treinoJunto && souSolicitanteTreino) {
      const ok = await cancelarSolicitacaoTreino(perfilId);
      if (ok) {
        setTreinoJunto(false);
        setSouSolicitanteTreino(null);
        localStorage.removeItem(storageKey);
      }
      return;
    }

    if (treinoJunto && souSolicitanteTreino === false) {
      window.location.href = "/notificacoes";
      return;
    }

    const ok = await solicitarTreino();
    if (ok) {
      setTreinoJunto(true);
      setSouSolicitanteTreino(true);
      localStorage.setItem(storageKey, "1");
    }
  };

  const observarAtleta = async (
    id: string
  ): Promise<"ok" | "dup" | "auth" | "err"> => {
    try {
      const token = Storage.token;
      const ownerId = Storage.tipoUsuarioId;
      
      const tipo =
        (Storage as any).tipoSalvo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        "";

      if (!token || !id || !ownerId) return "auth";

      const resp = await fetch(`${API.BASE_URL}/api/observados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ atletaId: id, ownerId, tipo }),
      });

      if (resp.ok) return "ok";
      if (resp.status === 409) return "dup";
      if (resp.status === 401) return "auth";
      return "err";
    } catch {
      return "err";
    }
  };

  const toggleObservar = async () => {
    setCarregandoObs(true);
    try {
      const id = await resolverAtletaIdSePreciso();
      if (!id) {
        alert("Não foi possível identificar o atleta.");
        return;
      }

      if (observando) {
        const prev = observando;
        setObservando(false);
        const ownerId = Storage.tipoUsuarioId;
        const tipo =
          (Storage as any).tipoSalvo ??
          localStorage.getItem("tipoUsuario") ??
          sessionStorage.getItem("tipoUsuario") ??
          "";

        const del = await fetch(
          `${API.BASE_URL}/api/observados/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Storage.token || ""}`,
            },
            body: JSON.stringify({ ownerId, tipo }),
          }
        );

        if (del.ok || del.status === 204 || del.status === 404) {
          if (obsKey) localStorage.removeItem(obsKey);
        } else {
          setObservando(prev);
        }
        return;
      }

      const r = await observarAtleta(id);
      if (r === "auth") {
        alert("Faça login novamente.");
        return;
      }
      if (r === "err") {
        alert("Não foi possível observar agora.");
        return;
      }
      setObservando(true);
      if (obsKey) localStorage.setItem(obsKey, "1");
    } finally {
      setCarregandoObs(false);
    }
  };

  const btnBase =
    "rounded-full font-semibold focus:outline-none focus:ring-2 focus:ring-white/40 transition " +
    "inline-flex items-center justify-center gap-2";

  const treinoLoading = !checouVinculo && !isOwnProfile && !isMe;
  const treinoDisabled = treinoLoading;
  const alvoTipoNorm = String(perfilTipo || perfilTipoProp || "").toLowerCase();

  const mostrarTreinarJuntos =
    !isOwnProfile &&
    !isMe &&
    podeChecarVinculo;


  let treinoLabel = "Treinar juntos";
  let treinoTitle = "Solicitar treino em conjunto";
  let treinoBtnClass = temVinculoTreino
    ? "bg-white/10 text-white border border-white/40"
    : "bg-green-400 text-green-900";

  if (treinoLoading) {
    treinoLabel = "...";
    treinoTitle = "Carregando...";
  } else if (temVinculoTreino) {
    treinoLabel = "Já treino junto";
    treinoTitle = "Vocês já possuem vínculo de treinamento";
  } else if (treinoJunto && souSolicitanteTreino) {
    treinoLabel = "Solicitação enviada";
    treinoTitle = "Cancelar solicitação de treino em conjunto";
    treinoBtnClass = "bg-white/10 text-white border border-white/40";
  } else if (treinoJunto && souSolicitanteTreino === false) {
    treinoLabel = "Responder convite";
    treinoTitle = "Você recebeu um convite para treinar junto";
    treinoBtnClass = "bg-amber-300 text-green-900";
  }

  const onlineText = (() => {
    // ✅ se bloqueou, não mostra pra ninguém
    if (presencePrivacyBlocked) return null;

    // se ainda não carregou
    if (presenceOnline === null && !presenceLastSeenAt) return null;

    // online agora
    if (presenceOnline) {
      return (isOwnProfile || isMe) ? "🟢 Você está online" : "🟢 Online";
    }

    // offline sem lastSeen
    if (!presenceLastSeenAt) return "🔴 Offline";

    const ago = timeAgoPtBR(presenceLastSeenAt);
    return ago === "agora" ? "🟢 Online" : `⚪ Online ${ago}`;
  })();

  return (
    <div className="footera-bg-green p-6 flex flex-col items-center relative">
      {isOwnProfile && (
        <div>
          <div className="absolute top-4 left-4 flex gap-2">
            <Link href="/mensagens">
              <Button
                variant="ghost"
                size="icon"
                className="relative bg-white/10 hover:bg-white/20 text-white rounded-full"
                title="Mensagens"
              >
                <Mail />
                <Badge count={unreadDM} />
              </Button>
            </Link>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href="/notificacoes">
              <Button
                variant="ghost"
                size="icon"
                className="relative bg-white/10 hover:bg-white/20 text-white rounded-full"
                title="Notificações"
              >
                <Bell />
                <Badge count={badgeCount} />
              </Button>
            </Link>
            <Link href="/perfil/editar">
              <Button
                variant="ghost"
                size="icon"
                className="bg-white/10 hover:bg-white/20 text-white rounded-full"
              >
                <Edit size={18} />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="w-24 h-24 rounded-full mb-3 flex items-center justify-center bg-white border-2 border-white overflow-hidden">
        <img
          src={imageSrc}
          alt={`${nome} profile`}
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallbackApplied) return;
            img.dataset.fallbackApplied = "1";
            img.src = FALLBACK_AVATAR;
          }}
        />
      </div>

      <h1 className="footera-text-cream text-2xl font-bold">
        {nome.toUpperCase()}
      </h1>

      {(idade || posicao || time) && (
        <p className="footera-text-cream text-sm mb-1 text-center">
          {idade && `${idade} anos`}
          {idade && posicao ? " • " : ""}
          {posicao}
          {posicao && time ? " • " : ""}
          {time}
        </p>
      )}

      {onlineText && (
        <div className="text-white text-xs font-semibold mt-0.5 text-center">
          {onlineText}
        </div>
      )}

      <div className="w-full mt-4">
        {kpis && kpis.length ? (
          <div className="grid grid-cols-3 gap-3">
            {kpis.map((k, i) => {
              const isConquistas = String(k.label || "").toLowerCase() === "conquistas";
              const podeIrConquistas = isConquistas;

              const card = (
                <div
                  className={`rounded-xl bg-white/15 border border-footera-cream/40 p-3 text-center ${
                    podeIrConquistas ? "cursor-pointer hover:bg-white/20" : ""
                  }`}
                  title={podeIrConquistas ? "Ver conquistas" : undefined}
                  role={podeIrConquistas ? "button" : undefined}
                >
                  <div className="footera-text-cream text-2xl font-bold">
                    {Number(k.value ?? 0)}
                  </div>
                  <div className="footera-text-cream/80 text-xs mt-1">
                    {k.label}
                  </div>
                </div>
              );

              return podeIrConquistas ? (
                <button
                  key={`${k.label}-${i}`}
                  type="button"
                  onClick={irConquistas}
                  className="text-left"
                >
                  {card}
                </button>
              ) : (
                <div key={`${k.label}-${i}`}>{card}</div>
              );
            })}
          </div>
        ) : (
          <>
            <h2 className="footera-text-cream text-center mb-2">
              {scoreTitle}
            </h2>
            <div className="footera-bg-green border border-footera-cream rounded-lg p-3 flex items-center justify-center gap-2">
              <span className="footera-text-cream text-3xl font-bold">
                {pontosTotal} pts
              </span>
              {typeof scoreDelta === "number" && scoreDelta > 0 && (
                <span
                  title={`+${scoreDelta} desde a última visita`}
                  className="ml-2 text-xs font-bold text-green-200 bg-green-900/30 border border-green-200/30 rounded px-2 py-0.5"
                >
                  ↑ +{scoreDelta}
                </span>
              )}
              <ScoreDeltaBadge usuarioId={perfilId} />
            </div>
          </>
        )}
      </div>

      {!isOwnProfile && (
        <div className="w-full max-w-2xl px-3 mt-4 mb-2">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              onClick={toggleFavorito}
              className={`text-xl sm:text-2xl ${
                ehFavorito ? "text-yellow-400" : "text-white/70"
              } px-2`}
              title={
                ehFavorito
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"
              }
              aria-label={
                ehFavorito
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"
              }
            >
              ★
            </button>

            <button
              disabled={seguindo === null}
              aria-pressed={!!seguindo}
              onClick={toggleSeguir}
              className={`${btnBase} ${
                seguindo
                  ? "bg-white/10 text-white border border-white/40"
                  : "bg-green-600 text-green-900"
              } 
                    disabled:opacity-60 disabled:cursor-not-allowed
                    px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
              title={
                seguindo === null
                  ? "Carregando..."
                  : seguindo
                  ? "Deixar de seguir"
                  : "Seguir"
              }
            >
              <UserPlus size={16} />
              <span className="truncate">
                {seguindo === null ? "..." : seguindo ? "Seguindo" : "Seguir"}
              </span>
            </button>

            <button
              onClick={iniciarChat}
              className={`${btnBase} bg-green-500 text-green-900 px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
            >
              <Send size={16} />
              <span className="truncate">Enviar mensagem</span>
            </button>

            {mostrarTreinarJuntos && (
              <button
                disabled={treinoDisabled}
                aria-pressed={!!(temVinculoTreino || treinoJunto)}
                onClick={toggleTreino}
                className={`${btnBase} ${treinoBtnClass}
                      disabled:opacity-60 disabled:cursor-not-allowed
                      px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
                title={treinoTitle}
              >
                <Users size={16} />
                <span className="truncate">{treinoLabel}</span>
              </button>
            )}

            {viewerCanObserve && podeObservar && (
              <button
                disabled={carregandoObs}
                aria-pressed={!!observando}
                onClick={toggleObservar}
                className={`${btnBase} ${
                  observando
                    ? "bg-white/10 text-white border border-white/40"
                    : "bg-green-300 text-green-900"
                } 
                      disabled:opacity-60 disabled:cursor-not-allowed
                      px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
                title={
                  carregandoObs
                    ? "Carregando..."
                    : observando
                    ? "Parar de observar"
                    : "Observar este atleta"
                }
              >
                <Eye size={16} />
                <span className="truncate">
                  {carregandoObs
                    ? "..."
                    : observando
                    ? "Observando"
                    : "Observar"}
                </span>
              </button>
            )}

            <button
              onClick={abrirModalCompartilhar}
              className={`${btnBase} bg-amber-300 text-green-900
                    px-3 py-1.5 text-xs md:px-4 md:py-2 md:text-sm`}
            >
              <Share2 size={16} />
              <span className="truncate">Compartilhar</span>
            </button>
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="mt-4 w-full flex justify-center">
          <div className="w-full max-w-md flex items-center justify-center gap-3">
            <Link href="/minha-rede">
              <Button
                className="flex-1 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/30"
              >
                <Users size={18} className="mr-2" />
                Minha rede
              </Button>
            </Link>

            <Link href="/configuracoes">
              <Button
                className="flex-1 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/30"
              >
                <Settings size={18} className="mr-2" />
                Configurações
              </Button>
            </Link>
          </div>
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">
              Compartilhar Perfil
            </h2>
            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                Enviar por mensagem:
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2">
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

                  const fotoSrc = u.foto
                    ? formatarUrlFoto(u.foto, "usuarios")
                    : "/assets/usuarios/default-user.png";

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
            <button
              onClick={() => setModalAberto(false)}
              className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl"
              aria-label="Fechar modal"
            >
              <CircleX />
            </button>
          </div>
        </div>
      )}

      {confirmBox?.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-5 rounded-xl w-96 shadow-xl">
            <p className="text-sm text-gray-800">{confirmBox.text}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-gray-200"
                onClick={() => setConfirmBox(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded bg-green-700 text-white"
                onClick={async () => {
                  try {
                    await confirmBox.onYes();
                  } finally {
                    setConfirmBox(null);
                  }
                }}
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
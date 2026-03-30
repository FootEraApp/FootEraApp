// client/src/pages/treino/treinos-instrutores
import { useMemo, useEffect, useState, useRef, type SVGProps } from "react";
import { Link, useLocation } from "wouter";
import {
  Check,
  X,
  Pencil,
  Trash2,
  Star as StarIcon,
} from "lucide-react";
import { API, APP, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";
import BottomNav from "@/components/layout/BottomNav.js";
import MeusExerciciosTab from "../../components/treinos/meusExerciciosTab.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

const Storage = {
  get token() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  },
  get tipoSalvo() {
    return localStorage.getItem("tipoUsuario") || sessionStorage.getItem("tipoUsuario") || "";
  },
  get usuarioId() {
    return localStorage.getItem("usuarioId") || sessionStorage.getItem("usuarioId") || "";
  },
  get tipoUsuarioId() {
    return localStorage.getItem("tipoUsuarioId") || sessionStorage.getItem("tipoUsuarioId") || "";
  },
  get plano() {
    return localStorage.getItem("plano") || sessionStorage.getItem("plano") || "";
  },
  get assinaturaPlano() {
    return localStorage.getItem("assinaturaPlano") || sessionStorage.getItem("assinaturaPlano") || "";
  },
};

type ExercicioInfoMin = {
  id: string;
  nome: string;
  descricao?: string | null;
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
};

interface ExercicioSessaoDetalhe {
  id: string;
  nome?: string | null;
  detalhes?: string | null;
  repeticoes?: string | null;
  series?: number | null;
  duracao?: string | null;
  descanso?: string | null;
  videoDemonstrativoUrl?: string | null;
  exercicioId?: string | null;
  exercicioTemporarioId?: string | null;
  exercicioPersonalizadoId?: string | null;
  exercicio?: ExercicioInfoMin | null;
  exercicioTemporario?: ExercicioInfoMin | null;
  exercicioPersonalizado?: ExercicioInfoMin | null;
  concluido?: boolean;
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
  series?: number | null;
  duracao?: string | null;
  descanso?: string | null;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: Exercicio[];
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  professorId?: string;
  escolinhaId?: string;
  clubeId?: string;
  pontuacao?: number | null;
  professoresIds?: string[];
  criadoresNomes?: string[];
  criadorTipo?: "professor" | "clube" | "escolinha" | "escola" | "admin" | "desconhecido";
}

interface UsuarioLogado {
  tipo:
    | "admin"
    | "atleta"
    | "escola"
    | "escolinha"
    | "clube"
    | "professor"
    | "olheiro";
  usuarioId: string;
  tipoUsuarioId: string;
}
interface SubmissaoParaValidacao {
  id: string;
  criadoEm: string;
  aprovado: boolean | null;
  pontosSugeridos: number;
  atleta: { id: string; usuarioId: string; nome: string; foto?: string | null };
  treino: { agendadoId: string; titulo: string; programadoId?: string | null };
  midias: string[];
  observacao?: string | null;
}

interface AtletaVinculado {
  id: string;
  usuario: {
    id: string;
    nome: string;
    foto?: string | null;
  };
}

interface Turma {
  id: string;
  nome: string;
  atletaIds: string[];
  professorIds?: string[];
  professorNomes?: string[];
  professorNome?: string | null;
}

type MetodologiaPublico = "ATLETAS" | "PROFISSIONAIS" | "AMBOS" | string;

type MetodologiaCard = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  criadorNome?: string | null;
  totalAssinantes?: number | null;
  // ✅ novos:
  videoCount?: number;
  treinoCount?: number;
  nivel?: "Base" | "Avancado" | "Performance" | string | null;
  jaAssinada?: boolean;
  tags?: string[];
  mediaAvaliacao: number;     // 0..5
  notaCount: number;     // quantidade de avaliações
  pontos: number; 
  publicoAlvo?: MetodologiaPublico | null;
  totalReviews?: number | null;
};

type SessaoDeHoje = {
  id: string;
  data: string;
  treino: any;
  turma: any;
  statusRaw: string;
  status: "nao_iniciada" | "em_andamento" | "finalizada" | "cancelada" | "faltou";
  dataSessao: Date | null;
  win: StartWindowInfo | null;
  faltou: boolean;
  podeIniciar: boolean;
  exercicios?: any[];
  presencas?: any[];
  startedAt?: string | null;
  // ✅ adicionar
  duracaoMinutosReal?: number | null;
  penalidadeAtraso?: boolean;
  presentes?: any[];
  presentesNomes?: string[];
};

type StartWindowInfo = {
  hasTime: boolean;     // se a data tem hora marcada (ex: 21:00)
  canStart: boolean;    // se pode iniciar agora
  isLate: boolean;      // se já passou do limite e virou "faltou"
  startAt: Date;        // momento "alvo" (hora marcada ou meio-dia do dia)
  lateAt: Date;         // momento em que vira "faltou"
};

function parseDateSafe(raw: any): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  const s = String(raw).trim();
  if (!s) return null;

  // datetime-local sem timezone: 2026-02-24T19:00 ou 2026-02-24T19:00:00
  const mLocal = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (mLocal) {
    const [, Y, M, D, h, mi, sec] = mLocal;
    return new Date(
      Number(Y),
      Number(M) - 1,
      Number(D),
      Number(h),
      Number(mi),
      Number(sec || 0),
      0
    );
  }

  // só data YYYY-MM-DD
  const mDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDate) {
    const [, Y, M, D] = mDate;
    return new Date(Number(Y), Number(M) - 1, Number(D), 0, 0, 0, 0);
  }

  // ISO com timezone
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function hasHoraMarcada(d: Date | null) {
  if (!d) return false;
  // se no horário BRT não for 00:00, considera "tem hora"
  const hh = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(d)
  );
  const mm = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      minute: "2-digit",
    }).format(d)
  );
  return !(hh === 0 && mm === 0);
}

function getStartWindowInfo(d: Date | null): StartWindowInfo | null {
  if (!d) return null;

  const now = new Date();

  // ✅ se tem hora marcada: libera 1h antes; passa 30min depois => faltou
  if (hasHoraMarcada(d)) {
    const startAt = d;
    const canStartFrom = new Date(startAt.getTime() - 60 * 60 * 1000); // 1h antes
    const lateAt = new Date(startAt.getTime() + 60 * 60 * 1000);       // 30min depois

    const canStart = now >= canStartFrom && now <= lateAt;
    const isLate = now > lateAt;

    return { hasTime: true, canStart, isLate, startAt, lateAt };
  }

  // ✅ se NÃO tem hora: libera apenas no dia (BRT); depois do dia acabar => faltou
  const startDay = startOfDayBRT(d);
  const endDay = endOfDayBRT(d);

  const canStart = now >= startDay && now <= endDay;
  const isLate = now > endDay;

  // startAt aqui é só referência (pode ser o próprio startDay)
  return { hasTime: false, canStart, isLate, startAt: startDay, lateAt: endDay };
}

function normTxt(s: any) {
  return String(s || "").trim().toLowerCase();
}

function formatElapsed(startedAtISO?: string | null, nowMs?: number) {
  if (!startedAtISO) return "00:00";
  const startMs = new Date(startedAtISO).getTime();
  const diffSec = Math.max(0, Math.floor(((nowMs ?? Date.now()) - startMs) / 1000));
  const mm = String(Math.floor(diffSec / 60)).padStart(2, "0");
  const ss = String(diffSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function SoccerFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="2.25" />
      <rect x="3" y="8.5" width="4" height="7" rx="0.5" />
      <rect x="17" y="8.5" width="4" height="7" rx="0.5" />
    </svg>
  );
}
const PLACEHOLDER_USER = "/assets/usuarios/default-user.png";

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return null;
  const p = String(raw).trim();
  if (!p) return null;

  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (p.startsWith("/")) return `${API.BASE_URL}${p}`;

  // "uploads/..." ou "assets/..." sem barra
  return `${API.BASE_URL}/${p}`;
}

function formatarData(data?: string) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "";
}

function formatarDataBR(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function getHoraHHMM(d: Date) {
  return d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getYMDInBRT(d: Date) {
  // pega “ano/mês/dia” no calendário do Brasil
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // YYYY-MM-DD
  const [Y, M, D] = parts.split("-").map(Number);
  return { Y, M, D };
}

function startOfDayBRT(d: Date) {
  const { Y, M, D } = getYMDInBRT(d);
  return new Date(`${String(Y).padStart(4, "0")}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}T00:00:00-03:00`);
}

function endOfDayBRT(d: Date) {
  const { Y, M, D } = getYMDInBRT(d);
  return new Date(`${String(Y).padStart(4, "0")}-${String(M).padStart(2, "0")}-${String(D).padStart(2, "0")}T23:59:59.999-03:00`);
}

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
}

function pickFirstId(obj: any, keys: string[]): string {
  for (const k of keys) {
    const val = obj?.[k];
    const id = pickId(val);
    if (id) return id;
  }
  return "";
}

function pickId(v: any): string {
  const s = String(v ?? "").trim();
  return s && s !== "null" && s !== "undefined" ? s : "";
}

function getOwnerIdsFromTreino(tr: any) {
  const clubeObj =
    tr?.clube ?? tr?.Clube ?? tr?.criador?.clube ?? tr?.criador?.Clube ?? null;

  const escolinhaObj =
    tr?.escolinha ?? tr?.Escolinha ?? tr?.criador?.escolinha ?? tr?.criador?.Escolinha ?? null;

  const professorObj =
    tr?.professor ?? tr?.Professor ?? tr?.criador?.professor ?? tr?.criador?.Professor ?? null;

  let clubeId =
    pickFirstId(tr, ["clubeId", "clube_id", "ClubeId"]) ||
    pickFirstId(clubeObj, ["id", "clubeId", "clube_id"]) ||
    pickFirstId(tr?.criador, ["clubeId", "clube_id"]);

  let escolinhaId =
    pickFirstId(tr, ["escolinhaId", "escolinha_id", "EscolinhaId"]) ||
    pickFirstId(escolinhaObj, ["id", "escolinhaId", "escolinha_id"]) ||
    pickFirstId(tr?.criador, ["escolinhaId", "escolinha_id"]);

  let professorId =
    pickFirstId(tr, ["professorId", "professor_id", "ProfessorId"]) ||
    pickFirstId(professorObj, ["id", "professorId", "professor_id", "usuarioId"]) ||
    pickFirstId(tr?.criador, ["professorId", "professor_id", "usuarioId"]);

  // ✅ FALLBACK PRINCIPAL: quando o backend manda { autor: { tipo, id, nome } }
  const autorTipo = String(tr?.autor?.tipo ?? "").trim().toLowerCase();
  const autorId = pickId(tr?.autor?.id);

  if (autorId && !clubeId && !escolinhaId && !professorId) {
    if (autorTipo === "clube") clubeId = autorId;
    else if (autorTipo === "escolinha" || autorTipo === "escola") escolinhaId = autorId;
    else if (autorTipo === "professor") professorId = autorId;
  }

  return { clubeId, escolinhaId, professorId };
}

function getTipoUsuarioIdFromMe(tipo: string, me: any): string {
  const t = String(tipo || "").toLowerCase();

  const clubeId =
    pickId(me?.clube?.id) || pickId(me?.Clube?.id) || pickId(me?.clubeId) || pickId(me?.ClubeId);

  const escolinhaId =
    pickId(me?.escolinha?.id) || pickId(me?.Escolinha?.id) || pickId(me?.escolinhaId) || pickId(me?.EscolinhaId);

  const professorId =
    pickId(me?.professor?.id) || pickId(me?.Professor?.id) || pickId(me?.professorId) || pickId(me?.ProfessorId);

  const atletaId =
    pickId(me?.atleta?.id) || pickId(me?.Atleta?.id) || pickId(me?.atletaId) || pickId(me?.AtletaId);

  const adminId =
    pickId(me?.admin?.id) || pickId(me?.Administrador?.id) || pickId(me?.adminId) || pickId(me?.administradorId);

  // se o backend já devolve tipoUsuarioId certo, aproveita
  const tipoUsuarioId = pickId(me?.tipoUsuarioId) || pickId(me?.tipoUsuario?.id);

  if (t === "clube") return clubeId || tipoUsuarioId;
  if (t === "escolinha" || t === "escola") return escolinhaId || tipoUsuarioId;
  if (t === "professor") return professorId || tipoUsuarioId;
  if (t === "atleta") return atletaId || tipoUsuarioId;
  if (t === "admin") return adminId || tipoUsuarioId;

  return tipoUsuarioId;
}

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

function normalizeAssetUrl(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;

  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;
  return `${API.BASE_URL}/${u}`; // cobre "uploads/..." sem barra
}

function normalizeImgUrl(raw?: string | null) {
  if (!raw) return null;
  const u = String(raw).trim();
  if (!u) return null;

  // se vier "/uploads/..." ou "/assets/..." → precisa apontar para o BACKEND
  if (u.startsWith("/")) return `${API.BASE_URL}${u}`;

  return u; // já é URL absoluta
}

function isUsuarioFree() {
  try {
    const planoRaw =
      (Storage as any).assinaturaPlano ??
      (Storage as any).plano ??
      localStorage.getItem("assinaturaPlano") ??
      localStorage.getItem("plano") ??
      sessionStorage.getItem("assinaturaPlano") ??
      sessionStorage.getItem("plano") ??
      "";

    const normalized = String(planoRaw || "").toLowerCase();

    if (!normalized) return true;

    if (
      normalized.includes("pro") ||
      normalized.includes("elite") ||
      normalized.includes("premium")
    ) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export default function TreinosInstrutores({
  tipo,
}: {
  tipo: UsuarioLogado["tipo"] | "";
}) {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [abaProfessor, setAbaProfessor] = useState<
    "avaliar" | "criar" | "sessoes" | "exercicios" | "learning"
  >("exercicios");
  const [meuNome, setMeuNome] = useState<string>("");
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [profNomeById, setProfNomeById] = useState<Record<string, string>>({});
  const [submissoesPendentes, setSubmissoesPendentes] = useState<
    SubmissaoParaValidacao[]
  >([]);
  const [carregandoSubmissoes, setCarregandoSubmissoes] = useState(false);
  const [page, setPage] = useState({ total: 0, limit: 20, offset: 0 });
  const [metodologias, setMetodologias] = useState<MetodologiaCard[]>([]);
  const [exerciciosConcluidos, setExerciciosConcluidos] = useState<string[]>([]);
  const [buscaMetodologias, setBuscaMetodologias] = useState("");
  const [loadingMetodologias, setLoadingMetodologias] = useState(false);
  const [erroMetodologias, setErroMetodologias] = useState<string | null>(null);
  // filtros selecionados (chips)
  const [filtrosSelecionados, setFiltrosSelecionados] = useState<string[]>([]);
  type FiltroConteudo = "TODOS" | "VIDEOS_TREINOS" | "VIDEOS" | "TREINOS";
  const [filtroConteudo, setFiltroConteudo] = useState<FiltroConteudo>("TODOS");
  const [filtroNivel, setFiltroNivel] = useState<"TODOS" | "Base" | "Avancado" | "Performance">("TODOS");
  const OPCOES_FILTRO = [
    "Goleiros",
    "Linhas",
    "Base",
    "Avançado",
    "Mentalidade",
  ] as const;

  function toggleFiltro(tag: string) {
    setFiltrosSelecionados((prev) => {
      const has = prev.some((x) => normTxt(x) === normTxt(tag));
      if (has) return prev.filter((x) => normTxt(x) !== normTxt(tag));
      return [...prev, tag];
    });
  }

  function limparFiltros() {
    setFiltrosSelecionados([]);
  }

  const [filtroPublico, setFiltroPublico] = useState<"TODOS" | "ATLETAS" | "PROFISSIONAIS" | "AMBOS">("TODOS");
  const [atletasVinculados, setAtletasVinculados] = useState<AtletaVinculado[]>([]);
  const [atletasSelecionadosByTreinoId, setAtletasSelecionadosByTreinoId] = useState<Record<string, string[]>>({});
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaSelecionadaByTreinoId, setTurmaSelecionadaByTreinoId] = useState<Record<string, string>>({});
  const [sessoesDeHoje, setSessoesDeHoje] = useState<SessaoDeHoje[]>([]);
  const [sessaoAbertaExerciciosId, setSessaoAbertaExerciciosId] = useState<string | null>(null);
  const [sessaoEmRemarcacaoId, setSessaoEmRemarcacaoId] = useState<string | null>(null);
  const [remarcarDataBySessaoId, setRemarcarDataBySessaoId] = useState<Record<string, string>>({});
  const [remarcarHoraBySessaoId, setRemarcarHoraBySessaoId] = useState<Record<string, string>>({});
  const [videoModal, setVideoModal] = useState<{
    url: string;
    nome: string;
    repeticoes?: string;
  } | null>(null);
  const [exerciciosMarcadosBySessao, setExerciciosMarcadosBySessao] =
    useState<Record<string, string[]>>({});
  const [alunosDaSessao, setAlunosDaSessao] = useState<AtletaVinculado[]>([]);
  const [modalSessaoId, setModalSessaoId] = useState<string | null>(null);
  const [presentesSelecionados, setPresentesSelecionados] = useState<string[]>([]);
  const [clockNow, setClockNow] = useState<number>(Date.now());
  const [professoresVinculadosIds, setProfessoresVinculadosIds] = useState<string[]>([]);
  const [professoresVinculadosNomeById, setProfessoresVinculadosNomeById] = useState<Record<string, string>>({});
  const [realizadoCountByTreinoId, setRealizadoCountByTreinoId] = useState<Record<string, number>>({});
  const [exerciciosCountByTreinoId, setExerciciosCountByTreinoId] = useState<Record<string, number>>({});
  const [videoByExId, setVideoByExId] = useState<Record<string, string>>({});
  const startedAtRef = useRef<string | null>(null);
  const debugOnceRef = useRef(false);

  const turmaById = useMemo(() => {
    const map: Record<string, Turma> = {};
     for (const t of turmas) map[String(t.id)] = t;
      return map;
  }, [turmas]);

  const atletaNomeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of atletasVinculados) {
      const id = String(a?.id ?? "").trim();
      const nome = String(a?.usuario?.nome ?? "").trim();
      if (id && nome) map[id] = nome;
    }
    return map;
  }, [atletasVinculados]);

  useEffect(() => {
  const token = getToken();
  if (!token) return;

  (async () => {
    const res = await fetch(`${API.BASE_URL}/api/exercicios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

    const map: Record<string, string> = {};
    for (const e of list) {
      const v = e.videoDemonstrativoUrl ?? e.videoUrl ?? e.video ?? null;
      if (e.id && v) map[String(e.id)] = String(v);
    }
    setVideoByExId(map);
  })();
}, []);

useEffect(() => {
  const token = getToken();
  if (!token) return;

  (async () => {
    try {
      const res = await fetch(`${API.BASE_URL}/api/professores`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

      const map: Record<string, string> = {};

      for (const p of list) {
        const professorId = String(p?.id ?? "").trim();
        const usuarioId = String(p?.usuarioId ?? p?.usuario?.id ?? "").trim();

        const nome =
          p?.usuario?.nome ||
          p?.nome ||
          p?.usuario?.nomeCompleto ||
          "";

        const nomeLimpo = String(nome || "").trim();
        if (!nomeLimpo) continue;

        if (professorId) map[professorId] = nomeLimpo;
        if (usuarioId) map[usuarioId] = nomeLimpo;
      }

      setProfNomeById(map);
    } catch (e) {
      console.warn("[treinos] falha ao carregar /api/professores", e);
    }
  })();
}, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const tipoUser = String(usuario?.tipo ?? "").toLowerCase();
    const tipoUsuarioId = String(usuario?.tipoUsuarioId ?? "").trim();

    if (!tipoUsuarioId) return;

    if (tipoUser !== "clube" && tipoUser !== "escolinha") {
      setProfessoresVinculadosIds([]);
      setProfessoresVinculadosNomeById({});
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API.BASE_URL}/api/professores/vinculados?tipo=${encodeURIComponent(tipoUser)}&tipoUsuarioId=${encodeURIComponent(tipoUsuarioId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const txt = await res.text().catch(() => "");
        
        if (!res.ok) {
          setProfessoresVinculadosIds([]);
          setProfessoresVinculadosNomeById({});
          return;
        }

        const data = txt ? JSON.parse(txt) : [];

        const list = Array.isArray(data) ? data : data.items ?? data.data ?? [];

        const ids: string[] = [];
        const nomeById: Record<string, string> = {};

        for (const p of list) {
          const id =
            String(
              p?.professorId ??
              p?.professor?.id ??
              p?.id ??
              ""
            ).trim();

          if (!id) continue;

          const nome =
            String(
              p?.professor?.usuario?.nome ??
              p?.professor?.nome ??
              p?.usuario?.nome ??
              p?.nome ??
              ""
            ).trim();

          ids.push(id);
          if (nome) nomeById[id] = nome;
        }

        setProfessoresVinculadosIds(Array.from(new Set(ids)));
        setProfessoresVinculadosNomeById(nomeById);
      } catch (e) {
        console.warn("[treinos] erro ao carregar professores vinculados", e);
        setProfessoresVinculadosIds([]);
        setProfessoresVinculadosNomeById({});
      }
    })();
  }, [usuario?.tipo, usuario?.tipoUsuarioId]);

  useEffect(() => {
    if (abaProfessor !== "learning") return;
    carregarMetodologias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaProfessor, filtroPublico]);

  useEffect(() => {
    const id = setInterval(() => {
      setClockNow(Date.now());
    }, 1000); 

    return () => clearInterval(id);
  }, []);

  async function carregarMetodologias() {
    const token = getToken();
    if (!token) {
      setErroMetodologias("Sem token. Faça login novamente.");
      return;
    }

    setLoadingMetodologias(true);
    setErroMetodologias(null);

    try {
      const publicoParam = filtroPublico; // já é "TODOS" | "ATLETAS" | "PROFISSIONAIS" | "AMBOS"

      const r = await fetch(
        `${API.BASE_URL}/api/metodologias/visiveis?publico=${encodeURIComponent(publicoParam)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );


      const js = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(js?.message || js?.error || "Falha ao carregar metodologias.");
      }

      const arr: any[] = Array.isArray(js) ? js : js.items ?? [];

      const normalizadas: MetodologiaCard[] = arr.map((m: any) => ({
        id: String(m.id),
        titulo: m.titulo ?? m.nome ?? "Metodologia",
        descricao: m.descricao ?? null,

        // ✅ capa correta (evita 404 em localhost:5173/uploads/...)
        capaUrl: normalizeAssetUrl(m.capaUrl ?? m.logoUrl ?? m.imagemUrl ?? null),

        publicoAlvo: m.publicoAlvo ?? "AMBOS",
        nivel: m.nivel ?? null,
        tipo: m.tipo ?? null,
        totalSemanas: Number(m.totalSemanas ?? 0),
        videoCount: Number(m.videoCount ?? m._count?.itensVideo ?? 0),
        treinoCount: Number(m.treinoCount ?? m._count?.itensTreino ?? 0),
        totalAssinantes: Number(m.totalAssinantes ?? m._count?.assinantes ?? 0),
        mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
        notaCount: Number(m.totalReviews ?? m.notaCount ?? 0),
        totalReviews: Number(m.totalReviews ?? m.notaCount ?? 0),
        // ⚠️ a lista normalmente NÃO vem com pontos -> vamos preencher depois via detalhe
        pontos: Number(m.pontosTotal ?? m.pontos ?? m.pontuacao ?? 0),
        criadorNome:
          m.criadorNome ??
          m.autor?.nome ??
          m.criador?.nome ??
          m.professor?.nome ??
          m.usuarioCriador?.nome ??
          null,

      }));

      // ✅ ENRIQUECE (pontos + capa garantida) usando /detalhe
      const detalhadas = await Promise.all(
        normalizadas.map(async (card) => {
          try {
            const rr = await fetch(
              `${API.BASE_URL}/api/metodologias/${encodeURIComponent(card.id)}/detalhe`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const jj = await rr.json().catch(() => null);
            if (!rr.ok || !jj) return card;

            // 1) tenta vir pronto do backend
            let pontosTotal = Number(jj.pontosTotal ?? 0);

            // 2) fallback: soma pontos dos itens (MetodologiaItem.pontos)
            if (!pontosTotal && Array.isArray(jj.itens)) {
              pontosTotal = jj.itens
                .filter((it: any) => it?.publicado !== false)
                .reduce((acc: number, it: any) => acc + Number(it?.pontos ?? 0), 0);
            }

            // (opcional) melhora contagem de itens se o detalhe vier com itens
            const itens = Array.isArray(jj.itens) ? jj.itens : [];
            const videoCount = itens.filter((it: any) => String(it?.tipo).toUpperCase() === "VIDEO" && it?.publicado !== false).length;
            const treinoCount = itens.filter((it: any) => String(it?.tipo).toUpperCase() === "TREINO" && it?.publicado !== false).length;

            const nomeCriador =
              jj?.criadorNome ??
              jj?.criadorUsuario?.nome ??
              jj?.criadorUsuario?.nomeDeUsuario ??
              jj?.autor?.nome ??
              jj?.autor?.nomeDeUsuario ??
              jj?.professor?.nome ??
              jj?.clube?.nome ??
              jj?.escolinha?.nome ??
              null;

            const mediaAvaliacao = Number(
              jj.mediaAvaliacao ?? jj.media ?? jj.notaMedia ?? card.mediaAvaliacao ?? 0
            );

            const totalReviews = Number(
              jj.totalReviews ?? jj.totalAvaliacoes ?? jj.notaCount ?? card.totalReviews ?? 0
            );

            return {
              ...card,
              criadorNome: card.criadorNome || (nomeCriador ? String(nomeCriador) : null),
              pontos: Number.isFinite(pontosTotal) ? pontosTotal : card.pontos,
              capaUrl: normalizeAssetUrl(jj.capaUrl ?? card.capaUrl) ?? card.capaUrl,
              videoCount: videoCount || card.videoCount,
              treinoCount: treinoCount || card.treinoCount,
              mediaAvaliacao: Number.isFinite(mediaAvaliacao) ? mediaAvaliacao : (card.mediaAvaliacao ?? 0),
              totalReviews: Number.isFinite(totalReviews) ? totalReviews : (card.totalReviews ?? 0),
            };
          } catch (e: any) {
            console.warn("Erro ao detalhar metodologia", card.id, e);
            return card;
          }
        })
      );

      setMetodologias(detalhadas);
    } catch (e: any) {
      setErroMetodologias(e?.message || "Erro ao carregar metodologias.");
      setMetodologias([]);
    } finally {
      setLoadingMetodologias(false);
    }
  }

  async function assinarMetodologia(metodologiaId: string) {
    const token = getToken();
    if (!token) return;

    try {
      // ajuste se sua rota for outra:
      // ex: POST /api/metodologias/:id/assinar
      const res = await fetch(
        `${API.BASE_URL}/api/metodologias/${encodeURIComponent(metodologiaId)}/assinar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(payload?.message || "Não foi possível assinar a metodologia.");
        return;
      }

      // marca como assinada sem precisar refetch
      setMetodologias((prev) =>
        prev.map((m) => (m.id === metodologiaId ? { ...m, jaAssinada: true } : m))
      );
    } catch {
      alert("Erro ao assinar a metodologia.");
    }
  }

  async function buscarAlunosDaTurma(turmaId: string): Promise<AtletaVinculado[]> {
    const token = getToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/turmas/${encodeURIComponent(turmaId)}/alunos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.warn("[treinos] rota /turmas/:id/alunos não retornou alunos com atletaId");
        return [];
      }

      const data = await res.json();
      
      if (Array.isArray((data as any).alunos)) {
        const raw = (data as any).alunos;

      const alunos: AtletaVinculado[] = raw
        .map((a: any) => {
          const usuarioId = a.usuario?.id ?? a.usuarioId ?? "";
          const atletaId  = a.atletaId ?? a.id ?? null;

          const id = atletaId || "";

          if (!id) return null;

          const nome = a.usuario?.nome ?? a.nome ?? "Atleta";
          const foto = a.usuario?.foto ?? a.foto ?? null;

          return {
            id, 
            usuario: { id: usuarioId || id, nome, foto },
          };
        })
        .filter((a: any) => !!a);

      return alunos;
      }

      console.warn("[treinos] backend não retornou alunos com atletaId. Ajuste /api/turmas/:id/alunos para retornar alunos[].atletaId");
      return [];

    } catch (e) {
      console.error("[treinos] erro ao buscar alunos da turma", turmaId, e);
      return [];
    }
  }

 async function finalizarTreinoSessao(sessaoId: string) {
  const token = getToken();

  const sessao = sessoesDeHoje.find((x: any) => x.id === sessaoId);

  let tempoSeg = 0;

  if (sessao?.startedAt) {
    const inicioMs = new Date(sessao.startedAt).getTime();
    tempoSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));
  } else if (startedAtRef.current) {
    const inicioMs = new Date(startedAtRef.current).getTime();
    tempoSeg = Math.max(1, Math.round((Date.now() - inicioMs) / 1000));
  }

  const res = await fetch(
    `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(sessaoId)}/finalizar`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const js = await res.json().catch(() => ({}));
  if (!res.ok) {
    alert(js?.erro || js?.message || "Erro ao finalizar treino.");
    return;
  }

  const pontos = encodeURIComponent(String(js?.pontosAplicadosPorAtleta ?? 0));
  const tempo = encodeURIComponent(String(tempoSeg));

  window.location.href =
    `/submissao?sessaoId=${encodeURIComponent(sessaoId)}` +
    `&pontos=${pontos}` +
    `&tempoSeg=${tempo}`;
}

  async function abrirModalIniciar(sessaoId: string, turmaId?: string) {
    const token = getToken();
    if (!token) return;

    const turmaIdOk = String(turmaId || "").trim();
    if (!turmaIdOk) {
      console.warn("[treinos] turmaId ausente para buscar alunos", { sessaoId, turmaId });
      alert("Não consegui identificar a turma dessa sessão. Recarregue a página.");
      return;
    }

    // sempre trabalhar com let (nunca const) porque vamos setar depois
    let alunos: AtletaVinculado[] = [];

    try {
      // ✅ usa SEMPRE /turma/:id/alunos
      const res = await fetch(`${API.BASE_URL}/api/turmas/${turmaIdOk}/alunos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        console.warn("[treinos] falha ao buscar alunos da turma", turmaIdOk, res.status);
        // abre modal vazio mesmo, pra não travar o fluxo
        setAlunosDaSessao([]);
        setPresentesSelecionados([]);
        setModalSessaoId(sessaoId);
        return;
      }

      const data = await res.json();
      const arr = Array.isArray(data?.alunos) ? data.alunos : data;
      const listaBruta = Array.isArray(arr) ? arr : [];
      // ✅ mantém apenas quem realmente está na turma
      const lista = listaBruta.filter((a: any) => {
        // se o backend informar inTurma, respeita
        if (typeof a?.inTurma === "boolean") return a.inTurma === true;

        // fallback: se veio usuarioId/atletaId já vinculado, mantém
        return Boolean(a?.usuarioId || a?.usuario?.id || a?.atletaId || a?.id);
      });

      alunos = lista
        .map((a: any) => {
          const atletaId = a.atletaId ?? a.id ?? "";
          if (!atletaId) return null;

          const usuarioId = a.usuario?.id ?? a.usuarioId ?? "";
          const nome = a.usuario?.nome ?? a.nome ?? "Atleta";
          const foto = a.usuario?.foto ?? a.foto ?? null;

          return {
            id: String(atletaId),
            usuario: {
              id: String(usuarioId || atletaId),
              nome: String(nome),
              foto,
            },
          } as AtletaVinculado;
        })
        .filter(Boolean) as AtletaVinculado[];

      const vistos = new Set<string>();
      alunos = alunos.filter((a) => {
        const key = String(a.id);
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });

      setAlunosDaSessao(alunos);
      // ✅ padrão: todos marcados como presentes (igual seu código atual fazia)
      setPresentesSelecionados(alunos.map((a) => a.id));
      setModalSessaoId(sessaoId);
    } catch (e) {
      console.error("[treinos] erro ao abrir modal de presença:", e);
      setAlunosDaSessao([]);
      setPresentesSelecionados([]);
      setModalSessaoId(sessaoId);
    }
  }

  async function confirmarPresencas() {
    const token = getToken();
    if (!token || !modalSessaoId) return;

    const sessaoId = modalSessaoId;

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/sessoes-turma/${sessaoId}/iniciar`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            presentes: presentesSelecionados,
          }),
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("[treinos] erro ao iniciar sessão:", res.status, txt);
        alert("Não foi possível iniciar esse treino.");
        return;
      }

      const js = await res.json().catch(() => ({}));

      startedAtRef.current = js?.startedAt ?? new Date().toISOString();
      
      setModalSessaoId(null);
      setSessaoAbertaExerciciosId(sessaoId);
      await carregarSessoesDeHoje();
    } catch (e) {
      console.error("[treinos] erro ao confirmar presenças:", e);
      alert("Erro inesperado ao iniciar o treino.");
    }
  }

 async function carregarSessoesDeHoje() {
  const token = getToken();
  if (!token) return;

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/minhas?onlyToday=1&onlyTurma=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Falha ao buscar sessões");

    const data = await res.json();

    // ✅ pega a lista independente do formato que o backend retornar
    const items: any[] =
      Array.isArray(data) ? data :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data?.sessoes) ? data.sessoes :
      [];

    const norm: SessaoDeHoje[] = (items ?? []).map((s: any) => {
      const dataSessao = parseDateSafe(s.data);
      const win = getStartWindowInfo(dataSessao);

      const faltou = s.status === "AGENDADO" && Boolean(win?.isLate);
      const podeIniciar =
        s.status === "AGENDADO" && Boolean(win?.canStart) && !Boolean(win?.isLate);

      const statusVisual: SessaoDeHoje["status"] =
        s.status === "EM_ANDAMENTO"
          ? "em_andamento"
          : s.status === "FINALIZADO"
          ? "finalizada"
          : s.status === "CANCELADO"
          ? "cancelada"
          : faltou
          ? "faltou"
          : "nao_iniciada";

      return {
        id: String(s.id),
        data: String(s.data),
        treino: s.treino,
        turma: s.turma,
        exercicios: s.exercicios,
        presencas: s.presencas,
        presentes: s.presentes ?? [],
        presentesNomes: Array.isArray(s.presentesNomes) ? s.presentesNomes : [],
        statusRaw: String(s.status),
        status: statusVisual,
        dataSessao,
        win,
        faltou,
        podeIniciar,
        // ✅ adicionar
        duracaoMinutosReal:
          s.duracaoMinutosReal == null ? null : Number(s.duracaoMinutosReal),
        penalidadeAtraso: Boolean(s.penalidadeAtraso),
      };
    });

    setSessoesDeHoje(norm);
    setExerciciosMarcadosBySessao((prev) => {
      const next: Record<string, string[]> = { ...prev };
      norm.forEach((sessao) => {
        const marcados =
          sessao.exercicios
            ?.filter((e: ExercicioSessaoDetalhe) => e.concluido)
            .map((e: ExercicioSessaoDetalhe) => e.id) ?? [];
        if (marcados.length) {
          next[sessao.id] = marcados;
        }
      });
      return next;
    });
  } catch (e) {
    console.error("Erro ao carregar sessões:", e);
  }
}

async function remarcarSessao(
  sessaoId: string,
  dataISO: string,
  hora?: string,
) {
  const token = getToken();
  if (!token) return;

  if (!dataISO) {
    alert("Escolha uma data para remarcar o treino.");
    return;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diaSelecionado = new Date(`${dataISO}T00:00:00`);
  if (diaSelecionado < hoje) {
    alert("Você não pode remarcar um treino para uma data que já passou.");
    return;
  }

  let novaDataISO: string;
  if (hora && /^\d{2}:\d{2}$/.test(hora)) {
    const [h, m] = hora.split(":").map(Number);
    const d = new Date(diaSelecionado);
    d.setHours(h, m, 0, 0);
    novaDataISO = d.toISOString();
  } else {
    novaDataISO = `${dataISO}T12:00:00.000Z`;
  }

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(
        sessaoId,
      )}/remarcar`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ novaDataISO }),
      },
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[treinos] erro ao remarcar sessão:", res.status, txt);
      alert("Não foi possível remarcar esse treino.");
      return;
    }

    alert("Treino remarcado com sucesso!");

    setSessaoEmRemarcacaoId(null);
    await carregarSessoesDeHoje();
  } catch (e) {
    console.error("[treinos] erro inesperado ao remarcar sessão:", e);
    alert("Erro inesperado ao remarcar o treino.");
  }
}

async function excluirSessao(sessaoId: string) {
  const token = getToken();
  if (!token) return;

  if (!window.confirm("Tem certeza que deseja excluir esse treino da sua agenda?")) {
    return;
  }

  try {
    const res = await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(sessaoId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[treinos] erro ao excluir sessão:", res.status, txt);
      alert("Não foi possível excluir esse treino.");
      return;
    }

    setSessoesDeHoje((prev) => prev.filter((s) => s.id !== sessaoId));
    setSessaoAbertaExerciciosId((prev) => (prev === sessaoId ? null : prev));

    alert("Treino removido da sua agenda.");

  } catch (e) {
    console.error("[treinos] erro inesperado ao excluir sessão:", e);
    alert("Erro inesperado ao excluir o treino.");
  }
}

async function salvarProgressoSessao(sessaoId: string) {
  const token = getToken();
  if (!token) return;

  const ids = exerciciosMarcadosBySessao[sessaoId] ?? [];

  try {
    await fetch(
      `${API.BASE_URL}/api/sessoes-turma/${encodeURIComponent(
        sessaoId,
      )}/progresso`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ exerciciosConcluidosIds: ids }),
      },
    );
  } catch (e) {
    console.error("Erro ao salvar progresso da sessão:", e);
  }
}

  useEffect(() => {
    if (abaProfessor === "sessoes") carregarSessoesDeHoje();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abaProfessor, atletasVinculados.length]);

  useEffect(() => {
    const tipoSalvo =
      (Storage as any).tipoSalvo ??
      (Storage as any).tipoUsuario ??
      (Storage as any).tipo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario");

    const usuarioId =
      (Storage as any).usuarioId ?? localStorage.getItem("usuarioId");
    const tipoUsuarioId =
      (Storage as any).tipoUsuarioId ??
      localStorage.getItem("tipoUsuarioId") ??
      "";

    const t = String(tipoSalvo || "").toLowerCase() as UsuarioLogado["tipo"];
    if (
      [
        "admin",
        "atleta",
        "escola",
        "escolinha",
        "clube",
        "professor",
        "olheiro",
      ].includes(t) &&
      usuarioId
    ) {
      setUsuario({ tipo: t, usuarioId, tipoUsuarioId });
      (async () => {
        const token = getToken();
        if (!token) return;

        try {
          const r = await fetch(`${API.BASE_URL}/api/perfil/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) return;

          const me = await r.json().catch(() => ({}));

          const nome =
            me?.usuario?.nome ||
            me?.nome ||
            me?.professor?.usuario?.nome ||
            me?.professor?.nome ||
            me?.clube?.nome ||
            me?.escolinha?.nome ||
            "";

          setMeuNome(String(nome || "").trim());

          const tipoIdReal = getTipoUsuarioIdFromMe(t, me);

          if (tipoIdReal) {
            setUsuario((prev) =>
              prev ? { ...prev, tipoUsuarioId: tipoIdReal } : { tipo: t, usuarioId, tipoUsuarioId: tipoIdReal },
            );

            localStorage.setItem("tipoUsuarioId", tipoIdReal);
            sessionStorage.setItem("tipoUsuarioId", tipoIdReal);
          }
        } catch {}
      })();

    } else {
      console.warn("Tipo/IDs inválidos", { tipoSalvo, usuarioId, tipoUsuarioId });
    }
  }, []);

  const meusTreinos = treinos.filter((t) => {
    const meuId = String(usuario?.tipoUsuarioId ?? "").trim();
    const meuTipo = String(usuario?.tipo ?? "").toLowerCase();

    const donoId = {
      clubeId: String(t.clubeId ?? "").trim(),
      escolinhaId: String(t.escolinhaId ?? "").trim(),
      professorId: String(t.professorId ?? "").trim(),
    };

    const euSouDono =
      (!!meuId && (donoId.clubeId === meuId || donoId.escolinhaId === meuId || donoId.professorId === meuId));

    const euSouColaborador =
      Array.isArray(t.professoresIds) &&
      !!meuId &&
      t.professoresIds.map(String).includes(meuId);

    const treinoDoMeuProfessorVinculado =
      (meuTipo === "clube" || meuTipo === "escolinha") &&
      !!donoId.professorId &&
      professoresVinculadosIds.map(String).includes(donoId.professorId);

    const fallbackPorNome =
      !!meuNome &&
      Array.isArray(t.criadoresNomes) &&
      t.criadoresNomes.some((n) => normTxt(n) === normTxt(meuNome));

    return euSouDono || euSouColaborador || treinoDoMeuProfessorVinculado || fallbackPorNome;
  });

  const listaParaExibir =
    usuario?.tipo === "admin"
      ? treinos
      : treinos; // ✅ sempre usa a lista completa; depois você separa em "meus" e "vinculados"

  const listaOrdenadaParaExibir = useMemo(() => {
    const meuId = String(usuario?.tipoUsuarioId ?? "").trim();

    const getNomeCriador = (t: TreinoProgramado) => {
      const n1 = (Array.isArray(t.criadoresNomes) && t.criadoresNomes[0]) ? t.criadoresNomes[0] : "";
      const n2 = (t as any).criadorNome ?? "";
      const n3 =
        (t.professorId && profNomeById[String(t.professorId)]) ||
        (t.professorId && professoresVinculadosNomeById[String(t.professorId)]) ||
        "";
      return String(n1 || n2 || n3 || "—").trim();
    };

    const isMeuTreino = (t: TreinoProgramado) => {
      if (!meuId) return false;

      const donoIds = [t.professorId, t.clubeId, t.escolinhaId].map((x) => String(x ?? "").trim());
      const souDono = donoIds.includes(meuId);

      const souColab =
        Array.isArray(t.professoresIds) &&
        t.professoresIds.map(String).includes(meuId);

      return souDono || souColab;
    };

    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

    return [...(listaParaExibir ?? [])].sort((a, b) => {
      const aMine = isMeuTreino(a);
      const bMine = isMeuTreino(b);

      if (aMine !== bMine) return aMine ? -1 : 1;

      const na = getNomeCriador(a);
      const nb = getNomeCriador(b);
      const byOwner = collator.compare(na, nb);
      if (byOwner !== 0) return byOwner;

      return collator.compare(String(a.nome ?? ""), String(b.nome ?? ""));
    });
  }, [listaParaExibir, usuario?.tipoUsuarioId, profNomeById, professoresVinculadosNomeById]);

  const totalTreinosExibidos = useMemo(() => listaOrdenadaParaExibir.length, [listaOrdenadaParaExibir]);

  

  const totalExerciciosExibidos = useMemo(() => {
    return (listaOrdenadaParaExibir || []).reduce((acc, t) => {
      const n = Number(exerciciosCountByTreinoId[t.id] ?? t.exercicios?.length ?? 0);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [listaOrdenadaParaExibir, exerciciosCountByTreinoId]);

  const usuarioReady = useMemo(() => {
    const tipoOk = String(usuario?.tipo ?? tipo ?? "").trim().toLowerCase();
    const idOk = String(usuario?.tipoUsuarioId ?? "").trim();
    return { tipoOk, idOk, ready: !!tipoOk && !!idOk };
  }, [usuario?.tipo, usuario?.tipoUsuarioId, tipo]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    if (!usuarioReady.ready) return;

    const tipoTela = String(usuarioReady.tipoOk || "").toLowerCase();
    const vinculo =
      tipoTela === "escolinha" || tipoTela === "escola" ? "escolinha" :
      tipoTela === "clube" ? "clube" :
      tipoTela === "professor" ? "professor" :
      "";

    const entidadeIdReal = String(usuarioReady.idOk || "").trim();
    const entidadeFallback = String(usuario?.usuarioId || "").trim();
    const idParaEnviar = entidadeIdReal || entidadeFallback;

    if (!vinculo || !idParaEnviar) return;

    const headers = { Authorization: `Bearer ${token}` };

    const run = async () => {
      try {
        const isProfessor = vinculo === "professor";

        const url = isProfessor
          ? `${API.BASE_URL}/api/treinosprogramados` +
            `?professorId=${encodeURIComponent(idParaEnviar)}` +
            `&incluirColabs=1` +
            `&order=desc` +
            `&limit=200`
          : `${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis` +
            `?vinculo=${encodeURIComponent(vinculo)}` +
            `&id=${encodeURIComponent(idParaEnviar)}` +
            (entidadeIdReal ? `&tipoUsuarioId=${encodeURIComponent(entidadeIdReal)}` : "") +
            `&debug=1`;

        const r = await fetch(url, { headers });

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          throw new Error(`/gerenciar/treinosprogramados/visiveis: ${r.status} ${txt}`);
        }

        const jsonTreinos = await r.json().catch(() => ({}));
        const arr = Array.isArray(jsonTreinos)
          ? jsonTreinos
          : (jsonTreinos?.items ?? jsonTreinos?.data ?? []);

console.log("[treinos] resposta bruta:", jsonTreinos);
console.log("[treinos] items recebidos:", Array.isArray(arr) ? arr.length : 0);

        const normTreinos: TreinoProgramado[] = (Array.isArray(arr) ? arr : []).map((tr: any) => {
          const criadoresArr = Array.isArray(tr?.criadores) ? tr.criadores : [];
          const ids = getOwnerIdsFromTreino(tr);

          const criadorNomePrincipal =
            tr?.autor?.nome ||
            tr?.professor?.usuario?.nome ||
            tr?.professor?.nome ||
            (tr?.professorId ? profNomeById[String(tr.professorId)] : undefined) ||
            tr?.criador?.nome ||
            tr?.criadorNome ||
            tr?.clube?.nome ||
            tr?.escolinha?.nome ||
            tr?.escola?.nome ||
            (criadoresArr[0]?.nome ? String(criadoresArr[0].nome) : undefined) ||
            undefined;

          const criadorTipoRaw = String(tr?.criadorTipo ?? tr?.creatorType ?? tr?.criador?.tipo ?? "").toLowerCase();
          const criadorTipo: TreinoProgramado["criadorTipo"] =
            ids.professorId ? "professor"
            : ids.clubeId ? "clube"
            : ids.escolinhaId ? "escolinha"
            : criadorTipoRaw === "professor" ? "professor"
            : criadorTipoRaw === "clube" ? "clube"
            : criadorTipoRaw === "escolinha" ? "escolinha"
            : criadorTipoRaw === "escola" ? "escola"
            : criadorTipoRaw === "admin" ? "admin"
            : "desconhecido";

          const colaboradoresRaw =
            tr?.professores ||
            tr?.colaboradores ||
            tr?.professoresTreino ||
            tr?.treinosParticipando ||
            tr?.treinosParticipandoProfessor ||
            tr?.professoresIds ||
            [];

          const professoresIdsFromRaw: string[] = Array.from(
            new Set(
              (Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [])
                .map((p: any) =>
                  String(
                    p?.professorId ??
                    p?.professor?.id ??
                    p?.participanteId ??
                    p?.userId ??
                    p?.id ??
                    p ??
                    "",
                  ).trim(),
                )
                .filter(Boolean),
            ),
          );

          const professoresIdsFromCriadores: string[] = Array.from(
            new Set(
              criadoresArr
                .filter((c: any) => String(c?.tipo || "").toLowerCase() === "professor")
                .map((c: any) => String(c?.id || "").trim())
                .filter(Boolean),
            ),
          );

          const professoresIds: string[] = Array.from(
            new Set([...professoresIdsFromRaw, ...professoresIdsFromCriadores].filter(Boolean)),
          );

          const nomesFromIds = professoresIds
            .map((id) => profNomeById[String(id)])
            .map((x) => String(x || "").trim())
            .filter(Boolean);

          const nomesFromCriadores = criadoresArr
            .filter((c: any) => String(c?.tipo || "").toLowerCase() === "professor")
            .map((c: any) => String(c?.nome || "").trim())
            .filter(Boolean);

          const colaboradoresNomes: string[] = Array.from(
            new Set(
              [
                ...(Array.isArray(colaboradoresRaw) ? colaboradoresRaw : [])
                  .map((p: any) => p?.usuario?.nome ?? p?.nome ?? p?.professor?.usuario?.nome ?? p?.professor?.nome ?? "")
                  .map((x: any) => String(x || "").trim())
                  .filter(Boolean),
                ...nomesFromIds,
                ...nomesFromCriadores,
              ].filter(Boolean),
            ),
          );

          const meuTipoUsuarioId = usuarioReady.idOk;
          const souDono =
            String(ids.professorId ?? "") === meuTipoUsuarioId ||
            String(ids.escolinhaId ?? "") === meuTipoUsuarioId ||
            String(ids.clubeId ?? "") === meuTipoUsuarioId;

          const souColaborador = professoresIds.includes(meuTipoUsuarioId);
          const incluirMeuNome = Boolean(meuNome) && (souDono || souColaborador);
          const normalizarNome = (s: any) => String(s || "").trim().toLowerCase();

          const listaBruta = [
            criadorNomePrincipal,
            ...(incluirMeuNome ? [meuNome] : []),
            ...colaboradoresNomes,
          ]
            .map((x) => String(x || "").trim())
            .filter(Boolean);

          const criadoresNomes = Array.from(
            new Map(listaBruta.map((n) => [normalizarNome(n), n])).values(),
          );

          const professorIdFix =
            ids.professorId ||
            pickFirstId(tr, ["professorId", "professor_id", "ProfessorId", "criadorProfessorId"]) ||
            pickFirstId(tr?.professor, ["id", "professorId", "usuarioId"]) ||
            pickFirstId(tr?.criador, ["professorId", "usuarioId"]) ||
            undefined;

          const escolinhaIdFix =
            ids.escolinhaId ||
            pickFirstId(tr, ["escolinhaId", "escolinha_id", "EscolinhaId", "criadorEscolinhaId"]) ||
            pickFirstId(tr?.escolinha, ["id", "escolinhaId"]) ||
            pickFirstId(tr?.criador, ["escolinhaId"]) ||
            undefined;

          const clubeIdFix =
            ids.clubeId ||
            pickFirstId(tr, ["clubeId", "clube_id", "ClubeId", "criadorClubeId"]) ||
            pickFirstId(tr?.clube, ["id", "clubeId"]) ||
            pickFirstId(tr?.criador, ["clubeId"]) ||
            undefined;

          const toNum = (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          };

          return {
            id: String(tr.id),
            nome: String(tr.nome ?? ""),
            descricao: tr.descricao ?? undefined,
            nivel: String(tr.nivel ?? ""),
            dataAgendada: tr.dataAgendada ?? undefined,
            duracao: typeof tr.duracao === "number" ? tr.duracao : undefined,
            objetivo: tr.objetivo ?? undefined,
            dicas: Array.isArray(tr.dicas) ? tr.dicas : [],
            professorId: professorIdFix,
            escolinhaId: escolinhaIdFix,
            clubeId: clubeIdFix,
            pontuacao: toNum(tr.pontuacao ?? 0),
            professoresIds,
            criadoresNomes,
            criadorTipo,
            exercicios: (Array.isArray(tr.exercicios) ? tr.exercicios : []).map((ex: any) => ({
              id: String(
                ex?.exercicio?.id ??
                ex?.exercicioTemporario?.id ??
                ex?.exercicioPersonalizado?.id ??
                ex?.id ??
                ""
              ),
              nome: String(
                ex?.exercicio?.nome ??
                ex?.exercicioTemporario?.nome ??
                ex?.exercicioPersonalizado?.nome ??
                ex?.nome ??
                ""
              ),
              repeticoes: ex?.repeticoes ?? null,
              series: ex?.series ?? null,
              duracao: ex?.duracao ?? null,
              descanso: ex?.descanso ?? null,
            })),
          };
        });

        setTreinos(normTreinos);

console.log("[treinos] normTreinos:", normTreinos.length);

        // stats (se existir no backend)
        try {
          const ids = normTreinos.map((t) => t.id).filter(Boolean);
          if (ids.length) {
            const statsRes = await fetch(
              `${API.BASE_URL}/api/treinos/programados/stats?ids=${encodeURIComponent(ids.join(","))}`,
              { headers }
            );

            if (statsRes.ok) {
              const statsJson = await statsRes.json().catch(() => ({}));
              setRealizadoCountByTreinoId(statsJson?.realizadoCountByTreinoId ?? {});
              setExerciciosCountByTreinoId(statsJson?.exerciciosCountByTreinoId ?? {});
            } else {
              setRealizadoCountByTreinoId({});
              setExerciciosCountByTreinoId({});
            }
          } else {
            setRealizadoCountByTreinoId({});
            setExerciciosCountByTreinoId({});
          }
        } catch {
          setRealizadoCountByTreinoId({});
          setExerciciosCountByTreinoId({});
        }

        // outras cargas necessárias
        if (
          ["professor", "admin", "escola", "escolinha", "clube"].includes(String(usuarioReady.tipoOk || "").toLowerCase())
        ) {
          carregarSubmissoes();
          carregarAtletasVinculados();
          carregarTurmas();
        }
      } catch (e) {
        console.error(e);
        setTreinos([]);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    usuarioReady.ready,
    usuarioReady.idOk,
    usuarioReady.tipoOk,
    meuNome,
    profNomeById,
    professoresVinculadosIds,
  ]);

  useEffect(() => {
    if (abaProfessor === "sessoes") {
      carregarSessoesDeHoje();
    }
  }, [abaProfessor]);

  async function carregarAtletasVinculados() {
    const token = getToken();
    if (!token) return;

    const tipoUsuarioIdRaw =
      String(usuario?.tipoUsuarioId ?? "").trim() ||
      String((Storage as any).tipoUsuarioId ?? "").trim() ||
      String((Storage as any).professorId ?? "").trim();

    if (!tipoUsuarioIdRaw) {
      console.warn("[treinos] sem tipoUsuarioId para carregar atletas vinculados");
      return;
    }

    try {
      const url = `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`/treinos/atletas-vinculados: ${res.status}`);
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];
      const norm: AtletaVinculado[] = items.map((a: any) => ({
        id: a.id,
        usuario: {
          id: a.usuario?.id ?? a.usuarioId ?? "",
          nome: a.usuario?.nome ?? a.nome ?? "Atleta",
          foto: a.usuario?.foto ?? a.foto ?? null,
        },
      }));

      setAtletasVinculados(norm);
    } catch (e) {
      console.error(e);
      setAtletasVinculados([]);
    }
  }

  async function carregarTurmas() {
    const token = getToken();
    if (!token) return;

    const tipoUsuarioIdRaw =
      String(usuario?.tipoUsuarioId ?? "").trim() ||
      String((Storage as any).tipoUsuarioId ?? "").trim() ||
      String((Storage as any).professorId ?? "").trim();

    if (!tipoUsuarioIdRaw) {
      console.warn("[treinos] sem tipoUsuarioId para carregar turmas");
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const urls = [
      `${API.BASE_URL}/api/turmas/minhas?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/treinos/elencos?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/elencos?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
      `${API.BASE_URL}/api/turmas?tipoUsuarioId=${encodeURIComponent(
        tipoUsuarioIdRaw,
      )}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          console.warn("[treinos] falha ao buscar turmas em", url, res.status);
          if (res.status >= 500) throw new Error(String(res.status));
          continue;
        }

        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items ?? [];

        const norm: Turma[] = items.map((t: any) => {
        const nome = t.nome || t.titulo || "Turma";

        const professorNomeSingular = String(t.professorNome ?? t.professor ?? "").trim();

        const idsRaw =
          t.professorIds ??
          t.professoresIds ??
          t.professoresIdsDaTurma ??
          (Array.isArray(t.professores) ? t.professores.map((p: any) => p?.id ?? p?.professorId) : null) ??
          (Array.isArray(t.professoresTurma)
            ? t.professoresTurma.map((p: any) =>
                p?.professorId ??
                p?.professor?.id ??
                p?.Professor?.id ??
                ""
              )
            : null) ??
          [];

        const professorIds = Array.from(
          new Set((Array.isArray(idsRaw) ? idsRaw : []).map((x: any) => String(x || "")).filter(Boolean))
        );

        const nomesRaw =
          t.professorNomes ??
          t.professoresNomes ??
          (Array.isArray(t.professores)
            ? t.professores.map((p: any) => p?.nome ?? p?.usuario?.nome)
            : null) ??
          (Array.isArray(t.professoresTurma)
            ? t.professoresTurma.map((p: any) =>
                p?.professor?.usuario?.nome ??
                p?.professor?.nome ??
                p?.usuario?.nome ??
                p?.nome ??
                ""
              )
            : null) ??
          [];

        const professorNomesDireto = (Array.isArray(nomesRaw) ? nomesRaw : [])
          .map((x: any) => String(x || "").trim())
          .filter(Boolean);

        const nomesFromIds = professorIds
          .map((id) => profNomeById[String(id)])
          .map((x) => String(x || "").trim())
          .filter(Boolean);

        const splitNomes = (v: any) =>
          String(v || "")
            .split(",")
            .map((x) => String(x || "").trim())
            .filter(Boolean);

        const professorNomes = Array.from(
          new Set(
            [
              ...splitNomes(professorNomeSingular), // 🔥 quebra "A, B" em ["A","B"]
              ...professorNomesDireto,
              ...nomesFromIds,
            ]
              .map((x) => String(x || "").trim())
              .filter(Boolean),
          ),
        );

        const atletaIds = Array.from(
          new Set(
            (Array.isArray(t.atletaIds) ? t.atletaIds : [])
              .map((x: any) => String(x || "").trim())
              .filter(Boolean)
          )
        );

        return {
          id: String(t.id),
          nome: String(nome),
          atletaIds,
          professorIds,
          professorNomes,
          professorNome: professorNomes[0] ?? null,
        };
      });

      setTurmas(norm);
      return;

      } catch (e) {
        console.error("[treinos] erro ao carregar turmas de", url, e);
      }
    }

    setTurmas([]);
  }

  async function carregarSubmissoes(append = false) {
    const token = getToken();
    if (!token || !usuario) return;

    const limit = page.limit;
    const offset = append ? page.offset + page.limit : 0;

    setCarregandoSubmissoes(true);
    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes?tipoUsuarioId=${
          usuario.tipoUsuarioId
        }&status=pendente&limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Falha /treinos/submissoes: ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items ?? [];

      setSubmissoesPendentes((prev) => (append ? [...prev, ...items] : items));
      setPage({
        total: data.total ?? items.length,
        limit: data.limit ?? limit,
        offset,
      });
    } catch (e) {
      console.error(e);
      if (!append) setSubmissoesPendentes([]);
    } finally {
      setCarregandoSubmissoes(false);
    }
  }

  async function validarSubmissao(
    id: string,
    aprovado: boolean,
    pontosSug?: number,
  ) {
    const token = getToken();
    if (!token || !usuario) return;

    let pontos = 0;
    if (aprovado) {
      const inp = prompt(
        "Pontos a creditar para este treino:",
        String(pontosSug ?? 0),
      );
      if (inp === null) return;
      const n = Number(inp);
      pontos = Number.isFinite(n) && n >= 0 ? n : 0;
    }

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/submissoes/${id}/validar?tipoUsuarioId=${usuario.tipoUsuarioId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ aprovado, pontos }),
        },
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao validar:", res.status, txt);
        return alert("Não foi possível validar a submissão.");
      }
      setSubmissoesPendentes((prev) => prev.filter((s) => s.id !== id));
      alert(
        aprovado
          ? "Submissão aprovada e pontos creditados!"
          : "Submissão reprovada.",
      );
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao validar.");
    }
  }
  const aprovar = (id: string, pontos?: number) =>
    validarSubmissao(id, true, pontos);
  const reprovar = (id: string) => validarSubmissao(id, false, 0);

  async function obterAtletaIdsDaTurma(turmaId: string): Promise<string[]> {
    const token = getToken();
    if (!token) return [];

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/turmas/${encodeURIComponent(turmaId)}/alunos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        console.warn(
          "[treinos] falha ao buscar alunos da turma",
          turmaId,
          res.status,
        );
        return [];
      }

      const data = await res.json();
      
      let ids: string[] = [];

      if (Array.isArray((data as any).alunos)) {
        ids = (data as any).alunos
          .map((a: any) => String(a.atletaId ?? ""))
          .filter(Boolean);
      }
      else if (Array.isArray((data as any).atletaIds)) {
        ids = (data as any).atletaIds.map(String);
      }
      else if (Array.isArray((data as any).usuarioIds)) {
        console.warn("[treinos] /turmas/:id/alunos retornou usuarioIds. Precisa retornar atletaIds/alunos[].atletaId.");
        return [];
      }

      ids = Array.from(new Set(ids));

      return ids;
    } catch (e) {
      console.error("[treinos] erro ao obter atletas da turma", turmaId, e);
      return [];
    }
  }

  async function agendarTreinoProgramado(
    treino: TreinoProgramado,
    dataSelecionadaISO: string,
    horaSelecionada?: string,
    observacao?: string,
  ) {
    const token = getToken();
    if (!token) {
      alert("Faça login para agendar um treino.");
      return;
    }

    const tipoUser = String(
      usuario?.tipo ?? (Storage as any).tipoSalvo ?? "",
    ).toLowerCase();

    let atletaIdsParaAgendar: string[] = [];

    if (tipoUser === "atleta") {
      const atletaId =
        (Storage as any).tipoUsuarioId ||
        (Storage as any).atletaId ||
        usuario?.tipoUsuarioId;

      if (!atletaId) {
        alert(
          "Não foi possível identificar o atleta logado. Tente entrar novamente.",
        );
        return;
      }

      atletaIdsParaAgendar = [atletaId];
        } else {
      const turmaIdSelecionada = turmaSelecionadaByTreinoId[treino.id] || "";

      if (turmaIdSelecionada) {
        const turma = turmas.find((t) => t.id === turmaIdSelecionada);

        if (!turma) {
          alert("Turma selecionada não encontrada.");
          return;
        }

        const idsDaTurma = await obterAtletaIdsDaTurma(turma.id);

        if (!idsDaTurma.length) {
          alert("Turma selecionada não possui alunos cadastrados.");
          return;
        }

        atletaIdsParaAgendar = idsDaTurma;
      } else {
        const selecionados = atletasSelecionadosByTreinoId[treino.id] || [];
        if (selecionados.length === 0) {
          alert(
            "Selecione ao menos um atleta vinculado ou escolha uma turma para agendar o treino.",
          );
          return;
        }
        atletaIdsParaAgendar = selecionados;
      }
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diaSelecionadoStr =
      dataSelecionadaISO || new Date().toISOString().slice(0, 10);
    const diaSelecionado = new Date(`${diaSelecionadoStr}T00:00:00`);

    if (diaSelecionado < hoje) {
      alert("Você não pode agendar um treino em uma data que já passou.");
      return;
    }

    if (isUsuarioFree()) {
      const limite = new Date(hoje);
      limite.setMonth(limite.getMonth() + 1);
      limite.setHours(0, 0, 0, 0);

      if (diaSelecionado > limite) {
        alert(
          "Contas Free só podem agendar treinos até 30 dias a partir de hoje. Escolha uma data mais próxima.",
        );
        return;
      }
    }

    const dia = diaSelecionado.toISOString().slice(0, 10);

    let quandoISO: string;
    if (horaSelecionada && /^\d{2}:\d{2}$/.test(horaSelecionada)) {
      const [h, m] = horaSelecionada.split(":").map(Number);
      const dataComHora = new Date(diaSelecionado);
      dataComHora.setHours(h, m, 0, 0);
      quandoISO = dataComHora.toISOString();
    } else {
      quandoISO = `${dia}T23:59:59.000Z`;
    }

    const turmaIdSelecionada = turmaSelecionadaByTreinoId[treino.id] || "";
    if (turmaIdSelecionada) {
      try {
        const respSessao = await fetch(`${API.BASE_URL}/api/sessoes-turma`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            treinoProgramadoId: treino.id,
            turmaId: turmaIdSelecionada,
            dataISO: quandoISO,
          }),
        });

        const txt = await respSessao.text().catch(() => "");
        if (!respSessao.ok) {
          console.error("Erro ao criar sessão de turma:", respSessao.status, txt);
          alert("Não foi possível criar a sessão da turma.");
          return;
        }

        // ✅ AGORA O BACKEND já cria TreinoAgendado para todos os atletas.
        alert("Treino enviado para a turma (sessão + agendamentos criados)!");
        return; // 🔥 ISSO EVITA DUPLICAR (não roda o loop abaixo)
      } catch (e) {
        console.error("Erro inesperado ao criar sessão de turma:", e);
        alert("Erro inesperado ao criar sessão da turma.");
        return;
      }
    }

    try {
      let sucessos = 0;
      let conflitos = 0;

      for (const atletaId of atletaIdsParaAgendar) {
        const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            titulo: treino.nome,
            dataTreino: quandoISO,
            dataExpiracao: null,
            atletaId,
            treinoProgramadoId: treino.id,
            observacao: observacao ?? null,
            turmaId: turmaIdSelecionada || null,
          }),
        });

        if (!r.ok) {
          const txt = await r.text().catch(() => "");
          if (r.status === 409) {
            conflitos++;
            console.warn(
              "Já existe agendamento futuro desse treino para o atleta",
              atletaId,
              txt,
            );
            continue;
          }
          console.error("Falha ao agendar para atleta", atletaId, r.status, txt);
          continue;
        }

        const novo = await r.json().catch(() => null);
        window.dispatchEvent(
          new CustomEvent("treino:agendado", { detail: novo }),
        );
        sucessos++;
      }

      if (sucessos > 0) {
        const textoBase =
          sucessos === 1
            ? "Treino agendado para 1 atleta!"
            : `Treino agendado para ${sucessos} atletas!`;

        if (conflitos > 0) {
          alert(
            `${textoBase} Alguns atletas já tinham esse treino agendado e foram ignorados (${conflitos}).`,
          );
        } else {
          alert(textoBase);
        }
      } else if (conflitos > 0) {
        alert(
          "Todos os atletas selecionados já tinham esse treino agendado em uma data futura.",
        );
      } else {
        alert("Não foi possível agendar o treino para nenhum atleta.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  }

  async function deletarTreinoProgramado(treinoId: string) {
    const token = getToken();
    if (!token) return;

    if (!window.confirm("Tem certeza que deseja excluir este treino?")) return;

    const tipo = String(usuario?.tipo ?? "").toLowerCase();
    const tipoUsuarioId = String(usuario?.tipoUsuarioId ?? "").trim();

    const res = await fetch(
      `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(treinoId)}` +
      `?tipo=${encodeURIComponent(tipo)}` +
      `&tipoUsuarioId=${encodeURIComponent(tipoUsuarioId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const js = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(js?.message || "Não foi possível excluir o treino.");
      return;
    }

    setTreinos((prev) => prev.filter((t) => t.id !== treinoId));
    alert("Treino excluído com sucesso!");
  }

  function isTreinoMeuDeVerdade(t: TreinoProgramado, user: UsuarioLogado | null) {
    const meuTipo = String(user?.tipo ?? "").toLowerCase();
    const meuTipoUsuarioId = String(user?.tipoUsuarioId ?? "").trim();
    const meuUsuarioId = String(user?.usuarioId ?? "").trim();

    if (!meuTipo) return false;

    // IDs possíveis para comparar (caso tipoUsuarioId venha errado)
    const meusIds = Array.from(new Set([meuTipoUsuarioId, meuUsuarioId].filter(Boolean)));
    const tProfessorId = String(t.professorId ?? "").trim();
    const tClubeId = String(t.clubeId ?? "").trim();
    const tEscolinhaId = String(t.escolinhaId ?? "").trim();
    const souDono =
      (meuTipo === "professor" && meusIds.includes(tProfessorId)) ||
      (meuTipo === "clube" && meusIds.includes(tClubeId)) ||
      ((meuTipo === "escolinha" || meuTipo === "escola") && meusIds.includes(tEscolinhaId));

    const souColaborador =
      Array.isArray(t.professoresIds) &&
      t.professoresIds.map(String).some((id) => meusIds.includes(String(id).trim()));
    const adminPodeTudo = meuTipo === "admin";

    return adminPodeTudo || souDono || souColaborador;
  }

  const meusTreinosLista = useMemo(() => {
    if (!usuario) return [];
    if (String(usuario.tipo).toLowerCase() === "admin") return listaOrdenadaParaExibir; // admin vê tudo como lista única
    return (listaOrdenadaParaExibir || []).filter((t) => isTreinoMeuDeVerdade(t, usuario));
  }, [listaOrdenadaParaExibir, usuario]);

  const treinosVinculadosLista = useMemo(() => {
    if (!usuario) return [];
    if (String(usuario.tipo).toLowerCase() === "admin") return []; // admin não precisa de bloco “vinculados”
    return (listaOrdenadaParaExibir || []).filter((t) => !isTreinoMeuDeVerdade(t, usuario));
  }, [listaOrdenadaParaExibir, usuario]);

console.log("[treinos] listaOrdenadaParaExibir:", listaOrdenadaParaExibir.length);
console.log("[treinos] meusTreinosLista:", meusTreinosLista.length);
console.log("[treinos] treinosVinculadosLista:", treinosVinculadosLista.length);
console.log("[treinos] totalTreinosExibidos:", totalTreinosExibidos);

  const renderTreinoCard = (treino: TreinoProgramado) => {
    const podeEditar = isTreinoMeuDeVerdade(treino, usuario);
    const meuId = String(usuario?.tipoUsuarioId || usuario?.usuarioId || "").trim();
    const souDono =
      (String(usuario?.tipo || "").toLowerCase() === "professor" && String(treino.professorId || "").trim() === meuId) ||
      (String(usuario?.tipo || "").toLowerCase() === "clube" && String(treino.clubeId || "").trim() === meuId) ||
      ((String(usuario?.tipo || "").toLowerCase() === "escolinha" || String(usuario?.tipo || "").toLowerCase() === "escola") &&
        String(treino.escolinhaId || "").trim() === meuId);

    const souColaborador =
      Array.isArray(treino.professoresIds) &&
      treino.professoresIds.map(String).some((id) => String(id).trim() === meuId);

    const papelNoTreino =
      String(usuario?.tipo || "").toLowerCase() === "professor"
        ? (souColaborador && !souDono ? "Colaborador" : (souDono ? "Criador" : null))
        : (souDono ? "Criador" : null);

    return (
      <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-start justify-between gap-3">
          <h4
            className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
            onClick={() => navigate(`/treinos/unico?programadoId=${treino.id}`)}
            title="Abrir detalhes do treino"
          >
            {treino.nome}
          </h4>

          <div className="flex flex-col items-end gap-1">
            {papelNoTreino && (
              <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700 text-xs">
                {papelNoTreino}
              </span>
            )}

            {typeof treino.pontuacao === "number" && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                +{treino.pontuacao} pts
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-700">
          <strong>Nível:</strong> {treino.nivel || "—"}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500">
          Clique no nome do treino para ver os detalhes completos.
        </div>

        {podeEditar && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="p-2 rounded-lg border hover:bg-gray-50"
              title="Editar treino"
              onClick={() => {
                // 1) guarda a tela de origem (essa)
                sessionStorage.setItem("treino_returnTo", window.location.pathname + window.location.search);

                // 2) navega para edição no admin, passando returnTo também (mais confiável)
                navigate(
                  `/admin/treinos/create?id=${encodeURIComponent(treino.id)}&returnTo=${encodeURIComponent(
                    window.location.pathname + window.location.search
                  )}`
                );
              }}
            >
              <Pencil className="w-4 h-4 text-green-800" />
            </button>

            <button
              className="p-2 rounded-lg border hover:bg-red-50"
              title="Excluir treino"
              onClick={() => deletarTreinoProgramado(treino.id)}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>
      </div>
    );
  };

  const meuTipoUsuarioId = String(usuario?.tipoUsuarioId ?? "");

  const isGestor =
    usuario?.tipo &&
    ["professor", "admin", "escola", "escolinha", "clube"].includes(
      String(usuario.tipo).toLowerCase(),
    );

  const isOlheiro =
    String((Storage as any).tipoSalvo ?? "").toLowerCase() === "olheiro";

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4">
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>

        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          {/* LINHA 1: abas + campo */}
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              {isGestor ? (
                <div className="w-full min-w-0">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] sm:overflow-visible sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setAbaProfessor("exercicios")}
                      className={`shrink-0 px-3 py-2 rounded-lg border text-xs sm:text-sm min-w-[130px] sm:min-w-0 ${
                        abaProfessor === "exercicios"
                          ? "bg-green-800 text-white border-green-900"
                          : "bg-white text-gray-800 border-gray-200"
                      }`}
                    >
                      Meus Exercícios
                    </button>

                    <button
                      onClick={() => setAbaProfessor("criar")}
                      className={`shrink-0 px-3 py-2 rounded-lg border text-xs sm:text-sm min-w-[130px] sm:min-w-0 ${
                        abaProfessor === "criar"
                          ? "bg-green-800 text-white border-green-900"
                          : "bg-white text-gray-800 border-gray-200"
                      }`}
                    >
                      Meus Treinos
                    </button>

                    <button
                      onClick={() => setAbaProfessor("sessoes")}
                      className={`shrink-0 px-3 py-2 rounded-lg border text-xs sm:text-sm min-w-[130px] sm:min-w-0 ${
                        abaProfessor === "sessoes"
                          ? "bg-green-800 text-white border-green-900"
                          : "bg-white text-gray-800 border-gray-200"
                      }`}
                    >
                      Treinos de Hoje
                    </button>

                    <button
                      onClick={() => setAbaProfessor("avaliar")}
                      className={`shrink-0 px-3 py-2 rounded-lg border text-xs sm:text-sm min-w-[130px] sm:min-w-0 ${
                        abaProfessor === "avaliar"
                          ? "bg-green-800 text-white border-green-900"
                          : "bg-white text-gray-800 border-gray-200"
                      }`}
                    >
                      Avaliar Treinos
                    </button>

                    {FLAGS.LEARNING_ENABLED && (
                      <button
                        onClick={() => navigate("/learning")}
                        className="shrink-0 px-3 py-2 rounded-lg border text-xs sm:text-sm min-w-[130px] sm:min-w-0 bg-white text-gray-800 border-gray-200"
                      >
                        Learning
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-lg font-semibold text-green-900">Treinos</div>
              )}

              <div className="shrink-0 pt-0.5">
                <Link
                  href="/treinos/elenco"
                  aria-label="Ir para o elenco (campo)"
                  title="Elenco (campo)"
                  className="inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <SoccerFieldIcon className="w-5 h-5" />
                </Link>
              </div>
            </div>

            {/* LINHA 2: gerenciar atletas */}
            <div className="w-full flex justify-end pt-1">
              <Link
                href="/perfil/GerenciarAtletas"
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50 text-xs sm:text-sm whitespace-nowrap min-w-[240px] sm:min-w-[260px]"
                title="Gerenciador de Carreira"
              >
                Gerenciar Atletas
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isGestor && abaProfessor === "avaliar" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <h3 className="text-lg font-semibold mb-3">
                Treinos dos atletas afiliados
              </h3>

              {carregandoSubmissoes ? (
                <p className="text-gray-500">
                  Carregando submissões pendentes...
                </p>
              ) : submissoesPendentes.length === 0 ? (
                <p className="text-gray-500">
                  Nenhum treino pendente para avaliação no momento.
                </p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {submissoesPendentes.map((s) => {
                      const foto = resolveUploadUrl(s.atleta?.foto) ?? PLACEHOLDER_USER;

                      const midias = (Array.isArray(s.midias) ? s.midias : [])
                        .map(resolveUploadUrl)
                        .filter((x): x is string => Boolean(x));

                      return (
                        <li
                          key={s.id}
                          className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-3 sm:p-4"
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <img
                              src={resolveUploadUrl(foto) ?? PLACEHOLDER_USER}
                              alt={s.atleta?.nome ?? "Atleta"}
                              className="w-12 h-12 rounded-full object-cover"
                              onError={(e) => {
                                const el = e.currentTarget as HTMLImageElement;
                                el.onerror = null;
                                el.src = PLACEHOLDER_USER;
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-semibold text-green-900 truncate">
                                  {s.treino.titulo}
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  +{s.pontosSugeridos ?? 0} pts
                                </span>

                                <div className="ml-auto flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() =>
                                      aprovar(s.id, s.pontosSugeridos)
                                    }
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                    title="Aprovar e creditar pontos"
                                  >
                                    <Check className="w-4 h-4" /> Aprovar
                                  </button>
                                  <button
                                    onClick={() => reprovar(s.id)}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                                    title="Reprovar"
                                  >
                                    <X className="w-4 h-4" /> Reprovar
                                  </button>
                                </div>
                              </div>

                              <div className="text-sm text-gray-600 truncate">
                                {s.atleta?.nome}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatarData(s.criadoEm)} •{" "}
                                {new Date(s.criadoEm).toLocaleTimeString(
                                  "pt-BR",
                                )}
                              </div>

                              {!!midias.length && (
                                <div className="mt-3 sm:mt-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                                    {midias.map((src, idx) => {
                                      const isVid = isVideoUrl(src);
                                      return isVid ? (
                                        <div
                                          key={`${src}-${idx}`}
                                          className="relative w-full overflow-hidden rounded-lg bg-black border pt-[56.25%]"
                                        >
                                          <video
                                            src={src}
                                            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                            controls
                                            playsInline
                                            muted
                                            aria-label={`mídia ${idx + 1}`}
                                            preload="metadata"
                                          />
                                        </div>
                                      ) : (
                                        <a
                                          key={`${src}-${idx}`}
                                          href={src}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block group"
                                          title="Abrir imagem"
                                        >
                                          <div className="relative w-full overflow-hidden rounded-lg border bg-gray-50 pt-[56.25%]">
                                            <img
                                              src={src}
                                              alt={`mídia ${idx + 1}`}
                                              className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition"
                                              loading="lazy"
                                              decoding="async"
                                            />
                                          </div>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {submissoesPendentes.length < page.total && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => carregarSubmissoes(true)}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Carregar mais
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {abaProfessor === "exercicios" && <MeusExerciciosTab />}

          {false && abaProfessor === "learning" && (
            <div />
          )}

          {abaProfessor === "criar" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold">
                  {usuario?.tipo === "admin"
                    ? "Todos os Treinos"
                    : "Treinos vinculados a mim"}
                </h3>
                <div className="text-xs text-gray-600">
                  <strong>Treinos:</strong> {totalTreinosExibidos} •{" "}
                  <strong>Exercícios:</strong> {totalExerciciosExibidos}
                </div>
                <button
                  className="bg-green-800 text-white px-4 py-2 rounded-lg"
                  onClick={() => {
                    sessionStorage.setItem("treino_returnTo", window.location.pathname + window.location.search);
                    navigate("/treinos/novo");
                  }}
                >
                  Criar novo treino
                </button>
              </div>

             {/* ====== MEUS TREINOS (dono ou colaborador) ====== */}
              {(String(usuario?.tipo || "").toLowerCase() === "admin" || meusTreinosLista.length > 0) ? (
                <>
                  {String(usuario?.tipo || "").toLowerCase() !== "admin" && (
                    <h4 className="text-sm font-semibold text-green-900 mb-2">
                      Meus treinos
                    </h4>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(String(usuario?.tipo || "").toLowerCase() === "admin"
                      ? listaOrdenadaParaExibir
                      : meusTreinosLista
                    ).map(renderTreinoCard)}
                  </div>
                </>
              ) : (
                <p className="text-gray-500">
                  Você ainda não tem treinos (criador ou colaborador).
                </p>
              )}

              {/* ====== TREINOS VINCULADOS (sem editar/excluir) ====== */}
              {String(usuario?.tipo || "").toLowerCase() !== "admin" && treinosVinculadosLista.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-green-900 mb-2">
                    Treinos vinculados
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {treinosVinculadosLista.map((t) => (
                      <div key={t.id}>
                        {/* reaproveita o card, mas SEM ações */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                          <div className="flex items-start justify-between gap-3">
                            <h4
                              className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
                              onClick={() => navigate(`/treinos/unico?programadoId=${t.id}`)}
                              title="Abrir detalhes do treino"
                            >
                               <span>{t.nome}</span>

                                {(() => {
                                  const meuProfId = String(usuario?.tipoUsuarioId ?? "").trim();
                                  const souCriador = String(t.professorId ?? "").trim() === meuProfId;

                                  const souColab =
                                    !souCriador &&
                                    (t.professoresIds || []).map(String).includes(meuProfId);

                                  <span className="text-xs font-medium text-green-800/80">
                                    {souCriador ? "(Criador)" : souColab ? "(Colaborador)" : ""}
                                  </span>

                                  return null;
                                })()}

                            </h4>

                            <div className="flex flex-col items-end">
                              {typeof t.pontuacao === "number" && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                  +{t.pontuacao} pts
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 text-sm text-gray-700">
                            <strong>Nível:</strong> {t.nivel || "—"}
                          </div>

                          <div className="mt-2 text-xs text-gray-500">
                            Clique no nome do treino para ver os detalhes completos.
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {abaProfessor === "sessoes" && (
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
              <h3 className="text-lg font-semibold mb-3">Treinos de hoje</h3>

              {!sessoesDeHoje.length ? (
                <p className="text-gray-500">Nenhuma sessão marcada para hoje.</p>
              ) : (
                <ul className="space-y-3">
                  {sessoesDeHoje.map((s: any) => {
                    let labelTempo: string | null = null;

                    if (s.status === "em_andamento" && s.startedAt) {
                      const inicio = new Date(s.startedAt);
                      const diffMs = clockNow - inicio.getTime();
                      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
                      const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
                      const ss = String(totalSec % 60).padStart(2, "0");
                    } else if (
                      s.status === "finalizada" &&
                      s.duracaoMinutosReal != null &&
                      s.duracaoMinutosReal > 0
                    ) {
                      labelTempo = `Duração realizada: ${s.duracaoMinutosReal} min`;
                    }

                    return (
                      <li key={s.id} className="p-3 border rounded-lg shadow-sm">
                        <div className="font-semibold text-green-900">
                          {s.treino?.nome ?? "Treino"}
                        </div>
                        {(() => {
                          const turmaId = String(s.turma?.id ?? "");
                          const turmaLocal = turmaId ? turmaById[turmaId] : null;
                          const nomeTurma = turmaLocal?.nome ?? s.turma?.nome ?? "Turma";
                          const profsFromSessao = Array.from(
                            new Set(
                              (Array.isArray(s.turma?.professores) ? s.turma.professores : [])
                                .map((tp: any) =>
                                  String(
                                    tp?.professor?.usuario?.nome ??
                                    tp?.professor?.nome ??
                                    tp?.usuario?.nome ??
                                    tp?.nome ??
                                    ""
                                  ).trim()
                                )
                                .filter(Boolean)
                            )
                          );

                          const profsFromTurmaLocal = Array.from(
                            new Set(
                              [
                                String(turmaLocal?.professorNome ?? "").trim(),
                                ...(turmaLocal?.professorNomes ?? []).map((x) => String(x || "").trim()),
                              ].filter(Boolean)
                            )
                          );

                          const splitNomes = (v: any) =>
                            String(v || "")
                              .split(",")
                              .map((x) => String(x || "").trim())
                              .filter(Boolean);

                          const uniqByNorm = (arr: string[]) =>
                            Array.from(new Map(arr.map((n) => [normTxt(n), n])).values());

                          const nomesSessao = (Array.isArray(s.turma?.professores) ? s.turma.professores : [])
                            .flatMap((tp: any) =>
                              splitNomes(
                                tp?.professor?.usuario?.nome ??
                                tp?.professor?.nome ??
                                tp?.usuario?.nome ??
                                tp?.nome ??
                                ""
                              )
                            )
                            .filter(Boolean);

                          const baseTurma = (turmaLocal?.professorNomes ?? []).length
                            ? (turmaLocal?.professorNomes ?? [])
                            : [turmaLocal?.professorNome ?? ""];

                          const nomesTurmaLocal = baseTurma
                            .flatMap(splitNomes) // 🔥 quebra qualquer "A, B" dentro do array
                            .map((x) => String(x || "").trim())
                            .filter(Boolean);

                          // ✅ junta tudo e deduplica por normalização
                          const profs = uniqByNorm([...nomesSessao, ...nomesTurmaLocal]).join(", ");

                          return (
                            <div className="text-sm text-gray-600">
                              Turma: {nomeTurma}
                              {profs ? (
                                <span className="text-xs text-gray-500"> • Prof(s): {profs}</span>
                              ) : (
                                <span className="text-xs text-gray-400"> • Sem professor</span>
                              )}
                            </div>
                          );
                        })()}
                        
                        {s.dataSessao && (
                          <div className="text-sm text-gray-500 mt-1 mb-1">
                            Agendado para: {formatarDataBR(s.dataSessao)}
                            {s.win?.hasTime ? ` às ${getHoraHHMM(s.dataSessao)}` : ""}
                          </div>
                        )}

                        {typeof s.treino?.duracao === "number" && (
                          <div className="text-xs text-gray-500 mt-1">
                            Duração programada: {s.treino.duracao} min
                          </div>
                        )}

                        {labelTempo && (
                          <div className="text-xs text-gray-500 mt-1">{labelTempo}</div>
                        )}

                        {s.penalidadeAtraso && s.status === "finalizada" && (
                          <div className="text-xs text-amber-700 mt-1">
                            ⚠ Pontos reduzidos pela metade por atraso.
                          </div>
                        )}

                        {s.status === "finalizada" && Array.isArray((s as any).presentes) && (s as any).presentes.length > 0 && (
                          <div className="mt-2 text-xs text-gray-700">
                            <div className="font-semibold">Presentes:</div>
                            <div className="text-gray-600">
                              {Array.isArray((s as any).presentesNomes) && (s as any).presentesNomes.length
                                ? (s as any).presentesNomes.join(", ")
                                : (s as any).presentes.map((p: any) => p.nome).join(", ")
                              }
                            </div>
                          </div>
                        )}

                        {s.status === "nao_iniciada" && (
                          <button
                            onClick={() => abrirModalIniciar(String(s.id), String((s as any).turma?.id ?? (s as any).turmaId ?? ""))}
                            disabled={!s.podeIniciar}
                            title={
                              s.faltou
                                ? "Sessão expirou e virou falta."
                                : s.win?.hasTime
                                  ? "Liberado 1h antes e expira 1h depois do horário."
                                  : "Liberado apenas na hora do treino."
                            }
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition mr-2 ${
                              s.podeIniciar ? "bg-green-600 text-white" : "bg-gray-400 text-white cursor-not-allowed"
                            }`}
                          >
                            Iniciar
                          </button>
                        )}

                        <button
                          onClick={() => setSessaoAbertaExerciciosId(String(s.id))}
                          disabled={!(s.status === "em_andamento" || (s.status === "nao_iniciada" && s.podeIniciar))}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            (s.status === "em_andamento" || (s.status === "nao_iniciada" && s.podeIniciar))
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-gray-300 text-gray-600 cursor-not-allowed"
                          }`}
                        >
                          Visualizar Treino
                        </button>

                        {s.status === "finalizada" && (
                          <span className="mt-2 inline-block text-emerald-700 font-medium">
                            Finalizado ✓
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}   
        </div>
      </div>

      {modalSessaoId && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-4 space-y-3">
            <h4 className="text-lg font-semibold">Selecione os presentes</h4>
            <p className="text-sm text-gray-600">
              Marque apenas os atletas que estão presentes para este treino.
            </p>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {alunosDaSessao.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  Nenhum aluno encontrado para essa turma.
                </p>
              ) : (
                <ul className="divide-y">
                  {alunosDaSessao.map((aluno: any) => {
                    const id = aluno.id;
                    const nome =
                      aluno.nome ||
                      aluno.usuario?.nome ||
                      "Aluno";

                    const marcado = presentesSelecionados.includes(id);

                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={marcado}
                          onChange={() => {
                            setPresentesSelecionados((prev) =>
                              marcado
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            );
                          }}
                        />
                        <span className="text-sm text-gray-800">
                          {nome}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-2 rounded-lg border text-sm"
                onClick={() => {
                  setModalSessaoId(null);
                  setPresentesSelecionados([]);
                }}
              >
                Cancelar
              </button>

              <button
                className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-sm"
                onClick={confirmarPresencas}
                disabled={!presentesSelecionados.length}
              >
                Iniciar treino
              </button>
            </div>
          </div>
        </div>
      )}
      {sessaoAbertaExerciciosId && (() => {
        const sessao = sessoesDeHoje.find(
          (s: any) => s.id === sessaoAbertaExerciciosId,
        );
        if (!sessao) return null;

        const exerciciosSessao: ExercicioSessaoDetalhe[] = Array.isArray(sessao.exercicios)
          ? sessao.exercicios
          : [];

        const exerciciosDoTreino: any[] = Array.isArray(sessao.treino?.exercicios)
          ? (sessao.treino!.exercicios as any[])
          : [];

        // chave estável pra “bater” treino.exercicios com sessao.exercicios
        const keyOf = (x: any) =>
          x?.exercicioId
            ? `E:${String(x.exercicioId)}`
            : x?.exercicioTemporarioId
              ? `T:${String(x.exercicioTemporarioId)}`
              : x?.exercicioPersonalizadoId
                ? `P:${String(x.exercicioPersonalizadoId)}`
                : `ID:${String(x?.id ?? "")}`;

        // mapa do que foi concluído/marcado na sessão
        const sessaoByKey = new Map<string, ExercicioSessaoDetalhe>();
        for (const se of exerciciosSessao) sessaoByKey.set(keyOf(se), se);

        // ✅ lista final pra render (prioriza dados “completos” do treino)
        const exercicios: ExercicioSessaoDetalhe[] =
          exerciciosDoTreino.length > 0
            ? exerciciosDoTreino.map((te: any) => {
                const se = sessaoByKey.get(keyOf(te));
                return {
                  // id: usa o id da linha da sessão se existir (pra marcar concluído pelo id correto)
                  id: se?.id ?? String(te.id),
                  exercicioId: te.exercicioId ?? null,
                  exercicioTemporarioId: te.exercicioTemporarioId ?? null,
                  exercicioPersonalizadoId: te.exercicioPersonalizadoId ?? null,
                  // relações completas (nome/descrição/vídeo)
                  exercicio: te.exercicio ?? null,
                  exercicioTemporario: te.exercicioTemporario ?? null,
                  exercicioPersonalizado: te.exercicioPersonalizado ?? null,
                  repeticoes:
                    te.repeticoes != null
                      ? String(te.repeticoes)
                      : (se?.repeticoes ?? null),

                  series:
                    te.series != null
                      ? Number(te.series)
                      : (se?.series ?? null),

                  duracao:
                    te.duracao != null
                      ? String(te.duracao)
                      : (se?.duracao ?? null),

                  descanso:
                    te.descanso != null
                      ? String(te.descanso)
                      : (se?.descanso ?? null),
                  // estado da sessão
                  concluido: Boolean(se?.concluido),
                  // se backend já “achatou” videoDemonstrativoUrl, mantém também
                  videoDemonstrativoUrl:
                    se?.videoDemonstrativoUrl ??
                    te?.exercicio?.videoDemonstrativoUrl ??
                    te?.exercicioTemporario?.videoDemonstrativoUrl ??
                    te?.exercicioPersonalizado?.videoDemonstrativoUrl ??
                    null,
                  // extras
                  nome: null,
                  detalhes: null,
                } as ExercicioSessaoDetalhe;
              })
            : exerciciosSessao;

        const marcados = new Set(exerciciosMarcadosBySessao[sessao.id] ?? []);
        const pontosTreino =
          typeof sessao.treino?.pontuacao === "number"
            ? sessao.treino.pontuacao
            : null;

        const emRemarcacao = sessaoEmRemarcacaoId === sessao.id;
        const dataRemarcar = remarcarDataBySessaoId[sessao.id] ?? "";
        const horaRemarcar = remarcarHoraBySessaoId[sessao.id] ?? "";

        return (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-md sm:max-w-lg w-full p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => setSessaoAbertaExerciciosId(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="text-sm font-semibold text-gray-800 text-center flex-1">
                  {(() => {
                    const startedAtISO = sessao.startedAt || startedAtRef.current || null;
                    const emAndamento =
                      sessao.status === "em_andamento" ||
                      (!!startedAtISO && sessao.status !== "finalizada");
                   
                      if (!emAndamento) return null; // topo fica “só comando”; se não estiver em andamento, fica vazio

                    const tempoStr = formatElapsed(startedAtISO, clockNow);

                    return (
                      <span className="inline-flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Tempo decorrido:</span>
                        <span className="tabular-nums">{tempoStr}</span>
                      </span>
                    );
                  })()}
                </div>

                <div className="w-8" /> 
              </div>

              <h3 className="text-base sm:text-lg font-bold text-green-900">
                {sessao.treino?.nome ?? "Treino"}
              </h3>

              <p className="text-xs text-gray-500 mt-1">
                {(() => {
                  const d = parseDateSafe(sessao.data);
                  if (!d) return null;

                  const dataStr = d.toLocaleDateString("pt-BR");
                  const horaStr = hasHoraMarcada(d) ? ` • ${getHoraHHMM(d)}` : "";
                  return `Agendado para: ${dataStr}${horaStr}`;
                })()}
              </p>

              {pontosTreino !== null && (
                <div className="text-xs sm:text-sm text-amber-700 mt-1">
                  Vale <span className="font-semibold">+{pontosTreino} pts</span>{" "}
                  por atleta que concluir.
                </div>
              )}

              <div className="mt-2 max-h-[60vh] overflow-y-auto space-y-3">
                {exercicios.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum exercício cadastrado para este treino.
                  </p>
                ) : (
                  exercicios.map((ex) => {
                    const checked = marcados.has(ex.id);

                    const nome =
                      ex.exercicio?.nome ??
                      ex.exercicioTemporario?.nome ??
                      ex.exercicioPersonalizado?.nome ??
                      ex.nome ??
                      "Exercício";

                    const descricao =
                      ex.exercicio?.descricao ??
                      ex.exercicioTemporario?.descricao ??
                      ex.exercicioPersonalizado?.descricao ??
                      null;

                    const video =
                      ex.videoDemonstrativoUrl ??
                      ex.exercicio?.videoDemonstrativoUrl ??
                      ex.exercicioTemporario?.videoDemonstrativoUrl ??
                      ex.exercicioPersonalizado?.videoDemonstrativoUrl ??
                      null;

                    const repeticoes = ex.repeticoes ?? null;
                    const series = ex.series ?? null;
                    const duracao = ex.duracao ?? null;
                    const descanso = ex.descanso ?? null;
                    const videoUrl = video ? resolveUploadUrl(video) : null;
                    
                    return (
                      <div
                        key={ex.id}
                        className="border rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const exercicioId = String(ex.id || "").trim();
                              if (!exercicioId) return;

                              setExerciciosMarcadosBySessao((prev) => {
                                const current = new Set((prev[sessao.id] ?? []).map(String));
                                if (current.has(exercicioId)) current.delete(exercicioId);
                                else current.add(exercicioId);
                                return { ...prev, [sessao.id]: Array.from(current) };
                              });
                            }}
                            className={`mt-0.5 flex items-center justify-center w-6 h-6 rounded-full border text-xs ${
                              checked
                                ? "border-green-700 bg-green-700 text-white"
                                : "border-gray-300 bg-white text-gray-500"
                            }`}
                            aria-pressed={checked}
                          >
                            {checked ? <Check className="w-3 h-3" /> : "✕"}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold text-sm sm:text-base text-gray-900">
                                  {nome}
                                </div>

                                {descricao && (
                                  <div className="text-xs sm:text-sm text-gray-700 mt-1">
                                    {descricao}
                                  </div>
                                )}

                                <div className="mt-1 space-y-1">
                                  {series != null && series !== 0 ? (
                                    <div className="text-xs sm:text-sm text-gray-600">
                                      Séries: {series}
                                    </div>
                                  ) : null}

                                  {repeticoes ? (
                                    <div className="text-xs sm:text-sm text-gray-600">
                                      Repetições: {repeticoes}
                                    </div>
                                  ) : null}

                                  {duracao ? (
                                    <div className="text-xs sm:text-sm text-gray-600">
                                      Duração: {duracao}
                                    </div>
                                  ) : null}

                                  {descanso ? (
                                    <div className="text-xs sm:text-sm text-gray-600">
                                      Descanso: {descanso}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {videoUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVideoModal({
                                      url: videoUrl,
                                      nome,
                                      repeticoes: repeticoes ?? undefined,
                                    })
                                  }
                                  className="text-xs sm:text-sm font-medium text-green-700 hover:underline underline-offset-2 flex-shrink-0"
                                >
                                  Ver vídeo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {(() => {
                const emAndamento =
                  sessao.status === "em_andamento" ||
                  (!!(sessao.startedAt || startedAtRef.current) && sessao.status !== "finalizada");

                const podeFinalizar =
                  exercicios.length > 0 &&
                  exercicios.every((e) => {
                    const id = String(e.id || "").trim();
                    return id && marcados.has(id);
                  });

                return (
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {emAndamento ? (
                      <button
                        type="button"
                        disabled={!podeFinalizar}
                        title={
                          !podeFinalizar
                            ? "Marque todos os exercícios para habilitar o finalizar."
                            : ""
                        }
                        className={`flex-1 px-3 py-2 rounded-full text-white text-sm ${
                          podeFinalizar
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-red-300 cursor-not-allowed"
                        }`}
                        onClick={async () => {
                          if (!podeFinalizar) return;

                          await salvarProgressoSessao(sessao.id);
                          await finalizarTreinoSessao(sessao.id);
                        }}
                      >
                        Finalizar treino
                      </button>
                    ) : null}
                  </div>
                );
              })()}

              {emRemarcacao && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 items-center">
                  <input
                    type="date"
                    className="px-3 py-2 border rounded-lg text-sm w-full sm:w-auto flex-1"
                    value={dataRemarcar}
                    onChange={(e) =>
                      setRemarcarDataBySessaoId((prev) => ({
                        ...prev,
                        [sessao.id]: e.target.value,
                      }))
                    }
                  />
                  <input
                    type="time"
                    className="px-3 py-2 border rounded-lg text-sm w-full sm:w-[120px]"
                    value={horaRemarcar}
                    onChange={(e) =>
                      setRemarcarHoraBySessaoId((prev) => ({
                        ...prev,
                        [sessao.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-full bg-emerald-700 text-white text-sm w-full sm:w-auto"
                    onClick={() =>
                      remarcarSessao(sessao.id, dataRemarcar, horaRemarcar)
                    }
                  >
                    Confirmar
                  </button>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {videoModal && (() => {
        const isArquivo = isVideoUrl(videoModal.url);

        return (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4">
            <div className="bg-white rounded-2xl shadow-lg max-w-lg w-full p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{videoModal.nome}</h4>
                <button onClick={() => setVideoModal(null)}>✕</button>
              </div>

              <div className="w-full flex justify-center">
                {isArquivo ? (
                  <video
                    src={videoModal.url}
                    className="max-h-[70vh] w-auto rounded-xl"
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <iframe
                    src={videoModal.url}
                    className="w-full h-[70vh] rounded-xl"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav active="treinos" />

    </div>
  );
}
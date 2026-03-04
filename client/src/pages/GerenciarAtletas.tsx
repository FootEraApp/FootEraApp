// client/src/pages/GerenciarAtletas
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {CirclePlus } from "lucide-react";
import axios from "axios";
import {
  Users, Search, Filter, ChevronRight, ArrowUpAZ, ArrowDownZA,
  Shield, Activity, Trophy, Loader2, X, CalendarClock, ListChecks,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import Storage from "../../../server/utils/storage.js";
import { API, APP } from "../config.js";
import TurmasManager from "../components/turmas/TurmasManager.js";
import BottomNav from "@/components/layout/BottomNav.js";
import AgendaTreinos, { normalizeAgendadosPayload } from "@/components/agenda/AgendaTreinos";

export type CategoriaBase =
  | "Sub-9"
  | "Sub-11"
  | "Sub-13"
  | "Sub-15"
  | "Sub-17"
  | "Sub-20"
  | "Livre";

export type Posicao =
  | "Goleiro"
  | "Zagueiro"
  | "Lateral"
  | "Volante"
  | "Meia"
  | "Atacante";

type AtletaMin = {
  id: string;
  usuarioId: string;
  nome: string;
  sobrenome?: string | null;
  nomeUsuario?: string | null;
  idade?: number | null;
  foto?: string | null;
  categoria?: CategoriaBase | null;
  posicao?: Posicao | null;
  pontuacao?: number | null;
  ativoRecentemente?: boolean;
  clubeNome?: string | null;
  escolinhaNome?: string | null;
  professorNome?: string | null;
};

type ProfessorMin = {
  id: string;
  usuarioId: string;
  nome: string;
  cref?: string | null;
  foto?: string | null;
  turmas?: number;
};

type EstatisticasAtleta = {
  totalTreinosMes: number;
  concluidosMes: number;
  desafiosFeitosMes: number;
  mediaUltimas4Semanas: number;
  evolucaoSemanas: Array<{ semana: string; pontos: number }>;
};

type SubmissaoItem = {
  id: string;
  tipo: "treino" | "desafio";
  data: string;
  titulo: string;
  aprovado: boolean | null;
  pontos?: number | null;
};

type TreinoAgendadoItem = {
  id: string;
  titulo: string | null;
  dataTreino: string | Date | null;
  dataExpiracao?: string | Date | null;
  treinoProgramadoId?: string | null;
  treinoProgramado?: { id: string; nome?: string | null } | null;
  meuStatus?: string | null;
  status?: string | null;
  execucaoStatus?: string | null;
  submissaoTreinoId?: string | null;
  submissaoFeita?: boolean;
};

type TreinoProgramadoItem = {
  id: string;
  nome: string;
  codigo?: string | null;
  nivel?: string | null;
  descricao?: string | null;
  autor?: { tipo: "Professor" | "Clube" | "Escolinha" | "Desconhecido"; id: string | null; nome: string | null };
};

type AvaliacaoResp = {
  submissaoTreinoId: string;
  avaliacao: null | {
    id: string;
    nota: number;
    concluiu: boolean;
    teveDificuldade: boolean;
    dificuldadeMotivo: string | null;
    motivoNaoConcluiu: string | null;
    comentarios: { id: string; texto: string; ordem: number }[];
  };
};

type AutorTipoApi = "Professor" | "Clube" | "Escolinha";


function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function isPastDayISO(dayISO: string) {
  const [y, m, d] = dayISO.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.getTime() < startOfToday().getTime();
}

function toISODateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 0, 0, 0, 0);
}

function parseAsDate(x: any): Date | null {
  if (!x) return null;
  if (x instanceof Date) return x;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKeyFromAny(x: any) {
  const d = parseAsDate(x);
  if (!d) return "";
  return toISODateOnly(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}



function statusLabel(s?: string | null) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO") return "Concluído";
  if (v === "IN_PROGRESS" || v === "EM_ANDAMENTO") return "Em andamento";
  if (v === "EXPIRED" || v === "EXPIRADO") return "Perdido";
  return "Pendente";
}

function autorTipoFromTela(t: "Escola" | "Clube" | "Professor"): AutorTipoApi {
  if (t === "Professor") return "Professor";
  if (t === "Clube") return "Clube";
  return "Escolinha";
}

function isCompleted(s?: string | null) {
  const v = String(s || "").toUpperCase();
  return v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO";
}

function isExpiredStatus(s?: string | null) {
  const v = String(s || "").toUpperCase();
  return v === "EXPIRED" || v === "EXPIRADO" || v === "PERDIDO";
}

function isLost(t: TreinoAgendadoItem) {
  if (isExpiredStatus(t.meuStatus) || isExpiredStatus(t.execucaoStatus) || isExpiredStatus(t.status)) return true;

  const dt = parseAsDate(t.dataTreino);
  if (!dt) return false;

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const treinoOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const passouDoDia = treinoOnly.getTime() < todayOnly.getTime();
  const concluido = isCompleted(t.meuStatus || t.execucaoStatus || t.status);

  return passouDoDia && !concluido;
}

function submissaoToAgendadoLike(s: SubmissaoItem): TreinoAgendadoItem {
  return {
    id: `sub_${s.id}`,
    titulo: s.titulo ?? "Treino",
    dataTreino: s.data,
    treinoProgramadoId: null,
    treinoProgramado: { id: "", nome: s.titulo ?? "Treino" },
    meuStatus: s.aprovado === true ? "COMPLETED" : "PENDENTE",
    status: null,
    execucaoStatus: null,
    submissaoTreinoId: s.tipo === "treino" ? s.id : null,
  };
}
const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;
const getFoto = (f?: string | null) => {
  if (!f || f === "" || f === "null") return AVATAR_FALLBACK;

  const v = String(f).trim();

  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/assets/") || v.startsWith("assets/")) {
    return v.startsWith("/") ? v : `/${v}`;
  }
  if (v.startsWith("/uploads/") || v.startsWith("uploads/")) {
    const path = v.startsWith("/") ? v.slice(1) : v;
    return `${API.BASE_URL}/${path}`;
  }

  return `${API.BASE_URL}/${v.replace(/^\/+/, "")}`;
};
const nomeCompletoAtleta = (a: Pick<AtletaMin, "nome" | "sobrenome" | "nomeUsuario">) => {
  const nu = String((a as any).nomeUsuario || "").trim();
  if (nu) return nu;

  const n = String(a.nome || "").trim();
  const s = String(a.sobrenome || "").trim();
  return [n, s].filter(Boolean).join(" ").trim() || "Atleta";
};

const numberOrDash = (n?: number | null) => (typeof n === "number" ? n : "–");
const formatRelativo = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000), h = Math.floor(min / 60), dias = Math.floor(h / 24);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (h < 24) return `há ${h} h`;
  if (dias === 1) return "ontem";
  return `há ${dias} d`;
};

// ✅ cache para não bater na API toda hora
const pontuacaoCacheRef = { current: new Map<string, number>() };

// ✅ mesma lógica do ProfileHeader: soma performance + disciplina + responsabilidade
async function fetchPontuacaoTotalPorUsuarioId(
  usuarioId: string,
  headers: any
): Promise<number | null> {
  const uid = String(usuarioId || "").trim();
  if (!uid) return null;

  const cached = pontuacaoCacheRef.current.get(uid);
  if (typeof cached === "number") return cached;

  try {
    const r = await fetch(`${API.BASE_URL}/api/perfil/${encodeURIComponent(uid)}/pontuacao`, {
      headers,
    });

    if (!r.ok) return null;
    const data: any = await r.json();

    // mesma soma do ProfileHeader
    const performance = Number(data?.performance) || 0;
    const disciplina = Number(data?.disciplina) || 0;
    const responsabilidade = Number(data?.responsabilidade) || 0;

    const total = performance + disciplina + responsabilidade;

    pontuacaoCacheRef.current.set(uid, total);
    return total;
  } catch {
    return null;
  }
}

function onImgErrorFallback(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if ((img as any).dataset?.fallbackApplied) return;
  (img as any).dataset.fallbackApplied = "1";
  img.src = AVATAR_FALLBACK;
}

const AprovacaoPill: React.FC<{ value: boolean | null }> = ({ value }) => {
  const cls = value === true
    ? "bg-emerald-100 text-emerald-700"
    : value === false
      ? "bg-red-100 text-red-700"
      : "bg-zinc-100 text-zinc-600";
  const label = value === true ? "aprovado" : value === false ? "reprovado" : "pendente";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>;
};

const StatusBadge: React.FC<{ ativo?: boolean }> = ({ ativo }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ativo ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"
      }`}
  >
    <span className={`h-2 w-2 rounded-full ${ativo ? "bg-green-500" : "bg-zinc-400"}`} />
    {ativo ? "ativo" : "inativo"}
  </span>
);

const posicoesMap: Record<string, string> = {
  GOL: "Goleiro",
  LD: "Lateral Direito",
  ZD: "Zagueiro Direito",
  ZE: "Zagueiro Esquerdo",
  LE: "Lateral Esquerdo",
  VOL1: "Volante 1",
  VOL2: "Volante 2",
  MEI: "Meia",
  PD: "Ponta Direita",
  CA: "Centroavante",
  PE: "Ponta Esquerda",
};

type PosicaoCodigo = keyof typeof posicoesMap;

const apiToUiCategoria = (c?: string | null): CategoriaBase | null => {
  if (!c) return null;
  if (c === "Livre") return "Livre";
  if (c.startsWith("Sub-")) return c as CategoriaBase;
  if (c.startsWith("Sub"))  return (`Sub-${c.slice(3)}` as CategoriaBase);
  return null;
};

const uiToApiCategoria = (c?: CategoriaBase | ""): string | undefined => {
  if (!c) return undefined;
  if (c === "Livre") return "Livre";
  return c.replace("Sub-", "Sub");
};

const GerenciarAtletas: React.FC = () => {
  const [location, setLocation] = useLocation();
  const isAtletasPage = location === "/perfil/GerenciarAtletas" || location === "/perfil/gerenciarAtletas";
  const isProfessoresPage = location === "/perfil/GerenciarProfessores" || location === "/perfil/gerenciarProfessores";

  const qs = location.includes("?") ? location.split("?")[1] : "";
  const params = new URLSearchParams(qs);
  const tab = params.get("tab");
  const isTurmasTab = tab === "turmas";
  const isTurmasPage = isProfessoresPage && isTurmasTab;

  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [tipo, setTipo] = useState<"Escola" | "Clube" | "Professor" | null>(null);
  const [usuarioIdEntidade, setUsuarioIdEntidade] = useState<string | null>(null);
  const [tipoUsuarioIdEntidade, setTipoUsuarioIdEntidade] = useState<string | null>(null);
  const [atletas, setAtletas] = useState<AtletaMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<"" | CategoriaBase>("");
  const [posicaoCodigo, setPosicaoCodigo] = useState<"" | PosicaoCodigo>("");
  const [status, setStatus] = useState<"" | "ativo" | "inativo">("");
  const [ordenacao, setOrdenacao] = useState<
    "pontuacao_desc" | "pontuacao_asc" | "nome_asc" | "nome_desc"
  >("pontuacao_desc");

  const [selecionados, setSelecionados] = useState<Record<string, boolean>>({});
  const [focado, setFocado] = useState<AtletaMin | null>(null);
  const [stats, setStats] = useState<EstatisticasAtleta | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingStatsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingSubsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [submissoes, setSubmissoes] = useState<SubmissaoItem[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [aba, setAba] = useState<"atletas" | "professores">("atletas");
  const [turmasOpen, setTurmasOpen] = useState(false);
  const [turmasProfessorId, setTurmasProfessorId] = useState<string | null>(null);
  const [professores, setProfessores] = useState<ProfessorMin[]>([]);
  const [profLoading, setProfLoading] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);
  const [carreiraOpen, setCarreiraOpen] = useState(false);
  const [cursorMonth, setCursorMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [agendados, setAgendados] = useState<TreinoAgendadoItem[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [loadingProgramados, setLoadingProgramados] = useState(false);
  const [treinosProgramados, setTreinosProgramados] = useState<TreinoProgramadoItem[]>([]);
  const [treinoProgramadoId, setTreinoProgramadoId] = useState<string>("");
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [avaliarOpen, setAvaliarOpen] = useState(false);
  const [avaliarLoading, setAvaliarLoading] = useState(false);
  const [submissaoSelecionada, setSubmissaoSelecionada] = useState<string>("");
  const [nota, setNota] = useState<number>(0);
  const [concluiu, setConcluiu] = useState<boolean>(true);
  const [teveDificuldade, setTeveDificuldade] = useState<boolean>(false);
  const [dificuldadeMotivo, setDificuldadeMotivo] = useState<string>("");
  const [motivoNaoConcluiu, setMotivoNaoConcluiu] = useState<string>("");
  const [comentarioLivre, setComentarioLivre] = useState<string>("");

  const OPCOES_COMENTARIOS = [
    "Boa execução técnica",
    "Precisa melhorar o ritmo",
    "Ótima intensidade",
    "Faltou consistência",
    "Postura e controle muito bons",
    "Atenção à finalização",
    "Excelente evolução",
    "Precisa focar na tomada de decisão",
  ] as const;

  const [comentariosMarcados, setComentariosMarcados] = useState<Record<string, boolean>>({});
  const [salvandoAvaliacao, setSalvandoAvaliacao] = useState(false);
  const [detalheAtivo, setDetalheAtivo] = useState(false);

  const tipoParaVinculo = (t: "Escola" | "Clube" | "Professor") =>
    t === "Escola" ? "escolinha" : t.toLowerCase();

  function getAutorId() {
    return String(tipoUsuarioIdEntidade || "");
  }

  function fecharModalAvaliacao() {
    setAvaliarOpen(false);
    setAvaliarLoading(false);
    setSubmissaoSelecionada("");
    setSalvandoAvaliacao(false);
    setComentarioLivre("");
  }

  const descobrirPerfil = async () => {
    try {
      const { data } = await axios.get(`${API.BASE_URL}/api/perfil/me`, { headers });

      const perfilTipo: string | undefined = data?.tipo; 
      const normalizado =
        perfilTipo === "Escolinha" ? "Escola" :
        perfilTipo === "Clube"     ? "Clube"  :
        perfilTipo === "Professor" ? "Professor" : null;

      if (!normalizado) throw new Error("Perfil institucional inválido para Gerenciar Atletas.");

      const usuarioId = data?.usuario?.id || Storage.usuarioId || null;
      const tipoIdFromApi =
        (perfilTipo === "Professor"  && data?.professor?.id) ||
        (perfilTipo === "Clube"      && data?.clube?.id) ||
        (perfilTipo === "Escolinha"  && data?.escolinha?.id) ||
        null;

      const tipoId =
        tipoIdFromApi ||
        (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        null;

      setTipoUsuarioIdEntidade(tipoId);

      if (!usuarioId) throw new Error("Não foi possível identificar o usuarioId da entidade.");

      setTipo(normalizado);
      setUsuarioIdEntidade(usuarioId);     
      setTipoUsuarioIdEntidade(tipoId);     
    } catch (e: any) {
      setTipo(null);
      setUsuarioIdEntidade(null);
      setTipoUsuarioIdEntidade(null);
      setError(e?.response?.data?.message || e?.message || "Não foi possível identificar o perfil");
    }
  };

  const carregarAtletas = async () => {
    if (!tipo || !usuarioIdEntidade) return;
    try {
      setError(null);
      setLoading(true);

      const usuarioId = String(usuarioIdEntidade || "").trim();
      const entidadeIdReal = String(tipoUsuarioIdEntidade || "").trim();
      if (!entidadeIdReal) {
        setError("Não foi possível identificar o ID da entidade (tipoUsuarioId). Faça logout/login ou verifique /api/perfil/me.");
        setAtletas([]);
        setLoading(false);
        return;
      }

      const params: any = {
        vinculo: tipoParaVinculo(tipo),
        id: entidadeIdReal,
        tipoUsuarioId: entidadeIdReal,
        order: ordenacao,
        usuarioId: String(usuarioIdEntidade || "").trim(),
      };

      if (entidadeIdReal) params.tipoUsuarioId = entidadeIdReal;

      params.usuarioId = usuarioId;
      if (q.trim()) params.search = q.trim();
      if (categoria) params.categoria = uiToApiCategoria(categoria);
      if (posicaoCodigo) params.posicao = posicaoCodigo;
      if (status) params.status = status;

      const { data } = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, { headers, params });
      const lista = (data?.atletas || []) as any[];
      const normalizados: AtletaMin[] = lista.map((a) => {
        const nomeUsuario = a.usuario?.nome ?? null;

        return {
          id: a.id,
          usuarioId: a.usuarioId,
          nome: a.nome ?? "Atleta",
          sobrenome: a.sobrenome ?? null,
          nomeUsuario,
          idade: a.idade ?? null,
          foto: a.foto ?? a.usuario?.foto ?? null,
          posicao: (posicoesMap as any)[a.posicao] ?? a.posicao ?? null,
          categoria: apiToUiCategoria(a.categoria),
          pontuacao: a.pontuacao ?? null, // (vai ser sobrescrito abaixo com o cálculo real)
          ativoRecentemente: !!a.ativoRecentemente,
          clubeNome: a.clube?.nome ?? a.clubeNome ?? null,
          escolinhaNome: a.escolinha?.nome ?? a.escolinhaNome ?? null,
          professorNome:
            a.professor?.nome ??
            a.professor?.usuario?.nome ??
            a.professorNome ??
            null,
        };
      });

      // ✅ seta rápido (UI não fica vazia)
      setAtletas(normalizados);

      // ✅ agora resolve pontuação REAL igual ProfileHeader (p/ cada atleta)
      const withRealScore = await Promise.all(
        normalizados.map(async (at) => {
          const total = await fetchPontuacaoTotalPorUsuarioId(at.usuarioId, {
            ...(headers || {}),
          });

          return {
            ...at,
            pontuacao: typeof total === "number" ? total : (at.pontuacao ?? null),
          };
        })
      );

      setAtletas(withRealScore);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Falha ao carregar atletas");
    } finally {
      setLoading(false);
    }
  };

  const carregarProfessores = async () => {
    if (!tipo || tipo === "Professor" || !usuarioIdEntidade) return;
    try {
      setProfError(null);
      setProfLoading(true);

      const usuarioId = String(usuarioIdEntidade || "").trim();
      const entidadeIdReal = String(tipoUsuarioIdEntidade || "").trim();
      if (!entidadeIdReal) {
        setError("Não foi possível identificar o ID da entidade (tipoUsuarioId). Faça logout/login ou verifique /api/perfil/me.");
        setAtletas([]);
        setLoading(false);
        return;
      }

      const params: any = {
        vinculo: tipoParaVinculo(tipo),
        id: entidadeIdReal,
        tipoUsuarioId: entidadeIdReal,
        order: ordenacao,
        usuarioId: String(usuarioIdEntidade || "").trim(),
      };

      if (entidadeIdReal) params.tipoUsuarioId = entidadeIdReal;

      params.usuarioId = usuarioId;

      if (q.trim()) params.search = q.trim();

      const { data } = await axios.get(`${API.BASE_URL}/api/gerenciar/professores`, { headers, params });
      const lista = (data?.professores || data || []) as any[];

      setProfessores(
        lista.map((p) => ({
          id: p.id,
          usuarioId: p.usuarioId,
          nome: p.nome,
          cref: p.cref ?? null,
          foto: p.fotoUrl ?? p.foto ?? null,
          turmas: p._count?.turmas ?? p.turmasCount ?? 0,
        }))
      );
    } catch (e: any) {
      setProfessores([]);
      setProfError(e?.response?.data?.message || e?.message || "Falha ao carregar professores");
    } finally {
      setProfLoading(false);
    }
  };

  const carregarStatsAtleta = async (atletaUsuarioId: string) => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas/${atletaUsuarioId}/pontuacao`, { headers });
      const s: EstatisticasAtleta = {
        totalTreinosMes: res.data?.totalTreinosMes ?? 0,
        concluidosMes: res.data?.concluidosMes ?? 0,
        desafiosFeitosMes: res.data?.desafiosFeitosMes ?? 0,
        mediaUltimas4Semanas: res.data?.mediaUltimas4Semanas ?? 0,
        evolucaoSemanas: res.data?.evolucaoSemanas ?? [
          { semana: "S-3", pontos: 0 },
          { semana: "S-2", pontos: 0 },
          { semana: "S-1", pontos: 0 },
          { semana: "S", pontos: 0 },
        ],
      };
      setStats(s);
    } catch (_) {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const carregarSubmissoesAtleta = async (atletaUsuarioId: string) => {
    setSubsLoading(true);
    try {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/gerenciar/atletas/${atletaUsuarioId}/submissoes`,
        { headers, params: { type: "all", period: "month", limit: 8 } }
      );
      const items = (data?.items || []) as any[];
      setSubmissoes(items.map((row) => ({
        id: row.id,
        tipo: row.tipo,
        data: new Date(row.data || row.criadoEm || Date.now()).toISOString(),
        titulo: row.titulo || (row.tipo === "treino" ? "Treino" : "Desafio"),
        aprovado: (row.aprovado ?? null),
        pontos: row.pontos ?? null,
      })));
    } catch {
      setSubmissoes([]);
    } finally {
      setSubsLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    descobrirPerfil();
  }, [token]);

  useEffect(() => {
    if (!tipo || !usuarioIdEntidade) return;

    carregarAtletas();
    if (tipo !== "Professor") carregarProfessores();

    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      carregarAtletas();
      if (tipo !== "Professor") carregarProfessores();
    }, 30000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [tipo, usuarioIdEntidade]);

  const filtrosRef = useRef<any>(null);

  useEffect(() => {
    if (!tipo || !usuarioIdEntidade) return;

    if (filtrosRef.current) clearTimeout(filtrosRef.current);

    filtrosRef.current = setTimeout(() => {
      carregarAtletas();
    }, 400);

    return () => {
      if (filtrosRef.current) clearTimeout(filtrosRef.current);
    };
  }, [q, categoria, posicaoCodigo, status, ordenacao, tipo, usuarioIdEntidade]);

  const filtrados = useMemo(() => atletas, [atletas]);
  const metricas = useMemo(() => {
    const total = filtrados.length || 0;
    const soma = filtrados.reduce((acc, a) => acc + (a.pontuacao ?? 0), 0);
    const mediaPont = total ? Math.round((soma / total) * 10) / 10 : 0;
    const ativos = filtrados.filter((a) => a.ativoRecentemente).length;
    return { total, mediaPont, ativos };
  }, [filtrados]);

  const limparSelecao = () => setSelecionados({});

  const abrirDetalhe = (a: AtletaMin) => {
    setFocado(a);
    setDetalheAtivo(true);
  };

  function limparDetalhe() {
    if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
    if (pollingSubsRef.current) clearInterval(pollingSubsRef.current);

    setDetalheAtivo(false);
    setFocado(null);
    setStats(null);
    setSubmissoes([]);
  }

  const focadoUid = focado?.usuarioId ?? focado?.id ?? null;

  useEffect(() => {
    if (!detalheAtivo || !focadoUid) return;

    carregarStatsAtleta(focadoUid);
    carregarSubmissoesAtleta(focadoUid);

    return () => {
      if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
      if (pollingSubsRef.current) clearInterval(pollingSubsRef.current);
    };
  }, [detalheAtivo, focadoUid]);

  async function carregarAgendadosDoAtleta(atletaId: string, mes: Date) {
    const month = `${mes.getFullYear()}-${pad2(mes.getMonth() + 1)}`;
    const r = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas/${atletaId}/agendados`, {
      headers,
      params: { month },
    });
    setAgendados(normalizeAgendadosPayload(r.data));
  }

  useEffect(() => {
    if (!carreiraOpen || !focado) return;

    setSelectedDays([]);
    setDrawerOpen(true);
    setTreinoProgramadoId("");

    const atletaId = focado.id;

    (async () => {
      try {
        setLoadingCalendar(true);
        await carregarAgendadosDoAtleta(atletaId, cursorMonth);
      } catch (e) {
        console.error("Erro ao carregar agendados:", e);
        setAgendados([]);
      } finally {
        setLoadingCalendar(false);
      }
    })();

    (async () => {
      try {
        setLoadingProgramados(true);

        const entidadeIdReal = String(tipoUsuarioIdEntidade || "").trim();
        const entidadeFallback = String(usuarioIdEntidade || "").trim();
        const idParaEnviar = entidadeIdReal || entidadeFallback;

        if (!entidadeIdReal) {
          console.warn(
            "[GerenciarAtletas] tipoUsuarioIdEntidade está vazio — usando usuarioIdEntidade como fallback. Ideal: /perfil/me retornar o id da entidade."
          );
        }

        const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`, {
          headers,
          params: {
            vinculo: tipo ? tipoParaVinculo(tipo) : undefined,
            id: idParaEnviar,
            tipoUsuarioId: entidadeIdReal || undefined,
            debug: "1",
          },
        });

        const items = (res.data?.items ?? res.data ?? []) as any[];

        setTreinosProgramados(
          items.map((t) => ({
            id: String(t.id),
            nome: String(t.nome ?? t.titulo ?? "Treino"),
            codigo: t.codigo ?? null,
            nivel: t.nivel ?? null,
            descricao: t.descricao ?? null,
            autor: t.autor
              ? { tipo: t.autor.tipo, id: t.autor.id ?? null, nome: t.autor.nome ?? null }
              : undefined,
          }))
        );
      } catch (e) {
        console.error("Erro ao carregar treinos programados:", e);
        setTreinosProgramados([]);
      } finally {
        setLoadingProgramados(false);
      }
    })();
  }, [carreiraOpen, focado?.id, tipo, usuarioIdEntidade,tipoUsuarioIdEntidade]);

  useEffect(() => {
    if (!carreiraOpen || !focado?.id) return;

    (async () => {
      try {
        setLoadingCalendar(true);
        await carregarAgendadosDoAtleta(focado.id, cursorMonth);
      } catch (e) {
        console.error("Erro ao recarregar agendados (troca de mês):", e);
        setAgendados([]);
      } finally {
        setLoadingCalendar(false);
      }
    })();
  }, [carreiraOpen, focado?.id, cursorMonth]);

  const chartData = useMemo(() => {
    const bins = [
      { semana: "Semana 1", treinos: 0, desafios: 0 },
      { semana: "Semana 2", treinos: 0, desafios: 0 },
      { semana: "Semana 3", treinos: 0, desafios: 0 },
      { semana: "Semana 4", treinos: 0, desafios: 0 },
    ];
    const now = Date.now();
    for (const s of submissoes) {
      if (s.aprovado !== true) continue;
      const t = new Date(s.data).getTime();
      const diffDays = Math.floor((now - t) / 86_400_000);
      let idx = -1;
      if (diffDays <= 6) idx = 3;
      else if (diffDays <= 13) idx = 2;
      else if (diffDays <= 20) idx = 1;
      else if (diffDays <= 27) idx = 0;
      if (idx >= 0) {
        if (s.tipo === "treino") bins[idx].treinos += 1;
        else bins[idx].desafios += 1;
      }
    }
    return bins;
  }, [submissoes]);

const monthLabel = useMemo(() => {
  const d = cursorMonth;
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}, [cursorMonth]);

function formatDayPtBR(dayISO: string) {
  const [y, m, d] = dayISO.split("-").map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const daysGrid = useMemo(() => {
  const first = startOfMonth(cursorMonth);
  const firstWeekday = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const inMonth = d.getMonth() === cursorMonth.getMonth();
    return { date: d, key: toISODateOnly(d), inMonth };
  });
}, [cursorMonth]);

const agendadosPorDia = useMemo(() => {
  const map = new Map<string, TreinoAgendadoItem[]>();

  for (const t of agendados) {
    const k = dayKeyFromAny(t.dataTreino);
    if (!k) continue;
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }

  for (const s of submissoes) {
    const k = dayKeyFromAny(s.data);
    if (!k) continue;

    const arr = map.get(k) ?? [];
    const like = submissaoToAgendadoLike(s);
    const nomeLike = (like.treinoProgramado?.nome || like.titulo || "").trim();
    const idx = arr.findIndex((x) => {
      const nomeX = (x.treinoProgramado?.nome || x.titulo || "").trim();
      return nomeX && nomeX === nomeLike;
    });

    if (idx >= 0) {
      const atual = arr[idx];
      arr[idx] = {
        ...atual,
        submissaoTreinoId: atual.submissaoTreinoId ?? like.submissaoTreinoId ?? null,
        submissaoFeita: atual.submissaoFeita ?? true,
        meuStatus: atual.meuStatus ?? like.meuStatus,
      };
    } else {
      arr.push(like);
    }
    map.set(k, arr);
  }
  return map;
}, [agendados, submissoes]);

const selectedDayItems = useMemo(() => {
  const out: { day: string; items: TreinoAgendadoItem[] }[] = [];
  for (const day of selectedDays) out.push({ day, items: agendadosPorDia.get(day) ?? [] });
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}, [selectedDays, agendadosPorDia]);

const hasPastSelectedDay = useMemo(() => {
  return selectedDays.some(isPastDayISO);
}, [selectedDays]);

const forceScrollDetails = useMemo(() => selectedDays.length >= 2, [selectedDays.length]);

function toggleDay(dayISO: string) {
  setDrawerOpen(true);
  setSelectedDays((prev) =>
    prev.includes(dayISO) ? prev.filter((d) => d !== dayISO) : [...prev, dayISO]
  );
}

async function agendarParaDiasSelecionados() {
  if (selectedDays.some(isPastDayISO)) {
    return alert("Não é permitido agendar treinos em datas passadas.");
  }
  if (!focado?.id) return;
  if (!treinoProgramadoId) return alert("Selecione um treino programado para agendar.");
  if (!selectedDays.length) return alert("Selecione ao menos 1 dia no calendário.");
  if (salvandoAgenda) return;

  const autorId = getAutorId();           
  const autorTipo = tipo ? autorTipoFromTela(tipo) : undefined; 

  if (!autorId || !autorTipo) {
    return alert("Não foi possível identificar o autor (entidade) para agendar.");
  }

  setSalvandoAgenda(true);
  try {
    await Promise.all(
      selectedDays.map((day) =>
        axios.post(
          `${API.BASE_URL}/api/treinos/agendados`,
          {
            atletaId: focado.id,
            treinoProgramadoId,
            dataTreino: day,
            autorId,
            autorTipo,
          },
          { headers }
        )
      )
    );

    const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, {
      headers,
      params: { atletaId: focado.id },
    });
    setAgendados(normalizeAgendadosPayload(r.data));
    setSelectedDays([]);
    alert("Treino(s) agendado(s) com sucesso!");
  } catch (e: any) {
    console.error(e);

    const msg =
      e?.response?.data?.message ||
      (e?.response?.status === 409 ? "Já existe treino agendado em um dos dias selecionados." : null) ||
      "Erro ao agendar treinos.";
    alert(msg);
  } finally {
    setSalvandoAgenda(false);
  }
}

async function abrirModalAvaliacao(submissaoTreinoId: string) {
  const id = String(submissaoTreinoId || "").trim();
  if (!id) return;

  setAvaliarOpen(true);
  setAvaliarLoading(true);
  setSubmissaoSelecionada(id);

  try {
    const { data } = await axios.get<AvaliacaoResp>(
      `${API.BASE_URL}/api/gerenciar/submissoes/treino/${id}/avaliacao`,
      { headers }
    );

    const av = data?.avaliacao;

    setNota(av?.nota ?? 0);
    setConcluiu(av?.concluiu ?? true);
    setTeveDificuldade(av?.teveDificuldade ?? false);
    setDificuldadeMotivo(av?.dificuldadeMotivo ?? "");
    setMotivoNaoConcluiu(av?.motivoNaoConcluiu ?? "");

    const marked: Record<string, boolean> = {};
    const livres: string[] = [];

    (av?.comentarios ?? []).forEach((c) => {
      const texto = String(c.texto || "").trim();
      if (!texto) return;

      if ((OPCOES_COMENTARIOS as readonly string[]).includes(texto)) {
        marked[texto] = true;
      } else {
        livres.push(texto);
      }
    });

    setComentariosMarcados(marked);
    setComentarioLivre(livres.join("\n"));
  } catch (e) {
    console.error(e);
    setNota(0);
    setConcluiu(true);
    setTeveDificuldade(false);
    setDificuldadeMotivo("");
    setMotivoNaoConcluiu("");
    setComentariosMarcados({});
    setComentarioLivre("");
  } finally {
    setAvaliarLoading(false);
  }
}

async function salvarAvaliacao() {
  if (!submissaoSelecionada) return;
  if (!tipo) return alert("Tipo de perfil inválido.");
  const autorId = getAutorId();
  if (!autorId) return alert("Não foi possível identificar o ID da entidade (autorId).");

  const autorTipo = autorTipoFromTela(tipo);
  const comentariosMarcadosArr = Object.entries(comentariosMarcados)
    .filter(([, v]) => v)
    .map(([texto]) => String(texto));
  const comentarioLivreTrim = comentarioLivre.trim();
  const comentariosTextoFinal = [
    ...comentariosMarcadosArr,
    ...(comentarioLivreTrim ? [comentarioLivreTrim] : []),
  ];
  const comentarios = comentariosTextoFinal.map((texto, idx) => ({ texto, ordem: idx }));

  setSalvandoAvaliacao(true);
    try {
      await axios.put(
        `${API.BASE_URL}/api/gerenciar/submissoes/treino/${submissaoSelecionada}/avaliacao`,
        {
          autorTipo,
          autorId,
          nota,
          concluiu,
          teveDificuldade,
          dificuldadeMotivo: teveDificuldade ? dificuldadeMotivo : null,
          motivoNaoConcluiu: concluiu ? null : motivoNaoConcluiu,
          comentarios,
        },
        { headers }
      );

      alert("Avaliação salva!");
      fecharModalAvaliacao();
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || "Erro ao salvar avaliação");
    } finally {
      setSalvandoAvaliacao(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-4 py-4 sm:py-6 pb-24">
      <div className="mb-3">
        <Link
          href="/perfil"
          aria-label="Voltar para o perfil"
          className="inline-flex h-10 w-10 items-center justify-center
                    rounded-xl border border-green-800/60 bg-white text-green-900
                    shadow-sm hover:bg-green-50"
        >
          <span className="text-xl -mt-0.5">&lt;</span>
        </Link>
      </div>
      
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-600/10 p-3 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{tipo ?? "Institucional"} · Gerenciar Atletas</h1>
            <p className="text-sm text-zinc-500">Acompanhe e organize seus atletas vinculados na FootEra.</p>

            {tipo && (
              <div className="mt-2 inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setLocation("/perfil/GerenciarAtletas")}
                  className={`px-3 py-1.5 rounded-lg ${
                    isAtletasPage ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Atletas
                </button>

                {tipo !== "Professor" && (
                  <button
                    type="button"
                    onClick={() => setLocation("/perfil/GerenciarProfessores")}
                    className={`px-3 py-1.5 rounded-lg ${
                      isProfessoresPage && !isTurmasTab
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    Professores
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setLocation("/perfil/GerenciarProfessores?tab=turmas")}
                  className={`px-3 py-1.5 rounded-lg ${
                    isTurmasPage ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Turmas
                </button>
              </div>
            )}


          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-start sm:justify-end gap-2">
          {tipo && (
            <>
              {tipo !== "Professor" && (
                <>
                  <button
                    onClick={() => { setTurmasProfessorId(null); setTurmasOpen(true); }}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <CirclePlus className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-sm">Adicionar</span>
                    <span className="hidden sm:inline whitespace-nowrap">turma</span>
                  </button>

                  <button
                    onClick={() => { setTurmasProfessorId(null); setTurmasOpen(true); }}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <ListChecks className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-sm">Turmas</span>
                    <span className="hidden sm:inline whitespace-nowrap"> (admin)</span>
                  </button>
                </>
              )}

              {tipo === "Professor" && (
                <button
                  onClick={() => setLocation("/perfil/GerenciarProfessores?tab=turmas")}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <ListChecks className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap text-sm">Turmas</span>
                </button>
              )}
            </>
          )}

        </div>
      </div>

      <div className="mb-3 sm:mb-4 grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-12">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] sm:text-sm"
          >
            <option value="">Categoria (todas)</option>
            {["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Livre"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={posicaoCodigo}
            onChange={(e) => setPosicaoCodigo(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] sm:text-sm"
          >
            <option value="">Posição (todas)</option>
            {Object.entries(posicoesMap).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-[13px] sm:text-sm"
          >
            <option value="">Status</option>
            <option value="ativo">Ativo recentemente</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      {aba === "professores" && tipo !== "Professor" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 p-4">
            <div className="text-sm font-semibold text-zinc-900">Professores vinculados</div>
            <div className="text-sm text-zinc-600">{professores.length} resultado(s)</div>
          </div>

          {profLoading ? (
            <div className="p-6 text-center text-zinc-600">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          ) : profError ? (
            <div className="p-6 text-center text-red-600">{profError}</div>
          ) : professores.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">Nenhum professor encontrado.</div>
          ) : (
            <table className="min-w-full table-fixed">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="w-16 p-3">Foto</th>
                  <th className="p-3">Nome</th>
                  <th className="w-28 p-3">CREF</th>
                  <th className="w-28 p-3">Turmas</th>
                  <th className="w-40 p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {professores.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-100">
                    <td className="p-3">
                      <img
                        src={getFoto(p.foto)}
                        alt={p.nome}
                        onError={onImgErrorFallback}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-zinc-900">{p.nome}</div>
                      
                    </td>
                    <td className="p-3 text-sm text-zinc-700">{p.cref ?? "—"}</td>
                    <td className="p-3 text-sm text-zinc-700">{p.turmas ?? 0}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setTurmasProfessorId(p.id); setTurmasOpen(true); }}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                        >
                          Administrar turmas
                        </button>
                        <button
                          onClick={() => { setTurmasProfessorId(p.id); setTurmasOpen(true); }}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                        >
                          Adicionar turma
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="mb-4 hidden sm:grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Shield className="h-4 w-4" /> Atletas vinculados
                </div>
                <div className="mt-2 text-2xl font-semibold">{metricas.total}</div>
                <div className="text-xs text-zinc-500">Total filtrado nesta visão</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Activity className="h-4 w-4" /> Ativos recentemente
                </div>
                <div className="mt-2 text-2xl font-semibold">{metricas.ativos}</div>
                <div className="text-xs text-zinc-500">Baseado em última atividade</div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Trophy className="h-4 w-4" /> Média de pontuação
                </div>
                <div className="mt-2 text-2xl font-semibold">{metricas.mediaPont}</div>
                <div className="text-xs text-zinc-500">Pontuação FootEra</div>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Filter className="h-4 w-4" /> {filtrados.length} resultado(s)
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => setOrdenacao((o) => (o === "pontuacao_desc" ? "pontuacao_asc" : "pontuacao_desc"))}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  {ordenacao.includes("pontuacao")
                    ? ordenacao === "pontuacao_desc"
                      ? <ArrowDownZA className="h-4 w-4" />
                      : <ArrowUpAZ className="h-4 w-4" />
                    : <ArrowDownZA className="h-4 w-4" />}
                  Pontuação
                </button>
                <button
                  onClick={() => setOrdenacao((o) => (o === "nome_asc" || o === "pontuacao_desc" ? "nome_desc" : "nome_asc"))}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <ArrowDownZA className="h-4 w-4" /> Nome
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
              {loading ? (
                <div className="p-6 text-center text-zinc-600">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Carregando atletas…
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-600">{error}</div>
              ) : filtrados.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">Nenhum atleta encontrado.</div>
              ) : (
                <>
                  <div className="sm:hidden divide-y divide-zinc-100">
                    {filtrados.map((a) => (
                      <div key={a.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getFoto(a.foto)}
                            alt={nomeCompletoAtleta(a)}
                            onError={onImgErrorFallback}
                            className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-zinc-900 truncate">
                              {nomeCompletoAtleta(a)}
                            </div>

                            <div className="text-xs text-zinc-500 truncate">
                              {a.categoria ?? "—"} · {a.posicao ?? "—"}
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-zinc-700">
                                Pontos: <strong className="text-zinc-900">{numberOrDash(a.pontuacao)}</strong>
                              </span>
                              <StatusBadge ativo={a.ativoRecentemente} />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => { setFocado(a); setCarreiraOpen(true); }}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700"
                          >
                            <CalendarClock className="h-4 w-4" />
                            Agenda
                          </button>

                          <button
                            onClick={() => abrirDetalhe(a)}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          >
                            Detalhes <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[980px] table-auto">
                      <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="w-24 p-3">Agenda</th>
                          <th className="w-16 p-3">Foto</th>
                          <th className="p-3">Nome</th>
                          <th className="w-28 p-3">Categoria</th>
                          <th className="w-32 p-3">Posição</th>
                          <th className="w-28 p-3">Pontuação</th>
                          <th className="w-28 p-3">Status</th>
                          <th className="w-40 p-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.map((a) => (
                          <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                            <td className="p-3">
                              <button
                                onClick={() => { setFocado(a); setCarreiraOpen(true); }}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                                title="Gerenciar agenda"
                              >
                                <CalendarClock className="h-4 w-4" />
                                Gerenciar
                              </button>
                            </td>

                            <td className="p-3">
                              <img
                                src={getFoto(a.foto)}
                                alt={nomeCompletoAtleta(a)}
                                onError={onImgErrorFallback}
                                className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow"
                              />
                            </td>

                            <td className="p-3">
                              <div className="font-medium text-zinc-900">
                                {nomeCompletoAtleta(a)}
                              </div>
                            </td>

                            <td className="p-3 text-sm text-zinc-700">{a.categoria ?? "—"}</td>
                            <td className="p-3 text-sm text-zinc-700">{a.posicao ?? "—"}</td>
                            <td className="p-3 text-sm text-zinc-900">{numberOrDash(a.pontuacao)}</td>
                            <td className="p-3">
                              <StatusBadge ativo={a.ativoRecentemente} />
                            </td>

                            <td className="p-3">
                              <button
                                onClick={() => abrirDetalhe(a)}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                              >
                                Ver detalhes <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-col items-start justify-between gap-2 text-sm sm:flex-row sm:items-center">
              <div className="text-zinc-600">
                Selecionados manualmente: <strong>{Object.values(selecionados).filter(Boolean).length}</strong>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={limparSelecao}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
                >
                  Limpar seleção
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            {focado ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={getFoto(focado.foto)}
                    onError={onImgErrorFallback}
                    className="h-12 w-12 rounded-full object-cover"
                  />

                  <div>
                    <div className="font-semibold text-zinc-900">
                      {nomeCompletoAtleta(focado)}
                    </div>
                    <div className="text-xs text-zinc-500">{focado.categoria ?? "—"} · {focado.posicao ?? "—"}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Treinos mês</div>
                    <div className="text-lg font-semibold">{stats?.concluidosMes ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Desafios mês</div>
                    <div className="text-lg font-semibold">{stats?.desafiosFeitosMes ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Média 4s</div>
                    <div className="text-lg font-semibold">{stats?.mediaUltimas4Semanas ?? 0}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm font-medium text-zinc-700">Atividade nas últimas 4 semanas</div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="semana" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="treinos" />
                        <Bar dataKey="desafios" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-medium text-zinc-700 mb-2">Últimas submissões (mês)</div>
                  {subsLoading ? (
                    <div className="text-zinc-600 text-sm">Carregando…</div>
                  ) : submissoes.length === 0 ? (
                    <div className="text-zinc-500 text-sm">Sem submissões no período.</div>
                  ) : (
                    <ul className="space-y-2">
                      {submissoes.map((s) => (
                        <li key={s.id} className="rounded-lg border border-zinc-200 p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{s.titulo}</div>
                            <AprovacaoPill value={s.aprovado} />
                          </div>
                          <div className="text-xs text-zinc-500">
                            {s.tipo === "treino" ? "Treino" : "Desafio"} · {formatRelativo(s.data)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={limparDetalhe}
                  className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Fechar detalhes
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Selecione um atleta para ver detalhes.
              </div>
            )}
          </div>
        </div>
      )}

      <TurmasManager
        open={turmasOpen}
        onClose={() => setTurmasOpen(false)}
        owner={
          tipo && tipo !== "Professor" && tipoUsuarioIdEntidade
            ? { tipo: tipo === "Escola" ? "Escolinha" : "Clube", id: tipoUsuarioIdEntidade }
            : undefined
        }
        professorId={
          tipo === "Professor"
            ? (tipoUsuarioIdEntidade || undefined) 
            : (turmasProfessorId || undefined)
        }
      />

      {carreiraOpen && focado && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/50 p-0 sm:p-3">
          <div
            className="
              w-screen h-[100dvh]
              max-w-none max-h-none
              overflow-hidden
              rounded-none
              border-0
              bg-white text-zinc-900
              shadow-none
              flex flex-col
            "
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 sm:px-4 py-2 sm:py-3">
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs text-zinc-500">Agenda de Treinos</div>
                <div className="font-extrabold truncate text-zinc-900 text-sm sm:text-base">
                  {nomeCompletoAtleta(focado)}
                </div>
              </div>

              <button
                onClick={() => setCarreiraOpen(false)}
                className="rounded-xl border border-zinc-200 bg-white px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

              <AgendaTreinos
                open={carreiraOpen && !!focado}
                title={nomeCompletoAtleta(focado)}
                fetchAgendados={async ({ monthISO }) => {
                  const atletaId = focado!.id;
                  const [yy, mm] = monthISO.split("-").map(Number);
                  const base = new Date(yy, (mm || 1) - 1, 1);

                  const toMonthISO = (d: Date) => {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, "0");
                    return `${y}-${m}`;
                  };

                  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
                  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);

                  const months = [toMonthISO(prev), toMonthISO(base), toMonthISO(next)];

                  const resps = await Promise.all(
                    months.map((m) =>
                      axios.get(`${API.BASE_URL}/api/gerenciar/atletas/${atletaId}/agendados`, {
                        headers,
                        params: { month: m },
                      })
                    )
                  );

                  const merged: any[] = [];
                  for (const r of resps) {
                    const data = r.data;
                    const arr =
                      (Array.isArray(data?.items) && data.items) ||
                      (Array.isArray(data?.agendados) && data.agendados) ||
                      (Array.isArray(data) && data) ||
                      [];
                    merged.push(...arr);
                  }

                  const byId = new Map<string, any>();
                  for (const it of merged) {
                    const id = String(it?.id || "");
                    if (!id) continue;
                    byId.set(id, it);
                  }

                  return { items: Array.from(byId.values()) };
                }}
                fetchProgramados={async () => {
                  const entidadeIdReal = String(tipoUsuarioIdEntidade || "").trim();
                  const entidadeFallback = String(usuarioIdEntidade || "").trim();
                  const idParaEnviar = entidadeIdReal || entidadeFallback;

                  const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`, {
                    headers,
                    params: {
                      vinculo: tipo ? tipoParaVinculo(tipo) : undefined,
                      id: idParaEnviar,
                      tipoUsuarioId: entidadeIdReal || undefined,
                      debug: "1",
                    },
                  });

                  return res.data;
                }}
                onAgendar={async ({ selectedDays, treinoProgramadoId, selectedTime }) => {
                  const autorId = String(tipoUsuarioIdEntidade || "");
                  const autorTipo = tipo ? autorTipoFromTela(tipo) : undefined;

                  if (!autorId || !autorTipo) throw new Error("Autor inválido");

                  const time = String(selectedTime || "12:00"); // fallback

                  await Promise.all(
                    selectedDays.map((day) =>
                      axios.post(
                        `${API.BASE_URL}/api/treinos/agendados`,
                        {
                          atletaId: focado!.id,
                          treinoProgramadoId,
                          // ✅ agora vai dia + hora:
                          dataTreino: `${day}T${time}:00`,
                          autorId,
                          autorTipo,
                        },
                        { headers }
                      )
                    )
                  );
                }}
                additionalItems={submissoes.map((s) => ({
                  id: `sub_${s.id}`,
                  titulo: s.titulo ?? "Treino",
                  dataTreino: s.data,
                  treinoProgramadoId: null,
                  treinoProgramado: { id: "", nome: s.titulo ?? "Treino" },
                  meuStatus: s.aprovado === true ? "COMPLETED" : "PENDENTE",
                  status: null,
                  execucaoStatus: null,
                  submissaoTreinoId: s.tipo === "treino" ? s.id : null,
                  submissaoFeita: true,
                }))}
                renderItemActions={(t) => {
                  const done = String(t.meuStatus || t.execucaoStatus || t.status || "").toUpperCase() === "COMPLETED";
                  if (!done || !t.submissaoTreinoId) return null;
                  return (
                    <button
                      onClick={() => abrirModalAvaliacao(String(t.submissaoTreinoId || ""))}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      💬 Avaliar treino
                    </button>
                  );
                }}
              />

            </div>
          </div>
        )}

          {avaliarOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3">
              <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <div>
                    <div className="text-xs text-zinc-500">Avaliar treino</div>
                    <div className="font-extrabold text-zinc-900">
                      Submissão: {submissaoSelecionada ? submissaoSelecionada.slice(0, 8) : ""}…
                    </div>
                  </div>
                  <button
                    onClick={fecharModalAvaliacao}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {avaliarLoading ? (
                  <div className="p-6 text-sm text-zinc-600">Carregando…</div>
                ) : (
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="text-sm font-semibold text-zinc-800 mb-2">Nota</div>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((v) => (
                          <button
                            key={v}
                            onClick={() => setNota(v)}
                            className={[
                              "h-10 w-10 rounded-xl border text-sm font-bold",
                              nota >= v
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                      <div>
                        <div className="font-semibold text-zinc-800">Concluiu o treino?</div>
                        <div className="text-xs text-zinc-500">Desmarque se não conseguiu finalizar.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={concluiu}
                        onChange={(e) => setConcluiu(e.currentTarget.checked)}
                        className="h-5 w-5"
                      />
                    </div>

                    {!concluiu && (
                      <div>
                        <div className="text-sm font-semibold text-zinc-800 mb-1">Motivo de não ter concluído</div>
                        <textarea
                          value={motivoNaoConcluiu}
                          onChange={(e) => setMotivoNaoConcluiu(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                      <div>
                        <div className="font-semibold text-zinc-800">Teve dificuldade?</div>
                        <div className="text-xs text-zinc-500">Marque se teve algum problema/dificuldade.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={teveDificuldade}
                        onChange={(e) => setTeveDificuldade(e.currentTarget.checked)}
                        className="h-5 w-5"
                      />
                    </div>

                    {teveDificuldade && (
                      <div>
                        <div className="text-sm font-semibold text-zinc-800 mb-1">Qual dificuldade?</div>
                        <textarea
                          value={dificuldadeMotivo}
                          onChange={(e) => setDificuldadeMotivo(e.target.value)}
                          className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
                          rows={3}
                        />
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="text-sm font-semibold text-zinc-800 mb-1">Comentário livre</div>
                      <textarea
                        value={comentarioLivre}
                        onChange={(e) => setComentarioLivre(e.target.value)}
                        placeholder="Escreva seu comentário…"
                        className="w-full rounded-xl border border-zinc-200 p-3 text-sm"
                        rows={3}
                      />
                      <div className="mt-1 text-xs text-zinc-500">
                        Dica: você pode escrever do seu jeito (sem precisar marcar opções).
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">

                    <button
                      type="button"
                      onClick={() => { setComentariosMarcados({}); setComentarioLivre(""); }}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                    >
                      Limpar comentários
                    </button>

                    <button
                      onClick={fecharModalAvaliacao}
                      className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={salvarAvaliacao}
                      disabled={salvandoAvaliacao}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {salvandoAvaliacao ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      <BottomNav />
    </div>
  );
};

export default GerenciarAtletas;
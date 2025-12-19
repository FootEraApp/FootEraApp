// client/src/pages/GerenciarAtletas
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Volleyball, User, CirclePlus, House } from "lucide-react";
import axios from "axios";
import {
  Users, Search, Filter, ChevronRight, ChevronLeft, CheckCircle2, XCircle, ClipboardList, ChevronDown, ArrowUpAZ, ArrowDownZA,
  Shield, Activity, Trophy, Loader2, X, CalendarClock, ListChecks, Send,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import TurmasManager from "../components/turmas/TurmasManager.js";

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

type TreinoProgramadoMin = {
  id: string;
  titulo: string;
  categoria?: CategoriaBase | null;
  objetivo?: string | null;
  pontuacao?: number | null;
  expiraEm?: string | null;
  naoExpira?: boolean | null;
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
  meuStatus?: string | null; // COMPLETED | IN_PROGRESS | PENDING | EXPIRED ...
  status?: string | null;
  execucaoStatus?: string | null;
};

type TreinoProgramadoItem = {
  id: string;
  nome: string;
  codigo?: string | null;
  nivel?: string | null;
  descricao?: string | null;
};

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
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
  if (v === "EXPIRED" || v === "EXPIRADO") return "Expirado";
  return "Pendente";
}

function isCompleted(s?: string | null) {
  const v = String(s || "").toUpperCase();
  return v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO";
}

const getFoto = (f?: string | null) => {
  if (!f || f === "" || f === "null") return "/assets/usuarios/default-user.png";
  if (f.startsWith("http")) return f;
  return `${API.BASE_URL}/${f.replace(/^\/+/, "")}`;
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

  const [abrirDesignar, setAbrirDesignar] = useState(false);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramadoMin[]>([]);
  const [treinoSelecionado, setTreinoSelecionado] = useState<string>("");
  const [objetivo, setObjetivo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [alcance, setAlcance] = useState<"todos" | "categoria" | "selecionados">("todos");
  const [categoriaFiltroDesignacao, setCategoriaFiltroDesignacao] = useState<"" | CategoriaBase>("");
  const [salvandoDesignacao, setSalvandoDesignacao] = useState(false);

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

  const tipoParaVinculo = (t: "Escola" | "Clube" | "Professor") =>
    t === "Escola" ? "escolinha" : t.toLowerCase();

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
      const tipoId =
        (perfilTipo === "Professor"  && (data?.professor?.id))  ||
        (perfilTipo === "Clube"      && (data?.clube?.id))      ||
        (perfilTipo === "Escolinha"  && (data?.escolinha?.id))  ||
        null;

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

      const params: any = {
        vinculo: tipoParaVinculo(tipo),
        id: usuarioIdEntidade,      
        order: ordenacao,
      };
      if (tipoUsuarioIdEntidade) params.tipoUsuarioId = tipoUsuarioIdEntidade; 
      if (q.trim()) params.search = q.trim();
      if (categoria) params.categoria = uiToApiCategoria(categoria);
      if (posicaoCodigo) params.posicao = posicaoCodigo;
      if (status) params.status = status;

      const { data } = await axios.get(`${API.BASE_URL}/api/gerenciar/atletas`, { headers, params });
      const lista = (data?.atletas || []) as any[];

      const normalizados: AtletaMin[] = lista.map((a) => ({
      id: a.id,
      usuarioId: a.usuarioId,
      nome: a.nome,
      idade: a.idade ?? null,
      foto: a.foto ?? null,
      posicao: (posicoesMap as any)[a.posicao] ?? a.posicao ?? null,
      categoria: apiToUiCategoria(a.categoria),
      pontuacao: a.pontuacao ?? null,
      ativoRecentemente: !!a.ativoRecentemente,
      clubeNome: a.clube?.nome ?? a.clubeNome ?? null,
      escolinhaNome: a.escolinha?.nome ?? a.escolinhaNome ?? null,
      professorNome:
        a.professor?.nome ??
        a.professor?.usuario?.nome ??
        a.professorNome ??
        null,
    }));

      setAtletas(normalizados);
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

    const params: any = {
      vinculo: tipoParaVinculo(tipo),
      id: usuarioIdEntidade,      
    };
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

  const carregarTreinos = async () => {
  if (!tipo || !usuarioIdEntidade) return;
  try {
    const params: any = { criador: tipoParaVinculo(tipo), id: usuarioIdEntidade };
    if (tipoUsuarioIdEntidade) params.tipoUsuarioId = tipoUsuarioIdEntidade;

    const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados`, { headers, params });
    const items = (res.data?.items ?? res.data ?? []) as any[];
    setTreinosDisponiveis(
      items.map((t) => ({
        id: t.id,
        titulo: t.titulo ?? t.nome ?? "Treino",
        objetivo: t.objetivo ?? null,
        pontuacao: t.pontuacao ?? null,
        categoria: apiToUiCategoria(t.categoria),
        expiraEm: t.expiraEm ?? null,
        naoExpira: !!t.naoExpira,
      }))
    );
  } catch {
    setTreinosDisponiveis([]);
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
    carregarTreinos();
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


  useEffect(() => {
    if (!tipo || !usuarioIdEntidade) return;
    carregarAtletas();
  }, [q, categoria, posicaoCodigo, status, ordenacao]);

  const filtrados = useMemo(() => atletas, [atletas]);

  const metricas = useMemo(() => {
    const total = filtrados.length || 0;
    const soma = filtrados.reduce((acc, a) => acc + (a.pontuacao ?? 0), 0);
    const mediaPont = total ? Math.round((soma / total) * 10) / 10 : 0;
    const ativos = filtrados.filter((a) => a.ativoRecentemente).length;
    return { total, mediaPont, ativos };
  }, [filtrados]);

  const toggleSelecionado = (id: string) => setSelecionados((prev) => ({ ...prev, [id]: !prev[id] }));
  const limparSelecao = () => setSelecionados({});

  const abrirDetalhe = (a: AtletaMin) => {
    setFocado(a);
  };

  useEffect(() => {
    if (!focado) {
      setStats(null);
      setSubmissoes([]);
      if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
      if (pollingSubsRef.current) clearInterval(pollingSubsRef.current);
      return;
    }
    const uid = focado.usuarioId || focado.id;
    carregarStatsAtleta(uid);
    carregarSubmissoesAtleta(uid);

    if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
    if (pollingSubsRef.current) clearInterval(pollingSubsRef.current);

    pollingStatsRef.current = setInterval(() => carregarStatsAtleta(uid), 15000);
    pollingSubsRef.current = setInterval(() => carregarSubmissoesAtleta(uid), 15000);

    return () => {
      if (pollingStatsRef.current) clearInterval(pollingStatsRef.current);
      if (pollingSubsRef.current) clearInterval(pollingSubsRef.current);
    };
  }, [focado?.usuarioId, focado?.id]);

  useEffect(() => {
    if (!carreiraOpen || !focado) return;

    // resetzinho ao abrir
    setSelectedDays([]);
    setDrawerOpen(true);
    setTreinoProgramadoId("");

    const atletaId = focado.id; // no seu /api/treinos/agendados você usa atletaId (id do Atleta)

    (async () => {
      try {
        setLoadingCalendar(true);
        const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, {
          headers,
          params: { atletaId },
        });
        setAgendados(Array.isArray(r.data) ? r.data : (r.data?.items ?? []));
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

        // tenta seu endpoint já existente de treinos do gerenciador
        // se você preferir, pode trocar por /api/treinos/programados se existir
        const res = await axios.get(`${API.BASE_URL}/api/gerenciar/treinosprogramados`, {
          headers,
          params: tipoUsuarioIdEntidade
            ? { criador: tipo ? tipoParaVinculo(tipo) : undefined, id: usuarioIdEntidade, tipoUsuarioId: tipoUsuarioIdEntidade }
            : { criador: tipo ? tipoParaVinculo(tipo) : undefined, id: usuarioIdEntidade },
        });

        const items = (res.data?.items ?? res.data ?? []) as any[];
        setTreinosProgramados(
          items.map((t) => ({
            id: String(t.id),
            nome: String(t.nome ?? t.titulo ?? "Treino"),
            codigo: t.codigo ?? null,
            nivel: t.nivel ?? null,
            descricao: t.descricao ?? null,
          }))
        );
      } catch (e) {
        console.error("Erro ao carregar treinos programados:", e);
        setTreinosProgramados([]);
      } finally {
        setLoadingProgramados(false);
      }
    })();
  }, [carreiraOpen, focado?.id]);

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

  const idsDestino = useMemo(() => {
    if (alcance === "todos") return filtrados.map((a) => a.usuarioId || a.id);
    if (alcance === "categoria" && categoriaFiltroDesignacao)
      return filtrados.filter((a) => a.categoria === categoriaFiltroDesignacao).map((a) => a.usuarioId || a.id);
    return Object.keys(selecionados).filter((k) => selecionados[k]);
  }, [alcance, filtrados, selecionados, categoriaFiltroDesignacao]);

const monthLabel = useMemo(() => {
  const d = cursorMonth;
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}, [cursorMonth]);

const daysGrid = useMemo(() => {
  const first = startOfMonth(cursorMonth);
  const firstWeekday = (first.getDay() + 6) % 7; // segunda=0
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
  return map;
}, [agendados]);

const selectedDayItems = useMemo(() => {
  const out: { day: string; items: TreinoAgendadoItem[] }[] = [];
  for (const day of selectedDays) out.push({ day, items: agendadosPorDia.get(day) ?? [] });
  out.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}, [selectedDays, agendadosPorDia]);

function toggleDay(dayISO: string) {
  setDrawerOpen(true);
  setSelectedDays((prev) => (prev.includes(dayISO) ? prev.filter((d) => d !== dayISO) : [...prev, dayISO]));
}

async function agendarParaDiasSelecionados() {
  if (!focado?.id) return;
  if (!treinoProgramadoId) return alert("Selecione um treino programado para agendar.");
  if (!selectedDays.length) return alert("Selecione ao menos 1 dia no calendário.");

  try {
    for (const day of selectedDays) {
      await axios.post(
        `${API.BASE_URL}/api/treinos/agendados`,
        {
          atletaId: focado.id,
          treinoProgramadoId,
          dataTreino: day, // YYYY-MM-DD
        },
        { headers }
      );
    }

    const r = await axios.get(`${API.BASE_URL}/api/treinos/agendados`, { headers, params: { atletaId: focado.id } });
    setAgendados(Array.isArray(r.data) ? r.data : (r.data?.items ?? []));
    alert("Treino(s) agendado(s) com sucesso!");
  } catch (e) {
    console.error(e);
    alert("Erro ao agendar treinos.");
  }
}


  const irCriarTreinoComPreselecionados = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem("novoTreinoState") || "{}");
      const next = {
        ...prev,
        atletasSelecionados: Array.from(new Set(idsDestino.length ? idsDestino : filtrados.map((a) => a.usuarioId || a.id))),
      };
      sessionStorage.setItem("novoTreinoState", JSON.stringify(next));
    } catch { }
    window.location.href = "/treinos/novo";
  };

  const enviarDesignacao = async () => {
    if (!treinoSelecionado) return alert("Selecione um treino");
    if (idsDestino.length === 0) return alert("Nenhum atleta selecionado para designação");

    setSalvandoDesignacao(true);
    try {
      const payload = {
        treinoProgramadoId: treinoSelecionado,
        objetivo: objetivo || undefined,
        prazo: prazo || undefined,
        destinatarios: idsDestino,
        origem: tipo ? (tipoParaVinculo(tipo) as "escolinha" | "clube" | "professor") : "escolinha",
      };
      await axios.post(`${API.BASE_URL}/api/gerenciar/treinosprogramados/convocar`, payload, { headers });
      alert("Treino designado com sucesso! Os atletas serão notificados.");
      setAbrirDesignar(false);
      setTreinoSelecionado("");
      setObjetivo("");
      setPrazo("");
      setAlcance("todos");
      setCategoriaFiltroDesignacao("");
      limparSelecao();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Falha ao designar treino");
    } finally {
      setSalvandoDesignacao(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
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
      
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-600/10 p-3 text-emerald-700">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">{tipo ?? "Institucional"} · Gerenciar Atletas</h1>
            <p className="text-sm text-zinc-500">Acompanhe e organize seus atletas vinculados na FootEra.</p>

            {tipo && tipo !== "Professor" && (
              <div className="mt-2 inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                <button
                  onClick={() => setAba("atletas")}
                  className={`px-3 py-1.5 rounded-lg ${aba === "atletas" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
                >
                  Atletas
                </button>
                <button
                  onClick={() => setAba("professores")}
                  className={`px-3 py-1.5 rounded-lg ${aba === "professores" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50"}`}
                >
                  Professores
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {tipo && tipo !== "Professor" && (
            <>
              <button
                onClick={() => { setTurmasProfessorId(null); setTurmasOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
              >
                <CirclePlus className="h-4 w-4" /> Adicionar turma
              </button>
              <button
                onClick={() => { setTurmasProfessorId(null); setTurmasOpen(true); }}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
              >
                <ListChecks className="h-4 w-4" /> Administrar turmas
              </button>
            </>
          )}

          <button
            onClick={() => setCarreiraOpen(true)}
            disabled={!focado}
            title={!focado ? "Selecione um atleta para gerenciar a carreira" : "Gerenciar carreira do atleta selecionado"}
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:hover:bg-emerald-600"
          >
            <CalendarClock className="h-4 w-4" />
            Gerenciar carreira
          </button>

          <button
            onClick={() => setAbrirDesignar(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white shadow hover:bg-emerald-700"
          >
            <ListChecks className="h-4 w-4" /> Designar treino
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
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
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
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
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Status</option>
            <option value="ativo">Ativo recentemente</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                      <img src={getFoto(p.foto)} alt={p.nome} className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow" />
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-zinc-900">{p.nome}</div>
                      <div className="text-xs text-zinc-500">ID: {p.usuarioId || p.id}</div>
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

            <div className="rounded-2xl border border-zinc-200 bg-white">
              <div className="overflow-x-auto">

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
                <table className="w-full min-w-[1100px] table-auto">
                  <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={filtrados.length > 0 && filtrados.every((a) => !!selecionados[a.usuarioId || a.id])}
                          onChange={(e) => {
                            const checked = e.currentTarget.checked;
                            setSelecionados((prev) => {
                              const next = { ...prev };
                              filtrados.forEach((a) => {
                                const key = a.usuarioId || a.id;
                                next[key] = checked;
                              });
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="w-16 p-3">Foto</th>
                      <th className="p-3">Nome</th>
                      <th className="w-28 p-3">Categoria</th>
                      <th className="w-32 p-3">Posição</th>
                      <th className="w-40 p-3">Time</th>       
                      <th className="w-40 p-3">Professor</th>  
                      <th className="w-28 p-3">Pontuação</th>
                      <th className="w-28 p-3">Status</th>
                      <th className="w-40 p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((a) => {
                      const key = a.usuarioId || a.id;
                      const checked = !!selecionados[key];
                      return (
                        <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSelecionado(key)}
                              aria-label={`Selecionar ${a.nome}`}
                            />
                          </td>
                          <td className="p-3">
                            <img
                              src={getFoto(a.foto)}
                              alt={a.nome}
                              className={`h-10 w-10 rounded-full object-cover ring-2 ring-white shadow ${checked ? "outline outline-2 outline-emerald-500" : ""}`}
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-zinc-900">{a.nome}</div>
                            <div className="text-xs text-zinc-500">ID: {key}</div>
                          </td>
                          <td className="p-3 text-sm text-zinc-700">{a.categoria ?? "—"}</td>
                          <td className="p-3 text-sm text-zinc-700">{a.posicao ?? "—"}</td>

                          <td className="p-3 text-sm text-zinc-700">
                            {a.clubeNome ?? a.escolinhaNome ?? "Independente"}
                          </td>

                          <td className="p-3 text-sm text-zinc-700">
                            {a.professorNome ?? "Sem professor"}
                          </td>

                          <td className="p-3 text-sm text-zinc-900">{numberOrDash(a.pontuacao)}</td>
                          <td className="p-3">
                            <StatusBadge ativo={a.ativoRecentemente} />
                          </td>

                          <td className="p-3">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                onClick={() => abrirDetalhe(a)}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
                              >
                                Ver detalhes <ChevronRight className="h-4 w-4" />
                              </button>

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              </div>
            </div>


            <div className="mt-3 flex flex-col items-start justify-between gap-2 text-sm sm:flex-row sm:items-center">
              <div className="text-zinc-600">
                Selecionados manualmente: <strong>{Object.values(selecionados).filter(Boolean).length}</strong>
                {" · "}Destinatários atuais (respeitando “Alcance”): <strong>{idsDestino.length}</strong>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={limparSelecao}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
                >
                  Limpar seleção
                </button>
                <button
                  onClick={() => setAbrirDesignar(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                >
                  <ListChecks className="h-4 w-4" /> Designar treino
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4">
            {focado ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <img src={getFoto(focado.foto)} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <div className="font-semibold text-zinc-900">{focado.nome}</div>
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
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
                Selecione um atleta para ver detalhes.
              </div>
            )}
          </div>
        </div>
      )}

      {abrirDesignar && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-4">
              <div className="flex items-center gap-2 text-zinc-900">
                <ListChecks className="h-5 w-5" /> Designar treino programado
              </div>
              <button onClick={() => setAbrirDesignar(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Treino</label>

                  {treinosDisponiveis.length === 0 ? (
                    <>
                      <select
                        disabled
                        className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
                      >
                        <option>Nenhum treino programado encontrado</option>
                      </select>

                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        <div className="font-medium">Você ainda não tem treinos programados.</div>
                        <div className="mt-1">
                          Crie um treino agora — já levaremos <b>{idsDestino.length}</b> atleta(s) selecionado(s) para a etapa 4.
                        </div>
                        <button
                          onClick={irCriarTreinoComPreselecionados}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700"
                        >
                          Criar treino em /treinos/novo
                        </button>
                      </div>
                    </>
                  ) : (
                    <select
                      value={treinoSelecionado}
                      onChange={(e) => setTreinoSelecionado(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Selecione um treino…</option>
                      {treinosDisponiveis.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titulo}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Prazo (opcional)</label>
                  <input
                    type="date"
                    value={prazo}
                    onChange={(e) => setPrazo(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Objetivo (opcional)</label>
                  <input
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                    placeholder="Descreva objetivos, instruções ou metas específicas"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3 text-sm">
                  <span className="text-zinc-600">Alcance:</span>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "todos"} onChange={() => setAlcance("todos")} />
                    Todos os atletas filtrados
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "categoria"} onChange={() => setAlcance("categoria")} />
                    Por categoria
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="alcance" checked={alcance === "selecionados"} onChange={() => setAlcance("selecionados")} />
                    Apenas selecionados manualmente
                  </label>
                </div>

                {alcance === "categoria" && (
                  <div className="flex items-center gap-2 p-3">
                    <select
                      value={categoriaFiltroDesignacao}
                      onChange={(e) => setCategoriaFiltroDesignacao(e.target.value as any)}
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Escolha a categoria…</option>
                      {["Sub-9", "Sub-11", "Sub-13", "Sub-15", "Sub-17", "Sub-20", "Livre"].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border-t border-zinc-100 p-3 text-sm text-zinc-600">
                  Destinatários: <strong>{idsDestino.length}</strong>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => setAbrirDesignar(false)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-700 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={enviarDesignacao}
                  disabled={salvandoDesignacao || treinosDisponiveis.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-70"
                  title={treinosDisponiveis.length === 0 ? "Crie um treino primeiro" : "Designar treino"}
                >
                  {salvandoDesignacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Designar treino
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TurmasManager
        open={turmasOpen}
        onClose={() => setTurmasOpen(false)}
        owner={tipo && tipo !== "Professor" && tipoUsuarioIdEntidade ? {
          tipo: tipo === "Escola" ? "Escolinha" : "Clube",
          id: tipoUsuarioIdEntidade
        } : undefined}
        professorId={turmasProfessorId || undefined}
      />

{carreiraOpen && focado && (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
    <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-[#0f1b2e] text-white shadow-2xl">
      {/* topo */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm opacity-80">Gerenciador de Carreira</div>
          <div className="font-extrabold truncate">{focado.nome}</div>
        </div>

        <button
          onClick={() => setCarreiraOpen(false)}
          className="rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10 border border-white/10"
        >
          Fechar
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px]">
        {/* Calendário */}
        <div className="p-4 border-b xl:border-b-0 xl:border-r border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setCursorMonth((d) => addMonths(d, -1))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                title="Mês anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCursorMonth((d) => addMonths(d, 1))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                title="Próximo mês"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="font-extrabold text-lg">{monthLabel}</div>
            </div>

            <div className="text-xs opacity-80 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-green-500" /> Concluído
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-red-500" /> Pendente
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded bg-white/20" /> Sem treino
              </span>
            </div>
          </div>

          {loadingCalendar ? (
            <div className="p-4 text-sm opacity-80">Carregando calendário...</div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 text-xs opacity-80 mb-2 px-1">
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                  <div key={w} className="text-center">{w}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {daysGrid.map(({ date, key, inMonth }) => {
                  const items = agendadosPorDia.get(key) ?? [];
                  const hasTreino = items.length > 0;
                  const done = hasTreino && items.some((t) => isCompleted(t.meuStatus || t.execucaoStatus));
                  const pend = hasTreino && !done;
                  const selected = selectedDays.includes(key);

                  const bg =
                    done ? "bg-green-500/25 border-green-400/30"
                    : pend ? "bg-red-500/20 border-red-400/30"
                    : "bg-white/5 border-white/10";

                  const opacity = inMonth ? "opacity-100" : "opacity-40";

                  return (
                    <button
                      key={key}
                      onClick={() => toggleDay(key)}
                      className={[
                        "h-16 rounded-xl border text-left p-2 transition relative",
                        bg,
                        opacity,
                        selected ? "ring-2 ring-white/40" : "hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold">{date.getDate()}</div>
                        {done ? <CheckCircle2 className="h-4 w-4 text-green-300" /> : null}
                        {pend ? <XCircle className="h-4 w-4 text-red-300" /> : null}
                      </div>
                      {hasTreino ? (
                        <div className="mt-1 text-[11px] opacity-90 truncate">
                          {items[0]?.treinoProgramado?.nome || items[0]?.titulo || "Treino"}
                          {items.length > 1 ? ` +${items.length - 1}` : ""}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] opacity-60 truncate">Sem treino</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Drawer */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ClipboardList className="h-5 w-5 opacity-80" />
              <h3 className="font-extrabold">Detalhes</h3>
            </div>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className="text-xs px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
            >
              {drawerOpen ? "Recolher" : "Abrir"}
            </button>
          </div>

          {!drawerOpen ? null : selectedDays.length === 0 ? (
            <div className="text-sm opacity-80">
              Clique em um ou mais dias do calendário para ver/agendar treinos.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agendamento rápido (multi-dia) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="text-sm font-bold mb-2">
                  Agendar para {selectedDays.length === 1 ? "1 dia selecionado" : `${selectedDays.length} dias selecionados`}
                </div>

                <div className="space-y-2">
                  <label className="text-xs opacity-80">Treino programado</label>
                  <select
                    value={treinoProgramadoId}
                    onChange={(e) => setTreinoProgramadoId(e.target.value)}
                    className="w-full bg-[#0b1220] border border-white/10 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecionar...</option>
                    {treinosProgramados.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}{t.codigo ? ` (${t.codigo})` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={agendarParaDiasSelecionados}
                    disabled={loadingProgramados}
                    className="w-full mt-2 bg-green-700 hover:bg-green-600 disabled:opacity-60 disabled:hover:bg-green-700 transition text-sm font-bold rounded-lg px-3 py-2"
                  >
                    {loadingProgramados ? "Carregando..." : "Agendar treino nos dias selecionados"}
                  </button>
                </div>
              </div>

              {/* Itens por dia */}
              {selectedDayItems.map(({ day, items }) => (
                <div key={day} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">{day}</div>
                    <div className="text-xs opacity-80">
                      {items.length ? `${items.length} treino(s)` : "Sem treino"}
                    </div>
                  </div>

                  {!items.length ? (
                    <div className="text-sm opacity-80">Nenhum treino agendado neste dia.</div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((t) => {
                        const nome = t.treinoProgramado?.nome || t.titulo || "Treino";
                        const done = isCompleted(t.meuStatus || t.execucaoStatus);
                        return (
                          <div key={t.id} className="rounded-lg border border-white/10 bg-[#0b1220] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold truncate">{nome}</div>
                                <div className="text-xs opacity-80 mt-1">
                                  Status:{" "}
                                  <span className={done ? "text-green-300" : "text-red-300"}>
                                    {statusLabel(t.meuStatus || t.execucaoStatus)}
                                  </span>
                                </div>
                              </div>
                              {done ? (
                                <CheckCircle2 className="h-5 w-5 text-green-300" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-300" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}


      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed"><House /></Link>
        <Link href="/explorar"><Search /></Link>
        <Link href="/post"><CirclePlus /></Link>
        <Link href="/treinos"><Volleyball /></Link>
        <Link href="/perfil"><User /></Link>
      </nav>
    </div>
  );
};

export default GerenciarAtletas;
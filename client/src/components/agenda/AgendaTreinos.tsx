import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import axios from "axios";
import { API, APP } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

const AVATAR_FALLBACK = `${APP.FRONTEND_BASE_URL}/assets/usuarios/footera-logo-fundo-verde.png`;

export type TreinoAgendadoItem = {
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
    // ✅ usado quando a lista foi agrupada pra turma
  alunosCount?: number | null;
  turmaNome?: string | null;
  atleta?: {
    atletaId?: string;
    usuarioId?: string | null;
    nome?: string | null;
    foto?: string | null;
  } | null;
};

export type TreinoProgramadoExercicioItem = {
  id: string;
  ordem?: number | null;
  repeticoes?: string | null;

  exercicioId?: string | null;
  exercicioTemporarioId?: string | null;

  exercicio?: {
    tipo: "catalogo" | "temporario";
    id: string;
    codigo?: string | null;
    nome: string;
    descricao?: string | null;
    nivel?: string | null;
    categorias?: string[];
    videoUrl?: string | null;
  } | null;
};

export type TreinoProgramadoItem = {
  id: string;
  nome: string;
  codigo?: string | null;
  nivel?: string | null;
  descricao?: string | null;

  imagemUrl?: string | null;
  duracao?: number | null;
  pontuacao?: number | null;
  categoria?: string[];
  tipoTreino?: string | null;

  exercicios?: TreinoProgramadoExercicioItem[];

  autor?: {
    tipo: "Professor" | "Clube" | "Escolinha" | "Desconhecido";
    id: string | null;
    nome: string | null;
  };
};


export type AgendaFetchAgendados = (args: {
  monthDate: Date;
  monthISO: string;
}) => Promise<any>;

export type AgendaFetchProgramados = () => Promise<any>;

export type AgendaOnAgendar = (args: {
  selectedDays: string[]; 
  treinoProgramadoId: string;
}) => Promise<void>;

export type AgendaRenderItemActions = (t: TreinoAgendadoItem) => React.ReactNode;
type AlunoDoTreinoUI = { usuarioId: string; nome: string; foto: string | null };

export type AgendaTreinosProps = {
  open: boolean;
  title: string;
  fetchAgendados: AgendaFetchAgendados;
  fetchProgramados: AgendaFetchProgramados;
  onAgendar: AgendaOnAgendar;
  additionalItems?: TreinoAgendadoItem[];
  renderItemActions?: AgendaRenderItemActions;
  initialMonth?: Date;
  turmaId?: string;
  // ✅ quando true, a agenda agrupa por treino/dia (pra não repetir por aluno)
  groupByTreinoPerDay?: boolean;
};

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

export function normalizeAgendadosPayload(payload: any): TreinoAgendadoItem[] {
  const arr =
    Array.isArray(payload)
      ? payload
      : payload?.items ??
        payload?.agendados ??
        payload?.treinosAgendados ??
        payload?.treinos ??
        payload?.data?.items ??
        payload?.data ??
        [];

  if (!Array.isArray(arr)) return [];

  return (
    arr
      .map((t: any): TreinoAgendadoItem => {
        const treinoProgramadoObj = t?.treinoProgramado ?? t?.programado ?? null;

        const nomeProgramado =
          treinoProgramadoObj?.nome ??
          treinoProgramadoObj?.titulo ??
          t?.treinoProgramadoNome ??
          t?.nomeTreinoProgramado ??
          t?.titulo ??
          t?.nome ??
          null;

        const treinoProgramadoId =
          t?.treinoProgramadoId ?? treinoProgramadoObj?.id ?? null;

        const dataTreino = t?.dataTreino ?? t?.dataHora ?? t?.data ?? null;

        const submissaoFeita = !!(t?.submissao?.feito ?? t?.submissaoFeita ?? false);

        const atletaObj = t?.atleta ?? t?.atletaUsuario ?? t?.usuario ?? null;
        const atletaNome =
          atletaObj?.nome ??
          [atletaObj?.usuario?.nome, atletaObj?.usuario?.sobrenome]
            .filter(Boolean)
            .join(" ") ??
          atletaObj?.usuario?.nome ??
          null;

        const atletaFoto =
          atletaObj?.foto ?? atletaObj?.usuario?.foto ?? atletaObj?.fotoUrl ?? null;

        const atletaIdFinal =
          atletaObj?.atletaId ?? atletaObj?.id ?? t?.atletaId ?? null;

        const atletaUsuarioIdFinal =
          atletaObj?.usuarioId ?? atletaObj?.usuario?.id ?? t?.usuarioId ?? null;

        return {
          id: String(t?.id ?? ""),
          titulo: t?.titulo ?? null,
          dataTreino,
          dataExpiracao: t?.dataExpiracao ?? t?.expiraEm ?? null,
          treinoProgramadoId,
          treinoProgramado: nomeProgramado
            ? {
                id: String(treinoProgramadoId ?? treinoProgramadoObj?.id ?? ""),
                nome: String(nomeProgramado),
              }
            : treinoProgramadoObj?.id
              ? {
                  id: String(treinoProgramadoObj.id),
                  nome: treinoProgramadoObj?.nome ?? null,
                }
              : null,
          meuStatus: t?.meuStatus ?? t?.statusExecucao ?? t?.execucaoStatus ?? null,
          status: t?.status ?? null,
          execucaoStatus: t?.execucaoStatus ?? t?.statusExecucao ?? null,
          submissaoTreinoId: t?.submissaoTreinoId ?? t?.submissao?.id ?? null,
          submissaoFeita,
          atleta:
            atletaNome || atletaIdFinal || atletaUsuarioIdFinal
              ? {
                  atletaId: atletaIdFinal ? String(atletaIdFinal) : undefined,
                  usuarioId: atletaUsuarioIdFinal ? String(atletaUsuarioIdFinal) : undefined,
                  nome: atletaNome ? String(atletaNome) : null,
                  foto: atletaFoto ? String(atletaFoto) : null,
                }
              : null,
        };
      })
      .filter((x: TreinoAgendadoItem) => Boolean(x?.id))
  );

}

function agruparAgendadosPorTreinoEDia(
  list: TreinoAgendadoItem[],
  turmaNome?: string
) {
  // chave = dia + treinoProgramadoId (ou titulo)
  const byKey = new Map<string, TreinoAgendadoItem & { _count: number }>();

  for (const t of list) {
    const day = dayKeyFromAny(t.dataTreino);
    if (!day) continue;

    const treinoKey = String(t.treinoProgramadoId ?? t.treinoProgramado?.id ?? t.titulo ?? t.id ?? "");
    if (!treinoKey) continue;

    const key = `${day}__${treinoKey}`;
    const prev = byKey.get(key);

    if (!prev) {
      byKey.set(key, { ...t, _count: 1 });
    } else {
      // só soma a quantidade (um por aluno)
      byKey.set(key, { ...prev, _count: (prev._count ?? 1) + 1 });
    }
  }

  // devolve itens “únicos” com alunosCount preenchido
  return Array.from(byKey.values()).map((x) => {
    const { _count, ...rest } = x;
    return {
      ...rest,
      alunosCount: _count,
      turmaNome: turmaNome ?? rest.turmaNome ?? null,
      // remove atleta pra não parecer “de um aluno”
      atleta: null,
    } as TreinoAgendadoItem;
  });
}

function statusLabel(s?: string | null) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETED" || v === "CONCLUIDO" || v === "CONCLUÍDO") return "Concluído";
  if (v === "IN_PROGRESS" || v === "EM_ANDAMENTO") return "Em andamento";
  if (v === "EXPIRED" || v === "EXPIRADO" || v === "PERDIDO") return "Perdido";
  return "Pendente";
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
  if (
    isExpiredStatus(t.meuStatus) ||
    isExpiredStatus(t.execucaoStatus) ||
    isExpiredStatus(t.status)
  )
    return true;

  const dt = parseAsDate(t.dataTreino);
  if (!dt) return false;

  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const treinoOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const passouDoDia = treinoOnly.getTime() < todayOnly.getTime();
  const concluido = isCompleted(t.meuStatus || t.execucaoStatus || t.status);

  return passouDoDia && !concluido;
}

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

function normalizeProgramadosPayload(payload: any): {
  meus: TreinoProgramadoItem[];
  footera: TreinoProgramadoItem[];
} {
  const mapItem = (t: any): TreinoProgramadoItem => ({
    id: String(t?.id ?? ""),
    nome: String(t?.nome ?? t?.titulo ?? "Treino"),
    codigo: t?.codigo ?? null,
    nivel: t?.nivel ?? null,
    descricao: t?.descricao ?? null,

    imagemUrl: t?.imagemUrl ?? null,
    duracao: typeof t?.duracao === "number" ? t.duracao : (t?.duracao ? Number(t.duracao) : null),
    pontuacao: typeof t?.pontuacao === "number" ? t.pontuacao : (t?.pontuacao ? Number(t.pontuacao) : null),
    categoria: Array.isArray(t?.categoria) ? t.categoria : [],
    tipoTreino: t?.tipoTreino ?? null,

    exercicios: Array.isArray(t?.exercicios)
      ? t.exercicios.map((e: any) => ({
          id: String(e?.id ?? ""),
          ordem: e?.ordem ?? null,
          repeticoes: e?.repeticoes ?? null,
          exercicioId: e?.exercicioId ?? null,
          exercicioTemporarioId: e?.exercicioTemporarioId ?? null,
          exercicio: e?.exercicio
            ? {
                tipo: e.exercicio.tipo ?? "catalogo",
                id: String(e.exercicio.id ?? ""),
                codigo: e.exercicio.codigo ?? null,
                nome: String(e.exercicio.nome ?? "Exercício"),
                descricao: e.exercicio.descricao ?? null,
                nivel: e.exercicio.nivel ?? null,
                categorias: Array.isArray(e.exercicio.categorias) ? e.exercicio.categorias : [],
                videoUrl: e.exercicio.videoUrl ?? e.exercicio.videoDemonstrativoUrl ?? null,
              }
            : null,
        })).filter((x: any) => x?.id)
      : [],

    autor: t?.autor
      ? { tipo: t.autor.tipo, id: t.autor.id ?? null, nome: t.autor.nome ?? null }
      : undefined,
  });

  const meusRaw = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.meus)
        ? payload.meus
        : Array.isArray(payload?.data?.items)
          ? payload.data.items
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

  return {
    meus: (Array.isArray(meusRaw) ? meusRaw : []).map(mapItem).filter((i) => i.id),
    footera: [],
  };
}

async function fetchAgendados3Meses(
  fetchAgendados: AgendaFetchAgendados,
  cursorMonth: Date
) {
  const toMonthISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

  const base = startOfMonth(cursorMonth);
  const prev = addMonths(base, -1);
  const next = addMonths(base, 1);

  const months = [
    { monthDate: prev, monthISO: toMonthISO(prev) },
    { monthDate: base, monthISO: toMonthISO(base) },
    { monthDate: next, monthISO: toMonthISO(next) },
  ];

  const resps = await Promise.all(months.map((m) => fetchAgendados(m)));
  const merged = resps.flatMap((p) => normalizeAgendadosPayload(p));
  const byId = new Map<string, TreinoAgendadoItem>();
  for (const it of merged) byId.set(String(it.id), it);

  return Array.from(byId.values());
}

export function useAgendaTreinos({
  open,
  initialMonth,
  fetchAgendados,
  fetchProgramados,
  additionalItems,
  groupByTreinoPerDay,
  title,
  turmaId, // ✅ ADD
}: Pick<
  AgendaTreinosProps,
  | "open"
  | "initialMonth"
  | "fetchAgendados"
  | "fetchProgramados"
  | "additionalItems"
  | "groupByTreinoPerDay"
  | "title"
  | "turmaId" // ✅ ADD
>) {
  const [cursorMonth, setCursorMonth] = useState<Date>(() =>
    startOfMonth(initialMonth ?? new Date())
  );
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [agendados, setAgendados] = useState<TreinoAgendadoItem[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [loadingProgramados, setLoadingProgramados] = useState(false);
  const [treinosMeus, setTreinosMeus] = useState<TreinoProgramadoItem[]>([]);
  const [treinosFootera, setTreinosFootera] = useState<TreinoProgramadoItem[]>([]);
  const [treinoProgramadoId, setTreinoProgramadoId] = useState<string>("");
  const [alunosOpenKey, setAlunosOpenKey] = useState<string | null>(null);
  const [alunosLoading, setAlunosLoading] = useState(false);
  const [alunosDoTreino, setAlunosDoTreino] = useState<{ usuarioId: string; nome: string; foto: string | null }[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelectedDays([]);
    setTreinoProgramadoId("");
    setCursorMonth(startOfMonth(initialMonth ?? new Date()));
  }, [open, initialMonth]);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        setLoadingProgramados(true);
        const payload = await fetchProgramados();
        const { meus } = normalizeProgramadosPayload(payload);

        setTreinosMeus(meus);
      } catch {
        setTreinosMeus([]);
      } finally {
        setLoadingProgramados(false);
      }
    })();
  }, [open, fetchProgramados]);

  useEffect(() => {
    if (!open) return;

    (async () => {
    try {
      setLoadingCalendar(true);
      const list = await fetchAgendados3Meses(fetchAgendados, cursorMonth);
      setAgendados(list);
    } catch {
      setAgendados([]);
    } finally {
      setLoadingCalendar(false);
    }
  })();

  }, [open, cursorMonth, fetchAgendados]);

  const monthLabel = useMemo(() => {
    const d = cursorMonth;
    const meses = [
      "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
    ];
    return `${meses[d.getMonth()]} ${d.getFullYear()}`;
  }, [cursorMonth]);

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

      const baseBruta = [...(agendados ?? []), ...(additionalItems ?? [])];

      // ✅ se vier em “modo turma”, agrupa por treino/dia pra não repetir por aluno
      const base = groupByTreinoPerDay
        ? agruparAgendadosPorTreinoEDia(baseBruta, title)
        : baseBruta;

      for (const t of base) {
        const k = dayKeyFromAny(t.dataTreino);
        if (!k) continue;
        const arr = map.get(k) ?? [];
        arr.push(t);
        map.set(k, arr);
      }

      return map;
    }, [agendados, additionalItems, groupByTreinoPerDay, title]);

  const selectedDayItems = useMemo(() => {
    const out: { day: string; items: TreinoAgendadoItem[] }[] = [];
    for (const day of selectedDays) out.push({ day, items: agendadosPorDia.get(day) ?? [] });
    out.sort((a, b) => a.day.localeCompare(b.day));
    return out;
  }, [selectedDays, agendadosPorDia]);

  const hasPastSelectedDay = useMemo(() => selectedDays.some(isPastDayISO), [selectedDays]);

  function toggleDay(dayISO: string) {
    setSelectedDays((prev) =>
      prev.includes(dayISO) ? prev.filter((d) => d !== dayISO) : [...prev, dayISO]
    );
  }

  async function carregarAlunosDoTreinoTurma(args: { dayISO: string; treinoProgramadoId: string }) {
  if (!turmaId || !args.treinoProgramadoId) return;

  try {
    setAlunosLoading(true);

    const token =
      (Storage as any)?.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const resp = await axios.get(`${API.BASE_URL}/api/treinos/alunos`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      params: {
        turmaId,
        treinoProgramadoId: args.treinoProgramadoId,
        day: args.dayISO,
      },
    });

    setAlunosDoTreino(resp.data?.items ?? []);
  } finally {
    setAlunosLoading(false);
  }
}

  return {
    cursorMonth,
    setCursorMonth,
    monthLabel,
    daysGrid,
    loadingCalendar,
    agendadosPorDia,
    selectedDays,
    setSelectedDays,
    toggleDay,
    hasPastSelectedDay,
    selectedDayItems,
    loadingProgramados,
    treinosMeus,
    treinosFootera,
    treinoProgramadoId,
    setTreinoProgramadoId,
    setAgendados,
    setTreinosFootera,
    alunosOpenKey,
    setAlunosOpenKey,
    alunosLoading,
    alunosDoTreino,
    setAlunosDoTreino,
    carregarAlunosDoTreinoTurma,
  };
}

export default function AgendaTreinos({
  open,
  title,
  fetchAgendados,
  fetchProgramados,
  onAgendar,
  additionalItems,
  renderItemActions,
  initialMonth,
  groupByTreinoPerDay,
  turmaId,
}: AgendaTreinosProps) {
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);
  const [aba, setAba] = useState<"agenda" | "agendar">("agenda");
  const [abaTreinos, setAbaTreinos] = useState<"meus" | "footera">("meus");
  const [buscaTreino, setBuscaTreino] = useState("");
  const [footeraLoaded, setFooteraLoaded] = useState(false);

  // 🔒 PRO gate (bloqueia aba FootEra para não assinantes)
  const [proLoading, setProLoading] = useState(false);
  const [isPro, setIsPro] = useState(true); // default true pra não piscar bloqueio antes de checar
  const [proGateChecked, setProGateChecked] = useState(false);

  const parceirosCacheRef = useRef<TreinoProgramadoItem[]>([]);

  async function checkIsPro() {
    const token =
      (Storage as any)?.token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const usuarioId =
      (Storage as any)?.usuarioId ||
      localStorage.getItem("usuarioId") ||
      sessionStorage.getItem("usuarioId") ||
      "";

    if (!token || !usuarioId) {
      setIsPro(false);
      setProGateChecked(true);
      return false;
    }

    try {
      setProLoading(true);

      const apiBase =
        typeof API === "string"
          ? API
          : String(
              (API as any)?.BASE_URL ??
                (API as any)?.baseUrl ??
                (API as any)?.base ??
                (API as any)?.url ??
                (API as any)?.API_BASE ??
                ""
            );

      const base = apiBase.replace(/\/+$/, "");
      const finalBase =
        base.startsWith("http://") || base.startsWith("https://")
          ? base
          : "http://localhost:3001";

      const url = `${finalBase}/api/usuarios/${usuarioId}/assinatura`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const ok = Boolean(res.data?.isPro);
      setIsPro(ok);
      setProGateChecked(true);
      return ok;
    } catch (e) {
      // se falhar, trava por segurança
      setIsPro(false);
      setProGateChecked(true);
      return false;
    } finally {
      setProLoading(false);
    }
  }

  const {
    cursorMonth,
    setCursorMonth,
    monthLabel,
    daysGrid,
    loadingCalendar,
    agendadosPorDia,
    selectedDays,
    setSelectedDays,
    toggleDay,
    hasPastSelectedDay,
    selectedDayItems,
    loadingProgramados,
    treinosMeus,
    treinosFootera,
    treinoProgramadoId,
    setTreinoProgramadoId,
    setAgendados,
    setTreinosFootera,
    // ✅ ADD ESTES:
    alunosOpenKey,
    setAlunosOpenKey,
    alunosLoading,
    alunosDoTreino,
    setAlunosDoTreino,
    carregarAlunosDoTreinoTurma,
  } = useAgendaTreinos({
    open,
    title,
    groupByTreinoPerDay,
    initialMonth,
    fetchAgendados,
    fetchProgramados,
    additionalItems,
    turmaId,
  });

  useEffect(() => {
    if (!open) return;
    setAba("agenda");
    setAbaTreinos("meus");
    setBuscaTreino("");
    setFooteraLoaded(false);
    setProGateChecked(false);
    setIsPro(true);
  }, [open]);

  // ✅ checar assinatura quando entrar na aba FootEra
  useEffect(() => {
    if (!open) return;
    if (abaTreinos !== "footera") return;

    // só checa uma vez por abertura (evita spam)
    if (proGateChecked) return;

    checkIsPro();
  }, [open, abaTreinos, proGateChecked]);


  // ✅ buscar treinos dos professores parceiros SOMENTE quando clicar na aba FootEra
  useEffect(() => {
    if (!open) return;
    if (abaTreinos !== "footera") return;
    if (footeraLoaded && treinosFootera.length) return;


    (async () => {
      try {

        const token =
          (Storage as any)?.token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const apiBase =
          typeof API === "string"
            ? API
            : String(
                (API as any)?.BASE_URL ??
                  (API as any)?.baseUrl ??
                  (API as any)?.base ??
                  (API as any)?.url ??
                  (API as any)?.API_BASE ??
                  ""
              );

        const base = apiBase.replace(/\/+$/, "");
        const finalBase =
          base.startsWith("http://") || base.startsWith("https://")
            ? base
            : "http://localhost:3001";

        const url = `${finalBase}/api/treinos/publicos-professores-parceiros`;

        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const raw = Array.isArray(res.data?.items)
          ? res.data.items
          : Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data?.items)
              ? res.data.data.items
              : [];

        const parceiros: TreinoProgramadoItem[] = raw
          .map((t: any) => ({
            id: String(t?.id ?? ""),
            nome: String(t?.nome ?? t?.titulo ?? "Treino"),
            codigo: t?.codigo ?? null,
            nivel: t?.nivel ?? null,
            descricao: t?.descricao ?? null,

            imagemUrl: t?.imagemUrl ?? null,
            duracao: typeof t?.duracao === "number" ? t.duracao : (t?.duracao ? Number(t.duracao) : null),
            pontuacao: typeof t?.pontuacao === "number" ? t.pontuacao : (t?.pontuacao ? Number(t.pontuacao) : null),
            categoria: Array.isArray(t?.categoria) ? t.categoria : [],
            tipoTreino: t?.tipoTreino ?? null,

            exercicios: Array.isArray(t?.exercicios)
              ? t.exercicios.map((e: any) => ({
                  id: String(e?.id ?? ""),
                  ordem: e?.ordem ?? null,
                  repeticoes: e?.repeticoes ?? null,
                  exercicioId: e?.exercicioId ?? null,
                  exercicioTemporarioId: e?.exercicioTemporarioId ?? null,
                  exercicio: e?.exercicio
                    ? {
                        tipo: e.exercicio.tipo ?? "catalogo",
                        id: String(e.exercicio.id ?? ""),
                        codigo: e.exercicio.codigo ?? null,
                        nome: String(e.exercicio.nome ?? "Exercício"),
                        descricao: e.exercicio.descricao ?? null,
                        nivel: e.exercicio.nivel ?? null,
                        categorias: Array.isArray(e.exercicio.categorias) ? e.exercicio.categorias : [],
                        videoUrl: e.exercicio.videoUrl ?? e.exercicio.videoDemonstrativoUrl ?? null,
                      }
                    : null,
                })).filter((x: any) => x?.id)
              : [],

            autor: t?.autor
              ? { tipo: t.autor.tipo, id: t.autor.id ?? null, nome: t.autor.nome ?? null }
              : undefined,
          }))
          .filter((x: TreinoProgramadoItem) => Boolean(x?.id));

        parceirosCacheRef.current = parceiros;
        setTreinosFootera(parceiros);
        setFooteraLoaded(true);
      } catch (e) {
        if (parceirosCacheRef.current?.length) {
          setTreinosFootera(parceirosCacheRef.current);
        }
      }
    })();
  }, [open, abaTreinos, footeraLoaded]);

  useEffect(() => {
    if (!open) return;
    if (selectedDays.length) setAba("agenda");
  }, [open, selectedDays.length]);

  if (!open) return null;

  async function agendarParaDiasSelecionados() {
    if (selectedDays.some(isPastDayISO)) {
      alert("Não é permitido agendar treinos em datas passadas.");
      return;
    }
    if (!treinoProgramadoId) {
      alert("Selecione um treino programado para agendar.");
      return;
    }
    if (!selectedDays.length) {
      alert("Selecione ao menos 1 dia no calendário.");
      return;
    }
    if (salvandoAgenda) return;

    setSalvandoAgenda(true);
    try {
      await onAgendar({ selectedDays, treinoProgramadoId });

      const list = await fetchAgendados3Meses(fetchAgendados, cursorMonth);
      setAgendados(list);
      setSelectedDays([]);
      alert("Treino(s) agendado(s) com sucesso!");
      setAba("agenda");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 409
          ? "Já existe treino agendado em um dos dias selecionados."
          : null) ||
        "Erro ao agendar treinos.";
      alert(msg);
    } finally {
      setSalvandoAgenda(false);
    }
  }

  const treinosDaAba = useMemo(() => {
    const base = abaTreinos === "meus" ? treinosMeus : treinosFootera;
    const term = buscaTreino.trim().toLowerCase();
    if (!term) return base;

    return base.filter((t) => {
      const hay = [
        t.nome,
        t.codigo ?? "",
        t.descricao ?? "",
        t.autor?.nome ?? "",
        t.autor?.tipo ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [abaTreinos, treinosMeus, treinosFootera, buscaTreino]);

  const forceScrollDetails = selectedDays.length >= 2;

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <div className="p-3 sm:p-4 border-b border-zinc-200 bg-white flex items-center justify-between gap-2">
        <div className="font-extrabold text-zinc-900">{title}</div>
        <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setAba("agenda")}
            className={[
              "px-3 py-1.5 rounded-lg",
              aba === "agenda" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            Agenda
          </button>
          <button
            type="button"
            onClick={() => setAba("agendar")}
            className={[
              "px-3 py-1.5 rounded-lg",
              aba === "agendar" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            Agendar
          </button>
        </div>
      </div>

      {aba === "agenda" ? (
        <div className="flex-1 min-h-0 overflow-hidden grid grid-rows-[minmax(0,1fr)_minmax(260px,0.9fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-3 sm:p-4 border-b border-zinc-200 lg:border-b-0 lg:border-r lg:border-zinc-200 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCursorMonth((d) => addMonths(d, -1))}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex-1 text-center font-extrabold text-base sm:text-lg text-zinc-900">
                  {monthLabel}
                </div>

                <button
                  onClick={() => setCursorMonth((d) => addMonths(d, 1))}
                  className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-zinc-600">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-500" /> Concluído
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-red-500" /> Perdido
                </span>
                <span className="flex items-center gap-1 col-span-2 sm:col-auto">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-zinc-300" /> Normal / Pendente
                </span>
              </div>
            </div>

            {loadingCalendar ? (
              <div className="p-4 text-sm opacity-80">Carregando calendário...</div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-[10px] sm:text-xs opacity-80 mb-2 px-0.5 sm:px-1">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                    <div key={w} className="text-center">
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {daysGrid.map(({ date, key, inMonth }) => {
                    const items = agendadosPorDia.get(key) ?? [];
                    const hasTreino = items.length > 0;
                    const done =
                      hasTreino &&
                      items.some((t) =>
                        isCompleted(t.meuStatus || t.execucaoStatus || t.status)
                      );
                    const lost = hasTreino && !done && items.some((t) => isLost(t));

                    const bg =
                      done
                        ? "bg-emerald-50 border-emerald-200"
                        : lost
                          ? "bg-red-50 border-red-200"
                          : "bg-white border-zinc-200";

                    const opacity = inMonth ? "opacity-100" : "opacity-40";
                    const selected = selectedDays.includes(key);
                    const past = isPastDayISO(key);

                    return (
                      <button
                        key={key}
                        onClick={() => toggleDay(key)}
                        className={[
                          "h-12 sm:h-16 rounded-xl border text-left p-1.5 sm:p-2 transition relative",
                          bg,
                          opacity,
                          selected ? "ring-2 ring-emerald-400" : "hover:bg-zinc-50",
                          past ? "opacity-70" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-xs sm:text-sm font-extrabold">
                            {date.getDate()}
                          </div>

                          <div className="hidden sm:flex items-center gap-1">
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : null}
                            {lost ? <XCircle className="h-4 w-4 text-red-600" /> : null}
                          </div>
                        </div>

                        <div className="sm:hidden mt-1 flex items-center gap-1">
                          {hasTreino ? (
                            <>
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  done
                                    ? "bg-emerald-500"
                                    : lost
                                      ? "bg-red-500"
                                      : "bg-zinc-400"
                                }`}
                              />
                              {items.length > 1 ? (
                                <span className="text-[10px] text-zinc-600 font-semibold">
                                  +{items.length - 1}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">treino</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-zinc-400">—</span>
                          )}
                        </div>

                        {hasTreino ? (
                          <div className="hidden sm:block mt-1 text-[11px] opacity-90 truncate">
                            {items[0]?.treinoProgramado?.nome || items[0]?.titulo || "Treino"}
                            {items.length > 1 ? ` +${items.length - 1}` : ""}
                          </div>
                        ) : (
                          <div className="hidden sm:block mt-1 text-[11px] opacity-60 truncate">
                            Sem treino
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            </div>
          </div>

          <div className="p-3 sm:p-4 min-h-0 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-zinc-500" />
                <h3 className="font-extrabold text-zinc-900">Detalhes</h3>
              </div>

              {selectedDays.length ? (
                <div className="text-xs text-zinc-500">
                  {selectedDays.length === 1 ? "1 dia selecionado" : `${selectedDays.length} dias selecionados`}
                </div>
              ) : null}
            </div>

            {selectedDays.length === 0 ? (
              <div className="text-sm opacity-80">
                Clique em um ou mais dias do calendário para ver os detalhes.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {hasPastSelectedDay ? (
                  <div className="rounded-xl border border-zinc-200 bg-white p-3 flex-none">
                    <div className="text-sm font-bold mb-1">Atenção</div>
                    <div className="text-sm opacity-80">
                      Você selecionou pelo menos um dia no passado.
                    </div>
                  </div>
                ) : null}

                <div className={["space-y-4", forceScrollDetails ? "" : ""].join(" ")}>
                  {selectedDayItems.map(({ day, items }) => (
                    <div key={day} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold">{formatDayPtBR(day)}</div>
                        <div className="text-xs opacity-80">
                          {items.length ? `${items.length} treino(s)` : "Sem treino"}
                        </div>
                      </div>

                      {!items.length ? (
                        <div className="text-sm opacity-80">
                          Nenhum treino agendado neste dia.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((t) => {
                            const nome = t.treinoProgramado?.nome || t.titulo || "Treino";
                            const done = isCompleted(t.meuStatus || t.execucaoStatus || t.status);
                            const lost = !done && isLost(t);

                            const statusText = statusLabel(t.meuStatus ?? t.execucaoStatus ?? t.status);
                            const statusClass = done
                              ? "text-emerald-600"
                              : lost
                                ? "text-red-600"
                                : "text-zinc-600";

                            const treinoKey = `${day}__${String(
                              t.treinoProgramadoId ?? t.treinoProgramado?.id ?? t.id
                            )}`;

                            const canOpenAlunos =
                              !!turmaId && groupByTreinoPerDay && !!t.treinoProgramadoId && (t.alunosCount ?? 0) > 0;

                            const isOpen = alunosOpenKey === treinoKey;

                            return (
                              <div
                                key={t.id}
                                className={`rounded-lg border border-zinc-200 bg-white p-3 ${canOpenAlunos ? "cursor-pointer hover:bg-zinc-50" : ""}`}
                                onClick={async () => {
                                  if (!canOpenAlunos) return;

                                  if (isOpen) {
                                    setAlunosOpenKey(null);
                                    setAlunosDoTreino([]);
                                    return;
                                  }

                                  setAlunosOpenKey(treinoKey);
                                  setAlunosDoTreino([]);
                                  await carregarAlunosDoTreinoTurma({
                                    dayISO: day,
                                    treinoProgramadoId: String(t.treinoProgramadoId),
                                  });
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-bold truncate">{nome}</div>

                                    <div className="text-xs opacity-80 mt-1">
                                      Status: <span className={statusClass}>{statusText}</span>
                                    </div>

                                    {groupByTreinoPerDay && (t.alunosCount ?? 0) > 0 ? (
                                      <div className="text-xs text-zinc-600 mt-1">
                                        Turma: <span className="font-semibold">{t.turmaNome ?? title}</span> •{" "}
                                        <span className="font-semibold">{t.alunosCount}</span> aluno(s)
                                      </div>
                                    ) : null}

                                    {renderItemActions ? <div className="mt-2">{renderItemActions(t)}</div> : null}
                                  </div>

                                  {done ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-300" />
                                  ) : lost ? (
                                    <XCircle className="h-5 w-5 text-red-300" />
                                  ) : null}
                                </div>

                                {/* ✅ LISTA DE ALUNOS (AGORA NO LUGAR CERTO) */}
                                {canOpenAlunos && isOpen ? (
                                  <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                                    {alunosLoading ? (
                                      <div className="text-sm text-zinc-600">Carregando alunos...</div>
                                    ) : alunosDoTreino.length === 0 ? (
                                      <div className="text-sm text-zinc-500">Nenhum aluno encontrado.</div>
                                    ) : (
                                      <div className="space-y-2">
                                        {alunosDoTreino.map((a: AlunoDoTreinoUI) => (
                                          <div key={a.usuarioId} className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-white border border-zinc-200 overflow-hidden flex-none">
                                              <img
                                                src={a.foto || AVATAR_FALLBACK}
                                                alt={a.nome}
                                                className="h-full w-full object-cover"
                                                onError={(e) => {
                                                  e.currentTarget.onerror = null; // evita loop
                                                  e.currentTarget.src = AVATAR_FALLBACK;
                                                }}
                                              />

                                            </div>
                                            <div className="text-sm font-semibold text-zinc-800 truncate">{a.nome}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
          {selectedDays.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="font-extrabold text-zinc-900 mb-1">Selecione dias primeiro</div>
              <div className="text-sm text-zinc-600">
                Vá na aba <b>Agenda</b>, selecione um ou mais dias no calendário e volte aqui para escolher o treino.
              </div>
            </div>
          ) : hasPastSelectedDay ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="font-extrabold text-zinc-900 mb-1">Agendamento indisponível</div>
              <div className="text-sm text-zinc-600">
                Você selecionou pelo menos um dia no passado. Selecione apenas datas futuras na aba <b>Agenda</b>.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <div className="font-extrabold text-zinc-900">Agendar treino</div>
                <div className="text-sm text-zinc-600 mt-1">
                  Dias selecionados:{" "}
                  <span className="font-semibold text-zinc-800">
                    {selectedDays.length === 1 ? "1 dia" : `${selectedDays.length} dias`}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                <div className="p-2 border-b border-zinc-100 flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => setAbaTreinos("meus")}
                      className={[
                        "px-3 py-1.5 rounded-lg",
                        abaTreinos === "meus"
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      Seus treinos
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbaTreinos("footera")}
                      className={[
                        "px-3 py-1.5 rounded-lg",
                        abaTreinos === "footera"
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      FootEra
                    </button>
                  </div>

                  <div className="text-[11px] text-zinc-500">
                    {abaTreinos === "meus"
                      ? `${treinosMeus.length} treino(s)`
                      : `${treinosFootera.length} treino(s)`}
                  </div>
                </div>

                <div className="p-3 border-b border-zinc-100">
                  <input
                    value={buscaTreino}
                    onChange={(e) => setBuscaTreino(e.target.value)}
                    placeholder="Buscar treino por nome, código, autor..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Lista */}
                <div className="relative">
                  {/* Conteúdo normal (travado quando não for PRO) */}
                  <div
                    className={[
                      "p-3 space-y-2 max-h-[52vh] overflow-y-auto",
                      abaTreinos === "footera" && proGateChecked && !isPro
                        ? "pointer-events-none select-none blur-[1px]"
                        : "",
                    ].join(" ")}
                  >
                    {loadingProgramados ? (
                      <div className="text-sm text-zinc-600">Carregando treinos...</div>
                    ) : treinosDaAba.length === 0 ? (
                      <div className="text-sm text-zinc-500">
                        Nenhum treino encontrado nessa aba.
                      </div>
                    ) : (
                      treinosDaAba.map((t) => {
                        const selected = String(t.id) === String(treinoProgramadoId);
                        return (
                          <div
                            key={t.id}
                            className={[
                              "rounded-xl border transition overflow-hidden",
                              selected
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-zinc-200 bg-white hover:bg-zinc-50",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              onClick={() => setTreinoProgramadoId(String(t.id))}
                              className="w-full text-left p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-extrabold text-zinc-900 truncate">
                                    {t.nome}{" "}
                                    {t.codigo ? (
                                      <span className="text-xs text-zinc-500">({t.codigo})</span>
                                    ) : null}
                                  </div>

                                  {t.autor?.nome ? (
                                    <div className="text-xs text-zinc-600 mt-1 truncate">
                                      {t.autor.tipo}:{" "}
                                      <span className="font-semibold">{t.autor.nome}</span>
                                    </div>
                                  ) : t.autor?.tipo ? (
                                    <div className="text-xs text-zinc-600 mt-1 truncate">
                                      Autor: <span className="font-semibold">{t.autor.tipo}</span>
                                    </div>
                                  ) : null}

                                  {t.descricao ? (
                                    <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2">
                                      {t.descricao}
                                    </div>
                                  ) : null}
                                </div>

                                <span
                                  className={[
                                    "h-4 w-4 rounded-full border flex-none mt-0.5",
                                    selected
                                      ? "bg-emerald-600 border-emerald-600"
                                      : "bg-white border-zinc-300",
                                  ].join(" ")}
                                />
                              </div>
                            </button>

                            {selected ? (
                              <div className="border-t border-emerald-200 bg-white">
                                <div className="px-3 py-2 text-xs font-extrabold text-zinc-800 flex items-center justify-between">
                                  <span>Exercícios</span>
                                  <span className="text-zinc-500 font-semibold">
                                    {(t.exercicios?.length ?? 0)} item(ns)
                                  </span>
                                </div>

                                <div className="px-3 pb-3 space-y-2">
                                  {(t.exercicios?.length ?? 0) === 0 ? (
                                    <div className="text-sm text-zinc-500">
                                      Este treino não possui exercícios.
                                    </div>
                                  ) : (
                                    (t.exercicios ?? [])
                                      .slice()
                                      .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
                                      .map((ex) => (
                                        <div
                                          key={ex.id}
                                          className="rounded-lg border border-zinc-200 bg-white p-2"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-bold text-zinc-900 truncate">
                                                {typeof ex.ordem === "number"
                                                  ? `${ex.ordem}. `
                                                  : ""}
                                                {ex.exercicio?.nome ?? "Exercício"}
                                                {ex.exercicio?.codigo ? (
                                                  <span className="text-xs text-zinc-500">
                                                    {" "}
                                                    ({ex.exercicio.codigo})
                                                  </span>
                                                ) : null}
                                              </div>

                                              {ex.repeticoes ? (
                                                <div className="text-xs text-zinc-600 mt-0.5">
                                                  Repetições:{" "}
                                                  <span className="font-semibold">{ex.repeticoes}</span>
                                                </div>
                                              ) : null}
                                            </div>

                                            {ex.exercicio?.videoUrl ? (
                                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex-none">
                                                VÍDEO
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 🔒 Overlay PRO (somente na aba FootEra) */}
                  {abaTreinos === "footera" && proGateChecked && !isPro ? (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/30 rounded-xl" />
                      <div className="relative z-10 w-[min(520px,92%)] rounded-2xl bg-white p-5 shadow-xl border">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                            <span className="text-emerald-600 font-extrabold">PRO</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-extrabold text-zinc-900">
                              Conteúdo exclusivo para assinantes
                            </h3>
                            <p className="text-sm text-zinc-600 mt-1">
                              Para agendar treinos de <b>professores parceiros</b> na aba{" "}
                              <b>FootEra</b>, você precisa de um plano ativo.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-extrabold hover:bg-emerald-700"
                                onClick={() => {
                                  window.location.href = "/assinatura";
                                }}
                              >
                                Ver planos
                              </button>

                              <button
                                type="button"
                                className="px-4 py-2 rounded-lg border text-zinc-700 font-bold hover:bg-zinc-50"
                                onClick={() => setAbaTreinos("meus")}
                              >
                                Voltar
                              </button>
                            </div>

                            <p className="text-xs text-zinc-500 mt-3">
                              Se você já assinou, tente sair e entrar novamente.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Loading do PRO (se quiser) */}
                  {abaTreinos === "footera" && !proGateChecked && proLoading ? (
                    <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-white/60 rounded-xl" />
                      <div className="relative z-10 text-sm font-bold text-zinc-700">
                        Verificando assinatura...
                      </div>
                    </div>
                  ) : null}
                </div>


                {/* Ação */}
                <div className="p-3 border-t border-zinc-100">
                  <button
                    onClick={agendarParaDiasSelecionados}
                    disabled={loadingProgramados || salvandoAgenda || !treinoProgramadoId}
                    className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:hover:bg-emerald-600 transition"
                  >
                    {salvandoAgenda
                      ? "Agendando..."
                      : loadingProgramados
                        ? "Carregando..."
                        : !treinoProgramadoId
                          ? "Selecione um treino"
                          : `Agendar para ${selectedDays.length === 1 ? "1 dia" : `${selectedDays.length} dias`}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAba("agenda")}
                    className="w-full mt-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition"
                  >
                    Voltar para Agenda
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

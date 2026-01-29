// client/src/components/agenda/AgendaTreinos.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import axios from "axios";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

/** =========================
 * Types
 * ========================= */
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
  monthISO: string; // YYYY-MM
}) => Promise<any>;

export type AgendaFetchProgramados = () => Promise<any>;

export type AgendaOnAgendar = (args: {
  selectedDays: string[]; // YYYY-MM-DD
  treinoProgramadoId: string;
}) => Promise<void>;

export type AgendaRenderItemActions = (t: TreinoAgendadoItem) => React.ReactNode;

export type AgendaTreinosProps = {
  open: boolean;
  title: string;
  fetchAgendados: AgendaFetchAgendados;

  /**
   * Pode retornar:
   * - { items: [...] } -> "Seus treinos"
   * - { meus: [...], footera: [...] }
   * - { items: [...], footera: [...] }
   * - [...] -> "Seus treinos"
   */
  fetchProgramados: AgendaFetchProgramados;

  onAgendar: AgendaOnAgendar;

  additionalItems?: TreinoAgendadoItem[];
  renderItemActions?: AgendaRenderItemActions;
  initialMonth?: Date;
};

/** =========================
 * Helpers (iguais aos seus)
 * ========================= */
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

/** =========================
 * Programados: separar "Seus" x "FootEra"
 * ========================= */
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


  // ✅ quando vier { items: [...] }, isso é "Seus treinos"
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

  // ✅ FootEra NÃO vem daqui (vem da outra API). Mantém vazio.
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

  // junta tudo e remove duplicados por id
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
}: Pick<
  AgendaTreinosProps,
  "open" | "initialMonth" | "fetchAgendados" | "fetchProgramados" | "additionalItems"
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

  // reset quando abrir
  useEffect(() => {
    if (!open) return;
    setSelectedDays([]);
    setTreinoProgramadoId("");
    setCursorMonth(startOfMonth(initialMonth ?? new Date()));
  }, [open, initialMonth]);

  // carregar programados ao abrir
  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        setLoadingProgramados(true);
        const payload = await fetchProgramados();

        const { meus } = normalizeProgramadosPayload(payload);

        // ✅ aqui é só "meus"
        setTreinosMeus(meus);
      } catch {
        setTreinosMeus([]);
      } finally {
        setLoadingProgramados(false);
      }
    })();
  }, [open, fetchProgramados]);


  // carregar agendados ao abrir + troca de mês
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
    const firstWeekday = (first.getDay() + 6) % 7; // seg=0
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
    const base = [...(agendados ?? []), ...(additionalItems ?? [])];

    for (const t of base) {
      const k = dayKeyFromAny(t.dataTreino);
      if (!k) continue;
      const arr = map.get(k) ?? [];
      arr.push(t);
      map.set(k, arr);
    }

    return map;
  }, [agendados, additionalItems]);

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
  };
}

/** =========================
 * Componente (UI)
 * ========================= */
export default function AgendaTreinos({
  open,
  title,
  fetchAgendados,
  fetchProgramados,
  onAgendar,
  additionalItems,
  renderItemActions,
  initialMonth,
}: AgendaTreinosProps) {
  const [salvandoAgenda, setSalvandoAgenda] = useState(false);

  // ✅ ABAS GRANDES (ganhar espaço)
  const [aba, setAba] = useState<"agenda" | "agendar">("agenda");

  // Dentro de AGENDAR: Seus treinos vs FootEra
  const [abaTreinos, setAbaTreinos] = useState<"meus" | "footera">("meus");
  const [buscaTreino, setBuscaTreino] = useState("");

  const [footeraLoaded, setFooteraLoaded] = useState(false);
  const parceirosCacheRef = useRef<TreinoProgramadoItem[]>([]);

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
  } = useAgendaTreinos({
    open,
    initialMonth,
    fetchAgendados,
    fetchProgramados,
    additionalItems,
  });

  // reset ao abrir
  useEffect(() => {
    if (!open) return;
    setAba("agenda");
    setAbaTreinos("meus");
    setBuscaTreino("");
    setFooteraLoaded(false);
  }, [open]);

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

        // ✅ se por algum motivo não vier http, força backend local no dev
        const finalBase =
          base.startsWith("http://") || base.startsWith("https://")
            ? base
            : "http://localhost:3001";

        const url = `${finalBase}/api/treinos/publicos-professores-parceiros`;


        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // ✅ seu backend manda { items: [...], debug: {...} }
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


        // ✅ salva cache + estado
        parceirosCacheRef.current = parceiros;

        // 🔥 substitui a lista FootEra pelos parceiros
        setTreinosFootera(parceiros);

        setFooteraLoaded(true);
      } catch (e) {
        // ✅ não zera: mantém o último que carregou
        if (parceirosCacheRef.current?.length) {
          setTreinosFootera(parceirosCacheRef.current);
        }
      }
    })();
  }, [open, abaTreinos, footeraLoaded]);


  // se selecionar dias, fica natural ir pra agenda
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
      // depois de agendar, volta pra Agenda
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
      {/* HEADER ABAS GRANDES */}
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

      {/* CONTEÚDO */}
      {aba === "agenda" ? (
        // =========================
        // ABA 1: AGENDA (CALENDÁRIO + DETALHES)
        // =========================
        <div className="flex-1 min-h-0 overflow-hidden grid grid-rows-[minmax(0,1fr)_minmax(260px,0.9fr)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* CALENDÁRIO */}
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

          {/* DETALHES (embaixo) */}
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
                {/* aviso de dia passado */}
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

                            return (
                              <div key={t.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-bold truncate">{nome}</div>
                                    <div className="text-xs opacity-80 mt-1">
                                      Status: <span className={statusClass}>{statusText}</span>
                                    </div>

                                    {renderItemActions ? (
                                      <div className="mt-2">{renderItemActions(t)}</div>
                                    ) : null}
                                  </div>

                                  {done ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-300" />
                                  ) : lost ? (
                                    <XCircle className="h-5 w-5 text-red-300" />
                                  ) : null}
                                </div>
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
        // =========================
        // ABA 2: AGENDAR (selecionar treino + botão)
        // =========================
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

              {/* Sub-abas */}
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

                {/* Busca */}
                <div className="p-3 border-b border-zinc-100">
                  <input
                    value={buscaTreino}
                    onChange={(e) => setBuscaTreino(e.target.value)}
                    placeholder="Buscar treino por nome, código, autor..."
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Lista */}
                <div className="p-3 space-y-2 max-h-[52vh] overflow-y-auto">
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
                            selected ? "border-emerald-300 bg-emerald-50" : "border-zinc-200 bg-white hover:bg-zinc-50",
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
                                    {t.autor.tipo}: <span className="font-semibold">{t.autor.nome}</span>
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
                                  selected ? "bg-emerald-600 border-emerald-600" : "bg-white border-zinc-300",
                                ].join(" ")}
                              />
                            </div>
                          </button>

                          {/* ✅ GAVETA */}
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
                                  <div className="text-sm text-zinc-500">Este treino não possui exercícios.</div>
                                ) : (
                                  (t.exercicios ?? [])
                                    .slice()
                                    .sort((a, b) => (Number(a.ordem ?? 0) - Number(b.ordem ?? 0)))
                                    .map((ex) => (
                                      <div
                                        key={ex.id}
                                        className="rounded-lg border border-zinc-200 bg-white p-2"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="text-sm font-bold text-zinc-900 truncate">
                                              {typeof ex.ordem === "number" ? `${ex.ordem}. ` : ""}
                                              {ex.exercicio?.nome ?? "Exercício"}
                                              {ex.exercicio?.codigo ? (
                                                <span className="text-xs text-zinc-500"> ({ex.exercicio.codigo})</span>
                                              ) : null}
                                            </div>

                                            {ex.repeticoes ? (
                                              <div className="text-xs text-zinc-600 mt-0.5">
                                                Repetições: <span className="font-semibold">{ex.repeticoes}</span>
                                              </div>
                                            ) : null}
                                          </div>

                                          {/* só um “badge” simples se tem vídeo */}
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

import React, { useEffect, useRef, useState, type SVGProps, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarClock,
  Volleyball,
  User,
  CirclePlus,
  Search,
  House,
  CircleX,
  CircleCheck,
  Send,
  Share2,
  Trash2,
  Check,
  X,
  BookMarked,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API, FLAGS } from "../config.js";
import { Badge } from "../components/ui/badge.js";
import HealthBanner from "../components/legal/HealthBanner.js";

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
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
}

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string | null;
  dataExpiracao?: string | null;
  nivel?: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  treinoProgramado?: {
    id: string;
    descricao?: string;
    nivel: string;
    dicas?: string[];
    objetivo?: string;
    duracao?: number;
    dataAgendada?: string | null;
    pontuacao?: number | null;
    exercicios: {
      exercicio: { id: string; nome: string };
      repeticoes: string;
    }[];
  };
}

interface Desafio {
  id: string;
  titulo: string;
  descricao: string;
  nivel: string;
  pontuacao: number;
  imagemUrl?: string;
}

interface UsuarioLogado {
  tipo: "admin" | "atleta" | "escola" | "escolinha" | "clube" | "professor" | "olheiro";
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

type AgendaTipo = "TREINO" | "DESAFIO" | "EVENTO" | "JOGO" | "PENEIRA" | "OUTRO";

type AgendaItem = {
  id: string;
  tipo: AgendaTipo;
  titulo: string;
  inicio: string;
  fim?: string | null; 
  origem: string;
};

interface EventoAtleta {
  id: string;
  tipo?: string | null; 
  titulo: string;
  inicio: string;
  fim?: string | null;
}

type MinhasSubTreino = {
  id: string;
  treinoAgendadoId: string | null;
  treinoProgramadoId: string | null;
  aprovado: boolean | null;
};

type TreinoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

type Checklist = Record<string, boolean>;

type WeekStatus = {
  index: number;
  start: string;
  end: string;
  status: "success" | "fail" | "none";
  count: { total: number; approved: number; rejected: number };
};

const PLACEHOLDER_USER = "/assets/default-user.png";

const TIMER_KEY = (treinoAgendadoId: string) => `footera:treinoTimerStart:${treinoAgendadoId}`;

function formatHHMMSS(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const CHECKLIST_KEY = (treinoAgendadoId: string) => `footera:treinoChecklist:${treinoAgendadoId}`;

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/attached_assets/")) return raw;
  if (raw.startsWith("/uploads/")) return `${API.BASE_URL}${raw}`;
  return `${API.BASE_URL}/uploads/${raw.replace(/^\/+/, "")}`;
}

function isVideoUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(clean);
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

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

const getStore = (): Storage => {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {}
  try {
    if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  } catch {}
  let mem: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(mem).length;
    },
    clear: () => {
      mem = {};
    },
    getItem: (k: string) => (k in mem ? mem[k] : null),
    key: (i: number) => Object.keys(mem)[i] ?? null,
    removeItem: (k: string) => {
      delete mem[k];
    },
    setItem: (k: string, v: string) => {
      mem[k] = String(v);
    },
  } as any as Storage;
};

function inferWeekStatus(w: WeekStatus, nowMs = Date.now()): WeekStatus["status"] {
  const approved = Number(w?.count?.approved ?? 0);
  const endMs = Date.parse(w.end);
  if (approved > 0) return "success";
  if (Number.isFinite(endMs) && nowMs >= endMs) return "fail";
  return "none";
}

function weekOfMonthIndex(dateLike: string | number | Date): 1 | 2 | 3 | 4 {
  const d = new Date(dateLike);
  const day = d.getDate();
  return Math.min(4, Math.floor((day - 1) / 7) + 1) as 1 | 2 | 3 | 4;
}

function buildMonthBuckets(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const toISO = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();

  const buckets = [
    { index: 1, start: new Date(y, m, 1), end: new Date(y, m, 8) },
    { index: 2, start: new Date(y, m, 8), end: new Date(y, m, 15) },
    { index: 3, start: new Date(y, m, 15), end: new Date(y, m, 22) },
    { index: 4, start: new Date(y, m, 22), end: new Date(y, m + 1, 1) },
  ].map((b) => ({
    index: b.index as 1 | 2 | 3 | 4,
    start: toISO(b.start),
    end: toISO(b.end),
    status: "none" as WeekStatus["status"],
    count: { total: 0, approved: 0, rejected: 0 },
  }));

  return buckets;
}

function computeMonthlyWeeks(rawWeeks: WeekStatus[], now = new Date()): WeekStatus[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const buckets = buildMonthBuckets(now);

  for (const w of rawWeeks || []) {
    const d = new Date(w.start);
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    const idx = weekOfMonthIndex(d) - 1;
    buckets[idx].count.total += Number(w.count?.total ?? 0);
    buckets[idx].count.approved += Number(w.count?.approved ?? 0);
    buckets[idx].count.rejected += Number(w.count?.rejected ?? 0);
  }

  const nowMs = now.getTime();
  for (const b of buckets) {
    const endMs = Date.parse(b.end);
    if (b.count.approved > 0) b.status = "success";
    else if (nowMs >= endMs) b.status = "fail";
    else b.status = "none";
  }

  return buckets.map((b) => ({
    index: b.index,
    start: b.start,
    end: b.end,
    status: b.status,
    count: b.count,
  }));
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarAgenda({ items }: { items: AgendaItem[] }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => today);

  const itemsByDay = useMemo(() => {
    const map: Record<string, AgendaItem[]> = {};
    for (const item of items) {
      const start = new Date(item.inicio);
      if (isNaN(start.getTime())) continue;
      const key = formatDateKey(start);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.inicio.localeCompare(b.inicio));
    }

    return map;
  }, [items]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = currentMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const selectedKey = formatDateKey(selectedDate);
  const selectedItems = itemsByDay[selectedKey] ?? [];

  const goPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const weekdayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={goPrevMonth}
          className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-sm font-semibold text-green-900 uppercase tracking-wide">
          {monthLabel}
        </div>

        <button
          type="button"
          onClick={goNextMonth}
          className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1 text-[11px] text-center text-gray-500">
        {weekdayLabels.map((lbl, idx) => (
          <div key={`${lbl}-${idx}`} className="font-medium">
            {lbl}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) {
            return <div key={idx} className="h-9" />;
          }

          const key = formatDateKey(date);
          const dayNum = date.getDate();
          const isToday = formatDateKey(date) === formatDateKey(today);
          const isSelected = formatDateKey(date) === selectedKey;
          const hasItems = (itemsByDay[key]?.length ?? 0) > 0;

          const baseClasses =
            "h-9 flex flex-col items-center justify-center rounded-lg text-xs cursor-pointer select-none border";
          let variant = "bg-white text-gray-800 border-gray-200";
          if (isSelected) {
            variant = "bg-green-800 text-white border-green-900";
          } else if (isToday) {
            variant = "bg-emerald-50 text-emerald-800 border-emerald-300";
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`${baseClasses} ${variant}`}
            >
              <span>{dayNum}</span>
              {hasItems && (
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-xs text-gray-600 mb-2">
          {selectedItems.length > 0 ? (
            <>
              {selectedItems.length} atividade(s) em{" "}
              <strong>{selectedDate.toLocaleDateString("pt-BR")}</strong>
            </>
          ) : (
            <>
              Nenhuma atividade em{" "}
              <strong>{selectedDate.toLocaleDateString("pt-BR")}</strong>
            </>
          )}
        </div>

        {selectedItems.length > 0 && (
          <ul className="space-y-2">
            {selectedItems.map((item, idx) => (
              <li
                key={`${item.origem}-${item.id}-${idx}`}
                className="flex items-start gap-2 rounded-lg border bg-white px-3 py-2 text-sm"
              >
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0
                    ${
                      item.tipo === "TREINO"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : item.tipo === "DESAFIO"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : item.tipo === "EVENTO" || item.tipo === "PENEIRA"
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-gray-100 text-gray-700 border border-gray-200"
                    }
                  `}
                >
                  {item.tipo}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-green-900 truncate">
                    {item.titulo}
                  </div>
                  <div className="text-[11px] text-gray-600">
                    {new Date(item.inicio).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {item.fim && (
                      <>
                        {" "}
                        –{" "}
                        {new Date(item.fim).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function PaginaTreinos() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [, navigate] = useLocation();
  const [abaProfessor, setAbaProfessor] = useState<"avaliar" | "criar">("avaliar");
  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);

  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  const [submissoesPendentes, setSubmissoesPendentes] = useState<SubmissaoParaValidacao[]>([]);
  const [carregandoSubmissoes, setCarregandoSubmissoes] = useState(false);
  const [page, setPage] = useState({ total: 0, limit: 20, offset: 0 });

  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<Set<string>>(new Set());
  const [idsProgramadosSubmetidos, setIdsProgramadosSubmetidos] = useState<Set<string>>(new Set());
  const [idsDesafiosSubmetidos, setIdsDesafiosSubmetidos] = useState<Set<string>>(new Set());

  const [statusPorTreino, setStatusPorTreino] =
    useState<
      Record<
        string,
        { status: string; startedAt?: string | null; completedAt?: string | null }
      >
    >({});

  const [checklistByTreino, setChecklistByTreino] = useState<Record<string, Checklist>>({});
  const [semanasDesafio, setSemanasDesafio] = useState<WeekStatus[]>([]);

  const [elapsedByTreino, setElapsedByTreino] = useState<Record<string, number>>({});
  const tickRef = useRef<number | null>(null);

  const [dataAgendarById, setDataAgendarById] = useState<Record<string, string>>({});
  const [obsById, setObsById] = useState<Record<string, string>>({});

  const tipoAtual = (usuario?.tipo ?? "").toLowerCase();
  const podeGerirElenco = ["professor", "clube", "escolinha", "escola"].includes(tipoAtual);

  const [viewAtleta, setViewAtleta] = useState<"lista" | "calendario">("lista");

  const [eventosAtleta, setEventosAtleta] = useState<EventoAtleta[]>([]);

  const agendaItemsAtleta: AgendaItem[] = useMemo(() => {
  const items: AgendaItem[] = [];

    for (const t of treinosAgendados) {
      const inicioIso =
        t.prazoEnvio ??
        t.dataTreino ??
        t.treinoProgramado?.dataAgendada ??
        null;

      if (!inicioIso) continue;

      items.push({
        id: t.id,
        tipo: "TREINO",
        titulo: t.titulo,
        inicio: inicioIso,
        fim: t.dataExpiracao ?? null,
        origem: "TREINO_AGENDADO",
      });
    }

    for (const d of desafios) {
      const anyD = d as any;
      const inicioIso: string | null =
        anyD.inicio ??
        anyD.dataInicio ??
        anyD.dataLimite ??
        null;

      if (!inicioIso) continue;

      items.push({
        id: d.id,
        tipo: "DESAFIO",
        titulo: d.titulo,
        inicio: inicioIso,
        fim: null,
        origem: "DESAFIO",
      });
    }

    for (const ev of eventosAtleta) {
      if (!ev || !ev.inicio) continue;

      items.push({
        id: ev.id,
        tipo: ev.tipo === "PENEIRA" ? "PENEIRA" : "EVENTO",
        titulo: ev.titulo,
        inicio: ev.inicio,
        fim: ev.fim ?? null,
        origem: "EVENTO",
      });
    }

    return items.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [treinosAgendados, desafios, eventosAtleta]);

  async function agendarTreinoProgramado(
    treino: TreinoProgramado,
    dataSelecionadaISO: string,
    observacao?: string
  ) {
    const token = getToken();
    const atletaId = (Storage as any).tipoUsuarioId || (Storage as any).atletaId;

    if (!token || !atletaId) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }

    const dia = (dataSelecionadaISO || new Date(Date.now() + 86400000).toISOString()).slice(
      0,
      10
    );
    const quandoISO = `${dia}T23:59:59.000Z`;

    try {
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
        }),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        if (r.status === 409) return alert("Você já tem um agendamento futuro desse treino.");
        console.error("Falha ao agendar:", r.status, txt);
        return alert("Não foi possível agendar o treino.");
      }

      const novo = await r.json();
      window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));
      alert("Treino agendado!");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  }

  const carregarChecklist = (treinoId: string, exerciciosIds: string[]) => {
    try {
      const raw = getStore().getItem(CHECKLIST_KEY(treinoId));
      const parsed = raw ? (JSON.parse(raw) as Checklist) : {};
      const filled: Checklist = { ...parsed };
      for (const id of exerciciosIds) {
        if (typeof filled[id] !== "boolean") filled[id] = false;
      }
      return filled;
    } catch {
      const empty: Checklist = {};
      for (const id of exerciciosIds) empty[id] = false;
      return empty;
    }
  };

  const salvarChecklist = (treinoId: string, state: Checklist) => {
    try {
      getStore().setItem(CHECKLIST_KEY(treinoId), JSON.stringify(state));
    } catch {}
  };

  const toggleItemChecklist = (treinoId: string, exercicioId: string) => {
    setChecklistByTreino((prev) => {
      const atual = { ...(prev[treinoId] ?? {}) };
      atual[exercicioId] = !atual[exercicioId];
      const novo = { ...prev, [treinoId]: atual };
      salvarChecklist(treinoId, atual);
      return novo;
    });
  };

  const marcarTodos = (treinoId: string, exerciciosIds: string[], value: boolean) => {
    setChecklistByTreino((prev) => {
      const novoEstado: Checklist = {};
      exerciciosIds.forEach((id) => (novoEstado[id] = value));
      const novo = { ...prev, [treinoId]: novoEstado };
      salvarChecklist(treinoId, novoEstado);
      return novo;
    });
  };

  const limparChecklist = (treinoId: string) => {
    setChecklistByTreino((prev) => {
      const novo = { ...prev, [treinoId]: {} };
      salvarChecklist(treinoId, {});
      return novo;
    });
  };

  function WeeklyChecker({ weeks }: { weeks: WeekStatus[] }) {
    if (!weeks || weeks.length === 0) return null;
    return (
      <div className="mb-3">
        <div className="text-sm font-semibold text-green-900 mb-1">Semanas do mês</div>
        <div className="flex items-center gap-2">
          {weeks.map((w) => {
            const base =
              w.status === "success"
                ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                : w.status === "fail"
                ? "bg-red-100 border-red-300 text-red-700"
                : "bg-gray-100 border-gray-200 text-gray-500";
            return (
              <div
                key={w.index}
                className={`h-9 w-9 rounded-full border flex items-center justify-center shrink-0 ${base}`}
                title={`Semana ${w.index} (${new Date(w.start).toLocaleDateString(
                  "pt-BR"
                )} – ${new Date(new Date(w.end).getTime() - 1).toLocaleDateString("pt-BR")}) • ${
                  w.count.approved
                } aprov., ${w.count.rejected} reprov.`}
              >
                {w.status === "success" ? (
                  <Check className="w-5 h-5" />
                ) : w.status === "fail" ? (
                  <X className="w-5 h-5" />
                ) : (
                  <span className="text-xs">{w.index}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  async function carregarStatus(id: string) {
    const token = getToken();
    if (!token) return;

    const r = await fetch(`${API.BASE_URL}/api/treinos/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) return;

    const js = await r.json();

    const rawStatus = (js?.status ?? "PENDING") as TreinoStatus;

    const normalizedStatus: TreinoStatus =
      rawStatus === "COMPLETED" ? "COMPLETED" : "PENDING";

    setStatusPorTreino((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {}),
        status: normalizedStatus,
        startedAt: null,
        completedAt: js?.completedAt ?? null,
      },
    }));
  }

  useEffect(() => {
    treinosAgendados.forEach((t) => carregarStatus(t.id));
  }, [treinosAgendados]);

  useEffect(() => {
    const inProgressIds = Object.keys(statusPorTreino).filter(
      (id) => (statusPorTreino[id]?.status as TreinoStatus | undefined) === "IN_PROGRESS"
    );

    if (inProgressIds.length === 0) {
      if (tickRef.current) {
        clearInterval(tickRef.current as any);
        tickRef.current = null;
      }
      return;
    }

    if (tickRef.current) return;

    tickRef.current = window.setInterval(() => {
      setElapsedByTreino((prev) => {
        const now = Date.now();
        const next = { ...prev };
        for (const id of inProgressIds) {
          const st = statusPorTreino[id];
          const startedIso =
            (st?.startedAt as string | undefined) ??
            localStorage.getItem(TIMER_KEY(id)) ??
            undefined;
          const startedMs = startedIso ? Date.parse(startedIso) : NaN;
          if (Number.isFinite(startedMs)) {
            next[id] = Math.max(0, Math.floor((now - startedMs) / 1000));
          }
        }
        return next;
      });
    }, 1000) as any;

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current as any);
        tickRef.current = null;
      }
    };
  }, [statusPorTreino]);

  useEffect(() => {
    const next: Record<string, Checklist> = {};
    for (const t of treinosAgendados) {
      const exIds = (t.treinoProgramado?.exercicios ?? []).map((e) => e.exercicio.id);
      next[t.id] = carregarChecklist(t.id, exIds);
    }
    setChecklistByTreino(next);
  }, [treinosAgendados]);

  useEffect(() => {
    const handler = (e: any) => setTreinosAgendados((prev) => [e.detail, ...prev]);
    window.addEventListener("treino:agendado", handler as EventListener);
    window.dispatchEvent(new Event("treinos:ready"));
    return () => window.removeEventListener("treino:agendado", handler as EventListener);
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastAgendamento");
      if (!raw) return;
      const novo = JSON.parse(raw);

      setTreinosAgendados((prev) => {
        if (prev.some((t) => t.id === novo.id)) return prev;
        return [
          {
            id: novo.id,
            titulo: novo.titulo,
            dataTreino: novo.dataTreino,
            prazoEnvio: novo.dataTreino,
            treinoProgramado: undefined,
            nivel: null,
            duracaoMinutos: null,
          },
          ...prev,
        ];
      });

      sessionStorage.removeItem("lastAgendamento");
    } catch {}
  }, []);

  async function concluir(
    treinoAgendadoId: string,
    payload?: { observacao?: string; duracaoMinutos?: number; tempoSeg?: number; repeticoes?: number }
  ) {
    const token = getToken();
    if (!token) return alert("Sessão expirada. Faça login novamente.");

    try {
      const r = await fetch(
        `${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ treinoAgendadoId, ...(payload || {}) }),
        }
      );

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("Falha ao concluir treino:", r.status, txt);
        return alert("Não foi possível concluir o treino.");
      }

      setStatusPorTreino((prev) => ({
        ...prev,
        [treinoAgendadoId]: {
          ...(prev[treinoAgendadoId] ?? {}),
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
        },
      }));
      setIdsAgendadosSubmetidos((prev) => {
        const s = new Set(prev);
        s.add(treinoAgendadoId);
        return s;
      });

      alert("Treino concluído!");
      try {
        localStorage.removeItem(TIMER_KEY(treinoAgendadoId));
      } catch {}
      setElapsedByTreino((prev) => {
        const n = { ...prev };
        delete n[treinoAgendadoId];
        return n;
      });
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao concluir o treino.");
    }
  }

  async function iniciar(treinoAgendadoId: string) {
    const token = getToken();
    if (!token) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }

    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/iniciar`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Falha ao iniciar treino:", r.status, txt);
      alert(
        r.status === 401
          ? "Sessão expirada. Faça login novamente."
          : "Não foi possível iniciar o treino."
      );
      return;
    }

    let startedAtIso: string | null = null;
    try {
      const js = await r.json();
      startedAtIso = js?.startedAt ?? js?.started?.startedAt ?? null;
    } catch {
      startedAtIso = null;
    }
    if (!startedAtIso) startedAtIso = new Date().toISOString();
    try {
      localStorage.setItem(TIMER_KEY(treinoAgendadoId), startedAtIso);
    } catch {}

    setStatusPorTreino((prev) => ({
      ...prev,
      [treinoAgendadoId]: {
        ...(prev[treinoAgendadoId] ?? {}),
        status: "IN_PROGRESS",
        startedAt: startedAtIso,
      },
    }));
  }

  async function finalizarEEnviar(treino: TreinoAgendado) {
    const elapsed = elapsedByTreino[treino.id] ?? 0;
    if (!statusPorTreino[treino.id] || statusPorTreino[treino.id]?.status !== "IN_PROGRESS") {
      alert("Inicie o treino antes de finalizar.");
      return;
    }
    const usarCamera = window.confirm(
      "Quer gravar agora com a câmera? (OK=câmera • Cancelar=galeria)"
    );
    const qs = new URLSearchParams({
      treinoAgendadoId: treino.id,
      tempoSeg: String(elapsed),
      mode: usarCamera ? "camera" : "galeria",
    });
    navigate(`/submissao?${qs.toString()}`);
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      const res = await fetch(`${API.BASE_URL}/api/treinos/minhas-submissoes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const rows: Array<{ treinoAgendadoId: string }> = await res.json();
      setIdsAgendadosSubmetidos(
        new Set(rows.map((r) => r.treinoAgendadoId).filter(Boolean))
      );
    })();
  }, []);

  async function carregarMinhasSubmissoes(atletaId: string) {
    try {
      const token = getToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const r = await fetch(
        `${API.BASE_URL}/api/treinos/minhas-submissoes?atletaId=${encodeURIComponent(
          atletaId
        )}`,
        { headers }
      );
      if (r.ok) {
        const arr: MinhasSubTreino[] = await r.json();
        const setAg = new Set<string>();
        const setPg = new Set<string>();
        for (const s of arr) {
          if (s.treinoAgendadoId) setAg.add(s.treinoAgendadoId);
          if (s.treinoProgramadoId) setPg.add(s.treinoProgramadoId);
        }
        setIdsAgendadosSubmetidos(setAg);
        setIdsProgramadosSubmetidos(setPg);
      } else {
        setIdsAgendadosSubmetidos(new Set());
        setIdsProgramadosSubmetidos(new Set());
      }

      if (FLAGS.DESAFIOS_ENABLED) {
        try {
          const r2 = await fetch(
            `${API.BASE_URL}/api/desafios/minhas-submissoes?atletaId=${encodeURIComponent(
              atletaId
            )}`,
            { headers }
          );
          if (r2.ok) {
            const arr2: { desafioId: string }[] = await r2.json();
            setIdsDesafiosSubmetidos(new Set(arr2.map((x) => x.desafioId)));
          } else {
            setIdsDesafiosSubmetidos(new Set());
          }
        } catch {
          setIdsDesafiosSubmetidos(new Set());
        }
      } else {
        setIdsDesafiosSubmetidos(new Set());
      }
    } catch {
      setIdsAgendadosSubmetidos(new Set());
      setIdsProgramadosSubmetidos(new Set());
      setIdsDesafiosSubmetidos(new Set());
    }
  }

  useEffect(() => {
    if (!semanasDesafio.length) return;
    const now = new Date();
    const patched = semanasDesafio.map((b) => {
      if (b.count.approved > 0) return { ...b, status: "success" as const };
      const ended = Date.now() >= Date.parse(b.end);
      return { ...b, status: ended ? ("fail" as const) : ("none" as const) };
    });
    const changed = patched.some((w, i) => w.status !== semanasDesafio[i].status);
    if (changed) setSemanasDesafio(patched);
  }, [semanasDesafio]);

  useEffect(() => {
    const carregar = async () => {
      const rawTipo =
        (Storage as any).tipoSalvo ??
        (Storage as any).tipoUsuario ??
        (Storage as any).tipo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        "";

      const tipo = String(rawTipo).toLowerCase();
      const tipoUsuarioId =
        (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");
      const token =
        (Storage as any).token ?? localStorage.getItem("token");

      const qs = new URLSearchParams(window.location.search);
      const professorIdFromQuery = qs.get("professorId");

      if (professorIdFromQuery && token) {
        try {
          const res = await fetch(
            `${API.BASE_URL}/api/treinos/programados?professorId=${encodeURIComponent(
              professorIdFromQuery
            )}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (res.ok) {
            const data = await res.json();
            const lista = Array.isArray(data)
              ? data
              : data?.items ?? data?.data ?? [];

            const normTreinos = lista.map((t: any) => ({
              id: t.id,
              nome: t.nome,
              descricao: t.descricao ?? undefined,
              nivel: t.nivel,
              dataAgendada: t.dataAgendada ?? undefined,
              duracao: t.duracao ?? undefined,
              objetivo: t.objetivo ?? undefined,
              dicas: Array.isArray(t.dicas) ? t.dicas : [],
              professorId: t.professorId ?? undefined,
              escolinhaId: t.escolinhaId ?? undefined,
              clubeId: t.clubeId ?? undefined,
              pontuacao: t.pontuacao ?? undefined,
              exercicios: (t.exercicios ?? []).map((ex: any) => ({
                id: ex.exercicio?.id ?? ex.id ?? "",
                nome: ex.exercicio?.nome ?? ex.nome ?? "",
                repeticoes: ex.repeticoes ?? undefined,
              })),
            }));

            setTreinos(normTreinos);
          }
        } catch (e) {
          console.error("Falha ao carregar treinos por professorId:", e);
        }
      }

      if (tipo === "atleta" && token) {
        if (tipoUsuarioId) {
          carregarMinhasSubmissoes(tipoUsuarioId);
        }

        const headers: HeadersInit = {
          Authorization: `Bearer ${token}`,
        };
        const atletaId = tipoUsuarioId || (Storage as any).atletaId;

        if (atletaId) {
          const r = await fetch(
            `${API.BASE_URL}/api/treinos/agendados?atletaId=${encodeURIComponent(
              atletaId
            )}`,
            { headers }
          );

          if (!r.ok) {
            console.error(
              "/treinos/agendados",
              r.status,
              await r.text().catch(() => "")
            );
            setTreinosAgendados([]);
          } else {
            const treinosJson = await r.json();
            const normalizados = (Array.isArray(treinosJson)
              ? treinosJson
              : []
            ).map((t: any) => ({
              id: t.id,
              titulo: t.titulo,
              dataTreino: t.dataTreino ?? null,
              prazoEnvio:
                t.prazoEnvio ??
                t.dataExpiracao ??
                t.dataTreino ??
                t.treinoProgramado?.dataAgendada ??
                null,
              nivel: t.nivel ?? t.treinoProgramado?.nivel ?? null,
              duracaoMinutos:
                t.duracaoMinutos ?? t.treinoProgramado?.duracao ?? null,
              treinoProgramado: t.treinoProgramado ?? null,
            }));

            setTreinosAgendados(normalizados);
          }
        } else {
          setTreinosAgendados([]);
        }

        if (FLAGS.DESAFIOS_ENABLED) {
          const resDesafios = await fetch(
            `${API.BASE_URL}/api/desafios?tipoUsuarioId=${tipoUsuarioId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (resDesafios.ok) {
            const desafiosJson = await resDesafios.json();
            setDesafios(desafiosJson ?? []);
          } else {
            setDesafios([]);
          }

          try {
            const resSem = await fetch(
              `${API.BASE_URL}/api/treinos/desafios-semanais?tipoUsuarioId=${encodeURIComponent(
                tipoUsuarioId ?? ""
              )}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (resSem.ok) {
              const js = await resSem.json();
              const rawWeeks: WeekStatus[] = Array.isArray(js?.weeks)
                ? js.weeks
                : [];
              setSemanasDesafio(computeMonthlyWeeks(rawWeeks, new Date()));
            } else {
              setSemanasDesafio(buildMonthBuckets(new Date()));
            }
          } catch {
            setSemanasDesafio(buildMonthBuckets(new Date()));
          }
        } else {
          setDesafios([]);
          setSemanasDesafio([]);
        }

        try {
          const alvoId = tipoUsuarioId || atletaId;
          if (alvoId) {
            const resEvt = await fetch(
              `${API.BASE_URL}/api/eventos/minha-agenda?alvoId=${encodeURIComponent(
                alvoId
              )}`,
              { headers }
            );
            if (resEvt.ok) {
              const dataEvt = await resEvt.json();
              const lista = Array.isArray(dataEvt)
                ? dataEvt
                : dataEvt?.items ?? dataEvt?.data ?? [];

              const normalizados: EventoAtleta[] = lista
                .map((ev: any) => ({
                  id: ev.id,
                  tipo: ev.tipo ?? ev.categoria ?? null,
                  titulo: ev.titulo ?? ev.nome ?? "Evento",
                  inicio: ev.inicio ?? ev.dataInicio ?? ev.data ?? null,
                  fim:
                    ev.fim ??
                    ev.dataFim ??
                    ev.dataLimite ??
                    null,
                }))
                .filter((ev: EventoAtleta) => !!ev.inicio);

              setEventosAtleta(normalizados);
            } else {
              setEventosAtleta([]);
            }
          } else {
            setEventosAtleta([]);
          }
        } catch (e) {
          console.error("Falha ao carregar eventos do atleta:", e);
          setEventosAtleta([]);
        }
      } else if (tipo === "admin" && token) {
        const resTreinos = await fetch(
          `${API.BASE_URL}/api/treinos/programados`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!resTreinos.ok)
          throw new Error(`Falha /treinos/programados: ${resTreinos.status}`);
        const jsonTreinos = await resTreinos.json();

        const normTreinos = (Array.isArray(jsonTreinos)
          ? jsonTreinos
          : []
        ).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao ?? undefined,
          nivel: t.nivel,
          dataAgendada: t.dataAgendada ?? undefined,
          duracao: t.duracao ?? undefined,
          objetivo: t.objetivo ?? undefined,
          dicas: Array.isArray(t.dicas) ? t.dicas : [],
          professorId: t.professorId ?? undefined,
          escolinhaId: t.escolinhaId ?? undefined,
          clubeId: t.clubeId ?? undefined,
          pontuacao: t.pontuacao ?? undefined,
          exercicios: (t.exercicios ?? []).map((ex: any) => ({
            id: ex.exercicio?.id ?? ex.id ?? "",
            nome: ex.exercicio?.nome ?? ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        }));
        setTreinos(normTreinos);

        if (FLAGS.DESAFIOS_ENABLED) {
          const resDesafios = await fetch(`${API.BASE_URL}/api/desafios`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resDesafios.ok)
            throw new Error(`/desafios: ${resDesafios.status}`);
          const jsonDesafios = await resDesafios.json();
          setDesafios(jsonDesafios?.desafiosOficiais ?? jsonDesafios ?? []);
        } else {
          setDesafios([]);
        }
      } else if (
        ["professor", "clube", "escolinha", "escola"].includes(String(tipo)) &&
        token
      ) {
        const resTreinos = await fetch(
          `${API.BASE_URL}/api/treinos/programados`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!resTreinos.ok)
          throw new Error(`/treinos/programados: ${resTreinos.status}`);
        const jsonTreinos = await resTreinos.json();

        const normTreinos = (Array.isArray(jsonTreinos)
          ? jsonTreinos
          : []
        ).map((t: any) => ({
          id: t.id,
          nome: t.nome,
          descricao: t.descricao ?? undefined,
          nivel: t.nivel,
          dataAgendada: t.dataAgendada ?? undefined,
          duracao: t.duracao ?? undefined,
          objetivo: t.objetivo ?? undefined,
          dicas: Array.isArray(t.dicas) ? t.dicas : [],
          professorId: t.professorId ?? undefined,
          escolinhaId: t.escolinhaId ?? undefined,
          clubeId: t.clubeId ?? undefined,
          pontuacao: t.pontuacao ?? undefined,
          exercicios: (t.exercicios ?? []).map((ex: any) => ({
            id: ex.exercicio?.id ?? ex.id ?? "",
            nome: ex.exercicio?.nome ?? ex.nome ?? "",
            repeticoes: ex.repeticoes ?? undefined,
          })),
        }));
        setTreinos(normTreinos);

        if (FLAGS.DESAFIOS_ENABLED) {
          const resDesafios = await fetch(
            `${API.BASE_URL}/api/desafios?tipoUsuarioId=${
              (Storage as any).tipoUsuarioId
            }`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!resDesafios.ok)
            throw new Error(`/desafios: ${resDesafios.status}`);
          const jsonDesafios = await resDesafios.json();
          setDesafios(jsonDesafios ?? []);
        } else {
          setDesafios([]);
        }
      }
    };

    const carregarUsuario = () => {
      const tipoSalvo =
        (Storage as any).tipoSalvo ??
        (Storage as any).tipoUsuario ??
        (Storage as any).tipo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario");

      const usuarioId =
        (Storage as any).usuarioId ?? localStorage.getItem("usuarioId");
      const tipoUsuarioId =
        (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");

      const t = String(tipoSalvo || "").toLowerCase();
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
        setUsuario({ tipo: t as any, usuarioId, tipoUsuarioId: tipoUsuarioId ?? "" });
      } else {
        console.warn("Tipo/IDs inválidos", { tipoSalvo, usuarioId, tipoUsuarioId });
      }
    };
    carregar();
    carregarUsuario();
  }, []);

  useEffect(() => {
    if ((usuario?.tipo ?? "").toLowerCase() === "olheiro") {
      window.location.replace("/olheiros");
    }
  }, [usuario?.tipo]);

  useEffect(() => {
    if (!usuario) return;
    if (
      usuario.tipo === "professor" ||
      usuario.tipo === "clube" ||
      usuario.tipo === "escolinha" ||
      usuario.tipo === "escola" ||
      usuario.tipo === "admin"
    ) {
      if (abaProfessor === "avaliar") carregarSubmissoes();
    }
  }, [abaProfessor, usuario?.tipoUsuarioId]);

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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok)
        throw new Error(`Falha /treinos/submissoes: ${res.status}`);
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
    pontosSug?: number
  ) {
    const token = getToken();
    if (!token || !usuario) return;

    let pontos = 0;
    if (aprovado) {
      const inp = prompt(
        "Pontos a creditar para este treino:",
        String(pontosSug ?? 0)
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
        }
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
          : "Submissão reprovada."
      );
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao validar.");
    }
  }

  const aprovar = (id: string, pontos?: number) =>
    validarSubmissao(id, true, pontos);
  const reprovar = (id: string) => validarSubmissao(id, false, 0);

  const formatarDataHora = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "";

  const formatarData = (data?: string) =>
    data ? new Date(data).toLocaleDateString("pt-BR") : "";

  const treinosAgendadosVisiveis = treinosAgendados.filter(
    (t) => !idsAgendadosSubmetidos.has(t.id)
  );
  const desafiosVisiveis = desafios.filter(
    (d) => !idsDesafiosSubmetidos.has(d.id)
  );

  const renderDesafioCard = (desafio: Desafio) => (
    <div
      key={desafio.id}
      className="bg-white p-4 rounded-xl shadow-sm border border-yellow-300/60 mb-3"
    >
      <h4 className="font-bold text-yellow-700 text-lg mb-1">
        <Link href={`/desafios/${desafio.id}`} className="hover:underline">
          {desafio.titulo}
        </Link>
      </h4>

      <p className="text-sm text-gray-600 mb-2">{desafio.descricao}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span>Nível: {desafio.nivel}</span>
        <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          {desafio.pontuacao} pts
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={() => navigate(`/submissao?desafioId=${desafio.id}`)}
          className="w-full whitespace-nowrap text[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-800 hover:bg-green-900 text-white"
          title="Fazer Submissão"
        >
          <span className="sm:hidden">Submeter</span>
          <span className="hidden sm:inline">Fazer Submissão</span>
        </button>

        <button
          onClick={() => navigate(`/desafios/${desafio.id}`)}
          className="w-full whitespace-nowrap text-[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white border border-green-300 text-green-800 hover:bg-green-50"
          title="Ver desafio"
        >
          Ver desafio
        </button>

        <button
          onClick={() => abrirModalCompartilhar(desafio.id)}
          className="w-full inline-flex items-center justify-center gap-1 text-[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white"
          title="Compartilhar"
        >
          <Share2 className="w-4 h-4" />
          <span className="truncate">Compartilhar</span>
        </button>
      </div>
    </div>
  );

  if (!usuario) return <p className="text-center p-4">Carregando...</p>;

  const isGestor = ["professor", "admin", "escola", "escolinha", "clube"].includes(
    tipoAtual
  );
  const isOlheiro = tipoAtual === "olheiro";

  const renderTreinoCard = (treino: TreinoProgramado) => (
    <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border mb-4">
      <div className="flex items-start justify-between gap-3">
        <h4
          className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
          onClick={() => navigate(`/treinos/unico?programadoId=${treino.id}`)}
        >
          {treino.nome}
        </h4>

        {typeof treino.pontuacao === "number" && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            +{treino.pontuacao} pts
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            className="px-3 py-2 border rounded-lg"
            value={dataAgendarById[treino.id] ?? ""}
            onChange={(e) =>
              setDataAgendarById((p) => ({ ...p, [treino.id]: e.target.value }))
            }
          />
          <input
            type="text"
            placeholder="Observação (opcional)"
            className="px-3 py-2 border rounded-lg flex-1"
            value={obsById[treino.id] ?? ""}
            onChange={(e) =>
              setObsById((p) => ({ ...p, [treino.id]: e.target.value }))
            }
          />
          <button
            onClick={() => {
              const iso =
                dataAgendarById[treino.id] ||
                new Date().toISOString().slice(0, 10);
              agendarTreinoProgramado(treino, iso, obsById[treino.id]);
            }}
            className="bg-green-800 text-white px-3 py-2 rounded-lg"
          >
            Agendar treino
          </button>
        </div>
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => salvarTreinoNaBiblioteca(treino.id)}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 text-xs sm:text-sm bg-white hover:bg-emerald-50"
        >
          <BookMarked className="w-4 h-4 mr-1" />
          Salvar na biblioteca
        </button>
      </div>

      {treino.descricao && (
        <p className="text-sm text-gray-700 mt-1">{treino.descricao}</p>
      )}

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
        <p>
          <strong>Nível:</strong> {treino.nivel}
        </p>
        {treino.dataAgendada && (
          <p>
            <strong>Data:</strong> {formatarData(treino.dataAgendada)}
          </p>
        )}
        {typeof treino.duracao === "number" && (
          <p>
            <strong>Duração:</strong> {treino.duracao} min
          </p>
        )}
        {treino.objetivo && (
          <p className="sm:col-span-2">
            <strong>Objetivo:</strong> {treino.objetivo}
          </p>
        )}
      </div>

      {treino.exercicios?.length > 0 && (
        <div className="mt-3">
          <strong className="text-sm text-gray-800">Exercícios:</strong>
          <div className="max-h-40 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
            {treino.exercicios.map((ex, i) => (
              <div
                key={ex.id || `${i}-${ex.nome || "ex"}`}
                className="border-b pb-1 last:border-b-0"
              >
                <strong>{i + 1}.</strong> {ex.nome}{" "}
                {ex.repeticoes && (
                  <span className="text-gray-500">({ex.repeticoes})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderTreinoAgendadoCard = (treino: TreinoAgendado) => {
    const programado = treino.treinoProgramado;
    const nivel = treino.nivel ?? treino.treinoProgramado?.nivel ?? "-";
    const prazoIso =
      treino.prazoEnvio ??
      treino.dataTreino ??
      treino.treinoProgramado?.dataAgendada ??
      null;
    const exercicios = programado?.exercicios ?? [];
    const exIds = exercicios.map((e) => e.exercicio.id);
    const pontos = programado?.pontuacao ?? null;
    const jaSubmetido = idsAgendadosSubmetidos.has(treino.id);
    const st = statusPorTreino[treino.id]?.status as TreinoStatus | undefined;

    const ck = checklistByTreino[treino.id] ?? {};
    const done = exIds.filter((id) => ck[id]).length;
    const total = exIds.length;
    const allChecked = total > 0 && done === total;

    return (
      <div key={treino.id} className="bg-white p-4 rounded-xl shadow-sm border mb-4">
        <div className="flex items-start justify-between gap-3">
          <h4
            className="font-bold text-lg text-green-800 cursor-pointer hover:underline"
            onClick={() => navigate(`/treinos/unico?agendadoId=${treino.id}`)}
          >
            {treino.titulo}
          </h4>

          {programado?.id && (
            <button
              type="button"
              onClick={() => salvarTreinoNaBiblioteca(programado.id)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 text-xs sm:text-sm bg-white hover:bg-emerald-50"
            >
              <BookMarked className="w-4 h-4 mr-1" />
              Salvar na biblioteca
            </button>
          )}

          <div className="flex items-center gap-2">
            {typeof pontos === "number" && pontos > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                +{pontos} pts
              </span>
            )}
            <button
              onClick={() => removerTreinoAgendado(treino.id)}
              title="Remover"
              className="shrink-0 p-2 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {programado?.descricao && (
          <p className="text-sm text-gray-700 mt-1">{programado.descricao}</p>
        )}

        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
          <p>
            <strong>Nível:</strong> {nivel}
          </p>

          {programado?.duracao && (
            <p>
              <strong>Duração:</strong> {programado.duracao} min
            </p>
          )}

          {programado?.objetivo && (
            <p className="sm:col-span-2">
              <strong>Objetivo:</strong> {programado.objetivo}
            </p>
          )}

          {prazoIso && (
            <div className="sm:col-span-2 flex items-center text-gray-700">
              <CalendarClock className="h-4 w-4 mr-1" />
              Prazo para envio:
              <Badge
                variant="outline"
                className="ml-2 text-[11px] bg-green-100 text-green-700 border-green-200"
              >
                {formatarDataHora(prazoIso)}
              </Badge>
            </div>
          )}
        </div>

        {exercicios.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <strong className="text-sm text-gray-800">Exercícios</strong>
              <div className="text-xs text-gray-600">
                Progresso:{" "}
                <span
                  className={`font-semibold ${
                    allChecked ? "text-emerald-700" : "text-gray-800"
                  }`}
                >
                  {done}/{total}
                </span>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
              {exercicios.map((ex, i) => {
                const id = ex.exercicio.id;
                const checked = !!ck[id];
                return (
                  <label
                    key={id}
                    className="flex items-start gap-2 border-b pb-2 last:border-b-0 cursor-pointer select-none"
                    title={ex.exercicio.nome}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItemChecklist(treino.id, id)}
                      className="sr-only peer"
                    />

                    <span
                      className="
                        mt-0.5 relative h-5 w-5 rounded-md
                        border-2 border-emerald-600 bg-white
                        flex items-center justify-center
                        transition-all duration-150
                        peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-400/60
                        peer-checked:border-emerald-700
                        peer-checked:[&>svg]:opacity-100
                        peer-checked:[&>svg]:scale-100
                      "
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="
                          absolute h-3.5 w-3.5
                          text-emerald-700
                          opacity-0 scale-75
                          transition duration-150
                          pointer-events-none
                        "
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="presentation"
                      >
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{i + 1}.</span>
                        <span
                          className={`truncate ${
                            checked ? "line-through text-gray-500" : ""
                          }`}
                        >
                          {ex.exercicio.nome}
                        </span>
                        {!!ex.repeticoes && (
                          <span className="text-[11px] text-gray-500">
                            ({ex.repeticoes})
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => marcarTodos(treino.id, exIds, true)}
                className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Marcar todos
              </button>
              <button
                onClick={() => limparChecklist(treino.id)}
                className="text-xs px-2.5 py-1 rounded bg-white border text-gray-700 hover:bg-gray-50"
              >
                Limpar checklist
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
          {(st === undefined || st === "PENDING") && (
            <button
              onClick={() => iniciar(treino.id)}
              className="bg-green-700 text-white px-3 py-2 rounded-lg"
            >
              Iniciar
            </button>
          )}

          {st === "IN_PROGRESS" && (
            <>
              <span className="mr-auto text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                ⏱ {formatHHMMSS(elapsedByTreino[treino.id] ?? 0)}
              </span>

              <button
                onClick={() => finalizarEEnviar(treino)}
                disabled={!allChecked}
                className={`px-3 py-2 rounded-lg text-white ${
                  allChecked
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
                title={
                  allChecked
                    ? "Finalizar e enviar submissão"
                    : "Complete todos os exercícios para finalizar"
                }
              >
                Finalizar e enviar
              </button>
            </>
          )}

          {st === "COMPLETED" && (
            <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700 border-emerald-200 border">
              Concluído
            </span>
          )}

          {!jaSubmetido && st !== "IN_PROGRESS" && (
            <button
              onClick={() =>
                navigate(`/submissao?treinoAgendadoId=${treino.id}`)
              }
              className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-lg"
            >
              Fazer Submissão
            </button>
          )}
        </div>
      </div>
    );
  };

  async function salvarTreinoNaBiblioteca(treinoProgramadoId: string) {
    const token = getToken();

    if (!token) {
      alert("Sessão expirada. Faça login novamente.");
      return;
    }

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/biblioteca`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ treinoProgramadoId }),
      });

      if (!r.ok) {
        let payload: any = null;
        try {
          payload = await r.json();
        } catch {}

        if (
          r.status === 403 &&
          payload?.code === "LIMIT_REACHED" &&
          payload?.feature === "TREINO_SALVO"
        ) {
          alert(
            payload.message ||
              "Você atingiu o limite de treinos salvos na sua biblioteca no plano Free."
          );
          return;
        }

        if (r.status === 409) {
          alert("Esse treino já está na sua biblioteca.");
          return;
        }

        console.error(
          "Falha ao salvar na biblioteca:",
          r.status,
          payload || (await r.text().catch(() => ""))
        );
        alert("Não foi possível salvar o treino na biblioteca.");
        return;
      }

      alert("Treino salvo na sua biblioteca!");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao salvar o treino na biblioteca.");
    }
  }

  async function removerTreinoAgendado(id: string) {
    const token = getToken();
    if (!token) return alert("Sessão expirada.");
    if (!confirm("Remover este treino dos seus treinos?")) return;

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/treinos/agendados/${id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao excluir:", res.status, txt);
        return alert("Não foi possível excluir.");
      }
      setTreinosAgendados((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao excluir.");
    }
  }

  async function carregarUsuariosMutuos() {
    const token = getToken();
    setCarregandoMutuos(true);
    try {
      const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Erro ao buscar usuários mutuos");
      const data = await res.json();
      setUsuariosMutuos(data);
    } catch (err) {
      console.error(err);
      setUsuariosMutuos([]);
    } finally {
      setCarregandoMutuos(false);
    }
  }

  function abrirModalCompartilhar(desafioId: string) {
    setDesafioParaCompartilhar(desafioId);
    setModalAberto(true);
    carregarUsuariosMutuos();
    setSelecionados(new Set());
  }

  function toggleSelecionado(idUsuario: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(idUsuario)) novo.delete(idUsuario);
      else novo.add(idUsuario);
      return novo;
    });
  }

  async function enviarCompartilhamentoPorDM() {
    if (selecionados.size === 0 || !desafioParaCompartilhar) {
      alert("Selecione ao menos uma pessoa para compartilhar.");
      return;
    }
    const token = getToken();

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
              conteudo: desafioParaCompartilhar,
              tipo: "DESAFIO",
            }),
          })
        )
      );

      alert("Desafio compartilhado por mensagem!");
      setModalAberto(false);
    } catch (e) {
      console.error(e);
      alert("Falha ao enviar mensagens.");
    } finally {
      setEnviandoDM(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4">
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>
        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            {isGestor ? (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-[420px]">
                <button
                  onClick={() => setAbaProfessor("avaliar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "avaliar"
                      ? "bg-green-800 text-white border-green-900"
                      : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Avaliar Treinos
                </button>
                <button
                  onClick={() => setAbaProfessor("criar")}
                  className={`px-4 py-2 rounded-lg border text-sm ${
                    abaProfessor === "criar"
                      ? "bg-green-800 text-white border-green-900"
                      : "bg-white text-gray-800 border-gray-200"
                  }`}
                >
                  Meus Treinos
                </button>
              </div>
            ) : (
              <div className="text-lg font-semibold text-green-900">
                Treinos
              </div>
            )}

            {podeGerirElenco && (
              <Link
                href="/treinos/elenco"
                aria-label="Ir para o elenco (campo)"
                title="Elenco (campo)"
                className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <SoccerFieldIcon className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        <>
          {usuario.tipo === "atleta" && (
            <div className="space-y-6">
              <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                  <h3 className="text-lg font-semibold">Meus Treinos</h3>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="bg-green-800 text-white px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/novo")}
                    >
                      Agendar novo treino
                    </button>

                    <button
                      className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/livre/novo")}
                    >
                      Registrar treino livre
                    </button>

                    <button
                      className="bg-white border border-emerald-300 text-emerald-800 px-4 py-2 rounded-lg text-sm"
                      onClick={() => navigate("/treinos/livre/historico")}
                    >
                      Histórico de treinos livres
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setViewAtleta("lista")}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm border ${
                      viewAtleta === "lista"
                        ? "bg-green-800 text-white border-green-900"
                        : "bg-white text-gray-800 border-gray-200"
                    }`}
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewAtleta("calendario")}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm border inline-flex items-center gap-1 ${
                      viewAtleta === "calendario"
                        ? "bg-green-800 text-white border-green-900"
                        : "bg-white text-gray-800 border-gray-200"
                    }`}
                  >
                    <CalendarClock className="w-4 h-4" />
                    Calendário
                  </button>
                </div>

                {viewAtleta === "lista" ? (
                  treinosAgendadosVisiveis.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {treinosAgendadosVisiveis.map(renderTreinoAgendadoCard)}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      Nenhum treino disponível ainda.
                    </p>
                  )
                ) : (
                  <CalendarAgenda items={agendaItemsAtleta} />
                )}
              </div>

              {FLAGS.DESAFIOS_ENABLED && (
                <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Desafios</h3>
                    <div className="ml-3 shrink-0 [&>div]:mb-0 [&>div>div:first-child]:hidden">
                      <WeeklyChecker weeks={semanasDesafio} />
                    </div>
                  </div>

                  {desafiosVisiveis.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {desafiosVisiveis.map(renderDesafioCard)}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      Nenhum desafio disponível no momento.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {isGestor && (
            <div className="space-y-6">
              {abaProfessor === "avaliar" && (
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
                          const foto = s.atleta?.foto
                            ? resolveUploadUrl(s.atleta.foto)
                            : PLACEHOLDER_USER;
                          const midias = (Array.isArray(s.midias) ? s.midias : []).map(
                            resolveUploadUrl
                          );

                          return (
                            <li
                              key={s.id}
                              className="rounded-xl border bg-white shadow-sm hover:shadow-md transition p-3 sm:p-4"
                            >
                              <div className="flex items-start gap-3 sm:gap-4">
                                <img
                                  src={foto}
                                  alt={s.atleta?.nome}
                                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border"
                                  onError={(e) => {
                                    const el =
                                      e.currentTarget as HTMLImageElement;
                                    (el as any).onerror = null;
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
                                          aprovar(
                                            s.id,
                                            s.pontosSugeridos
                                          )
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
                                    {formatarDataHora(s.criadoEm)}
                                  </div>

                                  {!!s.observacao && (
                                    <p className="mt-1 text[13px] italic text-gray-700 leading-snug">
                                      “{s.observacao}”
                                    </p>
                                  )}
                                </div>
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

              {abaProfessor === "criar" && (
                <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold">
                      {usuario.tipo === "admin"
                        ? "Todos os Treinos"
                        : "Treinos que você criou"}
                    </h3>
                    <button
                      className="bg-green-800 text-white px-4 py-2 rounded-lg"
                      onClick={() => navigate("/treinos/novo")}
                    >
                      Criar novo treino
                    </button>
                  </div>

                  {(
                    usuario.tipo === "admin"
                      ? treinos
                      : treinos.filter(
                          (t) =>
                            t.professorId === usuario.tipoUsuarioId ||
                            t.escolinhaId === usuario.tipoUsuarioId ||
                            t.clubeId === usuario.tipoUsuarioId
                        )
                  ).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(
                        usuario.tipo === "admin"
                          ? treinos
                          : treinos.filter(
                              (t) =>
                                t.professorId === usuario.tipoUsuarioId ||
                                t.escolinhaId === usuario.tipoUsuarioId ||
                                t.clubeId === usuario.tipoUsuarioId
                            )
                      ).map(renderTreinoCard)}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      {usuario.tipo === "admin"
                        ? "Nenhum treino cadastrado."
                        : "Você ainda não criou nenhum treino."}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]">
        <Link href="/feed" className="hover:opacity-90" aria-label="Feed">
          <House />
        </Link>
        <Link href="/explorar" className="hover:opacity-90" aria-label="Explorar">
          <Search />
        </Link>
        <Link href="/post" className="hover:opacity-90" aria-label="Novo post">
          <CirclePlus />
        </Link>
        <Link
          href={isOlheiro ? "/olheiros" : "/treinos"}
          className="hover:opacity-90"
          aria-label="Treinos"
        >
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:opacity-90" aria-label="Perfil">
          <User />
        </Link>
      </nav>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">
              Compartilhar Desafio
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
                    ? resolveUploadUrl(u.foto)
                    : PLACEHOLDER_USER;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${
                        selecionado ? "border-green-600" : "border-transparent"
                      }`}
                    >
                      <img
                        src={fotoSrc}
                        alt={u.nome}
                        className="w-14 h-14 rounded-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          (el as any).onerror = null;
                          el.src = PLACEHOLDER_USER;
                        }}
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
                className={`mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg 
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
    </div>
  );
}
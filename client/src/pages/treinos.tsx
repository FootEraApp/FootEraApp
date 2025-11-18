import React, { useEffect, useRef, useState, type SVGProps, useMemo } from "react";
import { useLocation } from "wouter";
import {
  CalendarClock,
  Volleyball,
  User,
  CirclePlus,
  House,
  CircleCheck,
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
import { TreinosApi } from "../utils/treinosApi.js";

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
    capaUrl?: string | null;
    videoUrl?: string | null;
    exercicios: {
      exercicio: { id: string; nome: string };
      repeticoes: string;
    }[];
  } | null;
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
        {weekdayLabels.map((lbl) => (
          <div key={lbl} className="font-medium">
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
            {selectedItems.map((item) => (
              <li
                key={`${item.origem}-${item.id}`}
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
  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);

  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<Set<string>>(
    new Set()
  );
  const [idsProgramadosSubmetidos, setIdsProgramadosSubmetidos] = useState<Set<string>>(
    new Set()
  );
  const [idsDesafiosSubmetidos, setIdsDesafiosSubmetidos] = useState<Set<string>>(
    new Set()
  );

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

  const [viewAtleta, setViewAtleta] = useState<"lista" | "calendario">("lista");

  const [eventosAtleta, setEventosAtleta] = useState<EventoAtleta[]>([]);

  const [agendaFromApi, setAgendaFromApi] = useState<AgendaItem[]>([]);

  const tipoAtual = (usuario?.tipo ?? "").toLowerCase();

  const agendaItemsAtleta: AgendaItem[] = useMemo(() => {
    const items: AgendaItem[] = [];

    if (agendaFromApi.length) {
      items.push(...agendaFromApi);
    }

    for (const t of treinosAgendados) {
      const inicioIso =
        t.dataTreino ?? t.prazoEnvio ?? t.treinoProgramado?.dataAgendada ?? null;

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
        anyD.inicio ?? anyD.dataInicio ?? anyD.dataLimite ?? null;

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
  }, [treinosAgendados, desafios, eventosAtleta, agendaFromApi]);

  const agendaProximos7 = useMemo(() => {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(hoje.getDate() + 7);

    const startMs = hoje.getTime();
    const endMs = limite.getTime();

    return (agendaItemsAtleta || [])
      .filter((item) => {
        const t = Date.parse(item.inicio);
        if (!Number.isFinite(t)) return false;
        return t >= startMs && t <= endMs;
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [agendaItemsAtleta]);

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
    if (r.ok) {
      const js = await r.json();
      setStatusPorTreino((prev) => ({ ...prev, [id]: js }));
    }
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

  async function cancelarTreinoAgendado(treinoAgendadoId: string) {
  const token = getToken();
  if (!token) {
    alert("Sessão expirada. Faça login novamente.");
    return;
  }

  const confirma = window.confirm(
    "Tem certeza que deseja cancelar este treino agendado?"
  );
  if (!confirma) return;

  try {
    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Erro ao cancelar treino agendado:", r.status, txt);
      return alert("Não foi possível cancelar o treino.");
    }

    setTreinosAgendados((prev) => prev.filter((t) => t.id !== treinoAgendadoId));
    alert("Treino cancelado com sucesso.");
  } catch (e) {
    console.error(e);
    alert("Erro inesperado ao cancelar treino.");
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
    const token =
      (Storage as any).token ?? localStorage.getItem("token") ?? undefined;
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
      const token = (Storage as any).token ?? localStorage.getItem("token");
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
    const patched = semanasDesafio.map((b) => {
      if (b.count.approved > 0) return { ...b, status: "success" as const };
      const ended = Date.now() >= Date.parse(b.end);
      return { ...b, status: ended ? ("fail" as const) : ("none" as const) };
    });
    const changed = patched.some((w, i) => w.status !== semanasDesafio[i].status);
    if (changed) setSemanasDesafio(patched);
  }, [semanasDesafio]);

  useEffect(() => {
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
        ["admin", "atleta", "escola", "escolinha", "clube", "professor", "olheiro"].includes(t) &&
        usuarioId
      ) {
        setUsuario({ tipo: t as any, usuarioId, tipoUsuarioId: tipoUsuarioId ?? "" });
      } else {
        console.warn("Tipo/IDs inválidos", { tipoSalvo, usuarioId, tipoUsuarioId });
      }
    };

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
        (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId") ?? "";
      const token = (Storage as any).token ?? localStorage.getItem("token") ?? "";

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
            const lista = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

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

      if (tipoUsuarioId) {
        carregarMinhasSubmissoes(tipoUsuarioId);
      }

      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const atletaId = tipoUsuarioId || (Storage as any).atletaId;

      if (tipo === "atleta" && token) {
        try {
          const hoje = new Date();
          const daqui30 = new Date();
          daqui30.setDate(hoje.getDate() + 30);

          const rows = await TreinosApi.getCalendario(hoje, daqui30);
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
          setAgendaFromApi(normalizados);
        } catch (e) {
          console.error("Falha ao carregar calendário API:", e);
          setAgendaFromApi([]);
        }

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
            const normalizados = (Array.isArray(treinosJson) ? treinosJson : []).map(
              (t: any) => ({
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
                duracaoMinutos: t.duracaoMinutos ?? t.treinoProgramado?.duracao ?? null,
                treinoProgramado: t.treinoProgramado ?? null,
              })
            );

            setTreinosAgendados(normalizados);
          }
        } else {
          setTreinosAgendados([]);
        }

        if (FLAGS.DESAFIOS_ENABLED && tipoUsuarioId) {
          const resDesafios = await fetch(
            `${API.BASE_URL}/api/desafios?tipoUsuarioId=${tipoUsuarioId}`,
            { headers }
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
                tipoUsuarioId
              )}`,
              { headers }
            );
            if (resSem.ok) {
              const js = await resSem.json();
              const rawWeeks: WeekStatus[] = Array.isArray(js?.weeks) ? js.weeks : [];
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

              const normalizadosEv: EventoAtleta[] = lista
                .map((ev: any) => ({
                  id: ev.id,
                  tipo: ev.tipo ?? ev.categoria ?? null,
                  titulo: ev.titulo ?? ev.nome ?? "Evento",
                  inicio: ev.inicio ?? ev.dataInicio ?? ev.data ?? null,
                  fim: ev.fim ?? ev.dataFim ?? null,
                }))
                .filter((ev: EventoAtleta) => !!ev.inicio);

              setEventosAtleta(normalizadosEv);
            } else {
              setEventosAtleta([]);
            }
          } else {
            setEventosAtleta([]);
          }
        } catch (e) {
          console.error("Falha ao carregar eventos/peneiras:", e);
          setEventosAtleta([]);
        }
        try {
          const resTreinos = await fetch(
            `${API.BASE_URL}/api/treinos/programados/disponiveis?alvoId=${encodeURIComponent(
              tipoUsuarioId || atletaId
            )}`,
            { headers }
          );

          if (resTreinos.ok) {
            const data = await resTreinos.json();
            const lista = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

            const normTreinos: TreinoProgramado[] = lista.map((t: any) => ({
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
          } else {
            setTreinos([]);
          }
        } catch (e) {
          console.error("Falha ao carregar treinos programados disponíveis:", e);
          setTreinos([]);
        }
      } else {
        setTreinosAgendados([]);
        setAgendaFromApi([]);
        setEventosAtleta([]);
      }
    };

    carregarUsuario();
    void carregar();
  }, []);

  useEffect(() => {
  const agora = Date.now();

  setTreinosAgendados((prev) =>
    prev.filter((t) => {
      const dataRef =
        t.dataTreino ??
        t.prazoEnvio ??
        t.dataExpiracao ??
        t.treinoProgramado?.dataAgendada ??
        null;

      if (!dataRef) return true;
      const ms = Date.parse(dataRef);
      if (!Number.isFinite(ms)) return true;

      return ms >= agora;
    })
  );
}, [statusPorTreino]);

  const isAtleta = tipoAtual === "atleta";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-emerald-100">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/feed")}
            className="flex items-center gap-1 text-emerald-800 text-sm font-medium"
          >
            <House className="w-4 h-4" />
            <span>Início</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarClock className="w-4 h-4 text-emerald-700" />
            <span>Agenda de treinos</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-400">
            <User className="w-3 h-3" />
            <span>{usuario?.tipo ?? "Visitante"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-10">
        <HealthBanner />

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-green-900 flex items-center gap-2">
              <SoccerFieldIcon className="w-6 h-6 text-emerald-700" />
              Meus treinos
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Acompanhe sua agenda, conclua treinos e veja o que vem pela frente.
            </p>
          </div>

          {isAtleta && (
            <button
              type="button"
              onClick={() => navigate("/treinos/novo")}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-700 text-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-emerald-800"
            >
              <CirclePlus className="w-4 h-4" />
              Agendar novo treino
            </button>
          )}
        </div>

        {isAtleta && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex items-center bg-white rounded-full p-1 border border-emerald-100 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewAtleta("lista")}
                  className={`px-3 py-1.5 text-xs rounded-full flex items-center gap-1 ${
                    viewAtleta === "lista"
                      ? "bg-emerald-700 text-white"
                      : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  <Volleyball className="w-3 h-3" />
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setViewAtleta("calendario")}
                  className={`px-3 py-1.5 text-xs rounded-full flex items-center gap-1 ${
                    viewAtleta === "calendario"
                      ? "bg-emerald-700 text-white"
                      : "text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  <BookMarked className="w-3 h-3" />
                  Calendário
                </button>
              </div>

              {agendaProximos7.length > 0 && (
                <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1 flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Próximos 7 dias: {agendaProximos7.length} atividade(s)
                </span>
              )}
            </div>

            {viewAtleta === "calendario" ? (
              <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-3 py-3">
                {semanasDesafio.length > 0 && <WeeklyChecker weeks={semanasDesafio} />}
                <CalendarAgenda items={agendaItemsAtleta} />
              </div>
            ) : (
              <section>
                {treinosAgendados.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    Nenhum treino agendado ainda.{" "}
                    <button
                      type="button"
                      onClick={() => navigate("treinos/novo")}
                      className="text-emerald-700 font-semibold underline underline-offset-2"
                    >
                      Agende seu primeiro treino
                    </button>
                    .
                  </div>
                ) : (
                  <div className="space-y-3">
                    {treinosAgendados.map((t) => {
                      const status = statusPorTreino[t.id]?.status as
                        | TreinoStatus
                        | undefined;
                      const tempo = elapsedByTreino[t.id] ?? 0;
                      const isCompleted = status === "COMPLETED";
                      const isInProgress = status === "IN_PROGRESS";
                      const jaEnviado = idsAgendadosSubmetidos.has(t.id);
                      const exercicios =
                        t.treinoProgramado?.exercicios?.map((e) => ({
                          id: e.exercicio.id,
                          nome: e.exercicio.nome,
                          repeticoes: e.repeticoes,
                        })) ?? [];

                      const checklist = checklistByTreino[t.id] ?? {};

                      const dataLabel = t.dataTreino
                        ? new Date(t.dataTreino).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "sem data definida";

                        const isExpired = status === "EXPIRED";

                        const midiaUrl =
                          t.treinoProgramado?.capaUrl ?? t.treinoProgramado?.videoUrl ?? null;
                        
                      const url = resolveUploadUrl(midiaUrl); 

                      return (
                        <div
                          key={t.id}
                          className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-sm font-semibold text-green-900">
                                  {t.titulo}
                                </h2>

                                {t.nivel && (
                                  <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5">
                                    {t.nivel}
                                  </Badge>
                                )}

                                {isExpired && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                                    Expirado
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-gray-500 flex items-center gap-1">
                                <CalendarClock className="w-3 h-3" />
                                <span>{dataLabel}</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {isInProgress && (
                                <div className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
                                  {formatHHMMSS(tempo)}
                                </div>
                              )}
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => cancelarTreinoAgendado(t.id)}
                                  className="p-1 rounded-full border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                                  title="Cancelar treino"
                                  disabled={isCompleted || jaEnviado}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>

                                {!status || status === "PENDING" ? (
                                  <button
                                    type="button"
                                    onClick={() => iniciar(t.id)}
                                    disabled={jaEnviado}
                                    className={`text-xs px-2 py-1 rounded-full ${
                                      jaEnviado
                                        ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : "bg-emerald-700 text-white hover:bg-emerald-800"
                                    }`}
                                  >
                                    {jaEnviado ? "Já enviado" : "Iniciar"}
                                  </button>
                                ) : isInProgress ? (
                                  <button
                                    type="button"
                                    onClick={() => finalizarEEnviar(t)}
                                    disabled={jaEnviado}
                                    className="text-xs px-2 py-1 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                                  >
                                    Enviar submissão
                                  </button>
                                ) : isCompleted ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CircleCheck className="w-3 h-3" />
                                    Concluído
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          
                          {url && (
                            <div className="mt-2 mb-1">
                              {isVideoUrl(url) ? (
                                <video
                                  src={url}
                                  controls
                                  className="w-full rounded-xl border border-gray-200 max-h-60 object-cover"
                                />
                              ) : (
                                <img
                                  src={url}
                                  alt={t.titulo}
                                  className="w-full rounded-xl border border-gray-200 max-h-60 object-cover"
                                />
                              )}
                            </div>
                          )}

                          {exercicios.length > 0 && (
                            <div className="mt-3 border-t border-gray-100 pt-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium text-gray-700">
                                  Checklist de exercícios
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      marcarTodos(
                                        t.id,
                                        exercicios.map((e) => e.id),
                                        true
                                      )
                                    }
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-800 bg-emerald-50"
                                  >
                                    Marcar tudo
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      marcarTodos(
                                        t.id,
                                        exercicios.map((e) => e.id),
                                        false
                                      )
                                    }
                                    className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-white"
                                  >
                                    Limpar
                                  </button>
                                </div>
                              </div>
                              <ul className="space-y-1">
                                {exercicios.map((ex) => (
                                  <li
                                    key={ex.id}
                                    className="flex items-center gap-2 text-xs text-gray-700"
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleItemChecklist(t.id, ex.id)
                                      }
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                                        checklist[ex.id]
                                          ? "bg-emerald-600 border-emerald-700 text-white"
                                          : "bg-white border-gray-300 text-transparent"
                                      }`}
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <span className="truncate">
                                      {ex.nome}
                                      {ex.repeticoes && (
                                        <span className="text-[10px] text-gray-500 ml-1">
                                          • {ex.repeticoes}
                                        </span>
                                      )}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              
            )}
            {treinos.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <Volleyball className="w-4 h-4 text-emerald-700" />
                  Treinos disponíveis para agendar
                </h2>

                <div className="space-y-2">
                  {treinos.map((t) => (
                    <div
                      key={t.id}
                      className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-green-900">
                              {t.nome}
                            </h3>
                            {t.nivel && (
                              <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] px-2 py-0.5">
                                {t.nivel}
                              </Badge>
                            )}
                          </div>

                          {t.objetivo && (
                            <p className="text-[11px] text-gray-600 mb-1">
                              {t.objetivo}
                            </p>
                          )}

                          {t.duracao && (
                            <p className="text-[11px] text-gray-500">
                              Duração estimada: {t.duracao} min
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            const dia = window.prompt(
                              "Escolha a data do treino (formato AAAA-MM-DD):",
                              new Date().toISOString().slice(0, 10)
                            );
                            if (!dia) return;

                            const iso = `${dia}T23:59:59.000Z`;
                            await agendarTreinoProgramado(t, iso);
                          }}
                          className="text-xs px-3 py-1.5 rounded-full bg-emerald-700 text-white hover:bg-emerald-800"
                        >
                          Agendar treino
                        </button>
                      </div>

                      {t.exercicios?.length > 0 && (
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          <p className="text-[11px] font-medium text-gray-700 mb-1">
                            Exercícios deste treino:
                          </p>
                          <ul className="space-y-0.5">
                            {t.exercicios.map((ex) => (
                              <li
                                key={ex.id}
                                className="text-[11px] text-gray-700 flex items-center gap-1"
                              >
                                <span>• {ex.nome}</span>
                                {ex.repeticoes && (
                                  <span className="text-[10px] text-gray-500">
                                    ({ex.repeticoes})
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </>
        )}

        {!isAtleta && (
          <div className="mt-6 bg-white rounded-2xl border border-emerald-100 shadow-sm px-4 py-6 text-sm text-gray-600">
            <p>
              Em breve, um painel específico de treinos para o tipo de usuário{" "}
              <strong>{usuario?.tipo ?? "atual"}</strong>.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Enquanto isso, você já pode criar treinos salvos e programados na aba
              correspondente do painel.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
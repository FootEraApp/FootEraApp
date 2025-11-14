// client/src/pages/treinos/treinos-atletas.tsx
import React, { useEffect, useRef, useState, type SVGProps } from "react";
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
  ChevronDown,
  ChevronUp,
  Play,
  MoreVertical,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";

/* ===================== Tipos ===================== */
type TreinoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string | null;
  dataExpiracao?: string | null;
  nivel?: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  // novos do backend:
  meuStatus?: TreinoStatus | string;
  startedAt?: string | null;
  completedAt?: string | null;
  submissao?: { enviados: number; aprovados: number; feito: boolean } | null;
  treinoProgramado?: {
    id?: string;
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
type Checklist = Record<string, boolean>;
type WeekStatus = {
  index: number;
  start: string;
  end: string;
  status: "success" | "fail" | "none";
  count: { total: number; approved: number; rejected: number };
};
type MinhasSubTreino = {
  id: string;
  treinoAgendadoId: string | null;
  treinoProgramadoId: string | null;
  aprovado: boolean | null;
};

/* ===================== Helpers ===================== */
const PLACEHOLDER_USER = "/assets/default-user.png";
const TIMER_KEY = (treinoAgendadoId: string) => `footera:treinoTimerStart:${treinoAgendadoId}`;
const CHECKLIST_KEY = (treinoAgendadoId: string) => `footera:treinoChecklist:${treinoAgendadoId}`;

const VISIBLE_TREINOS = 6;
const ROW_ESTIMATE_PX = 72;
const DESAFIOS_MAX_PX = 240;

function formatHHMMSS(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
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
function isYouTubeUrl(u?: string | null) {
  if (!u) return false;
  return /(?:youtube\.com|youtu\.be)/i.test(u);
}
function toYouTubeEmbed(u: string) {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v") || "";
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shorts = url.pathname.match(/\/shorts\/([^/]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
  } catch {}
  return u;
}
function SoccerFieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="2.25" />
      <rect x="3" y="8.5" width="4" height="7" rx="0.5" />
      <rect x="17" y="8.5" width="4" height="7" rx="0.5" />
    </svg>
  );
}
const getToken = () =>
  (Storage as any).token ?? localStorage.getItem("token") ?? sessionStorage.getItem("token") ?? "";
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
function buildMonthBuckets(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const toISO = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
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
    const idx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
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
  return buckets.map((b) => ({ index: b.index, start: b.start, end: b.end, status: b.status, count: b.count }));
}
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
              title={`Semana ${w.index} (${new Date(w.start).toLocaleDateString("pt-BR")} – ${new Date(
                new Date(w.end).getTime() - 1,
              ).toLocaleDateString("pt-BR")}) • ${w.count.approved} aprov., ${w.count.rejected} reprov.`}
            >
              {w.status === "success" ? <Check className="w-5 h-5" /> : w.status === "fail" ? <X className="w-5 h-5" /> : <span className="text-xs">{w.index}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// date utils
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const sameDay = (a?: Date | null, b?: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ===================== Página (Atleta) ===================== */
export default function TreinosAtletas() {
  const [, navigate] = useLocation();

  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [semanasDesafio, setSemanasDesafio] = useState<WeekStatus[]>([]);
  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<Set<string>>(new Set());

  const [statusPorTreino, setStatusPorTreino] = useState<Record<string, { status: TreinoStatus | string; startedAt?: string | null; completedAt?: string | null }>>({});
  const [checklistByTreino, setChecklistByTreino] = useState<Record<string, Checklist>>({});
  const [elapsedByTreino, setElapsedByTreino] = useState<Record<string, number>>({});
  const tickRef = useRef<number | null>(null);

  // faixa/expansão
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // full-screen de treino
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);

  // menu (3 pontinhos) no header do fullscreen
  const [menuOpen, setMenuOpen] = useState(false);

  // modal de vídeo por exercício
  const [videoModal, setVideoModal] = useState<{ exercicioId: string; nome: string; url: string } | null>(null);
  const [videoCarregando, setVideoCarregando] = useState(false);
  const [videoErro, setVideoErro] = useState<string | null>(null);

  // compartilhar desafio
  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  // ===== helpers de identidade/role
  const tipo = String((Storage as any).tipoSalvo ?? localStorage.getItem("tipo") ?? "").toLowerCase();
  const canVerElenco = ["professor", "clube", "escolinha"].includes(tipo);
  const isOlheiro = tipo === "olheiro";

  // ===== medidas para card rolável =====
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const agendadosCardRef = useRef<HTMLDivElement | null>(null);
  const [agendadosMaxH, setAgendadosMaxH] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const calc = () => {
      if (!agendadosCardRef.current) return;
      const rect = agendadosCardRef.current.getBoundingClientRect();
      const bottomH = bottomNavRef.current?.offsetHeight ?? 64;
      const reserveDesafios = FLAGS.DESAFIOS_ENABLED ? (DESAFIOS_MAX_PX + 16) : 0;
      const available = Math.floor(window.innerHeight - rect.top - bottomH - 16 - reserveDesafios);
      const capByRows = VISIBLE_TREINOS * ROW_ESTIMATE_PX;
      setAgendadosMaxH(Math.max(200, Math.min(available, capByRows)));
    };
    calc();
    window.addEventListener("resize", calc);
    const i = window.setInterval(calc, 400);
    return () => {
      window.removeEventListener("resize", calc);
      window.clearInterval(i);
    };
  }, [treinosAgendados.length, desafios.length]);

  // ---------- carregamento inicial ----------
  useEffect(() => {
    const token = (Storage as any).token ?? localStorage.getItem("token");
    const atletaId =
      (Storage as any).tipoUsuarioId ||
      (Storage as any).atletaId ||
      localStorage.getItem("tipoUsuarioId") ||
      null;
    const usuarioId =
      (Storage as any).usuarioId ||
      localStorage.getItem("usuarioId") ||
      null;

    if (!token) return;

    (async () => {
      // minhas submissões (fallback)
      try {
        const urls: string[] = [];
        if (atletaId) urls.push(`${API.BASE_URL}/api/treinos/minhas-submissoes?atletaId=${encodeURIComponent(atletaId)}`);
        if (atletaId) urls.push(`${API.BASE_URL}/api/treinos/minhas-submissoes?tipoUsuarioId=${encodeURIComponent(atletaId)}`);
        if (usuarioId) urls.push(`${API.BASE_URL}/api/treinos/minhas-submissoes?usuarioId=${encodeURIComponent(usuarioId)}`);

        for (const u of urls) {
          const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) continue;
          const payload = await r.json().catch(() => null);
          const arr: MinhasSubTreino[] =
            Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.data)
              ? payload.data
              : Array.isArray(payload?.items)
              ? payload.items
              : [];
          if (arr.length > 0) {
            const setAg = new Set<string>();
            for (const s of arr) {
              if (s.treinoAgendadoId && s.aprovado === true) {
                setAg.add(s.treinoAgendadoId);
              }
            }
            setIdsAgendadosSubmetidos(setAg);
            break;
          }
        }
      } catch {}

      // treinos agendados (agora com status e submissões do backend)
      try {
        const urls: string[] = [];
        if (atletaId) urls.push(`${API.BASE_URL}/api/treinos/agendados?atletaId=${encodeURIComponent(atletaId)}`);
        if (atletaId) urls.push(`${API.BASE_URL}/api/treinos/agendados?tipoUsuarioId=${encodeURIComponent(atletaId)}`);
        if (usuarioId) urls.push(`${API.BASE_URL}/api/treinos/agendados?usuarioId=${encodeURIComponent(usuarioId)}`);

        let normalizados: TreinoAgendado[] = [];
        for (const u of Array.from(new Set(urls))) {
          const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) continue;
          const js = await r.json().catch(() => null);
          const list: any[] =
            Array.isArray(js)
              ? js
              : Array.isArray(js?.data)
              ? js.data
              : Array.isArray(js?.items)
              ? js.items
              : [];
          if ((list?.length ?? 0) > 0) {
            normalizados = list.map((t: any) => ({
              id: t.id,
              titulo: t.titulo,
              dataTreino: t.dataTreino ?? null,
              prazoEnvio: t.prazoEnvio ?? t.dataExpiracao ?? t.dataTreino ?? t.treinoProgramado?.dataAgendada ?? null,
              nivel: t.nivel ?? t.treinoProgramado?.nivel ?? null,
              duracaoMinutos: t.duracaoMinutos ?? t.treinoProgramado?.duracao ?? null,
              treinoProgramado: t.treinoProgramado ?? null,
              // novos
              meuStatus: t.meuStatus ?? t.status ?? "PENDING",
              startedAt: t.startedAt ?? null,
              completedAt: t.completedAt ?? null,
              submissao: t.submissao ?? { enviados: 0, aprovados: 0, feito: false },
            }));
            break;
          }
        }

        setTreinosAgendados(normalizados);

        // popular statusPorTreino a partir do backend (sem chamar /status N vezes)
        setStatusPorTreino((prev) => {
          const next = { ...prev };
          for (const t of normalizados) {
            next[t.id] = {
              status: (t.meuStatus as TreinoStatus) || "PENDING",
              startedAt: t.startedAt ?? null,
              completedAt: t.completedAt ?? null,
            };
          }
          return next;
        });

        // setar submetidos a partir dos counts do backend
        const setSub = new Set<string>();
        for (const t of normalizados) {
          if (t.submissao?.aprovados! > 0 || t.submissao?.feito) setSub.add(t.id);
        }
        if (setSub.size > 0) setIdsAgendadosSubmetidos(setSub);
      } catch {
        setTreinosAgendados([]);
      }

      // desafios + semanas
      if (FLAGS.DESAFIOS_ENABLED) {
        try {
          const baseQs = atletaId ? `tipoUsuarioId=${encodeURIComponent(atletaId)}` : usuarioId ? `usuarioId=${encodeURIComponent(usuarioId)}` : "";
          const resDesafios = await fetch(`${API.BASE_URL}/api/desafios${baseQs ? `?${baseQs}` : ""}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const js = await resDesafios.json().catch(() => null);
          const list = Array.isArray(js) ? js : Array.isArray(js?.data) ? js.data : Array.isArray(js?.items) ? js.items : [];
          setDesafios(list ?? []);
        } catch {
          setDesafios([]);
        }

        try {
          const baseQs = atletaId ? `tipoUsuarioId=${encodeURIComponent(atletaId)}` : usuarioId ? `usuarioId=${encodeURIComponent(usuarioId)}` : "";
          const resSem = await fetch(`${API.BASE_URL}/api/treinos/desafios-semanais${baseQs ? `?${baseQs}` : ""}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
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
    })();
  }, []);

  // NÃO precisamos mais forçar carregar /status para todos;
  // se algum vier sem meuStatus (improvável), ainda dá pra tentar:
  useEffect(() => {
    const faltando = treinosAgendados.filter((t) => !t.meuStatus);
    if (faltando.length === 0) return;
    faltando.forEach((t) => carregarStatus(t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treinosAgendados]);

  // carrega status de um treino (fallback apenas)
  async function carregarStatus(id: string) {
    const token = getToken();
    if (!token) return;
    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/${id}/status`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const js = await r.json();
        setStatusPorTreino((prev) => ({ ...prev, [id]: js }));
      }
    } catch {}
  }

  // ticking do timer (usa startedAt vindo do backend quando IN_PROGRESS)
  useEffect(() => {
    const inProgressIds = Object.keys(statusPorTreino).filter(
      (id) => (statusPorTreino[id]?.status as TreinoStatus | undefined) === "IN_PROGRESS",
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
          const startedIso = (st?.startedAt as string | undefined) ?? localStorage.getItem(TIMER_KEY(id)) ?? undefined;
          const startedMs = startedIso ? Date.parse(startedIso) : NaN;
          if (Number.isFinite(startedMs)) next[id] = Math.max(0, Math.floor((now - startedMs) / 1000));
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

  // checklist por treino
  const carregarChecklist = (treinoId: string, exerciciosIds: string[]) => {
    try {
      const raw = getStore().getItem(CHECKLIST_KEY(treinoId));
      const parsed = raw ? (JSON.parse(raw) as Checklist) : {};
      const filled: Checklist = { ...parsed };
      for (const id of exerciciosIds) if (typeof filled[id] !== "boolean") filled[id] = false;
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

  useEffect(() => {
    const next: Record<string, Checklist> = {};
    for (const t of treinosAgendados) {
      const exIds = (t.treinoProgramado?.exercicios ?? []).map((e) => e.exercicio.id);
      next[t.id] = carregarChecklist(t.id, exIds);
    }
    setChecklistByTreino(next);
  }, [treinosAgendados]);

  // ---------- ações do atleta ----------
  async function iniciar(treinoAgendadoId: string) {
    const token = getToken();
    if (!token) return alert("Sessão expirada. Faça login novamente.");

    const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Falha ao iniciar treino:", r.status, txt);
      alert(r.status === 401 ? "Sessão expirada. Faça login novamente." : "Não foi possível iniciar o treino.");
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
      [treinoAgendadoId]: { ...(prev[treinoAgendadoId] ?? {}), status: "IN_PROGRESS", startedAt: startedAtIso },
    }));
  }

  async function concluir(
    treinoAgendadoId: string,
    payload?: { observacao?: string; duracaoMinutos?: number; tempoSeg?: number; repeticoes?: number },
  ) {
    const token = getToken();
    if (!token) return alert("Sessão expirada. Faça login novamente.");

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${treinoAgendadoId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ treinoAgendadoId, ...(payload || {}) }),
      });

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("Falha ao concluir treino:", r.status, txt);
        return alert("Não foi possível concluir o treino.");
      }

      setStatusPorTreino((prev) => ({
        ...prev,
        [treinoAgendadoId]: { ...(prev[treinoAgendadoId] ?? {}), status: "COMPLETED", completedAt: new Date().toISOString() },
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

  async function finalizarEEnviar(treino: TreinoAgendado) {
    const elapsed = elapsedByTreino[treino.id] ?? 0;
    if (!statusPorTreino[treino.id] || statusPorTreino[treino.id]?.status !== "IN_PROGRESS") {
      alert("Inicie o treino antes de finalizar.");
      return;
    }
    const usarCamera = window.confirm("Quer gravar agora com a câmera? (OK=câmera • Cancelar=galeria)");
    const qs = new URLSearchParams({ treinoAgendadoId: treino.id, tempoSeg: String(elapsed), mode: usarCamera ? "camera" : "galeria" });
    navigate(`/submissao?${qs.toString()}`);
  }

  async function removerTreinoAgendado(id: string) {
    const token = Storage.token;
    if (!token) return alert("Sessão expirada.");
    if (!confirm("Remover este treino dos seus treinos?")) return;

    try {
      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao excluir:", res.status, txt);
        return alert("Não foi possível excluir.");
      }
      setTreinosAgendados((prev) => prev.filter((t) => t.id !== id));
      if (fullscreenId === id) setFullscreenId(null);
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao excluir.");
    }
  }

  // Remarcar (≤ 7 dias)
  async function remarcarTreino(t: TreinoAgendado) {
    const token = getToken();
    const atletaId = (Storage as any).tipoUsuarioId || (Storage as any).atletaId || localStorage.getItem("tipoUsuarioId");
    if (!token || !atletaId) return alert("Sessão expirada.");

    const baseDate = t.dataTreino ? new Date(t.dataTreino) : null;
    const sugest = baseDate ? baseDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const novoStr = window.prompt("Nova data (YYYY-MM-DD) • limite de 7 dias do original:", sugest);
    if (!novoStr) return;

    const novoDate = new Date(novoStr);
    if (Number.isNaN(+novoDate)) return alert("Data inválida.");
    if (!t.treinoProgramado) return alert("Treino base não encontrado para remarcação.");

    if (baseDate) {
      const deltaDays = Math.ceil(Math.abs(+novoDate - +baseDate) / 86400000);
      if (deltaDays > 7) return alert("Só é permitido remarcar em até 7 dias do treino original.");
    }

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          atletaId,
          treinoProgramadoId: (t as any)?.treinoProgramado?.id || (t as any)?.treinoProgramadoId,
          dataTreino: novoDate.toISOString(),
          titulo: t.titulo,
        }),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.error("Falha ao remarcar:", r.status, txt);
        return alert("Não foi possível remarcar (máximo 7 dias do original).");
      }
      alert("Treino remarcado!");
      setTreinosAgendados((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, dataTreino: novoDate.toISOString() } : x)),
      );
    } catch (e) {
      console.error(e);
      alert("Erro ao remarcar.");
    }
  }

  // ---------- carregar vídeo do exercício ----------
  async function abrirVideoDoExercicio(exercicioId: string, nome: string) {
    setVideoErro(null);
    setVideoCarregando(true);
    const token = getToken();

    async function buscarUrlViaExercicio(): Promise<string | null> {
      try {
        const r = await fetch(`${API.BASE_URL}/api/exercicios/${encodeURIComponent(exercicioId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) return null;
        const js = await r.json();
        const pick =
          js?.videoDemonstrativoUrl ||
          js?.videoUrl ||
          js?.url ||
          js?.midiaUrl ||
          js?.arquivoUrl ||
          js?.link ||
          js?.media?.url ||
          null;
        return pick ? resolveUploadUrl(String(pick)) : null;
      } catch {
        return null;
      }
    }
    async function buscarUrlViaVideos(): Promise<string | null> {
      try {
        const r = await fetch(`${API.BASE_URL}/api/videos?exercicioId=${encodeURIComponent(exercicioId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!r.ok) return null;
        const js = await r.json();
        const list = Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : [];
        if (!list.length) return null;
        const first = list[0];
        const pick =
          first?.videoDemonstrativoUrl ||
          first?.videoUrl ||
          first?.url ||
          first?.midiaUrl ||
          first?.arquivoUrl ||
          first?.link ||
          first?.media?.url ||
          null;
        return pick ? resolveUploadUrl(String(pick)) : null;
      } catch {
        return null;
      }
    }

    const viaEx = await buscarUrlViaExercicio();
    const url = viaEx || (await buscarUrlViaVideos());

    setVideoCarregando(false);
    if (!url) {
      setVideoErro("Não encontramos o vídeo deste exercício.");
      setVideoModal({ exercicioId, nome, url: "" });
      return;
    }
    setVideoModal({ exercicioId, nome, url });
  }

  // ---------- compartilhar desafio ----------
  async function carregarUsuariosMutuos() {
    const token = Storage.token;
    setCarregandoMutuos(true);
    try {
      const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erro ao buscar usuários mútuos");
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
    const token = Storage.token;
    try {
      setEnviandoDM(true);
      await Promise.all(
        Array.from(selecionados).map((paraId) =>
          fetch(`${API.BASE_URL}/api/mensagem`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paraId, conteudo: desafioParaCompartilhar, tipo: "DESAFIO" }),
          }),
        ),
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

  const formatarDataHora = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "");
  const formatarData = (data?: string | null) => (data ? new Date(data).toLocaleDateString("pt-BR") : "");

  // ===================== Cálculo de Status / Mês =====================
  const now = new Date();
  const hoje = startOfDay(now);

  const ordenados = [...treinosAgendados].sort((a, b) => {
    const ad = a.dataTreino ? +new Date(a.dataTreino) : 0;
    const bd = b.dataTreino ? +new Date(b.dataTreino) : 0;
    return ad - bd;
  });

  type TileInfo = {
    id: string;
    date: Date | null;
    titulo: string;
    statusClass: string;
    borderClass: string;
    dotClass: string;
    label: string;
    isToday: boolean;
    isMissed: boolean;
  };

function computeTile(t: TreinoAgendado): TileInfo {
  const d = t.dataTreino ? new Date(t.dataTreino) : null;

  // status vindo do backend
  const st = statusPorTreino[t.id]?.status as TreinoStatus | undefined;

  // se tem submissão aprovada ou já marcada como "feito"
  const submitted =
    (t.submissao?.aprovados ?? 0) > 0 ||
    idsAgendadosSubmetidos.has(t.id) ||
    t.submissao?.feito === true;

  const hojeFlag = d ? sameDay(d, hoje) : false;

  // 💥 REGRA NOVA: "faltou" = dia do treino já passou e não houve submissão/conclusão
  const diaPassou = d ? endOfDay(d) < now : false;

  // caso o backend marque como EXPIRED no futuro, também conta como faltou
  const expiradoBackend =
    (st as string) === "EXPIRED" ||
    (t as any).execucaoStatus === "EXPIRED";

  const missed = !submitted && (diaPassou || expiradoBackend) && st !== "COMPLETED";

  let statusClass = "bg-gray-100 text-gray-700";
  let borderClass = "border-gray-200";
  let dotClass = "bg-gray-400";
  let label = "Pendente";

  if (submitted) {
    statusClass = "bg-emerald-100 text-emerald-800";
    borderClass = "border-emerald-200";
    dotClass = "bg-emerald-500";
    label = "Submetido";
  } else if (st === "COMPLETED") {
    statusClass = "bg-rose-100 text-rose-800";
    borderClass = "border-rose-200";
    dotClass = "bg-rose-500";
    label = "Concluído";
  } else if (missed) {
    statusClass = "bg-red-200 text-red-900";
    borderClass = "border-red-300";
    dotClass = "bg-red-600";
    label = "Faltou";
  } else if (st === "IN_PROGRESS") {
    statusClass = "bg-blue-100 text-blue-800";
    borderClass = "border-blue-200";
    dotClass = "bg-blue-500";
    label = "Em progresso";
  }

  return {
    id: t.id,
    date: d,
    titulo: t.titulo,
    statusClass,
    borderClass,
    dotClass,
    label,
    isToday: hojeFlag,
    isMissed: missed,
  };
}



  const tiles: TileInfo[] = ordenados.map(computeTile);

useEffect(() => {
  if (!tiles.length) return;

  const todayTile = tiles.find((x) => x.isToday);
  if (!todayTile) return;

  const el = document.getElementById(`tile-${todayTile.id}`);

  setExpandedId(todayTile.id);

  if (el && stripRef.current) {
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}, [tiles.length, tiles]);

  // ===================== UI: detalhes do treino (conteúdo do full-screen) =====================
  const renderTreinoDetalhesConteudo = (treino: TreinoAgendado) => {
    const programado = treino.treinoProgramado;
    const nivel = treino.nivel ?? treino.treinoProgramado?.nivel ?? "-";
    const prazoIso = treino.prazoEnvio ?? treino.dataTreino ?? treino.treinoProgramado?.dataAgendada ?? null;
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
      <>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {prazoIso && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white border text-gray-700">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatarDataHora(prazoIso)}
            </span>
          )}
          <span className="text-sm text-gray-600">Nível: {nivel}</span>
          {treino.dataTreino && <span className="text-sm text-gray-600">Data: {formatarData(treino.dataTreino)}</span>}
          {typeof pontos === "number" && pontos > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">+{pontos} pts</span>
          )}
        </div>

        {programado?.descricao && <p className="text-sm text-gray-700 mt-3">{programado.descricao}</p>}
        {programado?.objetivo && <p className="text-sm text-gray-700">{`Objetivo: ${programado.objetivo}`}</p>}

        {exercicios.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <strong className="text-sm text-gray-800">Exercícios</strong>
              <div className="text-xs text-gray-600">
                Progresso: <span className={`font-semibold ${allChecked ? "text-emerald-700" : "text-gray-800"}`}>{done}/{total}</span>
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto mt-1 bg-gray-50 border rounded p-2 text-sm space-y-1">
              {exercicios.map((ex, i) => {
                const id = ex.exercicio.id;
                const checked = !!ck[id];
                return (
                  <div key={id} className="flex items-start gap-2 border-b pb-2 last:border-b-0 min-w-0">
                    {/* checkbox */}
                    <label className="cursor-pointer select-none flex items-start gap-2 flex-1 min-w-0" title={ex.exercicio.nome}>
                      <input
                        type="checkbox"
                        id={`ex-${id}`}
                        name={`ex-${id}`}
                        aria-label={`Marcar exercício ${ex.exercicio.nome}`}
                        checked={checked}
                        onChange={() => toggleItemChecklist(treino.id, id)}
                        className="sr-only peer"
                      />
                      <span
                        className="mt-0.5 relative h-5 w-5 rounded-md border-2 border-emerald-600 bg-white flex items-center justify-center transition-all duration-150
                                   peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-400/60 peer-checked:border-emerald-700
                                   peer-checked:[&>svg]:opacity-100 peer-checked:[&>svg]:scale-100"
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="absolute h-3.5 w-3.5 text-emerald-700 opacity-0 scale-75 transition duration-150 pointer-events-none"
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium shrink-0">{i + 1}.</span>
                          <span className={`flex-1 basis-0 min-w-0 truncate ${checked ? "line-through text-gray-500" : ""}`}>
                            {ex.exercicio.nome}
                          </span>
                          {!!ex.repeticoes && (
                            <span className="text-[11px] text-gray-500 shrink-0 whitespace-nowrap">({ex.repeticoes})</span>
                          )}
                        </div>
                      </div>
                    </label>

                    {/* botão play */}
                    <button
                      onClick={() => abrirVideoDoExercicio(id, ex.exercicio.nome)}
                      className="shrink-0 inline-flex items-center justify-center p-2 rounded-md bg-white border hover:bg-gray-50"
                      title="Assistir como fazer"
                      aria-label="Assistir vídeo do exercício"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {st === "IN_PROGRESS" && (
              <div className="mt-3 flex items-center gap-2">
                <button onClick={() => marcarTodos(treino.id, exIds, true)} className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                  Marcar todos
                </button>
                <button onClick={() => limparChecklist(treino.id)} className="text-xs px-2.5 py-1 rounded bg-white border text-gray-700 hover:bg-gray-50">
                  Limpar checklist
                </button>
              </div>
            )}
          </div>
        )}

        {/* Ações do treino (escondidas no fullscreen; a barra fixa cuida disso) */}
        {fullscreenId !== treino.id && (
          <div className="mt-5 flex flex-wrap items-center gap-2 justify-end">
            {(!statusPorTreino[treino.id] || statusPorTreino[treino.id]?.status === "PENDING") && (
              <>
                <button onClick={() => iniciar(treino.id)} className="bg-green-700 text-white px-3 py-2 rounded-lg">
                  Iniciar
                </button>
                <button onClick={() => remarcarTreino(treino)} className="border px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50">
                  Remarcar (≤ 7 dias)
                </button>
              </>
            )}

            {statusPorTreino[treino.id]?.status === "IN_PROGRESS" && (
              <>
                <button onClick={() => marcarTodos(treino.id, exIds, true)} className="text-xs px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                  Marcar todos
                </button>
                <button onClick={() => limparChecklist(treino.id)} className="text-xs px-2.5 py-1 rounded bg-white border text-gray-700 hover:bg-gray-50">
                  Limpar
                </button>

                <button
                  onClick={() => finalizarEEnviar(treino)}
                  disabled={(treino.treinoProgramado?.exercicios?.length ?? 0) > 0 && !((treino.treinoProgramado?.exercicios ?? []).every((e) => (checklistByTreino[treino.id] ?? {})[e.exercicio.id]))}
                  className={`ml-auto px-3 py-2 rounded-lg text-white ${
                    (treino.treinoProgramado?.exercicios?.length ?? 0) > 0 &&
                    !((treino.treinoProgramado?.exercicios ?? []).every((e) => (checklistByTreino[treino.id] ?? {})[e.exercicio.id]))
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                  title="Finalizar e enviar submissão"
                >
                  Finalizar e enviar
                </button>
              </>
            )}

            {statusPorTreino[treino.id]?.status === "COMPLETED" && (
              <>
                <span className="text-sm px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Concluído</span>
                {!jaSubmetido && (
                  <button onClick={() => navigate(`/submissao?treinoAgendadoId=${treino.id}`)} className="bg-green-800 hover:bg-green-900 text-white px-3 py-2 rounded-lg">
                    Fazer Submissão
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Remover (escondido no fullscreen) */}
        {fullscreenId !== treino.id && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => removerTreinoAgendado(treino.id)}
              title="Remover treino"
              className="shrink-0 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 inline-flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remover
            </button>
          </div>
        )}
      </>
    );
  };

  // ===================== Render =====================
  return (
    <div className="min-h-screen bg-neutral-50 pb-24 overflow-hidden">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4 overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>

        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold text-green-900">Treinos</div>

            {canVerElenco && (
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

        {/* Ações rápidas */}
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
            <h3 className="text-lg font-semibold">Meus Treinos</h3>

            <div className="flex flex-wrap items-center gap-2">
              <button className="bg-green-800 text-white px-4 py-2 rounded-lg text-sm" onClick={() => navigate("/treinos/novo")}>
                Agendar novo treino
              </button>

              <button className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm" onClick={() => navigate("/treinos/livre/novo")}>
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

          {/* Faixa mensal */}
          {tiles.length > 0 && (
            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollBehavior: "smooth" }}
            >
{tiles.map((tl) => {
  const disabled = tl.isMissed;

  return (
    <button
      id={`tile-${tl.id}`}
      key={tl.id}
      onClick={() => {
        if (disabled) return;
        setExpandedId((prev) => (prev === tl.id ? null : tl.id));
        setFullscreenId(tl.id);
        setMenuOpen(false);
      }}
      className={`snap-center shrink-0 min-w-[180px] max-w-[220px] text-left rounded-xl border px-3 py-2 ${
        tl.statusClass
      } ${tl.borderClass} ${disabled ? "cursor-default" : "hover:opacity-95"}`}
      aria-disabled={disabled}
      title={tl.titulo}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${tl.dotClass}`} />
          <span className="font-semibold text-sm">
            {tl.date ? tl.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}
          </span>
          {tl.isToday && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 border">Hoje</span>
          )}
        </div>
        {expandedId === tl.id && !disabled ? (
          <ChevronUp className="w-4 h-4 opacity-70" />
        ) : (
          <ChevronDown className="w-4 h-4 opacity-70" />
        )}
      </div>
      <div className="mt-1 text-sm line-clamp-2">{tl.titulo}</div>
      <div className="mt-1 text-[11px] opacity-80">{tl.label}</div>
    </button>
  );
})}
            </div>
          )}
        </div>

        {/* Treinos agendados */}
        <div ref={agendadosCardRef} className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
          <h3 className="text-lg font-semibold mb-3">Treinos agendados</h3>

          <div
            className="overflow-y-auto overscroll-contain -mr-2 pr-2"
            style={{ maxHeight: agendadosMaxH ? `${agendadosMaxH}px` : undefined }}
          >
            {ordenados.length === 0 ? (
              <p className="text-gray-500">Nenhum treino disponível ainda.</p>
            ) : (
              <ul className="divide-y">
{ordenados.map((t) => {
  const d = t.dataTreino ? new Date(t.dataTreino) : null;
  const isHoje = d ? sameDay(d, hoje) : false;
  const diaStr = d ? String(d.getDate()).padStart(2, "0") : "—";
  const subtitulo =
    d ? d.toLocaleDateString("pt-BR", { weekday: "short", month: "short" }) : "Sem data";

  // ===== mesma lógica do computeTile =====
  const st = statusPorTreino[t.id]?.status as TreinoStatus | undefined;

  const submitted =
    (t.submissao?.aprovados ?? 0) > 0 ||
    idsAgendadosSubmetidos.has(t.id) ||
    t.submissao?.feito === true;

  const diaPassou = d ? endOfDay(d) < now : false;
  const expiradoBackend =
    (st as string) === "EXPIRED" ||
    (t as any).execucaoStatus === "EXPIRED";

  const isMissedTreino =
    !submitted && (diaPassou || expiradoBackend) && st !== "COMPLETED";

  // classes do círculo
  let circleClass =
    "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-gray-50 border-gray-300 text-gray-800";
  let titleClass = "font-medium truncate text-gray-900";

  if (submitted || st === "COMPLETED") {
    // VERDE: treino feito / submetido
    circleClass =
      "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-emerald-50 border-emerald-300 text-emerald-800";
    titleClass = "font-medium truncate text-emerald-800";
  } else if (isMissedTreino) {
    // VERMELHO: faltou
    circleClass =
      "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-red-50 border-red-300 text-red-700";
    titleClass = "font-medium truncate text-red-700";
  } else if (isHoje) {
    // hoje, mas ainda pendente -> só um anel, mantém cinza
    circleClass += " ring-2 ring-emerald-300";
  }

  return (
    <li key={t.id} className="py-2">
      <button
        onClick={() => {
          if (isMissedTreino) return; // treino perdido não abre mais
          setFullscreenId(t.id);
          setMenuOpen(false);
        }}
        aria-label="Expandir treino"
        aria-disabled={isMissedTreino}
        className={`w-full flex items-center justify-between gap-3 text-left ${
          isMissedTreino ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Círculo com dia */}
          <div className={circleClass}>
            {diaStr}
          </div>

          {/* Título + subtítulo */}
          <div className="min-w-0">
            <div className={titleClass}>{t.titulo}</div>
            <div className="text-xs text-gray-500">{subtitulo}</div>
          </div>
        </div>

        <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
      </button>
    </li>
  );
})}

              </ul>
            )}
          </div>
        </div>

        {/* Desafios */}
        {FLAGS.DESAFIOS_ENABLED && (
          <div
            className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mt-6"
            style={{ maxHeight: DESAFIOS_MAX_PX, overflowY: "auto" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Desafios</h3>
              <div className="ml-3 shrink-0 [&>div]:mb-0 [&>div>div:first-child]:hidden">
                <WeeklyChecker weeks={semanasDesafio} />
              </div>
            </div>

            {desafios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {desafios.map((desafio) => (
                  <div key={desafio.id} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-300/60 mb-3">
                    <h4 className="font-bold text-yellow-700 text-lg mb-1">
                      <Link href={`/desafios/${desafio.id}`} className="hover:underline">
                        {desafio.titulo}
                      </Link>
                    </h4>

                    <p className="text-sm text-gray-600 mb-2">{desafio.descricao}</p>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span>Nível: {desafio.nivel}</span>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">{desafio.pontuacao} pts</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => navigate(`/submissao?desafioId=${desafio.id}`)}
                        className="w-full whitespace-nowrap text-[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-800 hover:bg-green-900 text-white"
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
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhum desafio disponível no momento.</p>
            )}
          </div>
        )}
      </div>

      {/* bottom nav */}
      <nav
        ref={bottomNavRef}
        className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]"
      >
        <Link href="/feed" className="hover:opacity-90" aria-label="Feed">
          <House />
        </Link>
        <Link href="/explorar" className="hover:opacity-90" aria-label="Explorar">
          <Search />
        </Link>
        <Link href="/post" className="hover:opacity-90" aria-label="Novo post">
          <CirclePlus />
        </Link>
        <Link href={isOlheiro ? "/olheiros" : "/treinos"} className="hover:opacity-90" aria-label="Treinos">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:opacity-90" aria-label="Perfil">
          <User />
        </Link>
      </nav>

      {/* ==== FULL-SCREEN DO TREINO ==== */}
      {fullscreenId && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          {/* header */}
          <div className="sticky top-0 z-10 px-4 py-3 border-b bg-white/95 backdrop-blur">
            {(() => {
              const atual = ordenados.find((t) => t.id === fullscreenId);
              const st = fullscreenId ? (statusPorTreino[fullscreenId]?.status as TreinoStatus | undefined) : undefined;
              const elapsed = fullscreenId ? (elapsedByTreino[fullscreenId] ?? 0) : 0;

              // para habilitar/desabilitar “Finalizar” no menu
              const exList = (atual?.treinoProgramado?.exercicios ?? []);
              const exIds = exList.map((e) => e.exercicio.id);
              const ck = fullscreenId ? (checklistByTreino[fullscreenId] ?? {}) : {};
              const total = exIds.length;
              const allChecked = total > 0 && exIds.every((id) => ck[id]);

              return (
                <div className="relative flex items-center gap-3">
                  {/* Timer gigante central sobrepondo o header quando em progresso */}
                  {st === "IN_PROGRESS" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className="font-mono font-black text-4xl sm:text-5xl leading-none tracking-[.15em] text-emerald-700 drop-shadow-sm"
                        aria-live="polite"
                      >
                        {formatHHMMSS(elapsed)}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setMenuOpen(false); setFullscreenId(null); }}
                    className="inline-flex items-center justify-center p-2 rounded-md border bg-white hover:bg-gray-50 relative z-10"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Título aparece somente quando NÃO está em progresso */}
                  <div className="flex-1 min-w-0 text-center relative z-0">
                    {st !== "IN_PROGRESS" && (
                      <div className="text-base sm:text-lg font-semibold text-green-900 truncate max-w-[70vw] mx-auto">
                        {atual?.titulo ?? "Treino"}
                      </div>
                    )}
                  </div>

                  {/* 3 pontinhos */}
                  <div className="relative z-10">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="inline-flex items-center justify-center p-2 rounded-md border bg-white hover:bg-gray-50"
                      aria-label="Mais opções"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10 overflow-hidden">
                        {/* Finalizar (se em progresso) */}
                        {st === "IN_PROGRESS" && (
                          <button
                            onClick={() => { setMenuOpen(false); if (atual) finalizarEEnviar(atual); }}
                            disabled={(total > 0) && !allChecked}
                            className={`w-full text-left px-3 py-2 text-sm ${((total > 0) && !allChecked) ? "text-gray-400 cursor-not-allowed" : "hover:bg-gray-50"}`}
                          >
                            Finalizar e enviar
                          </button>
                        )}

                        <button
                          onClick={() => { setMenuOpen(false); if (atual) remarcarTreino(atual); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          Remarcar (≤ 7 dias)
                        </button>

                        <button
                          onClick={() => { setMenuOpen(false); if (atual) removerTreinoAgendado(atual.id); }}
                          className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        >
                          Excluir treino
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* conteúdo */}
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
            {ordenados
              .filter((t) => t.id === fullscreenId)
              .map((treino) => (
                <div key={treino.id} className="max-w-3xl mx-auto">
                  <h2 className="font-bold text-lg text-green-900">{treino.titulo}</h2>
                  {renderTreinoDetalhesConteudo(treino)}
                </div>
              ))}
          </div>

          {/* barra inferior do fullscreen */}
          {(() => {
            const t = ordenados.find((x) => x.id === fullscreenId);
            if (!t) return null;

            const st = statusPorTreino[fullscreenId!]?.status as TreinoStatus | undefined;

            const exList = (t.treinoProgramado?.exercicios ?? []);
            const exIds = exList.map((e) => e.exercicio.id);
            const ck = checklistByTreino[fullscreenId!] ?? {};
            const total = exIds.length;
            const allChecked = total > 0 && exIds.every((id) => ck[id]);

            const iniciarOuFinalizar = () => {
              if (st === "IN_PROGRESS") return finalizarEEnviar(t);
              return iniciar(t.id);
            };

            const labelCentral = st === "IN_PROGRESS" ? "Finalizar" : "Iniciar";
            const disabledCentral = st === "IN_PROGRESS" && total > 0 && !allChecked;

            return (
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                  <button
                    onClick={() => remarcarTreino(t)}
                    className="h-11 px-3 rounded-lg border text-gray-700 bg-white hover:bg-gray-50 flex-1"
                  >
                    Remarcar
                  </button>

                  <button
                    onClick={iniciarOuFinalizar}
                    disabled={disabledCentral}
                    className={`h-12 px-4 rounded-xl text-white font-medium flex-[1.4]
                      ${st === "IN_PROGRESS" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-green-700 hover:bg-green-800"}
                      ${disabledCentral ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    {labelCentral}
                  </button>

                  <button
                    onClick={() => removerTreinoAgendado(t.id)}
                    className="h-11 px-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 flex-1"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ==== MODAL DE VÍDEO ==== */}
      {videoModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-green-900 truncate pr-4">{videoModal.nome}</h3>
              <button
                onClick={() => setVideoModal(null)}
                className="inline-flex items-center justify-center p-2 rounded-md hover:bg-gray-100"
                aria-label="Fechar vídeo"
              >
                <CircleX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {videoCarregando && <div className="text-sm text-gray-600">Carregando vídeo...</div>}

              {!videoCarregando && videoErro && (
                <div className="text-sm text-red-600">{videoErro}</div>
              )}

              {!videoCarregando && !videoErro && videoModal.url && (
                <>
                  {isVideoUrl(videoModal.url) ? (
                    <video src={videoModal.url} className="w-full rounded-lg" controls playsInline />
                  ) : isYouTubeUrl(videoModal.url) ? (
                    <div className="aspect-video w-full">
                      <iframe
                        className="w-full h-full rounded-lg"
                        src={toYouTubeEmbed(videoModal.url)}
                        title={videoModal.nome}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="text-sm">
                      Não foi possível incorporar este link.{" "}
                      <a href={videoModal.url} target="_blank" rel="noreferrer" className="text-green-700 underline">
                        Abrir em nova aba
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal compartilhar desafio */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-lg relative">
            <h2 className="text-lg font-bold mb-4 text-center">Compartilhar Desafio</h2>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">Enviar por mensagem:</p>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {carregandoMutuos && <span className="text-sm text-gray-500">Carregando contatos...</span>}
                {!carregandoMutuos && usuariosMutuos.length === 0 && <span className="text-sm text-gray-500">Você ainda não tem contatos mútuos.</span>}

                {usuariosMutuos.map((u) => {
                  const selecionado = selecionados.has(u.id);
                  const fotoSrc = u.foto ? resolveUploadUrl(u.foto) : PLACEHOLDER_USER;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSelecionado(u.id)}
                      title={u.nome}
                      className={`relative shrink-0 rounded-full border-2 ${selecionado ? "border-green-600" : "border-transparent"}`}
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
                    ${selecionados.size === 0 || enviandoDM ? "bg-gray-300 text-gray-600" : "bg-green-700 text-white hover:bg-green-800"}`}
              >
                <Send className="w-4 h-4" />
                {enviandoDM ? "Enviando..." : `Enviar para ${selecionados.size} contato(s)`}
              </button>
            </div>

            <button onClick={() => setModalAberto(false)} className="absolute top-2 right-3 text-gray-600 hover:text-black text-xl" aria-label="Fechar modal">
              <CircleX />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

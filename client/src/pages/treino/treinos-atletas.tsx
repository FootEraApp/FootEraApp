// client/src/pages/treino/treinos-atletas.tsx
import { toast } from "@/lib/toast";
import React, { useEffect, useRef, useState, type SVGProps } from "react";
import { Link, useLocation } from "wouter";
import {
  CalendarClock,
  Volleyball,
  CircleX,
  CircleCheck,
  Send,
  Share2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Star as StarIcon,
  Menu,
  CalendarPlus,
  Dumbbell,
  History,
  GraduationCap,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";
import BottomNav from "../../components/layout/BottomNav.js";
import Avatar from "../../components/shared/Avatar.js";

type AgendaTipo =
  | "TREINO"
  | "DESAFIO"
  | "EVENTO"
  | "JOGO"
  | "PENEIRA"
  | "OUTRO";

interface EventoAtleta {
  id: string;
  tipo?: string | null;
  titulo: string;
  inicio: string;
  fim?: string | null;
}

interface AgendaItem {
  id: string;
  tipo: AgendaTipo;
  titulo: string;
  inicio: string;
  fim?: string | null;
  origem: "treino" | "desafio" | "evento";
}

type TreinoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

interface TreinoAgendado {
  id: string;
  titulo: string;
  dataTreino: string | null;
  dataExpiracao?: string | null;
  nivel?: string | null;
  prazoEnvio?: string | null;
  duracaoMinutos?: number | null;
  meuStatus?: TreinoStatus | string;
  startedAt?: string | null;
  completedAt?: string | null;
  sessaoTreinoId?: string | null;
  sessaoTreino?: { id: string; nome: string } | null;
  sessaoTreinoNome?: string | null;
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
      exercicio: {
        id: string;
        nome: string;
        videoDemonstrativoUrl?: string | null;
        imgDemonstrativaUrl?: string | null;
        objetivo?: string | null;
      };
      repeticoes: string;
      series?: number | null;
      duracao?: string | null;
      descanso?: string | null;
    }[];
    criador?: {
      id: string;
      nome: string;
      tipo: "Professor" | "Clube" | "Escolinha";
    } | null;
    criadorNome?: string | null;
    criadorTipo?: string | null;
    professorId?: string | null;
    clubeId?: string | null;
    escolinhaId?: string | null;
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

type MetodologiaPublicoAlvo = "ATLETAS" | "PROFISSIONAIS" | "AMBOS" | string;

type MetodologiaCatalogo = {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  nivel?: string | null;
  publicoAlvo?: MetodologiaPublicoAlvo;
  pontosTotal?: number | null; 
  pontosBadge?: string | null;
  pontosPorSemanaLabel?: string | null; 
  totalAssinantes?: number | null;
  mediaAvaliacao?: number | null;
  totalAvaliacoes?: number | null;
  pontosPorSemana?: number | null;
  criadorNome?: string | null;
  criadorTipo?: "Professor" | "Clube" | "Escolinha" | string | null;
  assinada?: boolean | null;
  planoMinimo?: string | null;
  hasVideo?: boolean;
  hasTreino?: boolean;
};

const now = new Date();
const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const TIMER_KEY = (id: string) => `footera:treinoTimerStart:${id}`;
const CHECKLIST_KEY = (id: string) => `footera:treinoChecklist:${id}`;
const VISIBLE_TREINOS = 6;
const ROW_ESTIMATE_PX = 72;
const DESAFIOS_MAX_PX = 240;

const MOTIVATIONAL_MESSAGES = [
  "Bola pra frente, o próximo treino é seu! ⚽",
  "Nada pra ver aqui, segue o jogo. 😉",
  "Todo mundo falta um treino às vezes. O importante é voltar! 💪",
  "Respira, levanta a cabeça e vem pro próximo. 🙌",
  "Tá tudo bem. Campeões também erram o horário. 🏆",
];

function formatHHMMSS(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function hasHoraMarcada(d: Date | null) {
  if (!d) return false;
  return !(d.getHours() === 0 && d.getMinutes() === 0);
}

function getStartWindowInfo(t: TreinoAgendado) {
  const d = getDataExibicaoTreino(t);
  if (!d) {
    return { canStart: false, isLate: false };
  }

  if (hasHoraMarcada(d)) {
    const start = new Date(d.getTime() - 60 * 60 * 1000);
    const end = new Date(d.getTime() + 60 * 60 * 1000);

    const canStart = now >= start && now <= end;
    const isLate = now > end; 
    return { canStart, isLate };
  }

  const canStart = sameDay(d, hoje);
  const isLate = now > endOfDay(d); 
  return { canStart, isLate };
}

const ASSETS_CDN_BASE =
  import.meta.env.VITE_ASSETS_CDN_BASE_URL || "https://footera.app.br";

function isNativeApp() {
  if (typeof window === "undefined") return false;

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  return (
    protocol === "capacitor:" ||
    protocol === "ionic:" ||
    hostname === "localhost" ||
    hostname === "10.0.2.2"
  );
}

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";

  const p = String(raw).trim().replace(/\\/g, "/");
  if (!p || p === "null" || p === "undefined") return "";

  if (
    p.startsWith("blob:") ||
    p.startsWith("data:") ||
    p.startsWith("http://") ||
    p.startsWith("https://")
  ) {
    return p;
  }

  if (p.startsWith("/assets/")) {
    return isNativeApp()
      ? `${ASSETS_CDN_BASE}${p}`
      : p;
  }

  if (p.startsWith("assets/")) {
    return isNativeApp()
      ? `${ASSETS_CDN_BASE}/${p}`
      : `/${p}`;
  }

  if (p.startsWith("/exercicios/")) {
    return `${API.BASE_URL}${p}`;
  }

  if (p.startsWith("exercicios/")) {
    return `${API.BASE_URL}/${p}`;
  }

  if (p.startsWith("/uploads/") || p.startsWith("/upload/")) {
    return `${API.BASE_URL}${p}`;
  }

  if (p.startsWith("uploads/") || p.startsWith("upload/")) {
    return `${API.BASE_URL}/${p}`;
  }

  if (p.startsWith("/")) {
    return `${API.BASE_URL}${p}`;
  }

  return `${API.BASE_URL}/${p.replace(/^\/+/, "")}`;
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

function StarsRating({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  const half = Math.round(v * 2) / 2; 
  const full = Math.floor(half);
  const hasHalf = half - full === 0.5;

  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const idx = i + 1;

        if (idx <= full) {
          return (
            <StarIcon
              key={i}
              className="w-4 h-4 text-amber-500"
              fill="currentColor"
            />
          );
        }

        if (idx === full + 1 && hasHalf) {
          return (
            <span key={i} className="relative inline-block w-4 h-4">
              <StarIcon
                className="absolute inset-0 w-4 h-4 text-gray-300"
                fill="currentColor"
              />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: "50%" }}
              >
                <StarIcon
                  className="w-4 h-4 text-amber-500"
                  fill="currentColor"
                />
              </span>
            </span>
          );
        }

        return (
          <StarIcon
            key={i}
            className="w-4 h-4 text-gray-300"
            fill="none"
          />
        );
      })}
    </div>
  );
}

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

  function parseDateSafe(raw?: string | null): Date | null {
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getDataExibicaoTreino(t: TreinoAgendado): Date | null {
  return (
    parseDateSafe(t.dataTreino) ||
    parseDateSafe(t.prazoEnvio) ||
    parseDateSafe(t.treinoProgramado?.dataAgendada ?? null) ||
    null
  );
}

function getDataExibicaoTreinoRaw(t: TreinoAgendado): string | null {
  return (t.dataTreino || t.prazoEnvio || t.treinoProgramado?.dataAgendada || null) as any;
}

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const TIMEZONE_BR = "America/Sao_Paulo";

function formatarDataHoraBR(d?: Date | null) {
  if (!d) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE_BR,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatInputDateTimeSP(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function inputDateTimeSPToIso(value: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  return `${value}:00-03:00`;
}

function getHoraHHMM(d?: Date | null) {
  if (!d) return "";
  const hh = d.getHours();
  const mm = d.getMinutes();

  if (hh === 0 && mm === 0) return "";

  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WeeklyChecker({ weeks }: { weeks: any[] }) {
  if (!weeks || weeks.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-sm font-semibold text-green-900 mb-1">
        Semanas do mês
      </div>
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
              className={`h-9 w-9 rounded-full border flex items-center justify-center ${base}`}
            >
              {w.status === "success" ? "✓" : w.status === "fail" ? "✕" : w.index}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getCriadorLabel(t: TreinoAgendado): string | null {
  const tp: any = t.treinoProgramado ?? {};
  const root: any = t as any;

  const criadorFromTp = tp.criador as
    | { id?: string; nome?: string; tipo?: string }
    | undefined;
  const criadorFromRoot = root.criador as
    | { id?: string; nome?: string; tipo?: string }
    | undefined;

  const c = criadorFromTp ?? criadorFromRoot;

  const nome: string | null =
    c?.nome ??
    tp.criadorNome ??
    root.criadorNome ??
    tp.criadoPorNome ??
    root.criadoPorNome ??
    null;

  const tipo: string | null =
    (c?.tipo as string | undefined) ??
    (tp.criadorTipo as string | undefined) ??
    (root.criadorTipo as string | undefined) ??
    ((tp.professorId || root.professorId)
      ? "Professor"
      : (tp.clubeId || root.clubeId)
      ? "Clube"
      : (tp.escolinhaId || root.escolinhaId)
      ? "Escolinha"
      : null);

  if (!nome) return null;

  if (tipo === "Professor") return `Prof. ${nome}`;
  if (tipo) return `${nome} (${tipo})`;
  return nome;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function StarRating({
  value,
  sizeClass = "w-4 h-4",
}: {
  value: number;
  sizeClass?: string;
}) {
  const v = clamp01(value);

  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const frac = Math.max(0, Math.min(1, v - i));
        const pct = `${Math.round(frac * 100)}%`;

        return (
          <span key={i} className="relative inline-block">
            <StarIcon className={`${sizeClass} text-gray-300`} fill="none" />

            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: pct }}
            >
              <StarIcon
                className={`${sizeClass} text-amber-500`}
                fill="currentColor"
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function TreinosAtletas() {
  const [location, navigate] = useLocation();

  const qs = React.useMemo(() => {
    const raw = typeof window !== "undefined" ? window.location.search : "";
    return new URLSearchParams(raw);
  }, [location]);

  const openAgendadoByProgramadoId = qs.get("openAgendadoByProgramadoId"); 
  const qsMetodologiaId = qs.get("metodologiaId");
  const qsEstruturaId = qs.get("estruturaId");
  const qsMetodologiaItemId = qs.get("metodologiaItemId");

  const METODOLOGIA_LINK_KEY = (treinoAgendadoId: string) =>
    `footera:metodologiaLink:${treinoAgendadoId}`;

  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [semanasDesafio, setSemanasDesafio] = useState<WeekStatus[]>([]);
  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<
    Set<string>
  >(new Set());
  const [midiaPorNomeExercicio, setMidiaPorNomeExercicio] = useState<
    Record<string, { video?: string | null; img?: string | null }>
  >({});
  const [filtroPublico, setFiltroPublico] = useState<string>("TODOS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroNivel, setFiltroNivel] = useState<string>("TODOS");

  function normNome(n?: string | null) {
    return String(n || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function midiaDoCatalogo(nome?: string | null) {
    const k = normNome(nome);
    return midiaPorNomeExercicio[k] || null;
  }

  const [statusPorTreino, setStatusPorTreino] = useState<
    Record<
      string,
      {
        status: TreinoStatus | string;
        startedAt?: string | null;
        completedAt?: string | null;
      }
    >
  >({});
  const [checklistByTreino, setChecklistByTreino] = useState<
    Record<string, Checklist>
  >({});
  const [elapsedByTreino, setElapsedByTreino] = useState<
    Record<string, number>
  >({});
  const tickRef = useRef<number | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

const [midiaExercicioAberta, setMidiaExercicioAberta] =
  useState<string | null>(null);

const [playerMidiaAberto, setPlayerMidiaAberto] =
  useState(false);

const [erroMidiaExercicio, setErroMidiaExercicio] =
  useState<string | null>(null);

const fecharMidiaTimerRef = useRef<number | null>(null);

useEffect(() => {
  if (fecharMidiaTimerRef.current !== null) {
    window.clearTimeout(fecharMidiaTimerRef.current);
    fecharMidiaTimerRef.current = null;
  }

  setPlayerMidiaAberto(false);
  setMidiaExercicioAberta(null);
  setErroMidiaExercicio(null);
}, [fullscreenId]);

useEffect(() => {
  return () => {
    if (fecharMidiaTimerRef.current !== null) {
      window.clearTimeout(fecharMidiaTimerRef.current);
    }
  };
}, []);

  async function carregarMetodologias() {
    try {
      setMetodologiasLoading(true);
      setMetodologiasErro(null);

      const token = getToken();
      if (!token) return;

      const publicoParam = filtroPublico;

      const r = await fetch(
        `${API.BASE_URL}/api/metodologias/visiveis?publico=${encodeURIComponent(publicoParam)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const js = await r.json().catch(() => null);
      if (!r.ok) throw new Error(js?.message || "Falha ao carregar metodologias");

      const arr: any[] = Array.isArray(js) ? js : js.items ?? js.metodologias ?? [];

      const normalizadas: MetodologiaCatalogo[] = arr.map((m: any) => ({
        id: String(m.id),
        titulo: m.titulo ?? m.nome ?? "Metodologia",
        descricao: m.descricao ?? null,
        capaUrl: m.capaUrl ?? m.logoUrl ?? m.imagemUrl ?? null,
        publicoAlvo: m.publicoAlvo ?? "AMBOS",
        nivel: m.nivel ?? null,
        totalAssinantes: Number(m.totalAssinantes ?? m._count?.assinantes ?? 0),
        mediaAvaliacao: Number(m.mediaAvaliacao ?? 0),
        totalAvaliacoes: Number(m.totalAvaliacoes ?? m.totalReviews ?? m.notaCount ?? 0),
        criadorNome:
          m.criadorNome ??
          m.autor?.nome ??
          m.criador?.nome ??
          m.professor?.nome ??
          m.usuarioCriador?.nome ??
          null,
        criadorTipo: m.criadorTipo ?? m.tipoCriador ?? "Professor",
        planoMinimo: m.planoMinimo ?? "Free",
        pontosTotal: Number(m.pontosTotal ?? m.pontos ?? m.pontuacao ?? 0),
      }));

      const detalhadas = await Promise.all(
        normalizadas.map(async (card) => {
          try {
            const rr = await fetch(
              `${API.BASE_URL}/api/metodologias/${encodeURIComponent(card.id)}/detalhe`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const jj = await rr.json().catch(() => null);
            if (!rr.ok || !jj) return card;

            const itensPub: any[] = Array.isArray(jj.itens)
              ? jj.itens.filter((it: any) => it?.publicado !== false)
              : [];

            const tipos = itensPub.map((it: any) => String(it?.tipo || "").toUpperCase());
            const hasVideo = tipos.includes("VIDEO");
            const hasTreino = tipos.includes("TREINO");

            let pontosTotal = Number(jj.pontosTotal ?? 0);

            if (!pontosTotal && itensPub.length) {
              pontosTotal = itensPub.reduce(
                (acc: number, it: any) => acc + Number(it?.pontos ?? 0),
                0
              );
            }

            const mediaAvaliacao = Number(
              jj.mediaAvaliacao ?? jj.media ?? jj.notaMedia ?? card.mediaAvaliacao ?? 0
            );

            const totalAvaliacoes = Number(
              jj.totalAvaliacoes ?? jj.totalReviews ?? jj.notaCount ?? card.totalAvaliacoes ?? 0
            );

            return {
              ...card,
              descricao: card.descricao ?? jj.descricao ?? null,
              pontosTotal: Number.isFinite(pontosTotal) ? pontosTotal : card.pontosTotal,
              hasVideo,
              hasTreino,
              capaUrl:
                jj.capaUrl ??
                jj.logoUrl ??
                jj.imagemUrl ??
                card.capaUrl,
              mediaAvaliacao: Number.isFinite(mediaAvaliacao) ? mediaAvaliacao : (card.mediaAvaliacao ?? 0),
              totalAvaliacoes: Number.isFinite(totalAvaliacoes) ? totalAvaliacoes : (card.totalAvaliacoes ?? 0),
              criadorNome:
                card.criadorNome ??
                jj?.criadorNome ??
                jj?.criadorUsuario?.nome ??
                jj?.professor?.nome ??
                jj?.clube?.nome ??
                jj?.escolinha?.nome ??
                null,
            };
          } catch (e: any) {
            console.warn("Erro ao detalhar metodologia:", e);
            return card;
          }
        })
      );

      setMetodologias(detalhadas);
    } catch (e: any) {
      setMetodologias([]);
      setMetodologiasErro(e?.message || "Erro ao carregar metodologias.");
    } finally {
      setMetodologiasLoading(false);
    }
  }

  async function carregarCatalogoExercicios() {
  try {
    const token = getToken();
    if (!token) return;

    const r = await fetch(`${API.BASE_URL}/api/exercicios`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) return;

    const js = await r.json();
    const arr: any[] = Array.isArray(js) ? js : js.items ?? js.exercicios ?? [];

    const mapa: Record<string, { video?: string | null; img?: string | null }> = {};
    for (const ex of arr) {
      const key = normNome(ex?.nome);
      if (!key) continue;

      mapa[key] = {
        video: ex?.videoDemonstrativoUrl ?? ex?.videoUrl ?? null,
        img: ex?.imgDemonstrativaUrl ?? ex?.imagemUrl ?? null,
      };
    }

    setMidiaPorNomeExercicio(mapa);
  } catch (e) {
    console.warn("[TREINOS] falha ao carregar catálogo de exercícios:", e);
  }
}

useEffect(() => {
  if (!openAgendadoByProgramadoId) return;
  if (!treinosAgendados.length) return;

  const alvo = treinosAgendados.find(
    (t) => String(t?.treinoProgramado?.id || "") === String(openAgendadoByProgramadoId)
  );

  if (!alvo?.id) return;

  if (qsMetodologiaId && qsEstruturaId && qsMetodologiaItemId) {
    localStorage.setItem(
      METODOLOGIA_LINK_KEY(alvo.id),
      JSON.stringify({
        metodologiaId: qsMetodologiaId,
        estruturaId: qsEstruturaId,
        metodologiaItemId: qsMetodologiaItemId,
      })
    );
  }

  setExpandedId(alvo.id);
  setFullscreenId(alvo.id);

  const next = new URLSearchParams(window.location.search);
  next.delete("openAgendadoByProgramadoId");
  next.delete("metodologiaId");
  next.delete("estruturaId");
  next.delete("metodologiaItemId");

  const qs = next.toString();
  navigate(qs ? `/treinos?${qs}` : "/treinos", { replace: true });
}, [
  openAgendadoByProgramadoId,
  treinosAgendados,
  qsMetodologiaId,
  qsEstruturaId,
  qsMetodologiaItemId,
  navigate,
]);




  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  const [eventosAtleta, setEventosAtleta] = useState<EventoAtleta[]>([]);
  const [agendaAberta, setAgendaAberta] = useState(false);

const [dataAgendaSelecionada, setDataAgendaSelecionada] = useState(() => {
  const agora = new Date();

  return new Date(
    agora.getFullYear(),
    agora.getMonth(),
    agora.getDate()
  );
});

  type MainTab = "treinos" | "learning";
  const [mainTab, setMainTab] = useState<MainTab>("treinos");

const [menuTreinosAberto, setMenuTreinosAberto] = useState(false);

function navegarPeloMenu(rota: string) {
  setMenuTreinosAberto(false);
  navigate(rota);
}

  const [buscaMetodologia, setBuscaMetodologia] = useState("");

  const [addFiltroOpen, setAddFiltroOpen] = useState(false);
  const [metodologias, setMetodologias] = useState<MetodologiaCatalogo[]>([]);
  const [metodologiasLoading, setMetodologiasLoading] = useState(false);
  const [metodologiasErro, setMetodologiasErro] = useState<string | null>(null);

  const stripRef = useRef<HTMLDivElement | null>(null);
  const [missedClickCounts, setMissedClickCounts] = useState<
    Record<string, number>
  >({});

  const [easterEggMsg, setEasterEggMsg] = useState<string | null>(null);

  useEffect(() => {
    carregarCatalogoExercicios();
  }, []);

  useEffect(() => {
    if (!FLAGS.LEARNING_ENABLED) {
      if (
        window.location.pathname.startsWith("/learning") ||
        window.location.pathname.startsWith("/metodologias")
      ) {
        navigate("/treinos");
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (mainTab !== "learning") return;
    carregarMetodologias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, buscaMetodologia, filtroPublico, filtroTipo, filtroNivel]);
  
  useEffect(() => {
    if (!easterEggMsg) return;

    const id = window.setTimeout(() => {
      setEasterEggMsg(null);
    }, 3500); 

    return () => window.clearTimeout(id);
  }, [easterEggMsg]);

  function handleMissedClick(treinoId: string) {
    setMissedClickCounts((prev) => {
      const prevCount = prev[treinoId] ?? 0;
      const nextCount = prevCount + 1;
      const next = { ...prev, [treinoId]: nextCount };

      if (nextCount >= 10) {
        const msg =
          MOTIVATIONAL_MESSAGES[
            Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)
          ];

        setEasterEggMsg(msg);

        next[treinoId] = 0;
      }

      return next;
    });
  }

  function abrirModalCompartilhar(id: string) {
    setDesafioParaCompartilhar(id);
    setModalAberto(true);
    carregarUsuariosMutuos();
    setSelecionados(new Set());
  }

  async function enviarDesafioDM() {
    if (selecionados.size === 0 || !desafioParaCompartilhar) return;

    const token = getToken();
    setEnviandoDM(true);

    try {
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
      toast.success("Desafio enviado!");
      setModalAberto(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar DM.");
    } finally {
      setEnviandoDM(false);
    }
  }

  async function carregarEventosAtleta() {
    try {
      const token = getToken();
      if (!token) return;

      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const qs = new URLSearchParams();
      qs.set("from", from.toISOString());
      qs.set("to", to.toISOString());

      const r = await fetch(`${API.BASE_URL}/api/eventos/minha-agenda?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) throw new Error("Falha ao buscar agenda");

      const js = await r.json();
      const eventos = (Array.isArray(js) ? js : []).filter((it: any) => {
        const origem = String(it?.origem || "").toUpperCase();
        return origem === "EVENTO" || origem === "CONVOCACAO";
      });

      setEventosAtleta(
        eventos.map((it: any) => ({
          id: String(it.id),
          tipo: it.tipo ?? "EVENTO",
          titulo: it.titulo ?? "Evento",
          inicio: it.inicio,
          fim: it.fim ?? null,
        }))
      );
    } catch (e) {
      console.warn("Falha ao carregar agenda de eventos:", e);
      setEventosAtleta([]);
    }
  }

  async function carregarTreinosAgendados() {
    try {
      const token = getToken();
      if (!token) {
        console.warn("[TREINOS] sem token, não dá pra buscar treinos agendados");
        return;
      }

      const agora = new Date();

      const monthAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

      const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
      const monthProximo = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, "0")}`;

      const [resAtual, resProximo] = await Promise.all([
        fetch(`${API.BASE_URL}/api/treinos/agendados?month=${monthAtual}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API.BASE_URL}/api/treinos/agendados?month=${monthProximo}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (resAtual.status === 401 || resProximo.status === 401) {
        console.warn("[TREINOS] 401 ao buscar treinos agendados");
        return;
      }

      if (!resAtual.ok || !resProximo.ok) {
        throw new Error("Falha ao buscar treinos agendados");
      }

      const jsAtual = await resAtual.json();
      const jsProximo = await resProximo.json();

      const listaRaw: any[] = [
        ...(Array.isArray(jsAtual) ? jsAtual : jsAtual.items ?? []),
        ...(Array.isArray(jsProximo) ? jsProximo : jsProximo.items ?? []),
      ];

      const listaAdaptada: TreinoAgendado[] = listaRaw.map((item) => {
        const tp = item.treinoProgramado ?? null;

        return {
          id: item.id,
          titulo: item.titulo ?? tp?.nome ?? "Treino",
          prazoEnvio: item.prazoEnvio ?? null,
          dataTreino: item.dataTreino ?? tp?.dataAgendada ?? item.prazoEnvio ?? null,
          dataExpiracao: item.dataExpiracao ?? null,
          nivel: tp?.nivel ?? null,
          duracaoMinutos:
            item.duracaoMinutos ??
            (item.duracaoSegundos
              ? Math.round(item.duracaoSegundos / 60)
              : tp?.duracao ?? null),
          meuStatus:
            item.meuStatus ?? item.execucaoStatus ?? item.status ?? "PENDING",
          startedAt: item.startedAt ?? null,
          completedAt: item.completedAt ?? item.finishedAt ?? null,
          submissao: item.submissao ?? {
            enviados: 0,
            aprovados: 0,
            feito: false,
          },

          treinoProgramado: tp
            ? {
                id: tp.id,
                descricao: tp.descricao ?? null,
                nivel: tp.nivel ?? "Base",
                dicas: tp.dicas ?? [],
                objetivo: tp.objetivo ?? null,
                duracao: tp.duracao ?? null,
                dataAgendada: tp.dataAgendada ?? null,
                pontuacao: tp.pontuacao ?? null,
                exercicios:
                  (tp.exercicios ?? []).map((ex: any, idx: number) => {
                    const exNormal = ex.exercicio ?? null;
                    const exTemp = ex.exercicioTemporario ?? ex.exercicio_temporario ?? null;
                    const exPers =
                      ex.exercicioPersonalizado ??
                      ex.exercicio_personalizado ??
                      ex.exercicioPersonalizadoRef ?? 
                      null;

                    const resolvedId =
                      exNormal?.id
                        ? String(exNormal.id)
                        : exTemp?.id
                          ? `temp:${String(exTemp.id)}`
                          : exPers?.id
                            ? `pers:${String(exPers.id)}`
                            : `tempidx:${String(tp.id)}:${idx}`;

                    const resolvedNome =
                      exNormal?.nome ??
                      exTemp?.nome ??
                      exTemp?.titulo ??
                      exPers?.nome ??
                      exPers?.titulo ??
                      "Exercício";

                    const resolvedVideo =
                      exNormal?.videoDemonstrativoUrl ??
                      exNormal?.videoUrl ??
                      exTemp?.videoDemonstrativoUrl ??
                      exTemp?.videoUrl ??
                      exPers?.videoDemonstrativoUrl ??
                      exPers?.videoUrl ??
                      null;

                    const resolvedImg =
                      exNormal?.imgDemonstrativaUrl ??
                      exNormal?.imagemUrl ??
                      exTemp?.imgDemonstrativaUrl ??
                      exTemp?.imagemUrl ??
                      exPers?.videoPosterUrl ??
                      exPers?.imgDemonstrativaUrl ??
                      exPers?.imagemUrl ??
                      null;

                    return {
                      _key: `${resolvedId}:${idx}`,

                      exercicio: {
                        id: resolvedId,
                        nome: resolvedNome,
                        videoDemonstrativoUrl: resolvedVideo,
                        imgDemonstrativaUrl: resolvedImg,
                        descricao:
                          exNormal?.descricao ?? 
                          exNormal?.objetivo ??
                          exTemp?.descricao ??
                          exPers?.descricao ??
                          null,
                      },
                      repeticoes: ex.repeticoes ?? exTemp?.repeticoes ?? exPers?.repeticoes ?? "",
                      series:
                        ex.series ??
                        exNormal?.series ??
                        exTemp?.series ??
                        exPers?.series ??
                        null,
                      duracao:
                        ex.duracao ??
                        exNormal?.duracao ??
                        exTemp?.duracao ??
                        exPers?.duracao ??
                        null,
                      descanso:
                        ex.descanso ??
                        exNormal?.descanso ??
                        exTemp?.descanso ??
                        exPers?.descanso ??
                        null,
                    };
                  }) ?? [],
                criador: tp.criador ?? null,
                criadorNome: tp.criadorNome ?? tp.criadoPorNome ?? null,
                criadorTipo:
                  tp.criadorTipo ??
                  (tp.professorId
                    ? "Professor"
                    : tp.clubeId
                    ? "Clube"
                    : tp.escolinhaId
                    ? "Escolinha"
                    : null),
                professorId: tp.professorId ?? null,
                clubeId: tp.clubeId ?? null,
                escolinhaId: tp.escolinhaId ?? null,
              }
            : null,
        };
      });

      const dedupMap = new Map<string, TreinoAgendado>();

      for (const t of listaAdaptada) {
        const rawDate = t.dataTreino ? new Date(t.dataTreino) : null;
        const dateKey = rawDate
          ? `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, "0")}-${String(rawDate.getDate()).padStart(2, "0")}`
          : "sem-data";

        const timeKey = rawDate
          ? `${String(rawDate.getHours()).padStart(2, "0")}:${String(rawDate.getMinutes()).padStart(2, "0")}`
          : "sem-hora";

        const titleKey = String(t.titulo || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");

        const key = `${dateKey} ${timeKey}::${titleKey}`;

        if (!dedupMap.has(key)) dedupMap.set(key, t);
      }

      setTreinosAgendados(Array.from(dedupMap.values()));
    } catch (e) {
      console.error("Erro ao carregar treinos agendados:", e);
      setTreinosAgendados([]);
    }
  }

  const agendaItems: AgendaItem[] = React.useMemo(() => {
    const arr: AgendaItem[] = [];

    treinosAgendados.forEach((t) => {
      const inicio = getDataExibicaoTreinoRaw(t);
      if (!inicio) return;

      arr.push({
        id: t.id,
        tipo: "TREINO",
        titulo: t.titulo,
        inicio,
        fim: t.dataExpiracao ?? null,
        origem: "treino",
      });
    });

    desafios.forEach((d) => {
      arr.push({
        id: d.id,
        tipo: "DESAFIO",
        titulo: d.titulo,
        inicio: "",
        fim: null,
        origem: "desafio",
      });
    });

    eventosAtleta.forEach((e) => {
      arr.push({
        id: e.id,
        tipo: (e.tipo?.toUpperCase() as AgendaTipo) || "EVENTO",
        titulo: e.titulo,
        inicio: e.inicio,
        fim: e.fim ?? null,
        origem: "evento",
      });
    });

    return arr.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [treinosAgendados, desafios, eventosAtleta]);

const semanasMesAgenda = React.useMemo(() => {
  const ano = dataAgendaSelecionada.getFullYear();
  const mes = dataAgendaSelecionada.getMonth();

  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);

  // Começa na segunda-feira da primeira semana do mês
  const inicioGrade = new Date(primeiroDiaMes);
  const diasAntes = (inicioGrade.getDay() + 6) % 7;

  inicioGrade.setDate(inicioGrade.getDate() - diasAntes);
  inicioGrade.setHours(0, 0, 0, 0);

  // Termina no domingo da última semana do mês
  const fimGrade = new Date(ultimoDiaMes);
  const diasDepois = (7 - fimGrade.getDay()) % 7;

  fimGrade.setDate(fimGrade.getDate() + diasDepois);
  fimGrade.setHours(0, 0, 0, 0);

  const todosOsDias: Date[] = [];
  const cursor = new Date(inicioGrade);

  while (cursor <= fimGrade) {
    todosOsDias.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  const semanas: Date[][] = [];

  for (let index = 0; index < todosOsDias.length; index += 7) {
    semanas.push(todosOsDias.slice(index, index + 7));
  }

  return semanas;
}, [dataAgendaSelecionada]);

const indiceSemanaSelecionada = React.useMemo(() => {
  return semanasMesAgenda.findIndex((semana) =>
    semana.some((dia) => sameDay(dia, dataAgendaSelecionada))
  );
}, [semanasMesAgenda, dataAgendaSelecionada]);

const agendaItemsDoDia = React.useMemo(() => {
  return agendaItems.filter((item) => {
    const dataItem = parseDateSafe(item.inicio);

    return dataItem
      ? sameDay(dataItem, dataAgendaSelecionada)
      : false;
  });
}, [agendaItems, dataAgendaSelecionada]);

function quantidadeItensAgenda(data: Date) {
  return agendaItems.filter((item) => {
    const dataItem = parseDateSafe(item.inicio);
    return dataItem ? sameDay(dataItem, data) : false;
  }).length;
}

const tituloMesAgenda = dataAgendaSelecionada.toLocaleDateString("pt-BR", {
  month: "long",
  year: "numeric",
});

const tituloDiaAgenda = dataAgendaSelecionada.toLocaleDateString("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

  useEffect(() => {
    carregarTreinosAgendados();
    carregarEventosAtleta();
  }, []);

  useEffect(() => {
    const onAgendado = () => {
      carregarTreinosAgendados();
    };

    window.addEventListener("treino:agendado", onAgendado);

    const last = sessionStorage.getItem("lastAgendamento");
    if (last) {
      carregarTreinosAgendados();
      sessionStorage.removeItem("lastAgendamento");
    }

    return () => window.removeEventListener("treino:agendado", onAgendado);
  }, []);

  useEffect(() => {
    if (!openAgendadoByProgramadoId) return;
    if (!qsMetodologiaId || !qsMetodologiaItemId) return;
    if (!treinosAgendados?.length) return;

    const alvo = treinosAgendados.find(
      (t) => String(t.treinoProgramado?.id || "") === String(openAgendadoByProgramadoId)
    );

    if (!alvo) {
      toast.error("Esse treino ainda não está nos seus treinos agendados. Agende primeiro e tente novamente.");
      return;
    }

    try {
      localStorage.setItem(
        METODOLOGIA_LINK_KEY(alvo.id),
        JSON.stringify({
          metodologiaId: qsMetodologiaId,
          metodologiaItemId: qsMetodologiaItemId,
          estruturaId: qsEstruturaId,
        })
      );
    } catch {}

    setFullscreenId(alvo.id);

    try {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("openAgendadoByProgramadoId");
      clean.searchParams.delete("metodologiaId");
      clean.searchParams.delete("metodologiaItemId");
      window.history.replaceState({}, "", clean.toString());
    } catch {}
  }, [openAgendadoByProgramadoId, qsMetodologiaId, qsMetodologiaItemId, treinosAgendados]);

  const tipo = String(
    (Storage as any).tipoSalvo ?? localStorage.getItem("tipo") ?? ""
  ).toLowerCase();
  const canVerElenco = ["professor", "clube", "escolinha"].includes(tipo);
  const isOlheiro = tipo === "olheiro";

  const bottomNavRef = useRef<HTMLElement | null>(null);
  const agendadosCardRef = useRef<HTMLDivElement | null>(null);
  const [agendadosMaxH, setAgendadosMaxH] = useState<number>(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const calc = () => {
      if (!agendadosCardRef.current) return;

      const rect = agendadosCardRef.current.getBoundingClientRect();
      const bottomH = bottomNavRef.current?.offsetHeight ?? 64;

      const reserveDesafios = FLAGS.DESAFIOS_ENABLED
        ? DESAFIOS_MAX_PX + 16
        : 0;

      const available = Math.floor(
        window.innerHeight - rect.top - bottomH - 16 - reserveDesafios
      );

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

  const ordenados = [...treinosAgendados].sort((a, b) => {
    const ad = +(getDataExibicaoTreino(a)?.getTime() ?? 0);
    const bd = +(getDataExibicaoTreino(b)?.getTime() ?? 0);
    return ad - bd;
  });

  type TileInfo = {
    id: string;
    titulo: string;
    sessaoTreinoNome?: string | null;
    label: string;
    date: Date | null;
    isToday: boolean;
    isMissed: boolean;
    statusClass: string;
    borderClass: string;
    dotClass: string;
  };

  function computeTile(t: TreinoAgendado): TileInfo {
    const d = getDataExibicaoTreino(t);
    const isToday = d ? sameDay(d, hoje) : false;

    const st = (t.meuStatus ?? statusPorTreino[t.id]?.status) as
      | TreinoStatus
      | string
      | undefined;

    const submittedAgendado =
      (t.submissao?.aprovados ?? 0) > 0 ||
      t.submissao?.feito === true ||
      idsAgendadosSubmetidos.has(t.id);

    const diaPassou = d ? endOfDay(d) < now : false;
    const expiradoBackend =
      (st as string) === "EXPIRED" || (t as any).execucaoStatus === "EXPIRED";

    const isMissed =
      !submittedAgendado &&
      (diaPassou || expiradoBackend) &&
      st !== "COMPLETED";

    let statusClass = "bg-gray-50";
    let borderClass = "border-gray-300";
    let dotClass = "bg-gray-400";
    let label = "Pendente";

    if (submittedAgendado || st === "COMPLETED") {
      statusClass = "bg-emerald-50";
      borderClass = "border-emerald-400";
      dotClass = "bg-emerald-600";
      label = "Concluído";
    } else if (isMissed) {
      statusClass = "bg-red-50";
      borderClass = "border-red-300";
      dotClass = "bg-red-600";
      label = "Faltou";
    } else if (isToday) {
      label = "Hoje (pendente)";
      dotClass = "bg-gray-400";
    }

    return {
      id: t.id,
      titulo: t.titulo,
      sessaoTreinoNome:
        (t as any).sessaoTreinoNome ||
        (t as any).sessaoTreino?.nome ||
        (t as any).treinoProgramado?.sessaoTreinoNome ||
        (t as any).treinoProgramado?.sessaoTreino?.nome ||
        null,
      label,
      date: d,
      isToday,
      isMissed,
      statusClass,
      borderClass,
      dotClass,
    };
  }

  const tiles: TileInfo[] = ordenados.map((t) => computeTile(t));

  async function carregarUsuariosMutuos() {
    try {
      setCarregandoMutuos(true);

      const token = getToken();
      if (!token) return;

      const r = await fetch(`${API.BASE_URL}/api/usuarios/mutuos`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) throw new Error("Falha ao carregar usuários");
      const js = await r.json();

      setUsuariosMutuos(Array.isArray(js) ? js : []);
    } catch (err) {
      console.error("Erro ao carregar usuários mútuos:", err);
      setUsuariosMutuos([]);
    } finally {
      setCarregandoMutuos(false);
    }
  }

  useEffect(() => {
    const initialChecklist: Record<string, Checklist> = {};
    const initialElapsed: Record<string, number> = {};

    treinosAgendados.forEach((t) => {
      const rawCk = localStorage.getItem(CHECKLIST_KEY(t.id));
      if (rawCk) {
        try {
          const parsed = JSON.parse(rawCk) as Checklist;
          initialChecklist[t.id] = parsed;
        } catch {}
      }

      const rawStart = localStorage.getItem(TIMER_KEY(t.id));
      if (rawStart) {
        const startMs = Number(rawStart);
        if (!Number.isNaN(startMs)) {
          const sec = Math.floor((Date.now() - startMs) / 1000);
          if (sec > 0) {
            initialElapsed[t.id] = sec;
          }
        }
      }
    });

    if (Object.keys(initialChecklist).length) {
      setChecklistByTreino((prev) => ({ ...initialChecklist, ...prev }));
    }
    if (Object.keys(initialElapsed).length) {
      setElapsedByTreino((prev) => ({ ...initialElapsed, ...prev }));
    }
  }, [treinosAgendados]);

  useEffect(() => {
    if (!fullscreenId) {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    const st = statusPorTreino[fullscreenId]?.status as
      | TreinoStatus
      | undefined;

    if (st !== "IN_PROGRESS") {
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    const key = TIMER_KEY(fullscreenId);
    let startMs = Number(localStorage.getItem(key) || "");
    if (!startMs || Number.isNaN(startMs)) {
      startMs = Date.now();
      localStorage.setItem(key, String(startMs));
    }

    const update = () => {
      const sec = Math.floor((Date.now() - startMs) / 1000);
      setElapsedByTreino((prev) => ({
        ...prev,
        [fullscreenId]: sec,
      }));
    };

    update();
    const id = window.setInterval(update, 1000);
    tickRef.current = id as any;

    return () => {
      window.clearInterval(id);
      tickRef.current = null;
    };
  }, [fullscreenId, statusPorTreino]);

  useEffect(() => {
    if (!addFiltroOpen) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;

      const isInside = t.closest?.("[data-filtro-menu='1']");
      if (!isInside) setAddFiltroOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [addFiltroOpen]);

useEffect(() => {
  if (!menuTreinosAberto) return;

  const overflowAnterior = document.body.style.overflow;

  function fecharComEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      setMenuTreinosAberto(false);
    }
  }

  document.body.style.overflow = "hidden";
  window.addEventListener("keydown", fecharComEscape);

  return () => {
    document.body.style.overflow = overflowAnterior;
    window.removeEventListener("keydown", fecharComEscape);
  };
}, [menuTreinosAberto]);

  async function iniciar(id: string) {
    try {
      const nowMs = Date.now();
      localStorage.setItem(TIMER_KEY(id), String(nowMs));

      setStatusPorTreino((s) => ({
        ...s,
        [id]: { status: "IN_PROGRESS", startedAt: new Date().toISOString() },
      }));

      setElapsedByTreino((prev) => ({
        ...prev,
        [id]: 0,
      }));
    } catch (e) {
      console.error(e);
    }
  }

  async function concluirItemDaMetodologiaSeHouver(treinoAgendadoId: string) {
    try {
      const raw = localStorage.getItem(METODOLOGIA_LINK_KEY(treinoAgendadoId));
      if (!raw) return;

      const link = JSON.parse(raw) as {
        metodologiaId?: string;
        estruturaId?: string;
        metodologiaItemId?: string;
      };

      const metodologiaId = String(link?.metodologiaId || "");
      const estruturaId = String(link?.estruturaId || "");
      const itemId = String(link?.metodologiaItemId || "");
      if (!metodologiaId || !estruturaId || !itemId) return;

      const token = getToken();
      if (!token) return;

      await fetch(
        `${API.BASE_URL}/api/metodologias/${metodologiaId}/estruturas/${estruturaId}/concluir-item`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ itemId }),
        }
      );

      localStorage.removeItem(METODOLOGIA_LINK_KEY(treinoAgendadoId));
    } catch (e) {
      console.warn("[metodologia] falha ao concluir item:", e);
    }
  }

  async function finalizarEEnviar(treino: TreinoAgendado) {
    try {
      const token = getToken();
      if (!token) return;

      const r = await fetch(
        `${API.BASE_URL}/api/treinos/agendados/${treino.id}/complete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) throw new Error("não foi possível finalizar");

      await concluirItemDaMetodologiaSeHouver(treino.id);

      setStatusPorTreino((st) => ({
        ...st,
        [treino.id]: {
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
        },
      }));

      localStorage.removeItem(TIMER_KEY(treino.id));
      setElapsedByTreino((prev) => {
        const { [treino.id]: _, ...rest } = prev;
        return rest;
      });
      if (tickRef.current != null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }

      setFullscreenId(null);
    } catch (err) {
      console.error("Erro ao finalizar treino:", err);
      toast.error("Erro ao enviar treino.");
    }
  }

  async function remarcarTreino(t: TreinoAgendado) {
    const dataAtual = getDataExibicaoTreino(t) || new Date();

    const agora = new Date();
    const maxDate = new Date(dataAtual);
    maxDate.setDate(maxDate.getDate() + 7);

    const sugestao = formatInputDateTimeSP(dataAtual > agora ? dataAtual : agora);

    const nova = prompt(
      `Escolha a nova data e horário no formato AAAA-MM-DDTHH:mm.\n\n` +
        `Data atual: ${formatarDataHoraBR(dataAtual)}\n` +
        `Limite máximo: ${formatarDataHoraBR(maxDate)}\n\n` +
        `Exemplo: ${sugestao}`,
      sugestao
    );

    if (!nova) return;

    const isoSP = inputDateTimeSPToIso(nova.trim());

    if (!isoSP) {
      toast.error("Formato inválido. Use AAAA-MM-DDTHH:mm. Exemplo: 2026-06-09T15:30");
      return;
    }

    const novaDate = new Date(isoSP);

    if (Number.isNaN(novaDate.getTime())) {
      toast.error("Data ou horário inválido.");
      return;
    }

    if (novaDate < agora) {
      toast.error("Você não pode remarcar para uma data ou horário que já passou.");
      return;
    }

    if (novaDate > maxDate) {
      toast.error("Você só pode remarcar para no máximo 7 dias depois da data atual do treino.");
      return;
    }

    try {
      const token = getToken();
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${t.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataTreino: isoSP,
        }),
      });

      const js = await r.json().catch(() => null);

      if (!r.ok) {
        throw new Error(js?.message || "Erro ao remarcar");
      }

      setTreinosAgendados((arr) =>
        arr.map((x) => (x.id === t.id ? { ...x, dataTreino: isoSP } : x))
      );

      toast.error(`Treino remarcado para ${formatarDataHoraBR(novaDate)}.`);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível remarcar o treino.");
    }
  }

  async function removerTreinoAgendado(id: string) {
    if (!confirm("Deseja excluir este treino?")) return;

    try {
      const token = getToken();
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) throw new Error("Falha ao remover");

      setTreinosAgendados((arr) => arr.filter((t) => t.id !== id));
      setFullscreenId(null);

      localStorage.removeItem(TIMER_KEY(id));
      localStorage.removeItem(CHECKLIST_KEY(id));
      setElapsedByTreino((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
      setChecklistByTreino((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir treino.");
    }
  }

  function renderTreinoDetalhesConteudo(t: TreinoAgendado) {
    const exs = t.treinoProgramado?.exercicios ?? [];
    if (exs.length === 0)
      return <p className="text-gray-500">Nenhum exercício cadastrado.</p>;

    const ck = checklistByTreino[t.id] ?? {};
    const tileInfo = tiles.find((tl) => tl.id === t.id);
    const isMissedTreino = tileInfo?.isMissed ?? false;
    const toggleExercicio = (itemKey: string) => {
      if (isMissedTreino) return;

      setChecklistByTreino((prev) => {
        const atualTreino = { ...(prev[t.id] ?? {}) };
        const novoValor = !atualTreino[itemKey];
        atualTreino[itemKey] = novoValor;

        const next = { ...prev, [t.id]: atualTreino };
        try {
          localStorage.setItem(CHECKLIST_KEY(t.id), JSON.stringify(atualTreino));
        } catch {}
        return next;
      });
    };

type ExercicioDaLista = (typeof exs)[number];

function obterItemKey(ex: ExercicioDaLista) {
  return String(
    (ex as any)._key ??
    ex.exercicio.id
  );
}

function obterMidiaUrl(ex: ExercicioDaLista) {
  const midiaDireta =
    ex.exercicio.videoDemonstrativoUrl ||
    (ex.exercicio as any).imgDemonstrativaUrl ||
    null;

  const midiaFallback = (() => {
    const midia = midiaDoCatalogo(
      ex.exercicio.nome
    );

    return midia?.video || midia?.img || null;
  })();

  const midiaRaw =
    midiaDireta || midiaFallback;

  return midiaRaw
    ? resolveUploadUrl(midiaRaw)
    : null;
}

const exercicioMidiaSelecionado =
  exs.find((ex) => {
    const itemKey = obterItemKey(ex);
    const midiaKey = `${t.id}:${itemKey}`;

    return midiaKey === midiaExercicioAberta;
  }) ?? null;

const midiaSelecionada =
  exercicioMidiaSelecionado
    ? {
        key: midiaExercicioAberta!,
        nome:
          exercicioMidiaSelecionado.exercicio.nome,
        url: obterMidiaUrl(
          exercicioMidiaSelecionado
        ),
      }
    : null;

function fecharPlayerExercicio() {
  setPlayerMidiaAberto(false);

  if (fecharMidiaTimerRef.current !== null) {
    window.clearTimeout(
      fecharMidiaTimerRef.current
    );
  }

  // Espera a animação terminar antes de retirar o vídeo
  fecharMidiaTimerRef.current =
    window.setTimeout(() => {
      setMidiaExercicioAberta(null);
      setErroMidiaExercicio(null);
      fecharMidiaTimerRef.current = null;
    }, 500);
}

return (
  <div>
    {/* Player único, sempre acima da lista */}
    <div
      aria-hidden={!playerMidiaAberto}
      className={`grid overflow-hidden transition-all duration-500 ease-in-out ${
        playerMidiaAberto &&
        midiaSelecionada?.url
          ? "mb-4 grid-rows-[1fr] opacity-100"
          : "mb-0 grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        {midiaSelecionada?.url && (
          <div
            className={`overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm transition-all duration-500 ease-in-out ${
              playerMidiaAberto
                ? "translate-y-0 scale-100"
                : "-translate-y-3 scale-[0.96]"
            }`}
          >
            <div className="flex items-center justify-between border-b bg-green-50 px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold text-green-900">
                Demonstração:{" "}
                {midiaSelecionada.nome}
              </span>

              <button
                type="button"
                onClick={fecharPlayerExercicio}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-white"
                aria-label="Recolher vídeo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {erroMidiaExercicio ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">
                {erroMidiaExercicio}
              </p>
            ) : isYouTubeUrl(
                midiaSelecionada.url
              ) ? (
              <iframe
                key={midiaSelecionada.key}
                src={toYouTubeEmbed(
                  midiaSelecionada.url
                )}
                className="aspect-video w-full bg-black"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={midiaSelecionada.nome}
              />
            ) : isVideoUrl(
                midiaSelecionada.url
              ) ? (
              <video
                key={midiaSelecionada.key}
                src={midiaSelecionada.url}
                className="aspect-video w-full bg-black object-contain"
                controls
                autoPlay
                playsInline
                onError={() =>
                  setErroMidiaExercicio(
                    "Não foi possível carregar o vídeo."
                  )
                }
              />
            ) : (
              <img
                key={midiaSelecionada.key}
                src={midiaSelecionada.url}
                alt={midiaSelecionada.nome}
                className="max-h-[420px] w-full object-contain"
                onError={() =>
                  setErroMidiaExercicio(
                    "Não foi possível carregar a imagem."
                  )
                }
              />
            )}
          </div>
        )}
      </div>
    </div>

    {/* A expansão do player empurra esta lista para baixo */}
    <div className="space-y-2">
      {exs.map((ex) => {
const itemKey = obterItemKey(ex);
const midiaKey = `${t.id}:${itemKey}`;
const checked = ck[itemKey] === true;

const midiaUrl = obterMidiaUrl(ex);
const temMidia = Boolean(midiaUrl);

const estaAberta =
  playerMidiaAberto &&
  midiaExercicioAberta === midiaKey;

function alternarMidia() {
  if (!temMidia || !midiaUrl) return;

  setErroMidiaExercicio(null);

  if (
    midiaExercicioAberta === midiaKey &&
    playerMidiaAberto
  ) {
    fecharPlayerExercicio();
    return;
  }

  if (fecharMidiaTimerRef.current !== null) {
    window.clearTimeout(
      fecharMidiaTimerRef.current
    );

    fecharMidiaTimerRef.current = null;
  }

  setMidiaExercicioAberta(midiaKey);

  // Permite ao React montar o conteúdo antes da animação
  window.requestAnimationFrame(() => {
    setPlayerMidiaAberto(true);
  });
}

  function executarPeloTeclado(
    event: React.KeyboardEvent<HTMLDivElement>
  ) {
    if (!temMidia) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      alternarMidia();
    }
  }

return (
  <div key={midiaKey}>
    {/* Card selecionável */}
    <div
      role={temMidia ? "button" : undefined}
      tabIndex={temMidia ? 0 : -1}
      aria-expanded={
        temMidia ? estaAberta : undefined
      }
      aria-disabled={!temMidia}
      onClick={alternarMidia}
      onKeyDown={executarPeloTeclado}
      className={`flex items-center justify-between gap-3 rounded-lg border bg-neutral-50 p-3 transition-all duration-300 ${
        temMidia
          ? "cursor-pointer hover:border-green-400 hover:bg-green-50"
          : "cursor-default"
      } ${
        estaAberta
          ? "border-green-500 bg-green-50 ring-1 ring-green-200"
          : ""
      }`}
    >
        <div className="flex min-w-0 items-start gap-3">
          {/* Impede que o clique na conclusão abra o vídeo */}
          <div onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => toggleExercicio(itemKey)}
              disabled={isMissedTreino}
              className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
                isMissedTreino
                  ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-300"
                  : checked
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-gray-300 bg-white text-gray-400"
              }`}
              aria-pressed={checked}
              aria-label={
                checked
                  ? "Marcar como não feito"
                  : "Marcar como feito"
              }
            >
              {checked ? (
                <CircleCheck className="h-4 w-4" />
              ) : (
                <CircleX className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="min-w-0">
            <div
              className={`font-medium ${
                checked
                  ? "text-gray-500 line-through"
                  : ""
              }`}
            >
              {ex.exercicio.nome}
            </div>

            <div className="space-y-1 text-sm text-gray-500">
              {ex.series != null && ex.series !== 0 && (
                <p>
                  <span className="font-medium">Séries:</span>{" "}
                  {ex.series}
                </p>
              )}

              {ex.repeticoes && (
                <p>
                  <span className="font-medium">
                    Repetições:
                  </span>{" "}
                  {ex.repeticoes}
                </p>
              )}

              {ex.duracao && (
                <p>
                  <span className="font-medium">Duração:</span>{" "}
                  {ex.duracao}
                </p>
              )}

              {ex.descanso && (
                <p>
                  <span className="font-medium">Descanso:</span>{" "}
                  {ex.descanso}
                </p>
              )}
            </div>
          </div>
        </div>

        {temMidia && (
          <div className="shrink-0 text-green-800">
            {estaAberta ? (
              <ChevronUp
                className="h-5 w-5"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="h-5 w-5"
                aria-hidden="true"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
})}
    </div>
  </div>
);
}

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 overflow-x-hidden">
      <div className="w-full px-3 sm:px-4 lg:px-8">
        <div className="pt-3">
          <HealthBanner />
        </div>


        <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-neutral-50/90 backdrop-blur px-3 sm:px-0 pt-3 pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex w-full items-center gap-2 bg-white border rounded-xl p-1 shadow-sm">

              <button
                type="button"
                onClick={() => setMainTab("treinos")}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                  mainTab === "treinos"
                    ? "bg-green-800 text-white"
                    : "text-green-900 hover:bg-green-50"
                }`}
              >
                Treinos
              </button>

              {FLAGS.LEARNING_ENABLED && (
                <button
                  type="button"
                  onClick={() => navigate("/learning")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                    mainTab === "learning"
                      ? "bg-green-800 text-white"
                      : "text-green-900 hover:bg-green-50"
                  }`}
                >
                  Learning
                </button>
              )}

  {/* O ml-auto empurra este bloco para a direita */}
  <div className="ml-auto flex items-center gap-2">
    <div className="h-6 w-px bg-gray-200" />

    <button
      type="button"
      onClick={() => setMenuTreinosAberto(true)}
      aria-label="Abrir menu de treinos"
      aria-expanded={menuTreinosAberto}
      className="inline-flex h-8 w-9 items-center justify-center rounded-lg text-green-900 transition hover:bg-green-50"
    >
      <Menu className="h-5 w-5" />
    </button>
  </div>


            </div>
        
            {canVerElenco && (
              <Link
                href="/treinos/elenco"
                aria-label="Ir para o elenco"
                className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50"
              >
                <SoccerFieldIcon className="w-5 h-5" />
              </Link>
            )}
          </div>


        </div>


{mainTab === "treinos" && (
  <div className="space-y-8">
    {/* PRIMEIRA SEÇÃO: HOJE */}
    <section>
      <div className="mb-3">
        <h2 className="text-xl font-bold text-gray-900">Hoje</h2>
        <p className="text-sm text-gray-500">
          Seus treinos programados para hoje
        </p>
      </div>


            <div className="mt-4 mb-2 flex justify-center">
              <div className="w-full max-w-4xl bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">

<div className="flex items-center justify-between px-2 py-2">
  <div className="flex items-center gap-2">
    <CalendarClock className="h-5 w-5 text-green-800" />

    <div>
      <h3 className="text-lg font-semibold text-green-900">
        Minha Agenda
      </h3>

      <p className="text-xs capitalize text-gray-500">
        {tituloMesAgenda}
      </p>
    </div>
  </div>
</div>

{/* Calendário único: semana recolhida ou mês expandido */}
<div className="mt-3 overflow-hidden rounded-xl border bg-neutral-50 p-2 sm:p-3">
  {/* Cabeçalho dos dias da semana */}
  <div className="grid grid-cols-7 gap-1 text-center">
    {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
      (nomeDia) => (
        <span
          key={nomeDia}
          className="py-1 text-[10px] font-semibold uppercase text-gray-500 sm:text-xs"
        >
          {nomeDia}
        </span>
      )
    )}
  </div>

  {/* Todas as semanas pertencem à mesma grade */}
  <div className="mt-1">
    {semanasMesAgenda.map((semana, semanaIndex) => {
      const linhaVisivel =
        agendaAberta || semanaIndex === indiceSemanaSelecionada;

      return (
        <div
          key={semana[0].toISOString()}
          aria-hidden={!linhaVisivel}
          className={`grid grid-cols-7 gap-1 overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-in-out ${
            linhaVisivel
              ? "max-h-[72px] py-0.5 opacity-100"
              : "pointer-events-none max-h-0 py-0 opacity-0"
          }`}
        >
          {semana.map((dia) => {
            const selecionado = sameDay(
              dia,
              dataAgendaSelecionada
            );

            const diaAtual = sameDay(dia, hoje);

            const foraDoMes =
              dia.getMonth() !== dataAgendaSelecionada.getMonth();

            const quantidade = quantidadeItensAgenda(dia);

            return (
              <button
                key={dia.toISOString()}
                type="button"
                tabIndex={linhaVisivel ? 0 : -1}
                onClick={() => setDataAgendaSelecionada(dia)}
                aria-label={dia.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                className={`relative flex aspect-square min-h-10 items-center justify-center rounded-lg text-xs font-semibold transition sm:text-sm ${
                  selecionado
                    ? "bg-green-800 text-white shadow-sm"
                    : diaAtual
                      ? "border border-green-500 bg-green-50 text-green-900"
                      : foraDoMes
                        ? "text-gray-300 hover:bg-gray-100"
                        : "text-gray-700 hover:bg-green-100"
                }`}
              >
                {dia.getDate()}

                {quantidade > 0 && (
                  <span
                    className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                      selecionado
                        ? "bg-white"
                        : foraDoMes
                          ? "bg-gray-300"
                          : "bg-green-700"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      );
    })}
  </div>
</div>

{/* Botão no canto inferior direito */}
<div className="mt-3 flex justify-end">
  <button
    type="button"
    onClick={() => setAgendaAberta((aberta) => !aberta)}
    aria-expanded={agendaAberta}
    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-50"
  >
    {agendaAberta ? (
      <>
        Ver somente a semana
        <ChevronUp className="h-4 w-4" />
      </>
    ) : (
      <>
        Ver mês inteiro
        <ChevronDown className="h-4 w-4" />
      </>
    )}
  </button>
</div>

<div className="mt-4 border-t pt-3">
  <p className="mb-3 text-sm font-semibold capitalize text-gray-700">
    {tituloDiaAgenda}
  </p>

  <div className="max-h-[260px] overflow-y-auto">
                    {agendaItemsDoDia.length === 0 ? (
                      <p className="rounded-lg bg-neutral-50 px-3 py-4 text-center text-sm text-gray-500">
                        Nenhum treino ou evento agendado para este dia.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {agendaItemsDoDia.map((item) => {
                          if (item.origem === "treino") {
                            const treino = treinosAgendados.find(
                              (t) => t.id === item.id
                            );
                            if (!treino) return null;

                            const d = getDataExibicaoTreino(treino);
                            const isHoje = d ? sameDay(d, hoje) : false;
                            const diaStr = d
                              ? String(d.getDate()).padStart(2, "0")
                              : "—";
                            const hora = getHoraHHMM(d);
                            const subtitulo = d
                              ? `${d.toLocaleDateString("pt-BR", { weekday: "short", month: "short" })}${
                                  hora ? ` • ${hora}` : ""
                                }`
                              : "Sem data";

                            const criadorLabel = getCriadorLabel(treino);
                            const st = (statusPorTreino[treino.id]?.status ??
                              treino.meuStatus) as TreinoStatus | undefined;

                            const submittedAgendado =
                              (treino.submissao?.aprovados ?? 0) > 0 ||
                              treino.submissao?.feito === true ||
                              idsAgendadosSubmetidos.has(treino.id);

                            const diaPassou = d ? endOfDay(d) < now : false;
                            const expiradoBackend =
                              (st as string) === "EXPIRED" ||
                              (treino as any).execucaoStatus === "EXPIRED";

                            const isMissedTreino =
                              !submittedAgendado &&
                              (diaPassou || expiradoBackend) &&
                              st !== "COMPLETED";

                            let circleClass =
                              "flex items-center justify-center rounded-full border h-10 w-10 text-sm font-bold shrink-0 bg-gray-50 border-gray-300 text-gray-800";
                            let titleClass =
                              "font-medium truncate text-gray-900";

                            if (submittedAgendado || st === "COMPLETED") {
                              circleClass =
                                "flex items-center justify-center rounded-full border h-10 w-10 text-sm font-bold shrink-0 bg-emerald-50 border-emerald-300 text-emerald-800";
                              titleClass =
                                "font-medium truncate text-emerald-800";
                            } else if (isMissedTreino) {
                              circleClass =
                                "flex items-center justify-center rounded-full border h-10 w-10 text-sm font-bold shrink-0 bg-red-50 border-red-300 text-red-700";
                              titleClass =
                                "font-medium truncate text-red-700";
                            } else if (isHoje) {
                              circleClass += " ring-2 ring-gray-300";
                            }

                            return (
                              <li
                                key={`treino-${treino.id}`}
                                className="py-1.5"
                              >
                                <button
                                  onClick={() => {
                                    if (isMissedTreino) return;
                                    setFullscreenId(treino.id);
                                    setMenuOpen(false);
                                  }}
                                  aria-label="Abrir treino"
                                  aria-disabled={isMissedTreino}
                                  className={`w-full flex items-center justify-between gap-3 text-left ${
                                    isMissedTreino
                                      ? "opacity-60 cursor-not-allowed"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={circleClass}>{diaStr}</div>

                                    <div className="min-w-0">
                                      <div className={titleClass}>
                                        {treino.titulo}
                                      </div>
                                      <div className="text-[11px] text-gray-500">
                                        TREINO • {subtitulo}
                                        {criadorLabel
                                          ? ` • ${criadorLabel}`
                                          : ""}
                                      </div>
                                    </div>
                                  </div>

                                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                                </button>
                              </li>
                            );
                          }

                          const dateStr = item.inicio
                            ? new Date(item.inicio).toLocaleString("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "Sem data";

                          const icon =
                            item.tipo === "TREINO" ? (
                              <Volleyball className="w-4 h-4 text-green-700" />
                            ) : item.tipo === "DESAFIO" ? (
                              <StarIcon className="w-4 h-4 text-amber-600" />
                            ) : (
                              <CalendarClock className="w-4 h-4 text-blue-700" />
                            );

                          return (
                            <li
                              key={`${item.origem}-${item.id}`}
                              className="flex items-center justify-between bg-neutral-50 border rounded-lg px-3 py-2 hover:bg-neutral-100"
                            >
                              <div className="flex items-center gap-2">
                                {icon}
                                <div>
                                  <div className="text-sm font-medium">
                                    {item.titulo}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {item.tipo} • {dateStr}
                                  </div>
                                </div>
                              </div>

                              {item.origem === "desafio" && (
                                <Link
                                  href={`/desafios/${item.id}`}
                                  className="text-green-700 text-xs sm:text-sm"
                                >
                                  Ver
                                </Link>
                              )}

                              {item.origem === "evento" && (
                                <Link
                                  href={`/eventos/${item.id}`}
                                  className="text-green-700 text-xs sm:text-sm"
                                >
                                  Ver evento
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

    </section>

    {/* Separação entre Hoje e Meus Treinos */}
    <div className="border-t border-gray-200" />

    {/* SEGUNDA SEÇÃO: MEUS TREINOS */}
    <section>
      <div className="mb-3">
        <h2 className="text-xl font-bold text-gray-900">Meus Treinos</h2>
        <p className="text-sm text-gray-500">
          Todos os seus treinos disponíveis
        </p>
      </div>


          <>
                <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mb-6">


                  {tiles.length > 0 && (
                    <div
                      ref={stripRef}
                      className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory"
                    >
                      {tiles.map((tl) => {
                        const isMissed = tl.isMissed;

                        return (
                          <button
                            id={`tile-${tl.id}`}
                            key={tl.id}
                            onClick={() => {
                              setExpandedId((prev) => (prev === tl.id ? null : tl.id));
                              setFullscreenId(tl.id);
                              setMenuOpen(false);
                            }}
                            className={`snap-center shrink-0 min-w-[180px] max-w-[220px] text-left rounded-xl border px-3 py-2 ${
                              tl.statusClass
                            } ${tl.borderClass} ${
                              isMissed ? "opacity-80" : "hover:opacity-95"
                            }`}
                            title={tl.titulo}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${tl.dotClass}`}
                                />
                               {(() => {
                                  const hora = getHoraHHMM(tl.date);

                                  return (
                                    <span className="font-semibold text-sm">
                                      {tl.date
                                        ? tl.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                                        : "Sem data"}
                                      {hora ? (
                                        <span className="ml-2 text-[12px] font-medium text-gray-700">
                                          {hora}
                                        </span>
                                      ) : null}
                                    </span>
                                  );
                                })()}

                                {tl.isToday && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/70 border">
                                    Hoje
                                  </span>
                                )}
                              </div>

                              {expandedId === tl.id ? (
                                <ChevronUp className="w-4 h-4 opacity-70" />
                              ) : (
                                <ChevronDown className="w-4 h-4 opacity-70" />
                              )}
                            </div>

                            <div className="mt-1 text-sm line-clamp-2">
                              {tl.titulo}
                            </div>
                            {tl.sessaoTreinoNome ? (
                              <div className="mt-1 text-[11px] text-gray-600">
                                Sessão: {tl.sessaoTreinoNome}
                              </div>
                            ) : null}
                            <div className="mt-1 text-[11px] opacity-80">
                              {tl.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {FLAGS.DESAFIOS_ENABLED && (
                  <div
                    className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mt-6"
                    style={{
                      maxHeight: DESAFIOS_MAX_PX,
                      overflowY: "auto",
                    }}
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
                          <div
                            key={desafio.id}
                            className="bg-white p-4 rounded-xl shadow-sm border border-yellow-300/60 mb-3"
                          >
                            <h4 className="font-bold text-yellow-700 text-lg mb-1">
                              <Link
                                href={`/desafios/${desafio.id}`}
                                className="hover:underline"
                              >
                                {desafio.titulo}
                              </Link>
                            </h4>

                            <p className="text-sm text-gray-600 mb-2">
                              {desafio.descricao}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                              <span>Nível: {desafio.nivel}</span>
                              <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
                                {desafio.pontuacao} pts
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-2">
                              <button
                                onClick={() =>
                                  navigate(`/submissao?desafioId=${desafio.id}`)
                                }
                                className="w-full whitespace-nowrap text-[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-800 hover:bg-green-900 text-white"
                                title="Fazer Submissão"
                              >
                                <span className="sm:hidden">Submeter</span>
                                <span className="hidden sm:inline">
                                  Fazer Submissão
                                </span>
                              </button>

                              <button
                                onClick={() =>
                                  navigate(`/desafios/${desafio.id}`)
                                }
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
                      <p className="text-gray-500">
                        Nenhum desafio disponível no momento.
                      </p>
                    )}
                  </div>
                )}
          </>
        
    </section>
  </div>
)}







      </div>

{menuTreinosAberto && (
  <div
    className="fixed inset-0 z-[70]"
    role="dialog"
    aria-modal="true"
    aria-label="Menu de treinos"
  >
    <button
      type="button"
      className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
      onClick={() => setMenuTreinosAberto(false)}
      aria-label="Fechar menu"
    />

    <aside className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-green-950">
            Menu de treinos
          </h2>

          <p className="text-sm text-gray-500">
            Escolha o que deseja fazer
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMenuTreinosAberto(false)}
          aria-label="Fechar menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-gray-600 transition hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        <button
          type="button"
          onClick={() => navegarPeloMenu("/treinos/novo")}
          className="flex w-full items-center gap-3 rounded-xl border border-green-100 p-4 text-left transition hover:border-green-300 hover:bg-green-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-800">
            <CalendarPlus className="h-5 w-5" />
          </span>

          <span>
            <span className="block font-semibold text-green-950">
              Agendar novo treino
            </span>

            <span className="block text-sm text-gray-500">
              Programe um treino para uma data e horário
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => navegarPeloMenu("/treinos/livre/novo")}
          className="flex w-full items-center gap-3 rounded-xl border border-green-100 p-4 text-left transition hover:border-green-300 hover:bg-green-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            <Dumbbell className="h-5 w-5" />
          </span>

          <span>
            <span className="block font-semibold text-green-950">
              Registrar treino livre
            </span>

            <span className="block text-sm text-gray-500">
              Registre uma atividade realizada por conta própria
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => navegarPeloMenu("/treinos/livre/historico")}
          className="flex w-full items-center gap-3 rounded-xl border border-green-100 p-4 text-left transition hover:border-green-300 hover:bg-green-50"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <History className="h-5 w-5" />
          </span>

          <span>
            <span className="block font-semibold text-green-950">
              Histórico de treinos livres
            </span>

            <span className="block text-sm text-gray-500">
              Consulte seus treinos registrados
            </span>
          </span>
        </button>

        {FLAGS.LEARNING_ENABLED && (
          <button
            type="button"
            onClick={() => navegarPeloMenu("/learning")}
            className="flex w-full items-center gap-3 rounded-xl border border-green-100 p-4 text-left transition hover:border-green-300 hover:bg-green-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <GraduationCap className="h-5 w-5" />
            </span>

            <span>
              <span className="block font-semibold text-green-950">
                Learning
              </span>

              <span className="block text-sm text-gray-500">
                Acesse conteúdos e metodologias
              </span>
            </span>
          </button>
        )}
      </nav>
    </aside>
  </div>
)}

      {fullscreenId && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <div className="sticky top-0 z-10 px-4 py-3 border-b bg-white/95 backdrop-blur">
            {(() => {
              const atual = ordenados.find((t) => t.id === fullscreenId);
              const rawStatus =
                fullscreenId
                  ? (statusPorTreino[fullscreenId]?.status as
                      | TreinoStatus
                      | "READY_TO_SUBMIT"
                      | undefined)
                  : undefined;

              const backendStatus = (atual?.meuStatus ??
                (atual as any)?.execucaoStatus) as TreinoStatus | undefined;

              const submittedAgendado =
                (atual?.submissao?.aprovados ?? 0) > 0 ||
                atual?.submissao?.feito === true ||
                (atual ? idsAgendadosSubmetidos.has(atual.id) : false);

              let st: TreinoStatus | "READY_TO_SUBMIT" | undefined = rawStatus;
              if (!st || st === "PENDING") {
                if (backendStatus === "COMPLETED" || submittedAgendado) {
                  st = "COMPLETED";
                } else if (backendStatus === "EXPIRED") {
                  st = "EXPIRED";
                } else if (!st) {
                  st = backendStatus ?? "PENDING";
                }
              }

              const elapsed =
                fullscreenId && (elapsedByTreino[fullscreenId] ?? 0);

              const exList = atual?.treinoProgramado?.exercicios ?? [];
              const exKeys = exList.map((e: any) => e?._key ?? e?.exercicio?.id).filter(Boolean);
              const ck = fullscreenId ? checklistByTreino[fullscreenId] ?? {} : {};
              const total = exKeys.length;
              const allChecked = total > 0 && exKeys.every((k: string) => ck[k]);
              const d = atual?.dataTreino
                ? new Date(atual.dataTreino)
                : null;
              const diaPassou = d ? endOfDay(d) < now : false;
              const expiradoBackend =
                (st as string) === "EXPIRED" ||
                (atual as any)?.execucaoStatus === "EXPIRED";
              const dExib = atual ? getDataExibicaoTreino(atual) : null;
              const horaTop = getHoraHHMM(dExib);
              const isCompletedTreino =
                st === "COMPLETED" || submittedAgendado;
              const isMissedTreino =
                !isCompletedTreino &&
                (diaPassou || expiradoBackend) &&
                st !== "IN_PROGRESS";

              return (
                <div className="relative flex items-center gap-3">
                  {st === "IN_PROGRESS" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div
                        className="font-mono font-black text-4xl sm:text-5xl text-emerald-700 tracking-[.15em]"
                        aria-live="polite"
                      >
                        {formatHHMMSS(elapsed || 0)}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setFullscreenId(null);
                    }}
                    className="inline-flex items-center justify-center p-2 rounded-md border bg-white hover:bg-gray-50 relative z-10"
                    aria-label="Fechar"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex-1 min-w-0 text-center relative z-0">
                    {st !== "IN_PROGRESS" && (
                      <div className="text-base sm:text-lg font-semibold text-green-900 truncate max-w-[70vw] mx-auto">
                        {formatarDataHoraBR(dExib)}
                      </div>
                    )}
                  </div>

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
                        {st === "IN_PROGRESS" && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              if (atual) finalizarEEnviar(atual);
                            }}
                            disabled={total > 0 && !allChecked}
                            className={`w-full text-left px-3 py-2 text-sm ${
                              total > 0 && !allChecked
                                ? "text-gray-400 cursor-not-allowed bg-gray-50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            Finalizar e enviar
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (!atual) return;
                            if (isCompletedTreino || isMissedTreino) return;
                            setMenuOpen(false);
                            remarcarTreino(atual);
                          }}
                          disabled={isCompletedTreino || isMissedTreino}
                          className={`w-full text-left px-3 py-2 text-sm ${
                            isCompletedTreino || isMissedTreino
                              ? "text-gray-400 cursor-not-allowed bg-gray-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          Remarcar (≤ 7 dias)
                        </button>

                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            if (atual) removerTreinoAgendado(atual.id);
                          }}
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

          <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
            {ordenados
              .filter((t) => t.id === fullscreenId)
              .map((treino) => {
                const criadorLabel = getCriadorLabel(treino);

                return (
                  <div key={treino.id} className="max-w-3xl mx-auto">
                    <h2 className="font-bold text-lg text-green-900 mb-1">
                      {treino.titulo}
                    </h2>

                    {criadorLabel && (
                      <p className="text-sm text-gray-600 mb-3">
                        <span className="font-medium">Criado por:</span>{" "}
                        {criadorLabel}
                      </p>
                    )}

                    {renderTreinoDetalhesConteudo(treino)}
                  </div>
                );
              })}
          </div>

          {(() => {
            const t = ordenados.find((x) => x.id === fullscreenId);
            if (!t || !fullscreenId) return null;

            const rawStatus =
              statusPorTreino[fullscreenId]?.status as
                | TreinoStatus
                | "READY_TO_SUBMIT"
                | undefined;

            const backendStatus = (t.meuStatus ??
              (t as any)?.execucaoStatus) as TreinoStatus | undefined;

            const submittedAgendado =
              (t.submissao?.aprovados ?? 0) > 0 ||
              t.submissao?.feito === true ||
              idsAgendadosSubmetidos.has(t.id);

            let st: TreinoStatus | "READY_TO_SUBMIT" | undefined = rawStatus;
            if (!st || st === "PENDING") {
              if (backendStatus === "COMPLETED" || submittedAgendado) {
                st = "COMPLETED";
              } else if (backendStatus === "EXPIRED") {
                st = "EXPIRED";
              } else if (!st) {
                st = backendStatus ?? "PENDING";
              }
            }

            const exList = t.treinoProgramado?.exercicios ?? [];
            const exKeys = exList.map((e: any) => e?._key ?? e?.exercicio?.id).filter(Boolean);
            const ck = checklistByTreino[fullscreenId] ?? {};
            const total = exKeys.length;
            const allChecked = total > 0 && exKeys.every((k: string) => ck[k]);
            const isReadyToSubmit = st === "READY_TO_SUBMIT";
            const d = t.dataTreino ? new Date(t.dataTreino) : null;
            const diaPassou = d ? endOfDay(d) < now : false;
            const expiradoBackend =
              (st as string) === "EXPIRED" ||
              (t as any)?.execucaoStatus === "EXPIRED";

            const isCompletedTreino =
              st === "COMPLETED" || submittedAgendado;
            const isMissedTreino =
              !isCompletedTreino &&
              (diaPassou || expiradoBackend) &&
              st !== "IN_PROGRESS";

            let labelCentral: string;
            if (st === "IN_PROGRESS") {
              labelCentral = "Finalizar";
            } else if (isReadyToSubmit) {
              labelCentral = "Fazer submissão";
            } else if (isCompletedTreino) {
              labelCentral = "Treino concluído";
            } else {
              labelCentral = "Iniciar";
            }

            const windowInfo = getStartWindowInfo(t);
            const missedByRule = !isCompletedTreino && windowInfo.isLate;
            const finalIsMissed = isMissedTreino || missedByRule;
            const blockStartByTime =
              (!st || st === "PENDING") && !windowInfo.canStart;
            const disabledCentral =
              (st === "IN_PROGRESS" && total > 0 && !allChecked) ||
              isCompletedTreino ||
              blockStartByTime;
            const visuallyDisabled = disabledCentral || finalIsMissed;

            const handleCentralClick = () => {
              if (isCompletedTreino) {
                toast.success(
                  "Este treino já foi concluído e aprovado. Você ainda pode revisar os exercícios quando quiser. 😉"
                );
                return;
              }

              if (finalIsMissed) {
                handleMissedClick(t.id);
                return;
              }

              if (!st || st === "PENDING") {
                if (!windowInfo.canStart) {
                  handleMissedClick(t.id);
                  return;
                }
                iniciar(t.id);
                return;
              }

              if (st === "IN_PROGRESS") {
                if (tickRef.current != null) {
                  window.clearInterval(tickRef.current);
                  tickRef.current = null;
                }
                localStorage.removeItem(TIMER_KEY(fullscreenId));

                const currentElapsed = elapsedByTreino[fullscreenId] ?? 0;
                setElapsedByTreino((prev) => ({
                  ...prev,
                  [fullscreenId]: currentElapsed,
                }));

                setStatusPorTreino((prev) => ({
                  ...prev,
                  [fullscreenId]: {
                    ...(prev[fullscreenId] ?? {}),
                    status: "READY_TO_SUBMIT",
                  },
                }));

                return;
              }

              if (st === "READY_TO_SUBMIT") {
                const elapsed = elapsedByTreino[fullscreenId] ?? 0;
                const params = new URLSearchParams();
                params.set("treinoAgendadoId", t.id);
                /*
                * Informações que serão exibidas
                * na tela de submissão.
                */
                params.set(
                  "treinoNome",
                  String(
                    t.titulo ||
                      "Treino"
                  )
                );

                const pontosDoTreino =
                  Number(
                    t.treinoProgramado
                      ?.pontuacao ?? 0
                  );

                params.set(
                  "pontos",
                  String(
                    Number.isFinite(
                      pontosDoTreino
                    )
                      ? pontosDoTreino
                      : 0
                  )
                );

                const duracaoProgramadaMinutos =
                  Number(
                    t.treinoProgramado
                      ?.duracao ?? 0
                  );

                if (
                  Number.isFinite(
                    duracaoProgramadaMinutos
                  ) &&
                  duracaoProgramadaMinutos > 0
                ) {
                  params.set(
                    "duracaoProgramadaMinutos",
                    String(
                      duracaoProgramadaMinutos
                    )
                  );
                }

                const atletaNome =
                  String(
                    (Storage as any)
                      .nomeUsuario ||
                      localStorage.getItem(
                        "nomeUsuario"
                      ) ||
                      sessionStorage.getItem(
                        "nomeUsuario"
                      ) ||
                      "Atleta"
                  );

                params.set(
                  "atletaNome",
                  atletaNome
                );
                if (elapsed > 0) params.set("tempoSeg", String(elapsed));

                try {
                  const raw = localStorage.getItem(METODOLOGIA_LINK_KEY(t.id));
                  if (raw) {
                    const link = JSON.parse(raw);
                    if (link?.metodologiaId) params.set("metodologiaId", String(link.metodologiaId));
                    if (link?.metodologiaItemId) params.set("metodologiaItemId", String(link.metodologiaItemId));
                    if (link?.estruturaId) params.set("estruturaId", String(link.estruturaId));
                  }
                } catch {}

                navigate(`/submissao?${params.toString()}`);
                return;
              }
            };

            return (
              <div
                className="
                  fixed
                  bottom-0
                  left-0
                  right-0
                  z-30
                  bg-white/95
                  backdrop-blur
                  border-t
                  px-4
                  pt-3
                "
                style={{
                  paddingBottom:
                    "calc(12px + env(safe-area-inset-bottom))",
                }}
              >
                <div className="max-w-3xl mx-auto">
                  <button
                    onClick={handleCentralClick}
                    disabled={disabledCentral}
                    className={`h-12 w-full px-4 rounded-xl text-white font-medium
                      ${
                        st === "IN_PROGRESS"
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : isReadyToSubmit
                          ? "bg-green-700 hover:bg-green-800"
                          : isCompletedTreino
                          ? "bg-gray-400"
                          : "bg-green-700 hover:bg-green-800"
                      }
                      ${visuallyDisabled ? "opacity-60 cursor-not-allowed" : ""}
                    `}
                  >
                    {labelCentral}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}



      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                Compartilhar desafio
              </h3>
              <button
                onClick={() => setModalAberto(false)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {carregandoMutuos ? (
              <p className="text-gray-600">Carregando usuários...</p>
            ) : usuariosMutuos.length === 0 ? (
              <p className="text-gray-600">Nenhum usuário disponível.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 mb-3 pr-1">
                {usuariosMutuos.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      const set = new Set(selecionados);
                      set.has(u.id) ? set.delete(u.id) : set.add(u.id);
                      setSelecionados(set);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border text-left ${
                      selecionados.has(u.id)
                        ? "bg-green-50 border-green-300"
                        : "bg-white"
                    }`}
                  >
                    <Avatar
                      foto={u.foto}
                      alt={u.nome || "Usuário"}
                      className="w-10 h-10 border"
                    />

                    <div className="flex-1">
                      <div className="font-medium">{u.nome}</div>
                      <div className="text-xs text-gray-500">
                        @{u.usuario}
                      </div>
                    </div>

                    {selecionados.has(u.id) && (
                      <Check className="w-5 h-5 text-green-700" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              disabled={selecionados.size === 0 || enviandoDM}
              onClick={() => enviarDesafioDM()}
              className={`w-full py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 ${
                selecionados.size === 0 || enviandoDM
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-700 hover:bg-green-800"
              }`}
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </div>
        </div>
      )}

      {easterEggMsg && (
        <div className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="max-w-xs bg-black/80 text-white text-sm px-4 py-2.5 rounded-full shadow-lg text-center">
            {easterEggMsg}
          </div>
        </div>
      )}

      {!fullscreenId && (
        <BottomNav active="treinos" />
      )}

    </div>
  );
}
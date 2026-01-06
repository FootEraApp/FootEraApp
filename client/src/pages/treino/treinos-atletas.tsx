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
  Star as StarIcon,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";
import BottomNav from "@/components/layout/BottomNav.js";

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
      };
      repeticoes: string;
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

type MinhasSubTreino = {
  id: string;
  treinoAgendadoId: string | null;
  treinoProgramadoId: string | null;
  aprovado: boolean | null;
};

const now = new Date();
const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const PLACEHOLDER_USER = "/assets/usuarios/default-user.png";
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

function resolveUploadUrl(raw?: string | null) {
  if (!raw) return "";

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/assets/")) return raw;

  if (raw.startsWith("/exercicios/")) {
    return `${API.BASE_URL}${raw}`;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API.BASE_URL}${raw}`;
  }

  return `${API.BASE_URL}/${raw.replace(/^\/+/, "")}`;
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
    parseDateSafe(t.prazoEnvio) ||
    parseDateSafe(t.dataTreino) ||
    parseDateSafe(t.treinoProgramado?.dataAgendada ?? null) ||
    null
  );
}

function getDataExibicaoTreinoRaw(t: TreinoAgendado): string | null {
  return (t.prazoEnvio || t.dataTreino || t.treinoProgramado?.dataAgendada || null) as any;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

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

export default function TreinosAtletas() {
  const [location, navigate] = useLocation();
  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [semanasDesafio, setSemanasDesafio] = useState<WeekStatus[]>([]);
  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<
    Set<string>
  >(new Set());
  const [midiaPorNomeExercicio, setMidiaPorNomeExercicio] = useState<
    Record<string, { video?: string | null; img?: string | null }>
  >({});

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

  const [videoModal, setVideoModal] = useState<{
    exercicioId: string;
    nome: string;
    url: string;
  } | null>(null);
  const [videoCarregando, setVideoCarregando] = useState(false);
  const [videoErro, setVideoErro] = useState<string | null>(null);

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

  function pickMidiaFromExercicioPayload(ex: any): string {
  return (
    ex?.videoDemonstrativoUrl ||
    ex?.imgDemonstrativaUrl ||
    ex?.videoUrl ||
    ex?.imagemUrl ||
    ex?.midiaUrl ||
    ex?.midias?.[0]?.url ||
    ""
  );
}

function abrirMidiaExercicioDireto(
  exercicioId: string,
  nome: string,
  midiaRaw?: string | null
) {
  setVideoErro(null);
  setVideoCarregando(true);

  if (!midiaRaw) {
    setVideoErro("Este exercício ainda não tem vídeo ou imagem cadastrados.");
    setVideoCarregando(false);
    return;
  }

  const finalUrl = resolveUploadUrl(midiaRaw);

  setVideoModal({
    exercicioId,
    nome,
    url: finalUrl,
  });

  if (isYouTubeUrl(finalUrl)) {
    setVideoCarregando(false);
  }
}



  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  const [eventosAtleta, setEventosAtleta] = useState<EventoAtleta[]>([]);
  const [agendaAberta, setAgendaAberta] = useState(false);

  const stripRef = useRef<HTMLDivElement | null>(null);

  const [missedClickCounts, setMissedClickCounts] = useState<
    Record<string, number>
  >({});

  const [easterEggMsg, setEasterEggMsg] = useState<string | null>(null);

  useEffect(() => {
    carregarCatalogoExercicios();
  }, []);

  useEffect(() => {
    if (location === "/treinos") {
      carregarTreinosAgendados();
      carregarEventosAtleta();
    }
  }, [location]);

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
      alert("Desafio enviado!");
      setModalAberto(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar DM.");
    } finally {
      setEnviandoDM(false);
    }
  }

  async function carregarEventosAtleta() {
    try {
      const usuarioId =
        (Storage as any).usuarioId ??
        localStorage.getItem("usuarioId") ??
        sessionStorage.getItem("usuarioId");

      const token =
        (Storage as any).token ??
        localStorage.getItem("token") ??
        sessionStorage.getItem("token");

      if (!usuarioId || !token) return;

      const r = await fetch(
        `${API.BASE_URL}/api/eventos/atleta/${usuarioId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) throw new Error("Falha ao buscar eventos");
      const js = await r.json();

      setEventosAtleta(Array.isArray(js) ? js : []);
    } catch (e) {
      console.warn("Falha ao carregar eventos do atleta:", e);
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

      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (r.status === 401) {
        console.warn(
          "[TREINOS] 401 ao buscar treinos agendados – provavelmente token inválido/expirado"
        );
        return;
      }

      if (!r.ok) throw new Error("Falha ao buscar treinos agendados");

      const js = await r.json();
      const listaRaw: any[] = Array.isArray(js) ? js : js.items ?? [];
      const listaAdaptada: TreinoAgendado[] = listaRaw.map((item) => {
        const tp = item.treinoProgramado ?? null;

        return {
          id: item.id,
          titulo: item.titulo ?? tp?.nome ?? "Treino",
          prazoEnvio: item.prazoEnvio ?? null,
          dataTreino: item.prazoEnvio ?? item.dataTreino ?? tp?.dataAgendada ?? null,
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
                  (tp.exercicios ?? []).map((ex: any) => ({
                    exercicio: {
                      id: ex.exercicio?.id ?? "",
                      nome: ex.exercicio?.nome ?? "",
                      videoDemonstrativoUrl: ex.exercicio?.videoDemonstrativoUrl ?? null,
                      imgDemonstrativaUrl: ex.exercicio?.imgDemonstrativaUrl ?? null,
                    },
                    repeticoes: ex.repeticoes ?? "",
                  })) ?? [],

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

      setTreinosAgendados(listaAdaptada);
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
      alert("Erro ao enviar treino.");
    }
  }

  async function remarcarTreino(t: TreinoAgendado) {
    const nova = prompt("Escolha a nova data (AAAA-MM-DD):");
    if (!nova) return;

    try {
      const token = getToken();
      const r = await fetch(`${API.BASE_URL}/api/treinos/agendados/${t.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataTreino: nova,
        }),
      });

      if (!r.ok) throw new Error("Erro ao remarcar");

      setTreinosAgendados((arr) =>
        arr.map((x) => (x.id === t.id ? { ...x, dataTreino: nova } : x))
      );
    } catch (err) {
      console.error(err);
      alert("Não foi possível remarcar o treino.");
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
      alert("Erro ao excluir treino.");
    }
  }

function renderTreinoDetalhesConteudo(t: TreinoAgendado) {
  const exs = t.treinoProgramado?.exercicios ?? [];
  if (exs.length === 0)
    return <p className="text-gray-500">Nenhum exercício cadastrado.</p>;

  const ck = checklistByTreino[t.id] ?? {};

  const tileInfo = tiles.find((tl) => tl.id === t.id);
  const isMissedTreino = tileInfo?.isMissed ?? false;

  const toggleExercicio = (exId: string) => {
    if (isMissedTreino) return;

    setChecklistByTreino((prev) => {
      const atualTreino = { ...(prev[t.id] ?? {}) };
      const novoValor = !atualTreino[exId];
      atualTreino[exId] = novoValor;

      const next = { ...prev, [t.id]: atualTreino };
      try {
        localStorage.setItem(CHECKLIST_KEY(t.id), JSON.stringify(atualTreino));
      } catch {}
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {exs.map((ex) => {
        const checked = ck[ex.exercicio.id] === true;

        return (
          <div
            key={ex.exercicio.id}
            className="p-3 border rounded-lg bg-neutral-50 flex justify-between items-center gap-3"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleExercicio(ex.exercicio.id)}
                disabled={isMissedTreino}
                className={`mt-1 inline-flex items-center justify-center rounded-full border w-6 h-6 transition
                  ${
                    isMissedTreino
                      ? "bg-gray-100 border-gray-300 text-gray-300 cursor-not-allowed"
                      : checked
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-gray-300 text-gray-400"
                  }`}
                aria-pressed={checked}
                aria-label={
                  checked
                    ? "Marcar como não feito"
                    : "Marcar como feito"
                }
              >
                {checked ? (
                  <CircleCheck className="w-4 h-4" />
                ) : (
                  <CircleX className="w-4 h-4" />
                )}
              </button>

              <div>
                <div
                  className={`font-medium ${
                    checked ? "line-through text-gray-500" : ""
                  }`}
                >
                  {ex.exercicio.nome}
                </div>
                <div className="text-sm text-gray-500">
                  {ex.repeticoes || "-"}
                </div>
              </div>
            </div>

            <button
              disabled={isMissedTreino}
              className={`text-green-700 underline text-sm ${
                isMissedTreino ? "text-gray-400 no-underline cursor-not-allowed" : ""
              }`}
              onClick={() => {
                if (isMissedTreino) return;

                const midiaDireta =
                  ex.exercicio.videoDemonstrativoUrl ||
                  (ex.exercicio as any).imgDemonstrativaUrl ||
                  null;

                const midiaFallback = (() => {
                  const m = midiaDoCatalogo(ex.exercicio.nome);
                  return m?.video || m?.img || null;
                })();

                const midia = midiaDireta || midiaFallback;

                if (!midia) {
                  alert("Esse exercício está sem vídeo cadastrado no banco (videoDemonstrativoUrl = null).");
                  return;
                }

                abrirMidiaExercicioDireto(ex.exercicio.id, ex.exercicio.nome, midia);
              }}

            >
              Ver vídeo
            </button>
          </div>
        );
      })}
    </div>
  );
}


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
                aria-label="Ir para o elenco"
                className="flex-shrink-0 inline-flex items-center justify-center p-2.5 rounded-full bg-white text-green-800 border border-green-200 shadow hover:bg-green-50"
              >
                <SoccerFieldIcon className="w-5 h-5" />
              </Link>
            )}
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mb-6">
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
                        <span className="font-semibold text-sm">
                          {tl.date
                            ? tl.date.toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })
                            : "Sem data"}
                        </span>

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
                    <div className="mt-1 text-[11px] opacity-80">
                      {tl.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 mb-2 flex justify-center">
          <div className="w-full max-w-4xl bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4">
            <button
              onClick={() => setAgendaAberta((v) => !v)}
              className="w-full flex items-center justify-between px-2 py-2 text-left"
            >
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-green-800" />
                <h3 className="text-lg font-semibold text-green-900">
                  Minha Agenda
                </h3>
              </div>

              {agendaAberta ? (
                <ChevronUp className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-600" />
              )}
            </button>

            {agendaAberta && (
              <div className="mt-3 border-t pt-3 max-h-[260px] overflow-y-auto">
                {agendaItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Nenhum item na agenda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {agendaItems.map((item) => {
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
                        const subtitulo = d
                          ? d.toLocaleDateString("pt-BR", {
                              weekday: "short",
                              month: "short",
                            })
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
            )}
          </div>
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
      </div>

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
              const exIds = exList.map((e) => e.exercicio.id);
              const ck =
                fullscreenId ? checklistByTreino[fullscreenId] ?? {} : {};
              const total = exIds.length;
              const allChecked = total > 0 && exIds.every((id) => ck[id]);

              const d = atual?.dataTreino
                ? new Date(atual.dataTreino)
                : null;
              const diaPassou = d ? endOfDay(d) < now : false;
              const expiradoBackend =
                (st as string) === "EXPIRED" ||
                (atual as any)?.execucaoStatus === "EXPIRED";

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
                        {atual?.titulo ?? "Treino"}
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
            const exIds = exList.map((e) => e.exercicio.id);
            const ck = checklistByTreino[fullscreenId] ?? {};
            const total = exIds.length;
            const allChecked = total > 0 && exIds.every((id) => ck[id]);

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

            const disabledCentral =
              (st === "IN_PROGRESS" && total > 0 && !allChecked) ||
              isCompletedTreino;

            const visuallyDisabled = disabledCentral || isMissedTreino;

            const handleCentralClick = () => {
              if (isCompletedTreino) {
                alert(
                  "Este treino já foi concluído e aprovado. Você ainda pode revisar os exercícios quando quiser. 😉"
                );
                return;
              }

              if (isMissedTreino) {
                handleMissedClick(t.id);
                return;
              }

              if (!st || st === "PENDING") {
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
                if (elapsed > 0) {
                  params.set("tempoSeg", String(elapsed));
                }
                navigate(`/submissao?${params.toString()}`);
                return;
              }
            };

            return (
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isCompletedTreino || isMissedTreino) return;
                      remarcarTreino(t);
                    }}
                    disabled={isCompletedTreino || isMissedTreino}
                    className={`h-11 px-3 rounded-lg border text-gray-700 bg-white flex-1 ${
                      isCompletedTreino || isMissedTreino
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    Remarcar
                  </button>

                  <button
                    onClick={handleCentralClick}
                    disabled={disabledCentral}
                    className={`h-12 px-4 rounded-xl text-white font-medium flex-[1.4]
                      ${
                        st === "IN_PROGRESS"
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : isReadyToSubmit
                          ? "bg-green-700 hover:bg-green-800"
                          : isCompletedTreino
                          ? "bg-gray-400"
                          : "bg-green-700 hover:bg-green-800"
                      }
                      ${
                        visuallyDisabled
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
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

      {videoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-lg p-4">
            <button
        onClick={() => {
          setVideoModal(null);
          setVideoCarregando(false);
          setVideoErro(null);
        }}
        className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
      >
        <X className="w-6 h-6" />
      </button>

      <h2 className="text-lg font-semibold mb-3">
        {videoModal.nome}
      </h2>

      {videoCarregando && (
        <div className="text-center py-10 text-gray-600">
          Carregando vídeo...
        </div>
      )}

      {videoErro && (
        <div className="text-center py-6 text-red-600">
          {videoErro}
        </div>
      )}

      {!videoErro && isYouTubeUrl(videoModal.url) && (
        <div className="w-full">
          <div className="aspect-w-16 aspect-h-9 max-h-[70vh]">
            <iframe
              src={toYouTubeEmbed(videoModal.url)}
              className="w-full h-full rounded-lg"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {!videoErro &&
        !isYouTubeUrl(videoModal.url) &&
        isVideoUrl(videoModal.url) && (
          <div className="w-full flex justify-center">
            <video
              src={videoModal.url}
              className="w-full max-h-[70vh] rounded-lg object-contain"
              style={{ maxHeight: "70vh" }}
              controls
              autoPlay
              onError={() => {
                setVideoCarregando(false);
                setVideoErro("Não foi possível carregar o vídeo.")
              }}
              onLoadedData={() => setVideoCarregando(false)}
            />
          </div>
        )}

      {!videoErro &&
        !isVideoUrl(videoModal.url) &&
        !isYouTubeUrl(videoModal.url) && (
          <div className="w-full flex justify-center">
          <img
            src={videoModal.url}
            alt={videoModal.nome}
            className="w-full max-h-[70vh] rounded-lg object-contain"
            style={{ maxHeight: "70vh" }}
            onLoad={() => setVideoCarregando(false)}
            onError={() => {
              setVideoCarregando(false);
              setVideoErro("Não foi possível carregar a imagem.");
            }}
          />
          </div>
        )}
    </div>
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
                    <img
                      src={resolveUploadUrl(u.foto || PLACEHOLDER_USER)}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border"
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

      <BottomNav active="treinos" />

    </div>
  );
}

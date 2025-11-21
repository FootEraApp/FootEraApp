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
  Star as StarIcon,
} from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API, FLAGS } from "../../config.js";
import HealthBanner from "../../components/legal/HealthBanner.js";

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
      };
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


const now = new Date();
const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const PLACEHOLDER_USER = "/assets/default-user.png";
const TIMER_KEY = (id: string) => `footera:treinoTimerStart:${id}`;
const CHECKLIST_KEY = (id: string) => `footera:treinoChecklist:${id}`;

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
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const sameDay = (a?: Date | null, b?: Date | null) =>
  !!a && !!b &&
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


export default function TreinosAtletas() {
  const [, navigate] = useLocation();

  const [treinosAgendados, setTreinosAgendados] = useState<TreinoAgendado[]>([]);
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [semanasDesafio, setSemanasDesafio] = useState<WeekStatus[]>([]);
  const [idsAgendadosSubmetidos, setIdsAgendadosSubmetidos] = useState<Set<string>>(new Set());

  const [statusPorTreino, setStatusPorTreino] = useState<Record<string, {
    status: TreinoStatus | string;
    startedAt?: string | null;
    completedAt?: string | null;
  }>>({});

  const [checklistByTreino, setChecklistByTreino] = useState<Record<string, Checklist>>({});
  const [elapsedByTreino, setElapsedByTreino] = useState<Record<string, number>>({});
  const tickRef = useRef<number | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const [videoModal, setVideoModal] = useState<{ exercicioId: string; nome: string; url: string } | null>(null);
  const [videoCarregando, setVideoCarregando] = useState(false);
  const [videoErro, setVideoErro] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [usuariosMutuos, setUsuariosMutuos] = useState<any[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoDM, setEnviandoDM] = useState(false);
  const [carregandoMutuos, setCarregandoMutuos] = useState(false);
  const [desafioParaCompartilhar, setDesafioParaCompartilhar] = useState<string | null>(null);

  const [eventosAtleta, setEventosAtleta] = useState<EventoAtleta[]>([]);
  const [agendaAberta, setAgendaAberta] = useState(false);

  const stripRef = useRef<HTMLDivElement | null>(null);

function abrirModalCompartilhar(id: string) {
  setDesafioParaCompartilhar(id);
  setModalAberto(true);
  carregarUsuariosMutuos();
  setSelecionados(new Set());
}

async function enviarDesafioDM() {
  if (selecionados.size === 0 || !desafioParaCompartilhar) return;

  const token = Storage.token;
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

      const r = await fetch(`${API.BASE_URL}/api/eventos/atleta/${usuarioId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!r.ok) throw new Error("Falha ao buscar eventos");
      const js = await r.json();

      setEventosAtleta(Array.isArray(js) ? js : []);
    } catch (e) {
      console.warn("Falha ao carregar eventos do atleta:", e);
      setEventosAtleta([]);
    }
  }

  const agendaItems: AgendaItem[] = React.useMemo(() => {
    const arr: AgendaItem[] = [];

    // treinos
    treinosAgendados.forEach((t) => {
      if (!t.dataTreino) return;
      arr.push({
        id: t.id,
        tipo: "TREINO",
        titulo: t.titulo,
        inicio: t.dataTreino,
        fim: t.dataExpiracao ?? null,
        origem: "treino",
      });
    });

    // desafios
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

    // eventos externos
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
    function onAgendado() {
      // apenas recarregará os treinos na fase real (parte 2)
      setTimeout(() => {
        window.dispatchEvent(new Event("treinos:ready"));
      }, 50);
    }

    window.addEventListener("treino:agendado", onAgendado);
    return () => window.removeEventListener("treino:agendado", onAgendado);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event("treinos:ready"));
  }, []);

  const tipo = String(
    (Storage as any).tipoSalvo ?? localStorage.getItem("tipo") ?? ""
  ).toLowerCase();
  const canVerElenco = ["professor", "clube", "escolinha"].includes(tipo);
  const isOlheiro = tipo === "olheiro";

  // refs para cálculos visuais
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const agendadosCardRef = useRef<HTMLDivElement | null>(null);
  const [agendadosMaxH, setAgendadosMaxH] = useState<number>(0);

  // 🚨 Ajuste de altura da lista de treinos agendados
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

  // =========================
// ORDENADOS (treinos ordenados por data)
// =========================
const ordenados = [...treinosAgendados].sort((a, b) => {
  const ad = a.dataTreino ? +new Date(a.dataTreino) : 0;
  const bd = b.dataTreino ? +new Date(b.dataTreino) : 0;
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
  const d = t.dataTreino ? new Date(t.dataTreino) : null;
  const isToday = d ? sameDay(d, hoje) : false;

  const st = (t.meuStatus ?? statusPorTreino[t.id]?.status) as TreinoStatus | string | undefined;

  const submitted =
    (t.submissao?.aprovados ?? 0) > 0 ||
    t.submissao?.feito === true ||
    idsAgendadosSubmetidos.has(t.id);

  const diaPassou = d ? endOfDay(d) < now : false;
  const expiradoBackend =
    (st as string) === "EXPIRED" || (t as any).execucaoStatus === "EXPIRED";

  const isMissed =
    !submitted && (diaPassou || expiradoBackend) && st !== "COMPLETED";

  let statusClass = "bg-gray-50";
  let borderClass = "border-gray-300";
  let dotClass = "bg-gray-400";
  let label = "Pendente";

  if (submitted || st === "COMPLETED") {
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
    label = "Hoje";
    dotClass = "bg-emerald-600";
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

// =========================
// TILES (faixa mensal)
// =========================
const tiles: TileInfo[] = ordenados.map((t) => computeTile(t));

// =============================
// 🔹 CARREGAR USUÁRIOS MUTUOS
// =============================
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

// =============================
// 🔹 INICIAR TREINO
// =============================
async function iniciar(id: string) {
  try {
    const token = getToken();
    const now = Date.now();

    localStorage.setItem(TIMER_KEY(id), String(now));

    setStatusPorTreino((s) => ({
      ...s,
      [id]: { status: "IN_PROGRESS", startedAt: new Date().toISOString() },
    }));
  } catch (e) {
    console.error(e);
  }
}

// =============================
// 🔹 FINALIZAR E ENVIAR
// =============================
async function finalizarEEnviar(treino: TreinoAgendado) {
  try {
    const token = getToken();
    if (!token) return;

    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados/${treino.id}/finalizar`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!r.ok) throw new Error("não foi possível finalizar");

    setStatusPorTreino((st) => ({
      ...st,
      [treino.id]: { status: "COMPLETED", completedAt: new Date().toISOString() },
    }));

    setFullscreenId(null);
  } catch (err) {
    console.error("Erro ao finalizar treino:", err);
    alert("Erro ao enviar treino.");
  }
}

// =============================
// 🔹 REMARCAR TREINO
// =============================
async function remarcarTreino(t: TreinoAgendado) {
  const nova = prompt("Escolha a nova data (AAAA-MM-DD):");
  if (!nova) return;

  try {
    const token = getToken();
    const r = await fetch(
      `${API.BASE_URL}/api/treinos/agendados/${t.id}/remarcar`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ novaData: nova }),
      }
    );

    if (!r.ok) throw new Error("Erro ao remarcar");

    setTreinosAgendados((arr) =>
      arr.map((x) => (x.id === t.id ? { ...x, dataTreino: nova } : x))
    );
  } catch (err) {
    console.error(err);
    alert("Não foi possível remarcar o treino.");
  }
}

// =============================
// 🔹 REMOVER TREINO AGENDADO
// =============================
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
  } catch (err) {
    console.error(err);
    alert("Erro ao excluir treino.");
  }
}

// =============================
// 🔹 DETALHES DO TREINO
// =============================
function renderTreinoDetalhesConteudo(t: TreinoAgendado) {
  const exs = t.treinoProgramado?.exercicios ?? [];

  if (exs.length === 0)
    return <p className="text-gray-500">Nenhum exercício cadastrado.</p>;

  return (
    <div className="space-y-4">
      {exs.map((ex) => (
        <div
          key={ex.exercicio.id}
          className="p-3 border rounded-lg bg-neutral-50 flex justify-between"
        >
          <div>
            <div className="font-medium">{ex.exercicio.nome}</div>
            <div className="text-sm text-gray-500">
              {ex.repeticoes || "-"}
            </div>
          </div>
            <button
              className="text-green-700 underline"
              onClick={() =>
                setVideoModal({
                  exercicioId: ex.exercicio.id,
                  nome: ex.exercicio.nome,
                  url:
                    t.treinoProgramado?.exercicios.find(
                      (e) => e.exercicio.id === ex.exercicio.id
                    )?.exercicio?.videoDemonstrativoUrl || "",
                })
              }
            >
              Ver vídeo
            </button>
        </div>
      ))}
    </div>
  );
}


  return (
    <div className="min-h-screen bg-neutral-50 pb-24 overflow-hidden">
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl px-3 sm:px-4 overflow-hidden">
        
        {/* ======= HEALTHBANNER ======= */}
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <HealthBanner />
        </div>

        {/* ======= NOVO COMPONENTE: MINHA AGENDA ======= */}
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4 mt-4 mb-6">
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
                <p className="text-gray-500 text-sm">Nenhum item na agenda.</p>
              ) : (
                <ul className="space-y-2">
                  {agendaItems.map((item) => {
                    const dateStr = item.inicio
                      ? new Date(item.inicio).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "Sem data";

                    const icon =
                      item.tipo === "TREINO"
                        ? <Volleyball className="w-4 h-4 text-green-700" />
                        : item.tipo === "DESAFIO"
                        ? <StarIcon className="w-4 h-4 text-amber-600" />
                        : <CalendarClock className="w-4 h-4 text-blue-700" />;

                    return (
                      <li
                        key={item.id}
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

                        {/* Navegação */}
                        {item.origem === "treino" && (
                          <button
                            className="text-green-700 text-sm"
                            onClick={() => {
                              setFullscreenId(item.id);
                              setAgendaAberta(false);
                            }}
                          >
                            Abrir
                          </button>
                        )}

                        {item.origem === "desafio" && (
                          <Link
                            href={`/desafios/${item.id}`}
                            className="text-green-700 text-sm"
                          >
                            Ver
                          </Link>
                        )}

                        {item.origem === "evento" && (
                          <Link
                            href={`/eventos/${item.id}`}
                            className="text-green-700 text-sm"
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

        {/* ======= AÇÕES RÁPIDAS / MEUS TREINOS ======= */}
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

        {/* BOTÕES DE AÇÃO */}
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



          {/* ======= FAIXA MENSAL (TILES) ======= */}


          {tiles.length > 0 && (
            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory"
            >
              {/* ... AQUI continuam seus tiles (já existentes na parte 3) ... */}
                {tiles.map((tl) => {
                  const disabled = tl.isMissed;

                  return (
                    <button
                      id={`tile-${tl.id}`}
                      key={tl.id}
                      onClick={() => {
                        if (disabled) return;
                        setExpandedId((prev) =>
                          prev === tl.id ? null : tl.id
                        );
                        setFullscreenId(tl.id);
                        setMenuOpen(false);
                      }}
                      className={`snap-center shrink-0 min-w-[180px] max-w-[220px] text-left rounded-xl border px-3 py-2 ${
                        tl.statusClass
                      } ${tl.borderClass} ${
                        disabled ? "cursor-default" : "hover:opacity-95"
                      }`}
                      aria-disabled={disabled}
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

                        {expandedId === tl.id && !disabled ? (
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
        </div>

        {/* ======= TREINOS AGENDADOS ======= */}
        <div
          ref={agendadosCardRef}
          className="bg-white/90 backdrop-blur rounded-xl shadow-sm border p-4"
        >
          <h3 className="text-lg font-semibold mb-3">Treinos agendados</h3>

          <div
            className="overflow-y-auto overscroll-contain -mr-2 pr-2"
            style={{
              maxHeight: agendadosMaxH ? `${agendadosMaxH}px` : undefined,
            }}
          >
            {ordenados.length === 0 ? (
              <p className="text-gray-500">Nenhum treino disponível ainda.</p>
            ) : (
              <ul className="divide-y">
              {ordenados.map((t) => {
                const d = t.dataTreino ? new Date(t.dataTreino) : null;
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

                // ===== lógica do computeTile =====
                const st = statusPorTreino[t.id]?.status as
                  | TreinoStatus
                  | undefined;

                const submitted =
                  (t.submissao?.aprovados ?? 0) > 0 ||
                  idsAgendadosSubmetidos.has(t.id) ||
                  t.submissao?.feito === true;

                const diaPassou = d ? endOfDay(d) < now : false;
                const expiradoBackend =
                  (st as string) === "EXPIRED" ||
                  (t as any).execucaoStatus === "EXPIRED";

                const isMissedTreino =
                  !submitted &&
                  (diaPassou || expiradoBackend) &&
                  st !== "COMPLETED";

                // classe do círculo
                let circleClass =
                  "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-gray-50 border-gray-300 text-gray-800";

                let titleClass =
                  "font-medium truncate text-gray-900";

                if (submitted || st === "COMPLETED") {
                  // VERDE
                  circleClass =
                    "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-emerald-50 border-emerald-300 text-emerald-800";
                  titleClass =
                    "font-medium truncate text-emerald-800";
                } else if (isMissedTreino) {
                  // VERMELHO
                  circleClass =
                    "flex items-center justify-center rounded-full border h-12 w-12 text-base font-bold shrink-0 bg-red-50 border-red-300 text-red-700";
                  titleClass =
                    "font-medium truncate text-red-700";
                } else if (isHoje) {
                  // hoje → realce com anel
                  circleClass += " ring-2 ring-emerald-300";
                }

                return (
                  <li key={t.id} className="py-2">
                    <button
                      onClick={() => {
                        if (isMissedTreino) return;
                        setFullscreenId(t.id);
                        setMenuOpen(false);
                      }}
                      aria-label="Expandir treino"
                      aria-disabled={isMissedTreino}
                      className={`w-full flex items-center justify-between gap-3 text-left ${
                        isMissedTreino
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Círculo com dia */}
                        <div className={circleClass}>{diaStr}</div>

                        {/* Título + subtítulo */}
                        <div className="min-w-0">
                          <div className={titleClass}>{t.titulo}</div>
                          <div className="text-xs text-gray-500">
                            {subtitulo}
                          </div>
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
      {/* ======= DESAFIOS ======= */}
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
                    {/* Submeter */}
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

                    {/* Ver */}
                    <button
                      onClick={() => navigate(`/desafios/${desafio.id}`)}
                      className="w-full whitespace-nowrap text-[11px] sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white border border-green-300 text-green-800 hover:bg-green-50"
                      title="Ver desafio"
                    >
                      Ver desafio
                    </button>

                    {/* Compartilhar */}
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
      {/* ======= FULLSCREEN DO TREINO ======= */}
      {fullscreenId && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          {/* ===== HEADER ===== */}
          <div className="sticky top-0 z-10 px-4 py-3 border-b bg-white/95 backdrop-blur">
            {(() => {
              const atual = ordenados.find((t) => t.id === fullscreenId);
              const st =
                fullscreenId &&
                (statusPorTreino[fullscreenId]?.status as
                  | TreinoStatus
                  | undefined);
              const elapsed =
                fullscreenId &&
                (elapsedByTreino[fullscreenId] ?? 0);

              const exList = atual?.treinoProgramado?.exercicios ?? [];
              const exIds = exList.map((e) => e.exercicio.id);
              const ck = fullscreenId ? checklistByTreino[fullscreenId] ?? {} : {};
              const total = exIds.length;
              const allChecked =
                total > 0 && exIds.every((id) => ck[id]);

              return (
                <div className="relative flex items-center gap-3">
                  {/* TIMER NO CENTRO */}
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

                  {/* BOTÃO FECHAR */}
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

                  {/* TÍTULO */}
                  <div className="flex-1 min-w-0 text-center relative z-0">
                    {st !== "IN_PROGRESS" && (
                      <div className="text-base sm:text-lg font-semibold text-green-900 truncate max-w-[70vw] mx-auto">
                        {atual?.titulo ?? "Treino"}
                      </div>
                    )}
                  </div>

                  {/* MENU (3 pontinhos) */}
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

                        {/* FINALIZAR */}
                        {st === "IN_PROGRESS" && (
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              if (atual) finalizarEEnviar(atual);
                            }}
                            disabled={total > 0 && !allChecked}
                            className={`w-full text-left px-3 py-2 text-sm ${
                              total > 0 && !allChecked
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            Finalizar e enviar
                          </button>
                        )}

                        {/* REMARCAR */}
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            if (atual) remarcarTreino(atual);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                        >
                          Remarcar (≤ 7 dias)
                        </button>

                        {/* EXCLUIR */}
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

          {/* ===== CONTEÚDO DO FULLSCREEN ===== */}
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-28">
            {ordenados
              .filter((t) => t.id === fullscreenId)
              .map((treino) => (
                <div key={treino.id} className="max-w-3xl mx-auto">
                  <h2 className="font-bold text-lg text-green-900 mb-2">
                    {treino.titulo}
                  </h2>

                  {/* REUSANDO FUNÇÃO COMPLETA DO DETALHE */}
                  {renderTreinoDetalhesConteudo(treino)}
                </div>
              ))}
          </div>

          {/* ===== BARRA INFERIOR ===== */}
          {(() => {
            const t = ordenados.find((x) => x.id === fullscreenId);
            if (!t) return null;

            const st =
              statusPorTreino[fullscreenId!]?.status as
                | TreinoStatus
                | undefined;

            const exList = t.treinoProgramado?.exercicios ?? [];
            const exIds = exList.map((e) => e.exercicio.id);
            const ck = checklistByTreino[fullscreenId!] ?? {};
            const total = exIds.length;
            const allChecked =
              total > 0 && exIds.every((id) => ck[id]);

            const iniciarOuFinalizar = () => {
              if (st === "IN_PROGRESS") return finalizarEEnviar(t);
              return iniciar(t.id);
            };

            const labelCentral =
              st === "IN_PROGRESS" ? "Finalizar" : "Iniciar";

            const disabledCentral =
              st === "IN_PROGRESS" && total > 0 && !allChecked;

            return (
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur border-t px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-2">

                  {/* REMARCAR */}
                  <button
                    onClick={() => remarcarTreino(t)}
                    className="h-11 px-3 rounded-lg border text-gray-700 bg-white hover:bg-gray-50 flex-1"
                  >
                    Remarcar
                  </button>

                  {/* INICIAR / FINALIZAR */}
                  <button
                    onClick={iniciarOuFinalizar}
                    disabled={disabledCentral}
                    className={`h-12 px-4 rounded-xl text-white font-medium flex-[1.4]
                      ${
                        st === "IN_PROGRESS"
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : "bg-green-700 hover:bg-green-800"
                      }
                      ${
                        disabledCentral
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                  >
                    {labelCentral}
                  </button>

                  {/* EXCLUIR */}
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
      {/* ======= MODAL DE VÍDEO DO EXERCÍCIO ======= */}
      {videoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-lg p-4">
            {/* BOTÃO FECHAR */}
            <button
              onClick={() => setVideoModal(null)}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-800"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-lg font-semibold mb-3">{videoModal.nome}</h2>

            {/* CARREGANDO */}
            {videoCarregando && (
              <div className="text-center py-10 text-gray-600">
                Carregando vídeo...
              </div>
            )}

            {/* ERRO */}
            {videoErro && (
              <div className="text-center py-6 text-red-600">
                {videoErro}
              </div>
            )}

            {/* YOUTUBE EMBED */}
            {!videoErro && isYouTubeUrl(videoModal.url) && (
              <div className="aspect-w-16 aspect-h-9">
                <iframe
                  src={toYouTubeEmbed(videoModal.url)}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            {/* VÍDEO MP4 */}
            {!videoErro && !isYouTubeUrl(videoModal.url) && isVideoUrl(videoModal.url) && (
              <video
                src={videoModal.url}
                className="w-full rounded-lg"
                controls
                autoPlay
                onError={() => setVideoErro("Não foi possível carregar o vídeo.")}
                onLoadedData={() => setVideoCarregando(false)}
              />
            )}

            {/* IMAGEM */}
            {!videoErro &&
              !isVideoUrl(videoModal.url) &&
              !isYouTubeUrl(videoModal.url) && (
                <img
                  src={videoModal.url}
                  alt={videoModal.nome}
                  className="w-full rounded-lg"
                />
              )}
          </div>
        </div>
      )}

      {/* ======= MODAL COMPARTILHAR DESAFIO (DM) ======= */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Compartilhar desafio</h3>
              <button
                onClick={() => setModalAberto(false)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LISTA DE USUÁRIOS */}
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

            {/* BOTÃO ENVIAR */}
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

      {/* ======= BOTTOM NAV ======= */}
      <nav
        ref={bottomNavRef}
        className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t flex items-center justify-around z-30"
      >
        <Link
          href="/feed"
          className="flex flex-col items-center text-gray-600 hover:text-green-700"
        >
          <House className="w-6 h-6" />
          <span className="text-[10px]">Início</span>
        </Link>

        <Link
          href="/explorar"
          className="flex flex-col items-center text-gray-600 hover:text-green-700"
        >
          <Search className="w-6 h-6" />
          <span className="text-[10px]">Explorar</span>
        </Link>

        <Link
          href="/treinos"
          className="flex flex-col items-center text-green-700"
        >
          <Volleyball className="w-6 h-6" />
          <span className="text-[10px]">Treinos</span>
        </Link>

        <Link
          href="/perfil"
          className="flex flex-col items-center text-gray-600 hover:text-green-700"
        >
          <User className="w-6 h-6" />
          <span className="text-[10px]">Perfil</span>
        </Link>
      </nav>
    </div>
  );
}

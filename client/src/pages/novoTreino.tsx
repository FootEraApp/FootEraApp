// client/src/pages/novoTreino
import { useEffect, useMemo, useRef, useState, ReactNode, memo, type UIEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Volleyball,
  User,
  CirclePlus,
  Search as SearchIcon,
  House,
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Calendar as CalendarIcon,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { TreinosApi } from "../utils/treinosApi.js";
import type { ExItemUI, TreinoCreatePayload } from "../utils/treinos.types.js";
import {
  montarExerciciosParaPayload,
  parseRepeticoesStr,
} from "../utils/treinos.helpers.js";

type ExItemUILocal = ExItemUI & {
  videoUrl?: string | null;
};

type Organizacao = { id: string; nome: string; tipo: "Escolinha" | "Clube" };

type PontuacaoDetalhe = {
  total: number;
  nivel: number;
  tipo: number;
  exercicios: number;
  duracao: number;
  exCount: number;
};

const getToken = () =>
  (Storage as any).token ??
  localStorage.getItem("token") ??
  sessionStorage.getItem("token") ??
  "";

const PONTOS = {
  NIVEL: { Base: 0, Avancado: 10, Performance: 20 } as Record<string, number>,
  TIPO: { Tecnico: 5, Fisico: 6, Tatico: 8 } as Record<string, number>,
  POR_EXERCICIO: 4,
  POR_15_MIN: 1,
};

const NOMES_MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function formatYMD(ano: number, mesZeroBased: number, dia: number): string {
  const m = String(mesZeroBased + 1).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

function toDateOnlyBR(input: string): string {
  const s = String(input || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return formatYMD(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDatetimeLocalValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`; 
}

function toLocalISO_NoZ(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

function parseDateOnlyToLocalMidnight(dateOnly: string): Date {
  const s = toDateOnlyBR(dateOnly);
  if (!s) return new Date(NaN);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function resolveMediaUrl(raw?: string) {
  if (!raw) return "";
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("blob:") || p.startsWith("data:")) return p;
  if (p.startsWith("http")) return p;
  if (p.startsWith("/assets/")) return p;
  return `${API.BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

function resolveVideoUrl(raw?: string) {
  if (!raw) return "";
  const p = raw.replace(/\\/g, "/");

  if (p.startsWith("blob:") || p.startsWith("data:")) return p;

  if (p.startsWith("http")) return p;
  if (p.startsWith("/assets/")) return p;
  return `${API.BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

function calcularPontuacaoTreino(
  nivel: string,
  tipoTreino: string,
  duracaoMin: number,
  exercicios: ExItemUI[],
): PontuacaoDetalhe {

  const exCount = exercicios.filter((e) => e.idCatalogo || (e.nome && e.nome.trim())).length;
  const ptsEx = exCount * PONTOS.POR_EXERCICIO;

  const ptsNivel = PONTOS.NIVEL[nivel as keyof typeof PONTOS.NIVEL] ?? 0;
  const ptsTipo = PONTOS.TIPO[tipoTreino as keyof typeof PONTOS.TIPO] ?? 0;

  const dur = Number.isFinite(Number(duracaoMin)) ? Number(duracaoMin) : 0;
  const ptsDur = Math.max(0, Math.floor(dur / 15) * PONTOS.POR_15_MIN);

  const total = ptsEx + ptsNivel + ptsTipo + ptsDur;
  return { total, nivel: ptsNivel, tipo: ptsTipo, exercicios: ptsEx, duracao: ptsDur, exCount };
}

interface UsuarioLogado {
  tipo: "atleta" | "escola" | "escolinha" | "clube" | "professor";
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
  videoDemonstrativoUrl?: string;
  descricao?: string;
  nivel?: string;
  categorias?: string[];      
  duracaoMinutos?: number | null; 
  tipoTreino?: string | null; 
}


interface AtletaVinculado {
  id: string;
  nome: string;
  foto?: string;
  usuarioId?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  dataAgendada?: string;
  exercicios: {
    id: string;
    nome: string;
    repeticoes?: string;
  }[];
  pontuacao?: number | null;
  treinoProgramadoId?: string | null;
  origemId?: string | null;
  criador?: {
    tipo: "Professor" | "Clube" | "Escolinha";
    id: string;
    nome: string;
  } | null;
  criadorNome?: string | null;
  criadorTipo?: string | null;
  criadores?: { id: string; nome: string }[];
}

interface Elenco {
  id: string;
  nome: string;
  atletasIds?: string[];
}

type TreinoAgendadoResp = {
  id: string;
  titulo: string;
  dataTreino: string;
  treinoProgramadoId: string;
};

const SAVE_KEY = "novoTreinoState";
const RESTORE_FLAG_KEY = "novoTreino-shouldRestore";
const MAX_SLOTS_TREINOS_SALVOS = 5;

function toCategoriaEnum(val?: string | null): string | null {
  if (!val) return null;
  const m = String(val).match(/sub[\s\-]?(\d{1,2})/i);
  if (m) return `Sub${m[1]}`;
  if (/^livre$/i.test(String(val))) return "Livre";
  return val;
}

async function uploadVideo(file: File): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Sem token");

  const fd = new FormData();
  fd.append("foto", file);

  const base = (API as any)?.BASE_URL || "http://localhost:3001";

  const r = await fetch(`${base}/api/upload/perfil`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(txt || "Falha no upload");

  const j = txt ? JSON.parse(txt) : null;

  const url =
    j?.url ||
    j?.fileUrl ||
    j?.path ||
    j?.file?.url ||
    j?.data?.url ||
    "";

  if (!url) throw new Error("Upload não retornou URL");

  return String(url);
}

function authHeaders() {
  const token =
    (Storage as any).token ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";
  const headers: any = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiListarTreinosSalvos(
  ownerTipo: "professor" | "clube" | "escolinha",
  ownerId: string,
) {
  const headers = authHeaders();
  const url = `${API.BASE_URL}/api/treinosSalvos?tipoUsuario=${encodeURIComponent(
    ownerTipo,
  )}&tipoUsuarioId=${encodeURIComponent(ownerId)}&includePublic=0`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error("Falha ao listar treinos salvos");
  const j = await r.json();
  const meus = Array.isArray(j?.meus) ? j.meus : [];
  return meus as Array<{
    id: string;
    titulo: string;
    atualizadoEm?: string;
    expiraEm?: string | null;
  }>;
}

async function apiDeletarTreinoSalvo(id: string) {
  const headers = authHeaders();
  const r = await fetch(
    `${API.BASE_URL}/api/treinosSalvos/${encodeURIComponent(id)}`,
    { method: "DELETE", headers },
  );
  if (!r.ok) throw new Error("Falha ao apagar treino salvo");
  return true;
}

async function apiCriarTreinoSalvo(body: any) {
  const headers = authHeaders();
  const r = await fetch(`${API.BASE_URL}/api/treinosSalvos`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Falha ao criar treino salvo");
  }
  return r.json();
}

async function tentarSalvarComoTreinoSalvo(
  payload: TreinoCreatePayload,
  scoreTotal: number,
) {
  try {
    const token = getToken();
    if (!token) {
      return { saved: false, reason: "sem-token" as const };
    }

    const ownerTipo = payload.tipoUsuario;
    const ownerId = payload.tipoUsuarioId;

    if (!ownerTipo || !ownerId)
      return { saved: false, reason: "sem-dono" as const };

    const meus = await apiListarTreinosSalvos(ownerTipo, ownerId);

    if (meus.length >= MAX_SLOTS_TREINOS_SALVOS) {
      const lista = meus
        .map((m, i) => {
          const dt = m.atualizadoEm || m.expiraEm || "";
          return `${i + 1}) ${m.titulo} ${dt ? `(${dt})` : ""} [${m.id}]`;
        })
        .join("\n");

      const escolha = window.prompt(
        `Você já possui ${MAX_SLOTS_TREINOS_SALVOS} treinos salvos.\n` +
          `Escolha um número para apagar e liberar espaço OU deixe vazio para não salvar este novo treino.\n\n${lista}\n\nDigite 1-${meus.length}, ou deixe em branco para pular:`,
      );

      const idx = Number(escolha);
      if (
        !escolha ||
        !Number.isFinite(idx) ||
        idx < 1 ||
        idx > meus.length
      ) {
        return { saved: false, reason: "usuario-pulou" as const };
      }

      const apagar = meus[idx - 1];
      try {
        await apiDeletarTreinoSalvo(apagar.id);
      } catch {
        alert(
          "Não foi possível apagar o treino selecionado. O novo não será salvo na Gaveta.",
        );
        return { saved: false, reason: "falha-apagar" as const };
      }
    }

    const categorias = Array.isArray(payload.categoria)
      ? payload.categoria.map(toCategoriaEnum).filter(Boolean)
      : [];
    const body = {
      titulo: payload.nome,
      descricao: payload.descricao ?? null,
      nivel: payload.nivel ?? null,
      tipoTreino: payload.tipoTreino ?? null,
      categoria: categorias,
      duracao: payload.duracao ?? null,
      dicas: [],
      conteudo: {
        objetivo: payload.objetivo ?? null,
        exercicios: payload.exercicios,
        pontuacao: scoreTotal ?? null,
        dataAgendada: payload.dataAgendada ?? null,
      },
      publico: false,
      parceiro: false,
      naoExpira: false,
      tipoUsuario: ownerTipo,
      tipoUsuarioId: ownerId,
      criadoPorUsuarioId: payload.usuarioId ?? null,
    };

    await apiCriarTreinoSalvo(body);
    return { saved: true as const };
  } catch (e) {
    console.warn("tentarSalvarComoTreinoSalvo falhou:", e);
    return { saved: false, reason: "erro" as const };
  }
}

function safeParse<T>(str: string | null, fallback: T): T {
  try {
    if (!str) return fallback;
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

function saveState(partial: any) {
  try {
    const prev = safeParse<any>(sessionStorage.getItem(SAVE_KEY), {});
    const next = { ...prev, ...partial };
    sessionStorage.setItem(SAVE_KEY, JSON.stringify(next));
    sessionStorage.setItem(RESTORE_FLAG_KEY, "1");
  } catch {}
}

const steps = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Exercícios" },
  { id: 3, label: "Atletas" },
] as const;

function Stepper({
  current,
  onJump,
  completedUntil,
}: {
  current: number;
  onJump: (n: number) => void;
  completedUntil: number;
}) {
  return (
    <div className="-mx-2 sm:mx-0">
      <div className="overflow-x-auto px-2">
        <ol className="flex items-center gap-2 sm:gap-3 min-w-max">
          {steps.map((s, idx) => {
            const isCurrent = s.id === current;
            const isCompleted = s.id <= completedUntil;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJump(s.id)}
                  className={[
                    "flex items-center gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full border transition text-sm sm:text-base whitespace-nowrap",
                    isCurrent
                      ? "bg-green-700 text-white border-green-700"
                      : isCompleted
                      ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200",
                  ].join(" ")}
                  title={`Ir para ${s.label}`}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs">
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      s.id
                    )}
                  </span>
                  <span className="font-semibold text-xs sm:text-sm">
                    {s.label}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div className="hidden sm:block w-8 h-px bg-gray-300" />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-4 sm:p-6">
      <h3 className="font-bold text-lg sm:text-xl mb-4">{title}</h3>
      {children}
    </div>
  );
}

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect(); // carrega uma vez e pronto
      }
    }, options);

    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return { ref, inView };
}

const VideoThumb = memo(function VideoThumb({
  src,
  onClick,
}: {
  src: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative w-full h-44 sm:h-28 rounded overflow-hidden bg-black"
      title="Ver vídeo"
    >
      {/* thumbnail fake */}
      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
        <Play className="w-10 h-10 text-white opacity-90" />
      </div>
    </button>
  );
});



export default function NovoTreino() {
  const [, navigate] = useLocation();

  const [videoModalSrc, setVideoModalSrc] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [isFreePlan, setIsFreePlan] = useState(false);
  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramado[]>([]);

  type AbaTreinosAtleta = "meu_professor" | "footera";
  const [abaTreinosAtleta, setAbaTreinosAtleta] = useState<AbaTreinosAtleta>("meu_professor");
  const [treinosFootera, setTreinosFootera] = useState<TreinoProgramado[]>([]);
  const [professorVinculadoIds, setProfessorVinculadoIds] = useState<string[]>([]);

  const [atletasVinculados, setAtletasVinculados] = useState<AtletaVinculado[]>([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<string[]>([]);
  const [elencos, setElencos] = useState<Elenco[]>([]);
  const [elencoSelecionado, setElencoSelecionado] = useState<string>("");
  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<ExItemUILocal[]>([]);

  const [filtroEx, setFiltroEx] = useState("");
  const [filtroCategorias, setFiltroCategorias] = useState<string[]>([]);
  const [filtroNiveis, setFiltroNiveis] = useState<string[]>([]);
  const [filtroProf, setFiltroProf] = useState("");
  const restoredRef = useRef(false);
  const [idsProgramadosBloqueados, setIdsProgramadosBloqueados] = useState<
    Set<string>
  >(new Set());
  const [orgsVinculadas, setOrgsVinculadas] = useState<Organizacao[]>([]);
  const [orgSelecionada, setOrgSelecionada] = useState<string>("");
  const [novaTurmaNome, setNovaTurmaNome] = useState<string>("");
  const [datasAgendamento, setDatasAgendamento] = useState<string[]>([]);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  
  const jaSincronizouCalendarioComDatas = useRef(false);
  type ProfessorItem = { id: string; nome: string; codigo?: string; cref?: string };

  const [professores, setProfessores] = useState<ProfessorItem[]>([]);
  const [professoresSelecionados, setProfessoresSelecionados] = useState<string[]>([]);

  const [mesCalendario, setMesCalendario] = useState<{
    ano: number;
    mes: number;
  }>(() => {
    const base =
      (typeof window !== "undefined" &&
        (sessionStorage.getItem("novoTreino-dataTreinoBase") || "")) ||
      "";
    const hoje = new Date();
    const d = base ? new Date(base) : hoje;
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const PAGE_SIZE_EX = 25;
  const [pageEx, setPageEx] = useState(1);
  const listRef = useRef<HTMLUListElement | null>(null);

  const [salvando, setSalvando] = useState(false);

  function setVideoNoEx(index: number, videoUrl: string | null) {
    setExerciciosSelecionados((prev: ExItemUILocal[]) => {
      const copia = [...prev];
      copia[index] = { ...copia[index], videoUrl };
      return copia;
    });
  }

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "success",
  ) {
    setToast({ message, type });
  }

  function detectarSeFree(): boolean {
    try {
      const candidatos = [
        (Storage as any).plano,
        (Storage as any).assinaturaPlano,
        localStorage.getItem("planoAtual"),
        localStorage.getItem("plano"),
        sessionStorage.getItem("planoAtual"),
        sessionStorage.getItem("plano"),
      ].filter(Boolean) as string[];

      if (!candidatos.length) return false;

      const txt = candidatos.join(" ").toLowerCase();
      return (
        txt.includes("free") ||
        txt.includes("gratuito") ||
        txt.includes("grátis") ||
        txt.includes("gratis")
      );
    } catch {
      return false;
    }
  }

  const professorLogadoId = useMemo(() => {
    const tipo = String(
      (Storage as any).tipoSalvo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        ""
    ).trim().toLowerCase();

    if (tipo !== "professor") return "";

    return String(
      (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        ""
    ).trim();
  }, []);

  useEffect(() => {
  let cancel = false;

  (async () => {
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const r = await fetch(`${API.BASE_URL}/api/professores`, { headers });
      if (!r.ok) throw new Error(await r.text());

      const j = await r.json();
      const arr = Array.isArray(j) ? j : (j.items ?? j.data ?? []);

      const norm: ProfessorItem[] = (arr || []).map((p: any) => ({
        id: String(p.id),
        nome: String(p.nome ?? p.usuario?.nome ?? "Professor"),
        codigo: p.codigo ? String(p.codigo) : undefined,
        cref: p.cref ? String(p.cref) : undefined,
      }));

      const filtrados = professorLogadoId
        ? norm.filter((p) => String(p.id) !== String(professorLogadoId))
        : norm;

      if (!cancel) setProfessores(filtrados);
    } catch (e) {
      console.error("Erro ao carregar professores:", e);
      if (!cancel) setProfessores([]);
    }
  })();

  return () => { cancel = true; };
}, [professorLogadoId]);

  useEffect(() => {
  let cancel = false;

  (async () => {
    try {
      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const urls = [
        `${API.BASE_URL}/api/exercicios`,
        `${API.BASE_URL}/api/exercicios?ativos=1`,
        `${API.BASE_URL}/api/exercicios/listar`,
      ];

      let arr: any[] = [];
      for (const url of urls) {
        const r = await fetch(url, { headers });
        const txt = await r.text();

        if (!r.ok) {
          console.warn("[NovoTreino] falha:", r.status, txt);
          continue;
        }

        let j: any = null;
        try {
          j = txt ? JSON.parse(txt) : null;
        } catch {
          j = null;
        }

        const list = Array.isArray(j)
          ? j
          : j?.items ?? j?.data ?? j?.rows ?? j?.result ?? [];

        if (Array.isArray(list) && list.length) {
          arr = list;
          break;
        }
      }

      const normalizados: Exercicio[] = (arr || [])
        .map((e: any) => {
          const video =
            e.videoDemonstrativoUrl ??
            e.videoDemonstrativoURL ??
            e.videoUrl ??
            e.video ??
            e.midiaUrl ??
            e?.midia?.url ??
            null;

          const cats =
            e.categorias ??
            e.categoria ??
            e.categoriaBase ??
            e.faixaEtaria ??
            [];

          const categoriasArray = Array.isArray(cats)
            ? cats.map(String)
            : cats
            ? [String(cats)]
            : [];

          return {
            id: String(e.id),
            nome: String(e.nome ?? e.titulo ?? ""),
            descricao: e.descricao ?? e.desc ?? "",
            nivel: e.nivel ?? e.dificuldade ?? null,
            repeticoes: e.repeticoes ?? e.reps ?? "",
            videoDemonstrativoUrl: video ? String(video) : undefined,
            categorias: categoriasArray,
            duracaoMinutos:
              typeof e.duracaoMinutos === "number"
                ? e.duracaoMinutos
                : typeof e.duracao === "number"
                ? e.duracao
                : null,
            tipoTreino: e.tipoTreino ?? null,
          } as Exercicio;
        })
        .filter((x) => x.id && x.nome);

      if (!cancel) setExerciciosDisponiveis(normalizados);
    } catch (err) {
      console.error("[NovoTreino] erro ao carregar exercicios:", err);
      if (!cancel) setExerciciosDisponiveis([]);
    }
  })();

  return () => {
    cancel = true;
  };
}, []);

  useEffect(() => {
    const ehFree = detectarSeFree();
    setIsFreePlan(ehFree);
  }, []);

useEffect(() => {
  if (!toast) return;
  const ms = toast.type === "error" ? 9000 : 4000; // erro fica mais tempo
  const id = setTimeout(() => setToast(null), ms);
  return () => clearTimeout(id);
}, [toast]);

  useEffect(() => {
    if (dataTreino) {
      const soData = dataTreino.includes("T")
        ? dataTreino.split("T")[0]
        : dataTreino;
      sessionStorage.setItem("novoTreino-dataTreinoBase", soData);
    }
  }, [dataTreino]);

  useEffect(() => {
    if (
      !jaSincronizouCalendarioComDatas.current &&
      datasAgendamento.length > 0
    ) {
      const primeira = datasAgendamento[0];
      const d = new Date(primeira);
      if (!isNaN(d.getTime())) {
        setMesCalendario({ ano: d.getFullYear(), mes: d.getMonth() });
      }
      jaSincronizouCalendarioComDatas.current = true;
    }
  }, [datasAgendamento]);

  const MOSTRAR_TODOS = "__todos__";

  const score = useMemo(
    () => calcularPontuacaoTreino(nivel, tipoTreino, duracao, exerciciosSelecionados),
    [nivel, tipoTreino, duracao, exerciciosSelecionados],
  );

  function normalizaTreinos(raw: any[]): TreinoProgramado[] {
    return raw.map((t: any) => {
      const programadoId =
        t.treinoProgramadoId ?? t.programadoId ?? t.programado?.id ?? t.id;

      let criador: TreinoProgramado["criador"] = t.criador ?? null;

      const criadoresArr =
        Array.isArray(t.criadores) ? t.criadores :
        Array.isArray(t.colaboradores) ? t.colaboradores.map((c:any) => ({
          id: String(c.professor?.id ?? c.professorId),
          nome: String(c.professor?.nome ?? "Professor"),
        })) : [];

      if (!criador) {
        if (t.professor) {
          criador = {
            tipo: "Professor",
            id: t.professor.id,
            nome: t.professor.nome ?? "Professor",
          };
        } else if (t.clube) {
          criador = {
            tipo: "Clube",
            id: t.clube.id,
            nome: t.clube.nome ?? "Clube",
          };
        } else if (t.escolinha) {
          criador = {
            tipo: "Escolinha",
            id: t.escolinha.id,
            nome: t.escolinha.nome ?? "Escolinha",
          };
        }
      }

      const criadorNome =
        criador?.nome ??
        t.criadorNome ??
        t.criadoPorNome ??
        t.ownerNome ??
        t.donoNome ??
        t.professor?.usuario?.nome ??
        t.professor?.nome ??
        t.clube?.nome ??
        t.escolinha?.nome ??
        null;

      const criadorTipo =
        criador?.tipo ??
        t.criadorTipo ??
        t.tipoUsuario ??
        t.ownerTipo ??
        t.donoTipo ??
        (t.professorId
          ? "Professor"
          : t.clubeId
          ? "Clube"
          : t.escolinhaId
          ? "Escolinha"
          : null);

      return {
        id: String(programadoId),
        nome: t.nome ?? t.titulo ?? "(sem nome)",
        descricao: t.descricao ?? t.resumo ?? "",
        nivel: t.nivel ?? t.dificuldade ?? "-",
        pontuacao: t.pontuacao ?? null,
        exercicios: (t.exercicios ?? t.exs ?? []).map(
          (ex: any, i: number) => ({
            id: ex.id ?? ex.exercicioId ?? String(i),
            nome:
              ex.nome ??
              ex.titulo ??
              ex?.exercicio?.nome ??
              ex?.exercicioTemporario?.nome ??
              "",
            repeticoes: ex.repeticoes ?? ex.reps ?? ex.qtde ?? "",
          }),
        ),
        // @ts-ignore
        treinoProgramadoId:
          t.treinoProgramadoId ?? t.programadoId ?? t.programado?.id ?? null,
        // @ts-ignore
        origemId: t.id ?? null,
        criadores: criadoresArr,
        criador,
        criadorNome,
        criadorTipo,
      };
    });
  }

  function mapAtletas(items: any[]): AtletaVinculado[] {
    return (items || [])
      .map((a: any) => {
        const atletaId =
          a.atletaId ||
          a.id ||
          a?.atleta?.id ||
          "";

        const usuarioId =
          a.usuarioId ||
          a?.usuario?.id ||
          a?.atleta?.usuarioId ||
          a?.atleta?.usuario?.id ||
          "";

        const primeiroNome =
          a.nome ??
          a?.usuario?.nome ??
          a?.atleta?.nome ??
          "Atleta";

        const sobrenome =
          a.sobrenome ??
          a?.usuario?.sobrenome ??
          a?.atleta?.sobrenome ??
          "";

        let nomeCompleto = primeiroNome;
        if (sobrenome && !String(primeiroNome).includes(sobrenome)) {
          nomeCompleto = `${primeiroNome} ${sobrenome}`;
        }

        const foto =
          a.foto ??
          a?.usuario?.foto ??
          a?.atleta?.usuario?.foto ??
          undefined;

        return {
          id: String(atletaId),
          nome: nomeCompleto,
          foto,
          usuarioId: usuarioId ? String(usuarioId) : undefined,
        } as AtletaVinculado;
      })
      .filter((x) => x.id && x.id !== "undefined" && x.id !== "null")
  }

  const atletaIdLogado = useMemo(() => {
    const tipo = String(
      (Storage as any).tipoSalvo ??
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        ""
    ).trim().toLowerCase();

    if (tipo !== "atleta") return "";

    return String(
      (Storage as any).tipoUsuarioId ??
        localStorage.getItem("tipoUsuarioId") ??
        sessionStorage.getItem("tipoUsuarioId") ??
        ""
    ).trim();
  }, []);

  useEffect(() => {
    const tipo =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";
    if (String(tipo).toLowerCase() !== "atleta") return;

    let cancel = false;

     (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        if (!token) return;

        const headers = { Authorization: `Bearer ${token}` };
        const atletaId = String(atletaIdLogado || "").trim();

        if (!atletaId) {
          console.warn("[NovoTreino] atletaIdLogado vazio (Atleta.id).");
          return;
        }

        const tries = [
          `${API.BASE_URL}/api/treinos/disponiveis?atletaId=${encodeURIComponent(atletaId)}`,
        ];

        let lista: any[] = [];
        for (const url of tries) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          if (Array.isArray(arr)) {
            lista = arr;
            break;
          }
        }

        if (!cancel) setTreinosDisponiveis(normalizaTreinos(lista || []));
        try {
          const urlAg = `${API.BASE_URL}/api/treinos/agendados?atletaId=${encodeURIComponent(
            atletaIdLogado
          )}&apenasFuturos=1`;

          const ra = await fetch(urlAg, { headers });
          if (ra.ok) {
            const ja = await ra.json().catch(() => null);
            const arrAg = Array.isArray(ja) ? ja : (ja?.items ?? ja?.data ?? ja?.rows ?? []);
            const ids = new Set<string>(
              (arrAg || [])
                .map((x: any) => String(x.treinoProgramadoId ?? x.programadoId ?? x.treinoId ?? ""))
                .filter((s: string) => s && s !== "undefined" && s !== "null")
            );
            if (!cancel) setIdsProgramadosBloqueados(ids);
          } else {
            const txt = await ra.text().catch(() => "");
            console.warn("[NovoTreino] falha ao listar agendados p/ bloquear:", ra.status, txt);
          }
        } catch (e) {
          console.warn("[NovoTreino] erro ao listar agendados p/ bloquear:", e);
        }
      } catch (e) {
        console.error("Falha ao carregar treinos disponíveis:", e);
        if (!cancel) setTreinosDisponiveis([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [atletaIdLogado]);

useEffect(() => {
  const tipo =
    (Storage as any).tipoSalvo ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";

  if (String(tipo).toLowerCase() !== "atleta") return;

  let cancel = false;

  (async () => {
    try {
      const token = getToken();
      if (!token) return;

      const atletaId = String(atletaIdLogado || "").trim();
      if (!atletaId) return;

      const headers = { Authorization: `Bearer ${token}` };

      // tenta pegar os vínculos do Atleta em endpoints comuns do seu projeto
      const tries = [
        `${API.BASE_URL}/api/atletas/${encodeURIComponent(atletaId)}`,
        `${API.BASE_URL}/api/perfil/${encodeURIComponent(atletaId)}`, // se no seu projeto perfil/:id também traz relacoes
      ];

      let data: any = null;
      for (const url of tries) {
        const r = await fetch(url, { headers });
        if (!r.ok) continue;
        data = await r.json().catch(() => null);
        if (data) break;
      }

      const rels =
        data?.relacoesTreinamento ??
        data?.atleta?.relacoesTreinamento ??
        data?.data?.relacoesTreinamento ??
        [];

      const profIds = Array.from(
        new Set(
          (Array.isArray(rels) ? rels : [])
            .filter((x: any) => x?.ativo !== false) // ativo=true ou undefined
            .map((x: any) => String(x?.professorId ?? x?.professor?.id ?? "").trim())
            .filter((id: string) => id && id !== "undefined" && id !== "null"),
        ),
      );

      if (!cancel) setProfessorVinculadoIds(profIds);
    } catch (e) {
      console.warn("[NovoTreino] falha ao carregar professorVinculadoIds:", e);
      if (!cancel) setProfessorVinculadoIds([]);
    }
  })();

  return () => {
    cancel = true;
  };
}, [atletaIdLogado]);

useEffect(() => {
  const tipo =
    (Storage as any).tipoSalvo ??
    localStorage.getItem("tipoUsuario") ??
    sessionStorage.getItem("tipoUsuario") ??
    "";

  if (String(tipo).toLowerCase() !== "atleta") return;

  let cancel = false;

  (async () => {
    try {
      const token = getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      const r = await fetch(
        `${API.BASE_URL}/api/treinos/publicos-professores-parceiros`,
        { headers },
      );

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        console.warn("[NovoTreino] falha /publicos-professores-parceiros:", r.status, txt);
        if (!cancel) setTreinosFootera([]);
        return;
      }

      const j = await r.json().catch(() => null);
      const arr = Array.isArray(j) ? j : (j?.items ?? j?.data ?? j?.rows ?? []);

      if (!cancel) setTreinosFootera(normalizaTreinos(arr || []));
    } catch (e) {
      console.warn("[NovoTreino] erro ao carregar treinosFootera:", e);
      if (!cancel) setTreinosFootera([]);
    }
  })();

  return () => {
    cancel = true;
  };
}, []);


  useEffect(() => {
  (async () => {
    try {
      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const baseTipoUsuarioId =
        (Storage as any).tipoUsuarioId ||
        localStorage.getItem("tipoUsuarioId") ||
        sessionStorage.getItem("tipoUsuarioId") ||
        localStorage.getItem("perfilId") ||
        sessionStorage.getItem("perfilId") ||
        "";

      if (!baseTipoUsuarioId) {
        console.warn("[NovoTreino] sem tipoUsuarioId; não dá para carregar turmas/elencos");
        setElencos([]);
        setElencoSelecionado("");
        return;
      }

      const orgId =
        orgSelecionada && orgSelecionada !== MOSTRAR_TODOS
          ? orgSelecionada
          : null;

      const orgObj = orgId
        ? orgsVinculadas.find((o) => String(o.id) === String(orgId))
        : null;

      const ownerTipo =
        orgObj?.tipo === "Clube"
          ? "Clube"
          : orgObj?.tipo === "Escolinha"
          ? "Escolinha"
          : "Professor";

      const ownerId = orgObj?.id ? String(orgObj.id) : String(baseTipoUsuarioId);
      const professorId = String(baseTipoUsuarioId);

      {
        const urlMinhas = `${API.BASE_URL}/api/turmas/minhas?tipoUsuarioId=${encodeURIComponent(
          baseTipoUsuarioId
        )}`;

        const r = await fetch(urlMinhas, { headers });

        if (r.ok) {
          const data = await r.json();
          const arr = Array.isArray(data)
            ? data
            : data.items ?? data.data ?? data.rows ?? data.result ?? [];

          const norm = (arr || []).map((t: any) => ({
            id: String(t.id),
            nome: t.nome ?? t.titulo ?? "Turma",
            atletasIds:
              t.atletasIds ??
              t.membros?.map((m: any) => m.atletaId ?? m.id) ??
              [],
          }));

          setElencos(norm);
          return;
        } else {
          const txt = await r.text().catch(() => "");
          console.warn("[NovoTreino] falha em /api/turmas/minhas:", r.status, txt);
        }
      }

      {
        const query =
          ownerTipo === "Professor"
            ? `professorId=${encodeURIComponent(professorId)}`
            : `ownerTipo=${encodeURIComponent(ownerTipo)}&ownerId=${encodeURIComponent(ownerId)}`;

        const url = `${API.BASE_URL}/api/turmas?${query}`;
        const r = await fetch(url, { headers });

        if (r.ok) {
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];

          const norm = (arr || []).map((t: any) => ({
            id: String(t.id),
            nome: t.nome ?? t.titulo ?? "Turma",
            atletasIds:
              t.atletasIds ??
              t.membros?.map((m: any) => m.atletaId ?? m.id) ??
              [],
          }));

          setElencos(norm);
          return;
        } else {
          const txt = await r.text().catch(() => "");
          console.warn("[NovoTreino] falha em /api/turmas:", r.status, txt);
        }
      }

      setElencos([]);
      setElencoSelecionado("");
    } catch (e) {
      console.error("[NovoTreino] erro inesperado ao carregar turmas", e);
      setElencos([]);
      setElencoSelecionado("");
    }
  })();
}, [orgSelecionada, orgsVinculadas]);

  useEffect(() => {
    const tipoPersistido =
      (
        localStorage.getItem("tipoUsuario") ??
        sessionStorage.getItem("tipoUsuario") ??
        (Storage as any).tipoSalvo ??
        ""
      )
        .toString()
        .trim()
        .toLowerCase();

    const tipoNormalizado =
      tipoPersistido === "escolinha" ? "escola" : tipoPersistido;
    const permitidos = ["escola", "clube", "professor", "atleta"] as const;

    if (permitidos.includes(tipoNormalizado as any)) {
      setUsuario({ tipo: tipoNormalizado as (typeof permitidos)[number] });
    } else {
      console.warn("tipoUsuario inválido/inesperado:", {
        tipoPersistido,
        tipoNormalizado,
      });
      setUsuario(null);
    }

    const id =
      localStorage.getItem("usuarioId") ??
      sessionStorage.getItem("usuarioId") ??
      (Storage as any).usuarioId ??
      null;
    setUsuarioId(id);

    if (!restoredRef.current) {
      const shouldRestore =
        sessionStorage.getItem(RESTORE_FLAG_KEY) === "1";

      if (shouldRestore) {
        const saved = safeParse<any>(sessionStorage.getItem(SAVE_KEY), null);
        if (saved) {
          setEtapa(saved.etapa ?? 1);
          setNome(saved.nome ?? "");
          setDescricao(saved.descricao ?? "");
          setNivel(saved.nivel ?? "Base");
          setDuracao(saved.duracao ?? 60);
          setDataTreino(saved.dataTreino ?? "");
          setCategorias(
            saved.categorias ??
              (saved.categoria
                ? Array.isArray(saved.categoria)
                  ? saved.categoria
                  : [saved.categoria]
                : []),
          );
          setTipoTreino(saved.tipoTreino ?? "Tecnico");
          setObjetivo(saved.objetivo ?? "");
          const exOld = Array.isArray(saved.exerciciosSelecionados)
            ? saved.exerciciosSelecionados
            : [];
          const exUi: ExItemUI[] = exOld.map((x: any, idx: number) => ({
            idCatalogo: x.exercicioId ?? null,
            nome: x.nome ?? "",
            descricao: x.descricao ?? null,
            repeticoes: x.repeticoes ?? "",
            ordem: x.ordem ?? idx + 1,
            series: x.series ?? "",
          }));
          setExerciciosSelecionados(exUi);
          setAtletasSelecionados(saved.atletasSelecionados ?? []);
          setDatasAgendamento(saved.datasAgendamento ?? []);
          setProfessoresSelecionados(
            Array.isArray(saved.professoresSelecionados)
              ? saved.professoresSelecionados.map(String)
              : []
          );
        }
      }

      restoredRef.current = true;
    }

    setIniciado(true);
  }, []);

  useEffect(() => {
    const tipo = String(
    (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      ""
  ).trim().toLowerCase();

  if (tipo !== "professor") {
    setOrgsVinculadas([]);
    return;
  }
    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const professorTipoId =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          "";

        if (!professorTipoId) {
          setOrgsVinculadas([]);
          return;
        }

        const tentativas = [
          `${API.BASE_URL}/api/professores/${professorTipoId}/vinculos`,
          `${API.BASE_URL}/api/organizacoes?vinculadasAoProfessorId=${professorTipoId}`,
          `${API.BASE_URL}/api/vinculos?tipo=Professor&id=${professorTipoId}`,
        ];

        let arr: any[] = [];
        for (const url of tentativas) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const list = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          if (Array.isArray(list) && list.length) {
            arr = list;
            break;
          }
        }

        const normalizada: Organizacao[] = (arr || [])
          .map((o: any) => {
            const tipo: Organizacao["tipo"] = String(
              o.tipo ?? o.kind ?? o.categoria ?? "",
            )
              .toLowerCase()
              .includes("clube")
              ? "Clube"
              : "Escolinha";

            return {
              id: String(o.escolinhaId ?? o.clubeId ?? o.id ?? o.organizacaoId),
              nome: String(o.nome ?? o.titulo ?? "Organização"),
              tipo,
            };
          })
          .filter((x) => x.id);

        setOrgsVinculadas(normalizada);
        if (!orgSelecionada && normalizada.length === 1)
          setOrgSelecionada(normalizada[0].id);
      } catch {
        setOrgsVinculadas([]);
      }
    })();
  }, []);

  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        if (orgSelecionada === MOSTRAR_TODOS) {
          const urlsTodos = [
            `${API.BASE_URL}/api/atletas`,
            `${API.BASE_URL}/api/usuarios?perfil=atleta`,
            `${API.BASE_URL}/api/relacoes/atletas?todos=1`,
          ];
          for (const url of urlsTodos) {
            const r = await fetch(url, { headers });
            if (!r.ok) continue;
            const j = await r.json();
            const arr = Array.isArray(j)
              ? j
              : j.items ?? j.data ?? j.rows ?? j.result ?? [];
            if (!cancel) setAtletasVinculados(mapAtletas(arr));
            return;
          }
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        const tipoUsuarioId =
          orgSelecionada ||
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          localStorage.getItem("perfilId") ||
          sessionStorage.getItem("perfilId") ||
          "";

        if (!tipoUsuarioId) {
          console.warn(
            "[NovoTreino] nenhum tipoUsuarioId/perfilId encontrado; não dá para chamar /api/treinos/atletas-vinculados",
          );
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        const url = `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(
          tipoUsuarioId,
        )}&incluirPontuacao=1`;

        const r = await fetch(url, { headers });
        const txt = await r.text();

        if (!r.ok) {
          console.error(
            "[NovoTreino] erro ao buscar atletas-vinculados:",
            r.status,
            txt,
          );
          if (!cancel) setAtletasVinculados([]);
          return;
        }

        let data: any;
        try {
          data = txt ? JSON.parse(txt) : [];
        } catch {
          data = [];
        }

        const items = Array.isArray(data)
          ? data
          : data.items ?? data.data ?? data.rows ?? data.result ?? [];

        if (!cancel) {
          setAtletasVinculados(mapAtletas(items));
        }
      } catch (e) {
        console.error(
          "[NovoTreino] exceção ao carregar atletas-vinculados:",
          e,
        );
        if (!cancel) setAtletasVinculados([]);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [orgSelecionada]);

  useEffect(() => {
    saveState({
      etapa,
      nome,
      descricao,
      nivel,
      duracao,
      dataTreino,
      categorias,

      tipoTreino,
      objetivo,
      exerciciosSelecionados,
      atletasSelecionados,
      datasAgendamento,
      professoresSelecionados
    });
  }, [
    etapa,
    nome,
    descricao,
    nivel,
    duracao,
    dataTreino,
    categorias,
    tipoTreino,
    objetivo,
    exerciciosSelecionados,
    atletasSelecionados,
    datasAgendamento,
    professoresSelecionados,
  ]);

  async function criarTurmaComSelecionados() {
    const token =
      (Storage as any).token ??
      localStorage.getItem("token") ??
      sessionStorage.getItem("token");

    if (!token) {
      alert("Faça login novamente para criar uma turma.");
      return;
    }

    if (!novaTurmaNome || !novaTurmaNome.trim()) {
      alert("Dê um nome para a turma.");
      return;
    }

    if (!atletasSelecionados || atletasSelecionados.length === 0) {
      alert("Selecione pelo menos 1 atleta para a turma.");
      return;
    }


    const atletasSelecionadosObjs = atletasVinculados.filter((a) =>
      atletasSelecionados.includes(a.id),
    );

    const atletaIds = atletasSelecionadosObjs.map((a) => a.id);

    const usuarioIds = atletasSelecionadosObjs
      .map((a) => a.usuarioId)
      .filter((id): id is string => Boolean(id));

    const orgId = orgSelecionada && orgSelecionada !== MOSTRAR_TODOS ? String(orgSelecionada) : "";

    const orgObj = orgId
      ? orgsVinculadas.find((o) => String(o.id) === String(orgId))
      : null;

    const ownerTipoCapital =
      orgObj?.tipo === "Clube"
        ? "Clube"
        : orgObj?.tipo === "Escolinha"
        ? "Escolinha"
        : String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("clube")
        ? "Clube"
        : String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("escolinha") ||
          String(
            usuario?.tipo ??
              (Storage as any).tipoSalvo ??
              (Storage as any).tipo ??
              ""
          ).toLowerCase().startsWith("escola")
        ? "Escolinha"
        : "Professor";

    const ownerIdFinal = orgObj?.id
      ? String(orgObj.id)
      : String(
          (Storage as any).tipoUsuarioId ||
            (Storage as any).professorId ||
            localStorage.getItem("tipoUsuarioId") ||
            sessionStorage.getItem("tipoUsuarioId") ||
            ""
        );

    if (!ownerIdFinal) {
      alert("Não foi possível identificar o dono da turma. Faça login novamente.");
      return;
    }

    const payload = {
      ownerTipo: ownerTipoCapital,
      ownerId: ownerIdFinal,
      nome: novaTurmaNome.trim(),
      professorId: ownerTipoCapital === "Professor" ? ownerIdFinal : undefined,
      atletaIds,
      usuarioIds,
    };

    try {
      const resp = await fetch(`${API.BASE_URL}/api/turmas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        alert(
          data?.message ||
            data?.erro ||
            "Não foi possível criar a turma. Veja o console para mais detalhes.",
        );
        return;
      }

      if (data && data.id) {
        setElencos((prev) => [
          ...prev,
          {
            id: String(data.id),
            nome: data.nome ?? novaTurmaNome.trim(),
            atletasIds: atletaIds,
          },
        ]);
        setElencoSelecionado(String(data.id));
      }

      alert("Turma criada com sucesso!");

      setNovaTurmaNome("");
      setAtletasSelecionados([]);
    } catch (e) {
      console.error("[NovoTreino] erro ao criar turma", e);
      alert("Erro inesperado ao criar a turma.");
    }
  }

  const incluirElencoNoTreino = () => {
    if (!elencoSelecionado) return;
    const el = elencos.find((e) => e.id === elencoSelecionado);
    if (!el || !el.atletasIds?.length) return;

    setAtletasSelecionados((prev) => {
      const set = new Set(prev);
      el.atletasIds!.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  useEffect(() => {
      if (!professorLogadoId) return;
      setProfessoresSelecionados((prev) =>
        prev.filter((id) => String(id) !== String(professorLogadoId))
      );
  }, [professorLogadoId]);

  const [completedUntil, setCompletedUntil] = useState<number>(1);
  const goTo = (n: number) => {
    setEtapa(n);
    setCompletedUntil((prev) => Math.max(prev, n));
  };

  function normalizaNome(n?: string) {
    return (n || "").trim().toLowerCase();
  }

  function jaEstaNoTreinoPorIdOuNome(
    lista: ExItemUI[],
    id?: string,
    nome?: string,
  ) {
    const nomeK = normalizaNome(nome);
    const idK = id ? String(id) : null;

    return lista.some((ex) => {
      const sameId = idK && ex.idCatalogo && String(ex.idCatalogo) === idK;
      const sameName = nomeK && normalizaNome(ex.nome) === nomeK;
      return Boolean(sameId || sameName);
    });
  }

  const exerciciosFiltrados = useMemo(() => {
    let lista = [...exerciciosDisponiveis];

    const q = filtroEx.trim().toLowerCase();
    if (q) {
      lista = lista.filter((e) => {
        const nome = (e.nome || "").toLowerCase();
        const desc = (e.descricao || "").toLowerCase();
        const nivel = (e.nivel || "").toLowerCase();
        return nome.includes(q) || desc.includes(q) || nivel.includes(q);
      });
    }

    if (filtroCategorias.length > 0) {
      const catsFiltro = filtroCategorias.map((c) => c.toLowerCase());
      lista = lista.filter((e) => {
        const cats = (e.categorias || []).map((c) => String(c).toLowerCase());
        if (!cats.length) return false;
        return cats.some((c) => catsFiltro.includes(c));
      });
    }

    if (filtroNiveis.length > 0) {
      const niveisFiltro = filtroNiveis.map((n) => n.toLowerCase());
      lista = lista.filter((e) => {
        if (!e.nivel) return false;
        return niveisFiltro.includes(String(e.nivel).toLowerCase());
      });
    }

    return lista;
  }, [exerciciosDisponiveis, filtroEx, filtroCategorias, filtroNiveis]);

  useEffect(() => {
    setPageEx(1);
    // opcional: volta o scroll pro topo ao mudar filtro
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [filtroEx, filtroCategorias, filtroNiveis]);

  const exerciciosVisiveis = useMemo(() => {
    const total = pageEx * PAGE_SIZE_EX;
    return exerciciosFiltrados.slice(0, total);
  }, [exerciciosFiltrados, pageEx]);

  const temMaisExercicios = exerciciosVisiveis.length < exerciciosFiltrados.length;

  function onScrollListaExercicios(e: UIEvent<HTMLElement>) {
    const el = e.currentTarget;
    const faltando = el.scrollHeight - el.scrollTop - el.clientHeight;

    // quando faltar ~250px pra chegar no fim, carrega mais 25
    if (faltando < 250 && temMaisExercicios) {
      setPageEx((p) => p + 1);
    }
  }


  const adicionarExercicio = () => {
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        idCatalogo: null,
        nome: "",
        descricao: "",
        repeticoes: "",
        ordem: prev.length + 1,
        series: "",
        videoUrl: null,
      },
    ]);
  };

  const atualizarExercicio = (
  index: number,
  campo: keyof ExItemUILocal,
  valor: any
) => {
  setExerciciosSelecionados((prev) => {
    const copia = [...prev];
    (copia[index] as any)[campo] = valor;

    if (campo === "ordem") {
      const n = parseInt(String(valor), 10);
      if (!isNaN(n)) copia[index].ordem = n;
    }
    return copia;
  });
};

  const removerExercicio = (index: number) => {
    const novaLista = [...exerciciosSelecionados];
    novaLista.splice(index, 1);
    const renumerado = novaLista.map((x, i) => ({ ...x, ordem: i + 1 }));
    setExerciciosSelecionados(renumerado);
  };

  const adicionarExercicioExistente = (exercicio: Exercicio) => {
    setExerciciosSelecionados((prev) => {
      if (jaEstaNoTreinoPorIdOuNome(prev, exercicio.id, exercicio.nome)) {
        alert("Este exercício já foi adicionado ao treino.");
        return prev;
      }

      const { series, repeticoes } = parseRepeticoesStr(exercicio.repeticoes);

      return [
        ...prev,
        {
          idCatalogo: String(exercicio.id),
          nome: exercicio.nome,
          descricao: exercicio.descricao ?? "",
          repeticoes,
          series,
          ordem: prev.length + 1,
          videoUrl: null,
        },
      ];
    });
  };



  function getDono() {
    const tipoRaw =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    const tipoUsuarioIdLogged =
      (Storage as any).tipoUsuarioId ||
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      null;

    const orgId =
      orgSelecionada && orgSelecionada !== MOSTRAR_TODOS ? String(orgSelecionada) : "";

    if (orgId) {
      const org = orgsVinculadas.find((o) => String(o.id) === orgId);

      if (org?.tipo === "Clube") {
        return { tipoUsuario: "Clube" as const, tipoUsuarioId: orgId };
      }
      if (org?.tipo === "Escolinha") {
        return { tipoUsuario: "Escolinha" as const, tipoUsuarioId: orgId };
      }

      return { tipoUsuario: "Clube" as const, tipoUsuarioId: orgId };
    }

    const normalized =
      String(tipoRaw).trim().toLowerCase() === "escola" ||
      String(tipoRaw).trim().toLowerCase() === "escolinha"
        ? "Escolinha"
        : String(tipoRaw).trim().toLowerCase() === "professor"
        ? "Professor"
        : String(tipoRaw).trim().toLowerCase() === "clube"
        ? "Clube"
        : null;

    return {
      tipoUsuario: normalized as "Professor" | "Clube" | "Escolinha" | null,
      tipoUsuarioId: tipoUsuarioIdLogged,
    };
  }

  type DonoLiteral = "professor" | "clube" | "escolinha";
  function isDono(v: string): v is DonoLiteral {
    return v === "professor" || v === "clube" || v === "escolinha";
  }

  function extrairIdAtleta(a: any): string {
    if (!a) return "";
    if (typeof a === "string") return a;
    if (typeof a.id === "string") return a.id;
    if (typeof a.atletaId === "string") return a.atletaId;
    return "";
  }

    async function agendarTreinoEmLote(treinoProgramadoId: string) {
    try {
      const datasValidas = datasAgendamento.filter((d) => d && d.trim());

      let datasBase = datasValidas.length
        ? datasValidas
        : dataTreino
        ? [dataTreino]
        : [];

      if (isFreePlan && datasBase.length) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const limite = new Date(hoje);
        limite.setDate(limite.getDate() + 30);

        const dentroDaJanela = (str: string) => {
          const d = parseDateOnlyToLocalMidnight(str);
          if (isNaN(d.getTime())) return false;
          return d >= hoje && d <= limite;
        };

        const filtradas = datasBase.filter(dentroDaJanela);

        if (filtradas.length < datasBase.length) {
          showToast(
            "No plano Free, treinos só podem ser agendados em até 30 dias a partir de hoje. Datas fora desse intervalo foram ignoradas.",
            "info",
          );
        }

        datasBase = filtradas;
      }

      if (!datasBase.length || !atletasSelecionados.length) {
        return 0;
      }

      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";

      const headers: any = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const baseTime =
        dataTreino && dataTreino.includes("T")
          ? dataTreino.split("T")[1].slice(0, 5)
          : "18:00";

      const datasLocal = datasBase.map((d) => {
      const dateOnly = toDateOnlyBR(d);
      if (!dateOnly) return "";

      const dt = new Date(`${dateOnly}T${baseTime}:00`);
      return toLocalISO_NoZ(dt);
    }).filter(Boolean);

      const body = {
        treinoProgramadoId,
        datas: datasLocal,
        atletaIds: atletasSelecionados.map(String).filter(Boolean),
        elencosIds: elencoSelecionado ? [elencoSelecionado] : [],
        incluirObservados: false,
        tituloPadrao: nome || "Treino",
      };

      const res = await fetch(
        `${API.BASE_URL}/api/treinos/rotina/agendar`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao agendar treino em lote:", res.status, txt);
        return 0;
      }

      const json = await res.json().catch(() => null);
      return typeof json?.count === "number"
        ? json.count
        : datasLocal.length * atletasSelecionados.length;
    } catch (e) {
      console.error("Erro em agendarTreinoEmLote:", e);
      return 0;
    }
  }

const criarTreino = async () => {
  if (salvando) return;
  setSalvando(true);

  try {
    // ✅ limpa erro antigo (se você quiser manter, pode remover)
    // setToast(null);

    const { tipoUsuario, tipoUsuarioId } = getDono();
    const tipoUsuarioNormRaw = (tipoUsuario ?? "").toLowerCase();

    const professoresIdsFinal = Array.from(
      new Set(
        (professoresSelecionados || [])
          .map((x) => String(x))
          .filter(Boolean),
      ),
    );

    const professoresIdsFinalSemEu = professorLogadoId
      ? professoresIdsFinal.filter(
          (id) => String(id) !== String(professorLogadoId),
        )
      : professoresIdsFinal;

    if (!tipoUsuario || !tipoUsuarioId) {
      showToast(
        "Erro: não foi possível determinar o dono do treino (Professor/Clube/Escolinha).",
        "error",
      );
      return; // ✅ fica na página
    }

    if (!isDono(tipoUsuarioNormRaw)) {
      showToast("Erro: tipo de usuário inválido.", "error");
      return; // ✅ fica na página
    }
    const tipoUsuarioNorm: DonoLiteral = tipoUsuarioNormRaw;

    if (!usuarioId) {
      showToast("Erro: usuário não autenticado.", "error");
      return; // ✅ fica na página
    }

    const exercicios = montarExerciciosParaPayload(
      exerciciosSelecionados.map((e) => {
        const v = e.videoUrl ?? null;
        const videoFinal = v && String(v).startsWith("blob:") ? null : v;

        return {
          ...e,
          videoDemonstrativoUrl: videoFinal,
        };
      }) as any,
    );

    const mapNivel = (s: string) =>
      ({ Base: "Base", Avancado: "Avancado", Performance: "Performance" } as const)[
        s
      ] ?? "Base";

    const mapTipoTreino = (s: string) =>
      ({ Tecnico: "Tecnico", Fisico: "Fisico", Tatico: "Tatico", Mental: "Mental" } as const)[
        s
      ] ?? null;

    const mapCategoria = (s: string) => {
      const m = String(s || "").match(/sub[\s\-]?(\d{1,2})/i);
      if (m) return `Sub${m[1]}`;
      if (/^livre$/i.test(String(s))) return "Livre";
      return s;
    };

    const codigo =
      `${nome}`.trim()
        ? `${nome}`.toUpperCase().replace(/\s+/g, "-").slice(0, 24) +
          "-" +
          Date.now().toString(36)
        : "TP-" + Date.now().toString(36);

    // (mantive como estava, mesmo que não seja usado)
    const professorIdDoTreino =
      tipoUsuarioNorm === "professor"
        ? String(professorLogadoId || tipoUsuarioId)
        : null;

    const payload: TreinoCreatePayload = {
      codigo,
      nome,
      descricao: descricao || null,
      nivel: mapNivel(nivel),
      usuarioId,
      tipoUsuario: tipoUsuarioNorm,
      tipoUsuarioId,
      professoresIds: professoresIdsFinalSemEu,
      categoria:
        categorias.length > 0 ? categorias.map(mapCategoria).filter(Boolean) : [],
      tipoTreino: mapTipoTreino(tipoTreino),
      objetivo: objetivo || null,
      duracao: duracao ? Number(duracao) : null,
      dataTreino: dataTreino || null,
      dataAgendada: dataTreino || null,
      dicas: [],
      atletasIds: atletasSelecionados,
      elencosIds: elencoSelecionado ? [elencoSelecionado] : [],
      exercicios,
      pontuacao: Math.max(0, Math.floor(score.total)),
    };

    (payload as any).colaboradoresProfessorIds = professoresIdsFinalSemEu;

    // ✅ valida duplicados
    const vistosId = new Set<string>();
    const vistosNome = new Set<string>();
    const duplicados: string[] = [];

    for (const ex of exerciciosSelecionados) {
      const idK = ex.idCatalogo ? String(ex.idCatalogo) : null;
      const nomeK = normalizaNome(ex.nome);

      if (idK) {
        if (vistosId.has(idK)) duplicados.push(`ID ${idK}`);
        vistosId.add(idK);
      }
      if (nomeK) {
        if (vistosNome.has(nomeK)) duplicados.push(ex.nome || nomeK);
        vistosNome.add(nomeK);
      }
    }

    if (duplicados.length) {
      showToast(
        `Remova os exercícios repetidos antes de salvar: ${duplicados.join(", ")}`,
        "error",
      );
      return; // ✅ fica na página
    }

    const exValidos = exerciciosSelecionados.filter(
      (x) => x.idCatalogo || (x.nome && x.nome.trim()),
    );
    if (exValidos.length === 0) {
      showToast("Adicione pelo menos 1 exercício válido antes de salvar.", "error");
      return; // ✅ fica na página
    }

    // ✅ cria
    const criado: any = await TreinosApi.criar(payload);
    const profsSelecionadosDetalhe = professoresIdsFinal.map((id) => {
      const p = professores.find((x) => String(x.id) === String(id));
      return {
        id,
        nome: p?.nome ?? "(não encontrado na lista carregada)",
        codigo: p?.codigo ?? null,
        cref: p?.cref ?? null,
      };
    });

    let qtdAgendados = 0;
    const treinoProgramadoId =
      criado?.id ?? criado?.treinoProgramadoId ?? criado?.data?.id ?? null;

    if (treinoProgramadoId) {
      try {
        const token = getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

        const rr = await fetch(
          `${API.BASE_URL}/api/treinos/programados/${encodeURIComponent(
            String(treinoProgramadoId),
          )}`,
          { headers },
        );
        const jj = await rr.json().catch(() => null);
      } catch (e) {
        console.warn("[NovoTreino] DEBUG confirmacao falhou:", e);
      }

      qtdAgendados = await agendarTreinoEmLote(String(treinoProgramadoId));
    } else {
      console.warn(
        "TreinosApi.criar não retornou id do treino programado. Agendamento em lote foi pulado.",
      );
    }

    // ✅ tenta salvar na gaveta (não bloqueia sucesso)
    const resultadoSalvar = await tentarSalvarComoTreinoSalvo(payload, score.total);

    const atletasDoTreino = atletasVinculados.filter((a) =>
      atletasSelecionados.includes(a.id),
    );
    const nomesAtletas = atletasDoTreino.map((a) => a.nome);

    const datasBase =
      datasAgendamento.length > 0 ? datasAgendamento : dataTreino ? [dataTreino] : [];

    const datasLabel = datasBase.length
      ? datasBase
          .slice()
          .sort()
          .map((str) => {
            const iso = str.includes("T") ? str : `${str}T00:00:00`;
            const d = new Date(iso);
            if (isNaN(d.getTime())) return str;
            return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
          })
          .join(", ")
      : null;

    let msgPrincipal = `Treino "${nome || codigo}" criado com sucesso.`;

    if (qtdAgendados > 0 && nomesAtletas.length && datasLabel) {
      const nomesPreview =
        nomesAtletas.length <= 3
          ? nomesAtletas.join(", ")
          : `${nomesAtletas.slice(0, 3).join(", ")} + ${
              nomesAtletas.length - 3
            } atleta(s)`;

      msgPrincipal += ` Foi agendado automaticamente para ${nomesAtletas.length} atleta(s) (${nomesPreview}) nos dias ${datasLabel}.`;
    } else if (qtdAgendados > 0) {
      msgPrincipal += ` Foram gerados ${qtdAgendados} agendamentos para seus atletas.`;
    } else {
      msgPrincipal +=
        " Nenhum agendamento automático foi criado (você pode agendar depois na tela de treinos).";
    }

    let extra = "";
    if (resultadoSalvar.saved) {
      extra = " O treino também foi salvo na sua Gaveta.";
    } else if (resultadoSalvar.reason === "usuario-pulou") {
      extra = " Você optou por não salvar este treino na Gaveta (limite de 5).";
    } else if (resultadoSalvar.reason === "falha-apagar") {
      extra = " Não foi possível liberar espaço na Gaveta, então o treino não foi salvo lá.";
    } else if (resultadoSalvar.reason === "erro") {
      extra = " O treino foi criado, mas houve um erro ao salvar na Gaveta.";
    } else if (resultadoSalvar.reason === "sem-dono") {
      console.warn("Treino Salvo: sem dono identificado, pulando gaveta.");
    }

    showToast(msgPrincipal + extra, "success");

    // ✅ aqui pode limpar e voltar pra /treinos (SUCESSO)
    sessionStorage.removeItem(SAVE_KEY);
    sessionStorage.removeItem(RESTORE_FLAG_KEY);

    setEtapa(1);
    setCompletedUntil(1);
    setNome("");
    setDescricao("");
    setNivel("Base");
    setDuracao(60);
    setDataTreino("");
    setCategorias([]);
    setTipoTreino("Tecnico");
    setObjetivo("");
    setExerciciosSelecionados([]);
    setAtletasSelecionados([]);
    setDatasAgendamento([]);
    setProfessoresSelecionados([]);

    setTimeout(() => {
      navigate("/treinos");
    }, 500);
  } catch (e: any) {
    console.error("Falha inesperada ao criar treino:", e?.response?.data || e);

    // ✅ pega mensagem em vários formatos (axios/fetch/string)
    const msgErro =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      (typeof e === "string" ? e : "") ||
      "Erro inesperado ao criar treino.";

    // ✅ mostra o erro e NÃO navega
    showToast(msgErro, "error");

    // ✅ mantém o state + sessionStorage para usuário corrigir e tentar de novo
    // (não remove SAVE_KEY / RESTORE_FLAG_KEY)
  } finally {
    setSalvando(false);
  }
};


  const agendarTreino = async (t: TreinoProgramado) => {
    try {
      const atletaId = String(atletaIdLogado || "").trim();
      const token = (Storage as any).token;
      if (!atletaId || !token) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      const prazoSelecionadoRaw = (prazos[t.id] || "").trim();

      if (!prazoSelecionadoRaw) {
        alert("Selecione o prazo para envio antes de agendar.");
        return;
      }

      const prazoComSegundos =
        prazoSelecionadoRaw.length === 16 ? `${prazoSelecionadoRaw}:00` : prazoSelecionadoRaw;

      const quando = new Date(prazoComSegundos);

      if (isNaN(quando.getTime())) {
        alert("Prazo inválido. Selecione novamente.");
        return;
      }

      const expira = new Date(quando.getTime() + 3 * 24 * 60 * 60 * 1000);
      const dataTreinoLocal = toLocalISO_NoZ(quando);
      const dataExpiracaoLocal = toLocalISO_NoZ(expira);

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: dataTreinoLocal,
          dataExpiracao: dataExpiracaoLocal,
          atletaId,
          treinoProgramadoId: t.id,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Falha ao agendar treino:", res.status, txt);
        alert("Erro ao agendar treino.");
        return;
      }

      const novo: TreinoAgendadoResp = await res.json();

      sessionStorage.setItem("lastAgendamento", JSON.stringify(novo));
      window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));

      setIdsProgramadosBloqueados((prev) => new Set(prev).add(novo.treinoProgramadoId));
      setPrazos(({ [t.id]: _, ...rest }) => rest);
      
      alert("Treino agendado com sucesso!");
      navigate("/treinos");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao agendar treino.");
    }
  };

  if (!iniciado) return <p className="text-center p-4">Carregando...</p>;
  if (!usuario)
    return (
      <div className="p-4 text-center">
        Você precisa estar logado como <b>Escola</b>, <b>Clube</b> ou{" "}
        <b>Professor</b> para criar treinos.
      </div>
    );

  if (usuario.tipo === "atleta") {
    // 1) lista “Meu professor”: filtra pelos professores vinculados
    const treinosMeuProfessorBrutos =
      professorVinculadoIds.length === 0
        ? []
        : treinosDisponiveis.filter((t) => {
            const criadoresIds = (t.criadores || []).map((c) => String(c.id));
            const criadorId = t.criador?.id ? String(t.criador.id) : "";
            const todos = new Set<string>([...criadoresIds, ...(criadorId ? [criadorId] : [])]);
            return professorVinculadoIds.some((pid) => todos.has(String(pid)));
          });

    // 2) aplica bloqueio (já agendados) em ambas
    const treinosMeuProfessor = treinosMeuProfessorBrutos.filter(
      (t) => !idsProgramadosBloqueados.has(t.id),
    );

    const treinosParceirosFootera = treinosFootera.filter(
      (t) => !idsProgramadosBloqueados.has(t.id),
    );

    const listaAtiva =
      abaTreinosAtleta === "meu_professor" ? treinosMeuProfessor : treinosParceirosFootera;

    return (
      <div className="p-4 max-w-xl mx-auto mb-5">
        <Link
          href="/treinos"
          aria-label="Voltar para treinos"
          title="Voltar para explorar"
          className="inline-flex h-10 w-10 items-center justify-center
            rounded-full border border-green-800 bg-white text-green-900
            shadow-sm hover:bg-green-50 focus:outline-none
            focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <h2 className="text-lg font-bold mb-3">Treinos Disponíveis</h2>

        {/* Abas */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAbaTreinosAtleta("meu_professor")}
            className={[
              "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition",
              abaTreinosAtleta === "meu_professor"
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-green-900 border-green-200 hover:bg-green-50",
            ].join(" ")}
          >
            Meu professor
          </button>

          <button
            type="button"
            onClick={() => setAbaTreinosAtleta("footera")}
            className={[
              "flex-1 px-3 py-2 rounded-xl border text-sm font-semibold transition",
              abaTreinosAtleta === "footera"
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-green-900 border-green-200 hover:bg-green-50",
            ].join(" ")}
          >
            Professores Footera
          </button>
        </div>

        {/* Mensagens vazias específicas */}
        {listaAtiva.length === 0 ? (
          <div className="text-gray-600 bg-white border rounded-xl p-4">
            {abaTreinosAtleta === "meu_professor" ? (
              <>
                {professorVinculadoIds.length === 0 ? (
                  <p>
                    Você ainda não possui <b>professor vinculado</b>. Assim que houver vínculo,
                    os treinos dele aparecerão aqui.
                  </p>
                ) : (
                  <p>
                    Nenhum treino do seu professor está disponível para agendar no momento.
                  </p>
                )}
              </>
            ) : (
              <p>Nenhum treino público de professores parceiros encontrado no momento.</p>
            )}
          </div>
        ) : (
          listaAtiva.map((t) => (
            <div key={t.id} className="bg-white border p-4 rounded shadow mb-4">
              <div className="flex items-start justify-between gap-2">
                <h3
                  className="text-green-800 text-lg font-semibold cursor-pointer hover:underline"
                  onClick={() => navigate(`/treinos/unico?programadoId=${t.id}`)}
                  title="Ver detalhes do treino"
                >
                  {t.nome}
                </h3>

                {typeof t.pontuacao === "number" && t.pontuacao > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    +{t.pontuacao} pts
                  </span>
                )}
              </div>

              <p className="text-sm">
                <strong>Descrição:</strong> {t.descricao}
              </p>

              <p className="text-sm">
                <strong>Nível:</strong> {t.nivel}
              </p>

              {t.criadores?.length ? (
                <p className="text-sm mt-1">
                  <strong>Criado por:</strong> {t.criadores.map((c) => `Prof. ${c.nome}`).join(", ")}
                </p>
              ) : t.criador ? (
                <p className="text-sm mt-1">
                  <strong>Criado por:</strong>{" "}
                  {t.criador.tipo === "Professor"
                    ? `Prof. ${t.criador.nome}`
                    : `${t.criador.nome} (${t.criador.tipo})`}
                </p>
              ) : null}

              <p className="text-sm">
                <strong>Exercícios:</strong>
              </p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {t.exercicios.map((ex, i) => (
                  <li key={i}>
                    {ex.nome} {ex.repeticoes ? `(${ex.repeticoes})` : ""}
                  </li>
                ))}
              </ul>

              <label className="text-sm mt-2 block">
                <strong>Prazo para envio: </strong>
              </label>
              <input
                type="datetime-local"
                className="border p-2 rounded"
                value={prazos[t.id] || ""}
                onFocus={() => {
                  if (!prazos[t.id]) {
                    setPrazos((prev) => ({
                      ...prev,
                      [t.id]: toDatetimeLocalValue(new Date()),
                    }));
                  }
                }}
                onChange={(e) =>
                  setPrazos((prev) => ({
                    ...prev,
                    [t.id]: e.target.value,
                  }))
                }
              />

              <div className="flex justify-end mt-2">
                <button
                  className="mt-3 bg-green-800 text-white px-3 py-1 rounded text-sm w-fit"
                  style={{ alignSelf: "flex-end" }}
                  onClick={() => agendarTreino(t)}
                >
                  Agendar treino
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-28">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 items-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold col-start-1">
            Criar Novo Treino
          </h2>

          <div
            className="justify-self-center col-start-2"
            title={
              `Tipo: +${score.tipo} • ` +
              `Exercícios (${score.exCount}): +${score.exercicios} • ` +
              `Duração: +${score.duracao}`
            }
          >
            <span
              className="
              inline-flex items-center gap-1 rounded-full px-3 py-1
              text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-300
            "
            >
              {score.total} pts
            </span>
          </div>

          <button
            onClick={() => {
              if (confirm("Deseja limpar o progresso deste treino?")) {
                setEtapa(1);
                setCompletedUntil(1);
                setNome("");
                setDescricao("");
                setNivel("Base");
                setDuracao(60);
                setDataTreino("");
                setCategorias([]);
                setTipoTreino("Tecnico");
                setObjetivo("");
                setExerciciosSelecionados([]);
                setAtletasSelecionados([]);
                setProfessoresSelecionados([]);
                sessionStorage.removeItem(SAVE_KEY);
                sessionStorage.removeItem(RESTORE_FLAG_KEY);
              }
            }}
            className="text-sm text-red-700 underline justify-self-end col-start-3"
          >
            Limpar progresso
          </button>
        </div>



        {etapa === 1 && (
          <StepCard title="Informações Básicas">
            <label className="block text-sm text-gray-700 mb-1">
              Título do Treino
            </label>
            <input
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Título do Treino"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <label className="block text-sm text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Descrição do Treino"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Tipo do Treino
                </label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={tipoTreino}
                  onChange={(e) => setTipoTreino(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Tecnico">Técnico</option>
                  <option value="Fisico">Físico</option>
                  <option value="Tatico">Tático</option>
                  <option value="Mental">Mental</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Duração do Treino (minutos)
                </label>
                <input
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  type="number"
                  min={1}
                  value={duracao}
                  onChange={(e) =>
                    setDuracao(parseInt(e.target.value || "0") || 0)
                  }
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Professores realizadores (colaboradores)
                </label>

                <div className="border rounded p-2">
                  <input
                    className="border w-full p-2 rounded text-sm mb-2"
                    placeholder="Buscar professor..."
                    value={filtroProf}
                    onChange={(e) => setFiltroProf(e.target.value)}
                  />

                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {professores
                      .filter((p) => {
                        const q = (filtroProf || "").toLowerCase();
                        if (!q) return true;
                        const txt = `${p.nome} ${p.codigo ?? ""} ${p.cref ?? ""}`.toLowerCase();
                        return txt.includes(q);
                      })
                      .map((p) => {
                        const pid = String(p.id);
                        const checked = professoresSelecionados.map(String).includes(pid);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setProfessoresSelecionados((prev) => {
                                  const pid = String(p.id);
                                  const prevStr = prev.map(String);
                                   if (prevStr.includes(pid)) return prevStr.filter((x) => x !== pid);
                                  return [...prevStr, pid];
                                });
                              }}
                            />
                            <span className="text-sm">
                              {p.nome}
                              {p.codigo ? ` (${p.codigo})` : ""}{p.cref ? ` - ${p.cref}` : ""}
                            </span>
                          </label>
                        );
                      })}
                  </div>

                  {professoresSelecionados.length > 0 && (
                    <div className="mt-2 text-xs text-gray-700">
                      <span className="font-semibold">Selecionados:</span>{" "}
                      {professoresSelecionados
                        .map((id) => professores.find((p) => p.id === id)?.nome ?? id)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </div>

            </div>



          </StepCard>
        )}

        {etapa === 2 && (
          <>
            <StepCard title="Exercícios Selecionados">
              {exerciciosSelecionados.length === 0 && (
                <div className="text-sm text-gray-600 mb-3">
                  Nenhum exercício adicionado ainda.
                </div>
              )}

              {exerciciosDisponiveis.length === 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-3">
                  Nenhum exercício foi carregado. Verifique no console o log: <b>[NovoTreino] carregando exercicios...</b>
                </div>
              )}

              <div className="space-y-3">
                {exerciciosSelecionados.map((ex, i) => {
                  const base = ex.idCatalogo
                    ? exerciciosDisponiveis.find(
                        (e) => e.id === ex.idCatalogo,
                      )
                    : undefined;
                  const videoSrc = resolveVideoUrl(ex.videoUrl || base?.videoDemonstrativoUrl);

                  const nomeFinal = base?.nome ?? ex.nome ?? "";
                  const nivelFinal = base?.nivel ?? undefined;
                  const descFinal = base?.descricao ?? ex.descricao ?? "";

                  const ehDoBanco = Boolean(ex.idCatalogo);

                  return (
                    <div
                      key={i}
                      className="border rounded-lg p-3 relative bg-white shadow-sm"
                    >
                      <button
                        onClick={() => removerExercicio(i)}
                        className="text-red-600 text-sm self-end sm:absolute sm:top-2 sm:right-2"
                        title="Remover exercício"
                      >
                        Remover
                      </button>

                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="w-full sm:w-44 shrink-0">
                          {videoSrc ? (
                            <button
                              type="button"
                              className="relative w-full h-44 sm:h-28 rounded overflow-hidden bg-black"
                              onClick={() => setVideoModalSrc(videoSrc)}
                              title="Ver vídeo"
                            >
                              <video
                                className="w-full h-full object-cover"
                                src={videoSrc}
                                preload="metadata"
                                muted
                                playsInline
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                                  <Play className="w-5 h-5 text-white" />
                                </span>
                              </div>
                            </button>
                          ) : (
                            <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                              sem vídeo
                            </div>
                          )}

                          {!ehDoBanco && (
                            <div className="mt-2 flex items-center gap-2">
                              <label className="text-xs px-3 py-1.5 rounded bg-gray-100 border cursor-pointer">
                                {ex.videoUrl ? "Trocar vídeo" : "Upload de vídeo"}
                                <input
                                  type="file"
                                  accept="video/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    const old = exerciciosSelecionados[i]?.videoUrl;
                                    if (old && old.startsWith("blob:")) URL.revokeObjectURL(old);

                                    const localPreview = URL.createObjectURL(file);
                                    setVideoNoEx(i, localPreview);

                                    try {
                                      const url = await uploadVideo(file); 
                                      setVideoNoEx(i, url);               
                                      URL.revokeObjectURL(localPreview);
                                    } catch (err: any) {
                                      console.error(err);
                                      alert(err?.message || "Erro ao enviar vídeo");
                                    } finally {
                                      e.currentTarget.value = "";
                                    }
                                  }}
                                />
                              </label>

                              <button
                                type="button"
                                className="text-xs text-red-600 underline"
                                onClick={() => {
                                  const v = exerciciosSelecionados[i]?.videoUrl;
                                  if (v && v.startsWith("blob:")) URL.revokeObjectURL(v);
                                  setVideoNoEx(i, null);
                                }}
                                disabled={!ex.videoUrl}
                                title="Deixar sem vídeo"
                              >
                                Remover vídeo
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {ehDoBanco ? (
                              <div className="font-semibold">
                                {nomeFinal}
                              </div>
                            ) : (
                              <input
                                className="border p-1 rounded w-full"
                                placeholder="Nome do exercício"
                                value={ex.nome || ""}
                                onChange={(e) =>
                                  atualizarExercicio(
                                    i,
                                    "nome",
                                    e.target.value,
                                  )
                                }
                              />
                            )}

                            {nivelFinal ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {nivelFinal}
                              </span>
                            ) : null}
                          </div>

                          {ehDoBanco ? (
                            <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">
                              {descFinal || "Sem descrição."}
                            </p>
                          ) : (
                            <textarea
                              className="border w-full mb-2 p-1 rounded"
                              placeholder="Descrição"
                              value={ex.descricao || ""}
                              onChange={(e) =>
                                atualizarExercicio(
                                  i,
                                  "descricao",
                                  e.target.value,
                                )
                              }
                            />
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Séries
                              </label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 3"
                                value={ex.series || ""}
                                onChange={(e) =>
                                  atualizarExercicio(
                                    i,
                                    "series",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Repetições
                              </label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 12"
                                value={ex.repeticoes || ""}
                                onChange={(e) =>
                                  atualizarExercicio(
                                    i,
                                    "repeticoes",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={adicionarExercicio}
                className="bg-gray-200 px-3 py-1 rounded mb-2 mt-3"
              >
                + Adicionar linha (personalizado)
              </button>
            </StepCard>

            <div className="h-4" />

            <StepCard title="Exercícios Disponíveis">
              <div className="mb-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      className="border w-full p-2 pl-9 rounded text-sm"
                      placeholder="Buscar por nome, nível ou descrição..."
                      value={filtroEx}
                      onChange={(e) => setFiltroEx(e.target.value)}
                    />
                    <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {exerciciosFiltrados.length} resultado(s)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                  <div>
                    <select
                      multiple
                      size={7}
                      className="border w-full p-2 rounded text-xs sm:text-sm h-32"
                      value={filtroCategorias}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions).map(
                          (opt) => opt.value,
                        );
                        setFiltroCategorias(values);
                      }}
                    >
                      <option value="Sub9">Sub-9</option>
                      <option value="Sub11">Sub-11</option>
                      <option value="Sub13">Sub-13</option>
                      <option value="Sub15">Sub-15</option>
                      <option value="Sub17">Sub-17</option>
                      <option value="Sub20">Sub-20</option>
                      <option value="Livre">Livre</option>
                    </select>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">
                      Segure <b>Ctrl</b> (ou toque e selecione) para escolher mais de uma categoria.
                    </p>
                  </div>

                  <div>
                    <select
                      multiple
                      size={4}
                      className="border w-full p-2 rounded text-xs sm:text-sm h-24"
                      value={filtroNiveis}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions).map(
                          (opt) => opt.value,
                        );
                        setFiltroNiveis(values);
                      }}
                    >
                      <option value="Base">Base</option>
                      <option value="Avancado">Avançado</option>
                      <option value="Performance">Performance</option>
                    </select>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-1">
                      Você pode combinar vários níveis (ex.: Base + Avançado).
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroEx("");
                      setFiltroCategorias([]);
                      setFiltroNiveis([]);
                    }}
                    className="text-[11px] sm:text-xs text-gray-600 underline"
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>

              <ul
                ref={listRef}
                onScroll={onScrollListaExercicios}
                className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1"
              >
                {exerciciosVisiveis.map((exercicio) => {
                  const videoSrc = resolveVideoUrl(exercicio.videoDemonstrativoUrl);
                  const jaAdicionado = jaEstaNoTreinoPorIdOuNome(
                    exerciciosSelecionados,
                    exercicio.id,
                    exercicio.nome,
                  );

                  return (
                    <li key={exercicio.id} className="py-3">
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="w-full sm:w-44 shrink-0">
                          {videoSrc ? (
                            <VideoThumb
                              src={videoSrc}
                              onClick={() => setVideoModalSrc(videoSrc)}
                            />
                          ) : (
                            <div className="w-full h-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600">
                              sem vídeo
                            </div>
                          )}

                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{exercicio.nome}</div>
                            {exercicio.nivel ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {exercicio.nivel}
                              </span>
                            ) : null}
                          </div>

                          {exercicio.descricao ? (
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                              {exercicio.descricao}
                            </p>
                          ) : null}

                          {(exercicio.tipoTreino ||
                            exercicio.duracaoMinutos ||
                            (exercicio.categorias && exercicio.categorias.length > 0)) && (
                            <div className="flex flex-wrap gap-1 mt-1 text-[11px] text-gray-700">
                              {exercicio.tipoTreino && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                                  {exercicio.tipoTreino}
                                </span>
                              )}
                              {typeof exercicio.duracaoMinutos === "number" &&
                                exercicio.duracaoMinutos > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200">
                                    {exercicio.duracaoMinutos} min
                                  </span>
                                )}
                              {exercicio.categorias?.map((cat) => (
                                <span
                                  key={cat}
                                  className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => !jaAdicionado && adicionarExercicioExistente(exercicio)}
                          disabled={jaAdicionado}
                          className={`bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto ${
                            jaAdicionado ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {jaAdicionado ? "Adicionado" : "Adicionar"}
                        </button>
                      </div>
                    </li>
                  );
                })}

                {temMaisExercicios && (
                  <li className="py-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setPageEx((p) => p + 1)}
                      className="text-sm px-3 py-2 rounded border bg-white hover:bg-gray-50"
                    >
                      Carregar mais ({exerciciosVisiveis.length}/{exerciciosFiltrados.length})
                    </button>
                  </li>
                )}
              </ul>




            </StepCard>
          </>
        )}


        {etapa === 3 && (
          <StepCard title="Selecionar Atletas Vinculados">
            <div className="mb-4 grid gap-2">
              <label className="block text-sm text-gray-700">
                Organização (para montar turmas e listar alunos)
              </label>
              <select
                className="border w-full p-2 rounded"
                value={orgSelecionada}
                onChange={(e) => {
                  setOrgSelecionada(e.target.value);
                  setAtletasSelecionados([]);
                  setElencoSelecionado("");
                }}
              >
                <option value="">
                  — Meus vinculados (professor/escola/clube) —
                </option>
                <option value={MOSTRAR_TODOS}>— Todos os atletas —</option>
                {orgsVinculadas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome} ({o.tipo})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600">
                Se escolher uma organização, os alunos e as turmas listados
                abaixo virão dela.
              </p>
            </div>

            {atletasVinculados.length === 0 ? (
              <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
                Nenhum atleta encontrado para a fonte selecionada.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {atletasVinculados.map((atleta) => {
                  const selecionado = atletasSelecionados.includes(atleta.id);
                  return (
                    <div
                      key={atleta.id}
                      onClick={() =>
                        setAtletasSelecionados((prev) =>
                          selecionado
                            ? prev.filter((id) => id !== atleta.id)
                            : [...prev, atleta.id],
                        )
                      }
                      className={`cursor-pointer p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 ${
                        selecionado
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200"
                      }`}
                    >
                      <img
                        src={atleta.foto ? resolveMediaUrl(atleta.foto) : "https://via.placeholder.com/80"}
                        alt={atleta.nome}
                        className="w-20 h-20 mx-auto rounded-full object-cover mb-2"
                      />
                      <p className="font-semibold text-sm sm:text-base">
                        {atleta.nome}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="my-4 p-3 border rounded-md">
              <div className="mb-3 flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-700 mb-1">
                    Turmas da organização
                  </label>
                  <select
                    className="border w-full p-2 rounded"
                    value={elencoSelecionado}
                    onChange={(e) => setElencoSelecionado(e.target.value)}
                  >
                    <option value="">— Selecionar turma —</option>
                    {elencos.map((el) => (
                      <option key={el.id} value={el.id}>
                        {el.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={incluirElencoNoTreino}
                  className="bg-green-700 text-white px-3 py-2 rounded"
                >
                  Usar turma no treino
                </button>
              </div>

              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  className="border p-2 rounded sm:col-span-2"
                  placeholder='Nova turma (ex.: "Sub-13 - Noite")'
                  value={novaTurmaNome}
                  onChange={(e) => setNovaTurmaNome(e.target.value)}
                />
                <button
                  onClick={criarTurmaComSelecionados}
                  className="bg-emerald-600 text-white px-3 py-2 rounded"
                >
                  + Criar turma com selecionados
                </button>
              </div>
            </div>

            <div className="my-4 p-3 border rounded-md bg-gray-50">
              <div className="flex items-start gap-2 mb-3">
                <div className="mt-[2px]">
                  <CalendarIcon className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <label className="block text-sm text-gray-800 font-semibold">
                    Dias para agendar este treino automaticamente
                  </label>
                  <p className="text-xs text-gray-600">
                    Toque nos dias do calendário FootEra para marcar ou
                    desmarcar. Se você não escolher datas aqui, o treino será
                    criado sem agendamento automático. Depois você poderá
                    agendar manualmente para os atletas na tela de treinos.
                  </p>
                  {isFreePlan && (
                    <p className="mt-1 text-[11px] text-green-700">
                      No plano <b>Free</b>, o agendamento automático fica limitado
                      da data de hoje até 30 dias à frente. Para mais liberdade de
                      agenda, migre para o plano Pro. 😉
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setMesCalendario((prev) => {
                      const novoMes = prev.mes - 1;
                      if (novoMes < 0) {
                        return { ano: prev.ano - 1, mes: 11 };
                      }
                      return { ano: prev.ano, mes: novoMes };
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <div className="text-sm sm:text-base font-semibold text-green-800">
                  {NOMES_MESES_PT[mesCalendario.mes]} {mesCalendario.ano}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMesCalendario((prev) => {
                      const novoMes = prev.mes + 1;
                      if (novoMes > 11) {
                        return { ano: prev.ano + 1, mes: 0 };
                      }
                      return { ano: prev.ano, mes: novoMes };
                    })
                  }
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-100"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] sm:text-xs text-gray-500 mb-1">
                {DIAS_SEMANA_PT.map((d) => (
                  <div key={d} className="uppercase tracking-tight">
                    {d}
                  </div>
                ))}
              </div>

              {(() => {
                const { ano, mes } = mesCalendario;
                const primeiroDia = new Date(ano, mes, 1);
                const weekdaySundayBased = primeiroDia.getDay();
                const firstWeekday = (weekdaySundayBased + 6) % 7;
                const diasNoMes = new Date(ano, mes + 1, 0).getDate();

                const dias: Array<number | null> = [];
                for (let i = 0; i < firstWeekday; i++) dias.push(null);
                for (let d = 1; d <= diasNoMes; d++) dias.push(d);

                const semanas: Array<Array<number | null>> = [];
                for (let i = 0; i < dias.length; i += 7) {
                  semanas.push(dias.slice(i, i + 7));
                }

                let hoje: Date | null = null;
                let limite: Date | null = null;
                if (isFreePlan) {
                  hoje = new Date();
                  hoje.setHours(0, 0, 0, 0);

                  limite = new Date(hoje);
                  limite.setDate(limite.getDate() + 30);
                }

                const diaForaDaJanela = (dia: number) => {
                  if (!isFreePlan || !hoje || !limite) return false;
                  const dateStr = formatYMD(ano, mes, dia);
                  const d = new Date(`${dateStr}T00:00:00`);
                  if (isNaN(d.getTime())) return true;
                  d.setHours(0, 0, 0, 0);
                  return d < hoje || d > limite;
                };

                const toggleDia = (dia: number) => {
                  if (diaForaDaJanela(dia)) {
                    showToast(
                      "No plano Free, você só pode agendar treinos da data de hoje até 30 dias à frente.",
                      "info",
                    );
                    return;
                  }

                  const dateStr = formatYMD(ano, mes, dia);
                  setDatasAgendamento((prev) => {
                    if (prev.includes(dateStr)) {
                      return prev.filter((d) => d !== dateStr);
                    }
                    const next = [...prev, dateStr];
                    return next.sort();
                  });
                };

                return (
                  <div className="grid grid-rows-6 gap-1 mb-2">
                    {semanas.map((semana, idxSemana) => (
                      <div
                        key={idxSemana}
                        className="grid grid-cols-7 gap-1"
                      >
                        {semana.map((dia, idxDia) => {
                          if (!dia) {
                            return (
                              <div key={idxDia} className="h-8 sm:h-9" />
                            );
                          }
                          const dateStr = formatYMD(ano, mes, dia);
                          const selecionado =
                            datasAgendamento.includes(dateStr);

                          const bloqueado = diaForaDaJanela(dia);

                          return (
                            <button
                              key={idxDia}
                              type="button"
                              onClick={() => toggleDia(dia)}
                              disabled={bloqueado}
                              className={[
                                "h-8 sm:h-9 text-xs sm:text-sm flex items-center justify-center rounded-full border transition-all",
                                bloqueado
                                  ? "bg-gray-100 text-gray-400 border-dashed border-gray-300 cursor-not-allowed"
                                  : selecionado
                                  ? "bg-green-700 text-white border-green-700 shadow-sm"
                                  : "bg-white text-gray-800 border-gray-300 hover:bg-green-50",
                              ].join(" ")}
                            >
                              {dia}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {datasAgendamento.length > 0 && (
                <div className="mt-2 text-xs text-gray-700">
                  <span className="font-semibold">Dias selecionados:</span>{" "}
                  {datasAgendamento
                    .slice()
                    .sort()
                    .map((str) => {
                      const iso = str.includes("T") ? str : `${str}T00:00:00`;
                      const d = new Date(iso);
                      if (isNaN(d.getTime())) return str;
                      return d.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      });
                    })
                    .join(", ")}
                </div>
              )}

              {datasAgendamento.length > 0 &&
                atletasSelecionados.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    Você já escolheu datas, mas ainda não selecionou atletas. O
                    treino só será agendado para quem estiver selecionado
                    acima.
                  </p>
                )}
            </div>





          </StepCard>
        )}
      </div>

{/* ActionBar flutuante (acima da navbar) */}
<div className="fixed top-0 left-0 right-0 z-40 px-4 pt-2">
  <div className="max-w-3xl mx-auto">
    <div className="bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-2xl p-2 sm:p-3 flex items-center gap-2">
      {/* Voltar */}
      <button
        type="button"
        onClick={() => {
          if (etapa === 1) navigate("/treinos");
          else goTo(etapa - 1);
        }}
        className="px-3 sm:px-4 py-2 rounded-xl bg-gray-200 text-gray-900 shrink-0"
      >
        Voltar
      </button>

      {/* Stepper no meio (a barra de cima) */}
      <div className="flex-1 min-w-0">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            <Stepper current={etapa} onJump={goTo} completedUntil={completedUntil} />
          </div>
        </div>
      </div>

      {/* Próximo / Salvar */}
      {etapa < 3 ? (
        <button
          type="button"
          onClick={() => goTo(etapa + 1)}
          className="px-3 sm:px-4 py-2 rounded-xl bg-green-800 text-white shrink-0"
        >
          Próximo
        </button>
      ) : (
        <button
          type="button"
          onClick={criarTreino}
          disabled={salvando}
          className={[
            "px-3 sm:px-4 py-2 rounded-xl bg-green-800 text-white shrink-0",
            salvando ? "opacity-60 cursor-not-allowed" : "",
          ].join(" ")}
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      )}
    </div>
  </div>
</div>


      {toast && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center z-40 px-4">
          <div
            className={[
              "max-w-md w-full px-4 py-3 rounded-full shadow-lg border text-sm sm:text-base bg-white",
              toast.type === "success"
                ? "border-green-500 text-green-900"
                : toast.type === "error"
                ? "border-red-500 text-red-900"
                : "border-gray-400 text-gray-900",
            ].join(" ")}
          >
            {toast.message}
          </div>
        </div>
      )}

      {videoModalSrc && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setVideoModalSrc(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <button
                className="text-sm text-gray-700 underline"
                onClick={() => setVideoModalSrc(null)}
              >
                Fechar
              </button>
            </div>

            <video
              className="w-full max-h-[70vh] rounded bg-black"
              src={videoModalSrc}
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        <Link href="/feed" className="hover:underline">
          <House />
        </Link>
        <Link href="/explorar" className="hover:underline">
          <SearchIcon />
        </Link>
        <Link href="/post" className="hover:underline">
          <CirclePlus />
        </Link>
        <Link href="/treinos" className="hover:underline">
          <Volleyball />
        </Link>
        <Link href="/perfil" className="hover:underline">
          <User />
        </Link>
      </nav>
    </div>
  );
}
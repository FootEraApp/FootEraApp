// client/src/pages/novoTreino
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
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
  Calendar as CalendarIcon,
} from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { TreinosApi } from "../utils/treinosApi.js";
import { montarExerciciosParaPayload } from "../utils/treinos.helpers.js";
import type { ExItemUI, TreinoCreatePayload } from "../utils/treinos.types.js";

type Organizacao = { id: string; nome: string; tipo: "Escolinha" | "Clube" };

type PontuacaoDetalhe = {
  total: number;
  nivel: number;
  tipo: number;
  exercicios: number;
  duracao: number;
  dicas: number;
  exCount: number;
};

const PONTOS = {
  NIVEL: { Base: 0, Avancado: 10, Performance: 20 } as Record<string, number>,
  TIPO: { Tecnico: 5, Fisico: 6, Tatico: 8 } as Record<string, number>,
  POR_EXERCICIO: 4,
  POR_15_MIN: 1,
  POR_DICA: 1,
  DICAS_MAX: 5,
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

function resolveVideoUrl(raw?: string) {
  if (!raw) return "";
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("http")) return p;
  if (p.startsWith("/assets/")) return p;
  return `${API.BASE_URL}${p.startsWith("/") ? p : `/${p}`}`;
}

function calcularPontuacaoTreino(
  nivel: string,
  tipoTreino: string,
  duracaoMin: number,
  exercicios: ExItemUI[],
  dicas: string[],
): PontuacaoDetalhe {
  const exCount = exercicios.filter((e) => e.idCatalogo || (e.nome && e.nome.trim())).length;
  const ptsEx = exCount * PONTOS.POR_EXERCICIO;

  const ptsNivel = PONTOS.NIVEL[nivel as keyof typeof PONTOS.NIVEL] ?? 0;
  const ptsTipo = PONTOS.TIPO[tipoTreino as keyof typeof PONTOS.TIPO] ?? 0;

  const dur = Number.isFinite(Number(duracaoMin)) ? Number(duracaoMin) : 0;
  const ptsDur = Math.max(0, Math.floor(dur / 15) * PONTOS.POR_15_MIN);

  const dicasValidas = Math.min(PONTOS.DICAS_MAX, Math.max(0, dicas?.length ?? 0));
  const ptsDicas = dicasValidas * PONTOS.POR_DICA;

  const total = ptsEx + ptsNivel + ptsTipo + ptsDur + ptsDicas;
  return { total, nivel: ptsNivel, tipo: ptsTipo, exercicios: ptsEx, duracao: ptsDur, dicas: ptsDicas, exCount };
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
}

interface AtletaVinculado {
  id: string;
  nome: string;
  foto?: string;
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
const MAX_SLOTS_TREINOS_SALVOS = 5;

function toCategoriaEnum(val?: string | null): string | null {
  if (!val) return null;
  const m = String(val).match(/sub[\s\-]?(\d{1,2})/i);
  if (m) return `Sub${m[1]}`;
  if (/^livre$/i.test(String(val))) return "Livre";
  return val;
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
  const url = `${API.BASE_URL}/api/treinos-salvos?tipoUsuario=${encodeURIComponent(
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
    `${API.BASE_URL}/api/treinos-salvos/${encodeURIComponent(id)}`,
    { method: "DELETE", headers },
  );
  if (!r.ok) throw new Error("Falha ao apagar treino salvo");
  return true;
}

async function apiCriarTreinoSalvo(body: any) {
  const headers = authHeaders();
  const r = await fetch(`${API.BASE_URL}/api/treinos-salvos`, {
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
      dicas: Array.isArray(payload.dicas) ? payload.dicas : [],
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
  } catch {}
}

const steps = [
  { id: 1, label: "Informações" },
  { id: 2, label: "Exercícios" },
  { id: 3, label: "Dicas" },
  { id: 4, label: "Atletas" },
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
    <div className="mb-4 sm:mb-6 -mx-2 sm:mx-0">
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

export default function NovoTreino() {
  const [, navigate] = useLocation();

  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [prazos, setPrazos] = useState<Record<string, string>>({});
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<
    Exercicio[]
  >([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<
    TreinoProgramado[]
  >([]);
  const [atletasVinculados, setAtletasVinculados] = useState<
    AtletaVinculado[]
  >([]);
  const [atletasSelecionados, setAtletasSelecionados] = useState<string[]>([]);
  const [elencos, setElencos] = useState<Elenco[]>([]);
  const [elencoSelecionado, setElencoSelecionado] = useState<string>("");
  const [etapa, setEtapa] = useState<number>(1);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [duracao, setDuracao] = useState<number>(60);
  const [dataTreino, setDataTreino] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("Sub13");
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");
  const [iniciado, setIniciado] = useState<boolean>(false);
  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<
    ExItemUI[]
  >([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>("");
  const [filtroEx, setFiltroEx] = useState("");
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

  function showToast(
    message: string,
    type: "success" | "error" | "info" = "success",
  ) {
    setToast({ message, type });
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000); // some em 4s
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
    () =>
      calcularPontuacaoTreino(
        nivel,
        tipoTreino,
        duracao,
        exerciciosSelecionados,
        dicas,
      ),
    [nivel, tipoTreino, duracao, exerciciosSelecionados, dicas],
  );

  function normalizaTreinos(raw: any[]): TreinoProgramado[] {
    return raw.map((t: any) => {
      const programadoId =
        t.treinoProgramadoId ?? t.programadoId ?? t.programado?.id ?? t.id;

      let criador: TreinoProgramado["criador"] = t.criador ?? null;

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

        criador,
        criadorNome,
        criadorTipo,
      };
    });
  }

  function mapAtletas(items: any[]): AtletaVinculado[] {
    return (items || [])
      .map((a: any) => ({
        id: a.atletaId || a.id || a.usuarioId || "",
        nome: a.nome ?? a?.usuario?.nome ?? a?.atleta?.nome ?? "Atleta",
        foto:
          a.foto ?? a?.usuario?.foto ?? a?.atleta?.usuario?.foto ?? undefined,
      }))
      .filter((x) => x.id);
  }

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
        const atletaId =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          "";

        const tries = [
          `${API.BASE_URL}/api/treinos/disponiveis${
            atletaId ? `?atletaId=${encodeURIComponent(atletaId)}` : ""
          }`,
          `${API.BASE_URL}/api/treinos/programados`,
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
      } catch (e) {
        console.error("Falha ao carregar treinos disponíveis:", e);
        if (!cancel) setTreinosDisponiveis([]);
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
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        if (!orgSelecionada) {
          setElencos([]);
          setElencoSelecionado("");
          return;
        }

        try {
          const r = await fetch(
            `${API.BASE_URL}/api/treinos/elencos?tipoUsuarioId=${encodeURIComponent(
              orgSelecionada,
            )}`,
            { headers },
          );
          if (r.ok) {
            const j = await r.json();
            const arr = Array.isArray(j)
              ? j
              : j.items ?? j.data ?? j.rows ?? j.result ?? [];
            setElencos(
              (arr || []).map((e: any) => ({
                id: String(e.id),
                nome: e.nome ?? e.titulo ?? "Turma",
                atletasIds:
                  e.atletasIds ?? e.atletas?.map((a: any) => a.id) ?? [],
              })),
            );
            return;
          }
        } catch {}

        const ownerId = orgSelecionada;
        const urls = [
          `${API.BASE_URL}/api/elencos?organizacaoId=${encodeURIComponent(
            ownerId,
          )}`,
          `${API.BASE_URL}/api/turmas?organizacaoId=${encodeURIComponent(
            ownerId,
          )}`,
          `${API.BASE_URL}/api/turmas?escolinhaId=${encodeURIComponent(
            ownerId,
          )}`,
        ];

        for (const url of urls) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          if (Array.isArray(arr)) {
            setElencos(
              arr.map((e: any) => ({
                id: e.id,
                nome: e.nome ?? e.titulo ?? "Turma",
                atletasIds:
                  e.atletasIds ?? e.atletas?.map((a: any) => a.id) ?? [],
              })),
            );
            return;
          }
        }
        setElencos([]);
      } catch {
        setElencos([]);
      }
    })();
  }, [orgSelecionada]);

  useEffect(() => {
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

        const ownerId =
          orgSelecionada ||
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          "";

        const tries = [
          `${API.BASE_URL}/api/treinos/exercicios?tipoUsuarioId=${encodeURIComponent(
            ownerId,
          )}`,
          `${API.BASE_URL}/api/exercicios?ownerId=${encodeURIComponent(
            ownerId,
          )}`,
          `${API.BASE_URL}/api/exercicios`,
        ];

        for (const url of tries) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const arr = Array.isArray(j)
            ? j
            : j.items ?? j.data ?? j.rows ?? j.result ?? [];
          const itens: Exercicio[] = (arr || []).map((e: any) => ({
            id: String(e.id),
            nome: e.nome ?? e.titulo ?? "Sem nome",
            videoDemonstrativoUrl:
              e.videoDemonstrativoUrl ??
              e.videoUrl ??
              e.video ??
              e.demonstracaoUrl ??
              "",
            descricao: e.descricao ?? e.resumo ?? "",
            nivel: e.nivel ?? e.dificuldade ?? "",
          }));
          setExerciciosDisponiveis(itens);
          return;
        }

        setExerciciosDisponiveis([]);
      } catch (e) {
        console.error("Falha ao carregar exercícios:", e);
        setExerciciosDisponiveis([]);
      }
    })();
  }, [orgSelecionada]);

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
      const saved = safeParse<any>(sessionStorage.getItem(SAVE_KEY), null);
      if (saved) {
        setEtapa(saved.etapa ?? 1);
        setNome(saved.nome ?? "");
        setDescricao(saved.descricao ?? "");
        setNivel(saved.nivel ?? "Base");
        setDuracao(saved.duracao ?? 60);
        setDataTreino(saved.dataTreino ?? "");
        setCategoria(saved.categoria ?? "Sub13");
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
        setDicas(saved.dicas ?? []);
        setAtletasSelecionados(saved.atletasSelecionados ?? []);
        setDatasAgendamento(saved.datasAgendamento ?? []);
      }
      restoredRef.current = true;
    }

    setIniciado(true);
  }, []);

  useEffect(() => {
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

        console.log("[NovoTreino] orgSelecionada =", orgSelecionada);

        // Caso especial: mostrar todos os atletas
        if (orgSelecionada === MOSTRAR_TODOS) {
          const urlsTodos = [
            `${API.BASE_URL}/api/atletas`,
            `${API.BASE_URL}/api/usuarios?perfil=atleta`,
            `${API.BASE_URL}/api/relacoes/atletas?todos=1`,
          ];
          for (const url of urlsTodos) {
            console.log(
              "[NovoTreino] tentando carregar TODOS atletas em",
              url,
            );
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

        // Dono padrão (professor / escola / clube)
        const tipoUsuarioId =
          orgSelecionada ||
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          // fallback extra: alguns lugares usam "perfilId"
          localStorage.getItem("perfilId") ||
          sessionStorage.getItem("perfilId") ||
          "";

        console.log(
          "[NovoTreino] tipoUsuarioId usado em atletas-vinculados =",
          tipoUsuarioId,
        );

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

        console.log("[NovoTreino] GET", url);

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
          console.log(
            "[NovoTreino] atletas-vinculados carregados:",
            mapAtletas(items),
          );
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
      categoria,
      tipoTreino,
      objetivo,
      exerciciosSelecionados,
      dicas,
      atletasSelecionados,
      datasAgendamento,
    });
  }, [
    etapa,
    nome,
    descricao,
    nivel,
    duracao,
    dataTreino,
    categoria,
    tipoTreino,
    objetivo,
    exerciciosSelecionados,
    dicas,
    atletasSelecionados,
    datasAgendamento,
  ]);

  const criarTurmaComSelecionados = async () => {
    if (!orgSelecionada) {
      alert("Selecione uma organização primeiro.");
      return;
    }
    if (!novaTurmaNome.trim()) {
      alert("Informe o nome da turma.");
      return;
    }
    if (atletasSelecionados.length === 0) {
      alert("Selecione ao menos 1 atleta.");
      return;
    }

    try {
      const token =
        (Storage as any).token ||
        localStorage.getItem("token") ||
        sessionStorage.getItem("token") ||
        "";
      const headers: any = token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        : { "Content-Type": "application/json" };

      let ok = false,
        created: any = null;

      const ownerTipoRaw = orgsVinculadas.find(
        (o) => o.id === orgSelecionada,
      )?.tipo;
      const tipoUsuario =
        (ownerTipoRaw || "").toLowerCase() === "clube" ? "clube" : "escolinha";

      const tentativas = [
        { url: `${API.BASE_URL}/api/treinos/elencos`, method: "POST" },
        { url: `${API.BASE_URL}/api/elencos`, method: "POST" },
        { url: `${API.BASE_URL}/api/turmas`, method: "POST" },
      ];

      for (const t of tentativas) {
        const base = {
          nome: novaTurmaNome.trim(),
          atletasIds: atletasSelecionados,
        };
        const body = t.url.includes("/api/treinos/elencos")
          ? { ...base, tipoUsuario, tipoUsuarioId: orgSelecionada }
          : { ...base, organizacaoId: orgSelecionada };

        const r = await fetch(t.url, {
          method: t.method,
          headers,
          body: JSON.stringify(body),
        });

        const txt = await r.text();

        if (!r.ok) continue;
        created = txt ? JSON.parse(txt) : null;
        ok = true;
        break;
      }

      if (ok) {
        alert("Turma criada!");
        setNovaTurmaNome("");
        setElencos((prev) => [
          ...prev,
          {
            id: String(created?.id ?? Date.now()),
            nome: created?.nome ?? novaTurmaNome.trim(),
            atletasIds: created?.atletasIds ?? atletasSelecionados,
          },
        ]);
      } else {
        alert(
          "Falha ao criar turma (verifique os logs no console para o motivo do 400).",
        );
      }
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao criar turma.");
    }
  };

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

  const adicionarDataAgendamento = () => {
    setDatasAgendamento((prev) => [...prev, ""]);
  };

  const atualizarDataAgendamento = (index: number, valor: string) => {
    setDatasAgendamento((prev) => {
      const copia = [...prev];
      copia[index] = valor;
      return copia;
    });
  };

  const removerDataAgendamento = (index: number) => {
    setDatasAgendamento((prev) => prev.filter((_, i) => i !== index));
  };

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
    const q = filtroEx.trim().toLowerCase();
    if (!q) return exerciciosDisponiveis;
    return exerciciosDisponiveis.filter((e) => {
      const nome = (e.nome || "").toLowerCase();
      const desc = (e.descricao || "").toLowerCase();
      const nivel = (e.nivel || "").toLowerCase();
      return nome.includes(q) || desc.includes(q) || nivel.includes(q);
    });
  }, [filtroEx, exerciciosDisponiveis]);

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
      },
    ]);
  };

  const atualizarExercicio = (
    index: number,
    campo: keyof ExItemUI | "series",
    valor: string,
  ) => {
    const copia = [...exerciciosSelecionados];
    (copia[index][campo] as string | undefined) = valor;
    if (campo === "ordem") {
      const n = parseInt(valor, 10);
      if (!isNaN(n)) copia[index].ordem = n;
    }
    setExerciciosSelecionados(copia);
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
      return [
        ...prev,
        {
          idCatalogo: String(exercicio.id),
          nome: exercicio.nome,
          descricao: "",
          repeticoes: "",
          ordem: prev.length + 1,
          series: "",
        },
      ];
    });
  };

  const adicionarDica = () => {
    if (dicaAtual.trim()) {
      setDicas((prev) => [...prev, dicaAtual.trim()]);
      setDicaAtual("");
    }
  };

  function getDono() {
    const tipoRaw =
      (Storage as any).tipoSalvo ??
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      "";

    const normalized =
      String(tipoRaw).trim().toLowerCase() === "escola" ||
      String(tipoRaw).trim().toLowerCase() === "escolinha"
        ? "Escolinha"
        : String(tipoRaw).trim().toLowerCase() === "professor"
        ? "Professor"
        : String(tipoRaw).trim().toLowerCase() === "clube"
        ? "Clube"
        : null;

    const tipoUsuarioId =
      (Storage as any).tipoUsuarioId ||
      localStorage.getItem("tipoUsuarioId") ||
      sessionStorage.getItem("tipoUsuarioId") ||
      null;

    return {
      tipoUsuario: normalized as "Professor" | "Clube" | "Escolinha" | null,
      tipoUsuarioId,
    };
  }

  type DonoLiteral = "professor" | "clube" | "escolinha";
  function isDono(v: string): v is DonoLiteral {
    return v === "professor" || v === "clube" || v === "escolinha";
  }

  // 🔧 AQUI está a função ajustada para usar /api/treinos/rotina/agendar
  async function agendarTreinoEmLote(treinoProgramadoId: string) {
    try {
      const datasValidas = datasAgendamento.filter((d) => d && d.trim());

      const datasBase = datasValidas.length
        ? datasValidas
        : dataTreino
        ? [dataTreino]
        : [];

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

      const datasISO = datasBase.map((d) => {
        if (d.includes("T")) {
          return new Date(d).toISOString();
        }
        const dt = new Date(`${d}T${baseTime}`);
        return dt.toISOString();
      });

      const body = {
        treinoProgramadoId,
        datas: datasISO,
        // nome esperado pelo backend: atletaIds
        atletaIds: atletasSelecionados,
        // aproveita elencoSelecionado se tiver
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
        : datasISO.length * atletasSelecionados.length;
    } catch (e) {
      console.error("Erro em agendarTreinoEmLote:", e);
      return 0;
    }
  }

  const criarTreino = async () => {
    try {
      const { tipoUsuario, tipoUsuarioId } = getDono();
      const tipoUsuarioNormRaw = (tipoUsuario ?? "").toLowerCase();

      if (!tipoUsuario || !tipoUsuarioId) {
        alert(
          "Erro: não foi possível determinar o dono do treino (Professor/Clube/Escolinha).",
        );
        return;
      }

      if (!isDono(tipoUsuarioNormRaw)) {
        alert("Erro: tipo de usuário inválido.");
        return;
      }
      const tipoUsuarioNorm: DonoLiteral = tipoUsuarioNormRaw;

      if (!usuarioId) {
        alert("Erro: usuário não autenticado.");
        return;
      }

      const exercicios = montarExerciciosParaPayload(exerciciosSelecionados);

      const mapNivel = (s: string) =>
        ({
          Base: "Base",
          Avancado: "Avancado",
          Performance: "Performance",
        } as const)[s] ?? "Base";
      const mapTipoTreino = (s: string) =>
        ({
          Tecnico: "Tecnico",
          Fisico: "Fisico",
          Tatico: "Tatico",
        } as const)[s] ?? null;
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

      const payload: TreinoCreatePayload = {
        codigo,
        nome,
        descricao: descricao || null,
        nivel: mapNivel(nivel),
        usuarioId,
        tipoUsuario: tipoUsuarioNorm,
        tipoUsuarioId,
        categoria: categoria ? [mapCategoria(categoria)!] : [],
        tipoTreino: mapTipoTreino(tipoTreino),
        objetivo: objetivo || null,
        duracao: duracao ? Number(duracao) : null,
        dataTreino: dataTreino || null,
        dataAgendada: dataTreino || null,
        dicas,
        atletasIds: atletasSelecionados,
        elencosIds: elencoSelecionado ? [elencoSelecionado] : [],
        exercicios,
        pontuacao: Math.max(0, Math.floor(score.total)),
      };

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
        alert(
          `Remova os exercícios repetidos antes de salvar: ${duplicados.join(
            ", ",
          )}`,
        );
        return;
      }

      const exValidos = exerciciosSelecionados.filter(
        (x) => x.idCatalogo || (x.nome && x.nome.trim()),
      );
      if (exValidos.length === 0) {
        alert("Adicione pelo menos 1 exercício válido antes de salvar.");
        return;
      }

      const criado: any = await TreinosApi.criar(payload);

      let qtdAgendados = 0;
      const treinoProgramadoId =
        criado?.id ?? criado?.treinoProgramadoId ?? criado?.data?.id ?? null;

      if (treinoProgramadoId) {
        qtdAgendados = await agendarTreinoEmLote(
          String(treinoProgramadoId),
        );
      } else {
        console.warn(
          "TreinosApi.criar não retornou id do treino programado. Agendamento em lote foi pulado.",
        );
      }

      const resultadoSalvar = await tentarSalvarComoTreinoSalvo(
        payload,
        score.total,
      );

      const atletasDoTreino = atletasVinculados.filter((a) =>
        atletasSelecionados.includes(a.id),
      );
      const nomesAtletas = atletasDoTreino.map((a) => a.nome);

      const datasBase =
        datasAgendamento.length > 0
          ? datasAgendamento
          : dataTreino
          ? [dataTreino]
          : [];

      const datasLabel = datasBase.length
        ? datasBase
            .slice()
            .sort()
            .map((str) => {
              const d = new Date(str);
              if (isNaN(d.getTime())) return str;
              return d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              });
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
        extra =
          " Você optou por não salvar este treino na Gaveta (limite de 5).";
      } else if (resultadoSalvar.reason === "falha-apagar") {
        extra =
          " Não foi possível liberar espaço na Gaveta, então o treino não foi salvo lá.";
      } else if (resultadoSalvar.reason === "erro") {
        extra =
          " O treino foi criado, mas houve um erro ao salvar na Gaveta.";
      } else if (resultadoSalvar.reason === "sem-dono") {
        console.warn("Treino Salvo: sem dono identificado, pulando gaveta.");
      }

      showToast(msgPrincipal + extra, "success");

      sessionStorage.removeItem(SAVE_KEY);
      setEtapa(1);
      setCompletedUntil(1);
      setNome("");
      setDescricao("");
      setNivel("Base");
      setDuracao(60);
      setDataTreino("");
      setCategoria("Sub13");
      setTipoTreino("Tecnico");
      setObjetivo("");
      setExerciciosSelecionados([]);
      setDicas([]);
      setDicaAtual("");
      setAtletasSelecionados([]);
      setDatasAgendamento([]);
    } catch (e: any) {
      console.error(
        "Falha inesperada ao criar treino:",
        e?.response?.data || e,
      );

      const msgErro =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        "Erro inesperado ao criar treino.";

      showToast(msgErro, "error");
    }
  };

  const agendarTreino = async (t: TreinoProgramado) => {
    try {
      const atletaId = (Storage as any).tipoUsuarioId;
      const token = (Storage as any).token;
      if (!atletaId || !token) {
        alert("Sessão expirada. Faça login novamente.");
        return;
      }

      const prazoSelecionado = prazos[t.id];
      const quando = prazoSelecionado
        ? new Date(prazoSelecionado)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const expira = new Date(
        quando.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: quando.toISOString(),
          dataExpiracao: expira.toISOString(),
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
      setIdsProgramadosBloqueados(
        (prev) => new Set(prev).add(novo.treinoProgramadoId),
      );
      navigate("/treinos");
      const once = () => {
        window.removeEventListener("treinos:ready", once as any);
        window.dispatchEvent(
          new CustomEvent("treino:agendado", { detail: novo }),
        );
      };
      window.addEventListener("treinos:ready", once as any);

      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("treino:agendado", { detail: novo }),
          ),
        50,
      );
      setPrazos(({ [t.id]: _, ...rest }) => rest);
      alert("Treino agendado com sucesso!");
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
    const treinosParaAgendar = treinosDisponiveis.filter(
      (t) => !idsProgramadosBloqueados.has(t.id),
    );

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
        <h2 className="text-lg font-bold mb-4">Treinos Disponíveis</h2>

        {treinosParaAgendar.length === 0 ? (
          <p className="text-gray-600">
            Nenhum treino disponível para agendar no momento.
          </p>
        ) : (
          treinosParaAgendar.map((t) => (
            <div
              key={t.id}
              className="bg-white border p-4 rounded shadow mb-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3
                  className="text-green-800 text-lg font-semibold cursor-pointer hover:underline"
                  onClick={() =>
                    navigate(`/treinos/unico?programadoId=${t.id}`)
                  }
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

              {t.criador && (
                <p className="text-sm mt-1">
                  <strong>Criado por:</strong>{" "}
                  {t.criador.tipo === "Professor"
                    ? `Prof. ${t.criador.nome}`
                    : `${t.criador.nome} (${t.criador.tipo})`}
                </p>
              )}

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
                onChange={(e) =>
                  setPrazos((prev) => ({
                    ...prev,
                    [t.id]: e.target.value,
                  }))
                }
              />
              <button
                className="mt-3 bg-green-800 text-white px-5 py-2 rounded ml-3"
                onClick={() => agendarTreino(t)}
              >
                Agendar este treino
              </button>
            </div>
          ))
        )}

        <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-2 flex justify-around items-center shadow-md">
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-3 items-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold col-start-1">
            Criar Novo Treino
          </h2>

          <div
            className="justify-self-center col-start-2"
            title={
              `Nível: +${score.nivel} • Tipo: +${score.tipo} • ` +
              `Exercícios (${score.exCount}): +${score.exercicios} • ` +
              `Duração: +${score.duracao} • Dicas: +${score.dicas}`
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
                sessionStorage.removeItem(SAVE_KEY);
                setEtapa(1);
                setCompletedUntil(1);
                setNome("");
                setDescricao("");
                setNivel("Base");
                setDuracao(60);
                setDataTreino("");
                setCategoria("Sub13");
                setTipoTreino("Tecnico");
                setObjetivo("");
                setExerciciosSelecionados([]);
                setDicas([]);
                setDicaAtual("");
                setAtletasSelecionados([]);
              }
            }}
            className="text-sm text-red-700 underline justify-self-end col-start-3"
          >
            Limpar progresso
          </button>
        </div>

        <Stepper current={etapa} onJump={goTo} completedUntil={completedUntil} />

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
                  Nível do Treino
                </label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Base">Base</option>
                  <option value="Avancado">Avançado</option>
                  <option value="Performance">Performance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Categoria (Faixa Etária)
                </label>
                <select
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">--</option>
                  <option value="Sub9">Sub-9</option>
                  <option value="Sub11">Sub-11</option>
                  <option value="Sub13">Sub-13</option>
                  <option value="Sub15">Sub-15</option>
                  <option value="Sub17">Sub-17</option>
                  <option value="Sub20">Sub-20</option>
                  <option value="Livre">Livre</option>
                </select>
              </div>

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
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => goTo(2)}
                className="bg-green-800 text-white px-4 py-2 rounded"
              >
                Próximo
              </button>
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

              <div className="space-y-3">
                {exerciciosSelecionados.map((ex, i) => {
                  const base = ex.idCatalogo
                    ? exerciciosDisponiveis.find(
                        (e) => e.id === ex.idCatalogo,
                      )
                    : undefined;
                  const videoSrc = resolveVideoUrl(
                    base?.videoDemonstrativoUrl,
                  );

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
                        {videoSrc ? (
                          <video
                            className="w-full h-44 sm:w-44 sm:h-28 rounded bg-black object-cover shrink-0"
                            src={videoSrc}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-44 sm:w-44 sm:h-28 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600 shrink-0">
                            sem vídeo
                          </div>
                        )}

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
              <div className="mb-3 flex items-center gap-2">
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

              <ul className="divide-y divide-gray-200 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto pr-1">
                {exerciciosFiltrados.map((exercicio) => {
                  const videoSrc = resolveVideoUrl(
                    exercicio.videoDemonstrativoUrl,
                  );
                  const jaAdicionado = jaEstaNoTreinoPorIdOuNome(
                    exerciciosSelecionados,
                    exercicio.id,
                    exercicio.nome,
                  );

                  return (
                    <li key={exercicio.id} className="py-3">
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        {videoSrc ? (
                          <video
                            className="w-full h-40 sm:w-40 sm:h-24 rounded bg-black object-cover shrink-0"
                            src={videoSrc}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-40 sm:w-40 sm:h-24 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-600 shrink-0">
                            sem vídeo
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">
                              {exercicio.nome}
                            </div>
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
                        </div>

                        <button
                          onClick={() =>
                            !jaAdicionado &&
                            adicionarExercicioExistente(exercicio)
                          }
                          disabled={jaAdicionado}
                          className={`bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto ${
                            jaAdicionado
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            jaAdicionado
                              ? "Já adicionado ao treino"
                              : "Adicionar ao treino"
                          }
                        >
                          {jaAdicionado ? "Adicionado" : "Adicionar"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
                <button
                  onClick={() => goTo(1)}
                  className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto"
                >
                  Voltar
                </button>
                <button
                  onClick={() => goTo(3)}
                  className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto"
                >
                  Próximo
                </button>
              </div>
            </StepCard>
          </>
        )}

        {etapa === 3 && (
          <StepCard title="Dicas para os Atletas">
            <div className="flex gap-2 mb-3">
              <input
                className="border w-full p-2 rounded"
                placeholder="Ex: Mantenha a postura correta"
                value={dicaAtual}
                onChange={(e) => setDicaAtual(e.target.value)}
              />
              <button
                onClick={adicionarDica}
                className="bg-gray-300 px-3 py-2 rounded"
              >
                + Adicionar
              </button>
            </div>

            <ul className="list-disc pl-5 text-sm text-gray-700">
              {dicas.map((dica, i) => (
                <li key={i}>{dica}</li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button
                onClick={() => goTo(2)}
                className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto"
              >
                Voltar
              </button>
              <button
                onClick={() => goTo(4)}
                className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto"
              >
                Próximo
              </button>
            </div>
          </StepCard>
        )}

        {etapa === 4 && (
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
                        src={
                          atleta.foto
                            ? `${atleta.foto}`
                            : "https://via.placeholder.com/80"
                        }
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

                const toggleDia = (dia: number) => {
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

                          return (
                            <button
                              key={idxDia}
                              type="button"
                              onClick={() => toggleDia(dia)}
                              className={[
                                "h-8 sm:h-9 text-xs sm:text-sm flex items-center justify-center rounded-full border transition-all",
                                selecionado
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
                      const d = new Date(str);
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

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button
                onClick={() => goTo(3)}
                className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto"
              >
                Voltar
              </button>
              <button
                onClick={criarTreino}
                className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto"
              >
                Salvar Treino
              </button>
            </div>
          </StepCard>
        )}
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

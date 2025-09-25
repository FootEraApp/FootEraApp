// client/src/pages/novoTreino.tsx
import { useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Volleyball, User, CirclePlus, Search as SearchIcon, House, Check } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { TreinosApi } from "../utils/treinosApi.js";
import { montarExerciciosParaPayload } from "../utils/treinos.helpers.js";
import type { ExItemUI, TreinoCreatePayload } from "../utils/treinos.types.js";

/* =========================================================
   Regras de Pontuação (ajuste livre) NÂO APAGAR
   ========================================================= */
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
  POR_EXERCICIO: 4, // cada exercício
  POR_15_MIN: 1, // a cada 15min de duração
  POR_DICA: 1, // por dica
  DICAS_MAX: 5, // máximo de dicas que contam
};

function calcularPontuacaoTreino(
  nivel: string,
  tipoTreino: string,
  duracaoMin: number,
  exercicios: ExItemUI[],
  dicas: string[],
): PontuacaoDetalhe {
  const exCount = exercicios.filter(e => e.idCatalogo || (e.nome && e.nome.trim())).length;
  const ptsEx = exCount * PONTOS.POR_EXERCICIO;

  const ptsNivel = PONTOS.NIVEL[nivel as keyof typeof PONTOS.NIVEL] ?? 0;
  const ptsTipo = PONTOS.TIPO[tipoTreino as keyof typeof PONTOS.TIPO] ?? 0;

  const dur = Number.isFinite(Number(duracaoMin)) ? Number(duracaoMin) : 0;
  const ptsDur = Math.max(0, Math.floor(dur / 15) * PONTOS.POR_15_MIN);

  const dicasValidas = Math.min(PONTOS.DICAS_MAX, Math.max(0, (dicas?.length ?? 0)));
  const ptsDicas = dicasValidas * PONTOS.POR_DICA;

  const total = ptsEx + ptsNivel + ptsTipo + ptsDur + ptsDicas;
  return { total, nivel: ptsNivel, tipo: ptsTipo, exercicios: ptsEx, duracao: ptsDur, dicas: ptsDicas, exCount };
}

/* ========================================================= */

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
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.id}
                  </span>
                  <span className="font-semibold text-xs sm:text-sm">{s.label}</span>
                </button>
                {idx < steps.length - 1 && <div className="hidden sm:block w-8 h-px bg-gray-300" />}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: ReactNode }) {
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
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<Exercicio[]>([]);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<TreinoProgramado[]>([]);
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
  const [categoria, setCategoria] = useState<string>("Sub13");
  const [tipoTreino, setTipoTreino] = useState<string>("Tecnico");
  const [objetivo, setObjetivo] = useState<string>("");
  const [iniciado, setIniciado] = useState<boolean>(false);

  const [exerciciosSelecionados, setExerciciosSelecionados] = useState<ExItemUI[]>([]);
  const [dicas, setDicas] = useState<string[]>([]);
  const [dicaAtual, setDicaAtual] = useState<string>("");

  const [filtroEx, setFiltroEx] = useState("");
  const restoredRef = useRef(false);

  /* ===== Pontuação dinâmica ===== */
  const score = useMemo(
    () => calcularPontuacaoTreino(nivel, tipoTreino, duracao, exerciciosSelecionados, dicas),
    [nivel, tipoTreino, duracao, exerciciosSelecionados, dicas]
  );
  /* ============================== */

  function normalizaTreinos(raw: any[]): TreinoProgramado[] {
    return raw.map((t: any) => ({
      id: t.id,
      nome: t.nome ?? t.titulo ?? "(sem nome)",
      descricao: t.descricao ?? t.resumo ?? "",
      nivel: t.nivel ?? t.dificuldade ?? "-",
      pontuacao: t.pontuacao ?? null,
      exercicios: (t.exercicios ?? t.exs ?? []).map((ex: any, i: number) => ({
        id: ex.id ?? ex.exercicioId ?? String(i),
        nome: ex.nome ?? ex.titulo ?? ex?.exercicio?.nome ?? ex?.exercicioTemporario?.nome ?? "",
        repeticoes: ex.repeticoes ?? ex.reps ?? ex.qtde ?? "",
      })),
    }));
  }

  useEffect(() => {
    (async () => {
      try {
        const token = (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") || "";

        const tipoUsuarioId =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") || "";

        if (!tipoUsuarioId) return;

        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const tentativas = [
          `${API.BASE_URL}/api/elencos?tipoUsuarioId=${encodeURIComponent(tipoUsuarioId)}`,
          `${API.BASE_URL}/api/elencos/minha`,
          `${API.BASE_URL}/api/treinos/elencos?tipoUsuarioId=${encodeURIComponent(tipoUsuarioId)}`,
          `${API.BASE_URL}/api/elencos`,
        ];

        for (const url of tentativas) {
          const r = await fetch(url, { headers });
          if (!r.ok) continue;
          const j = await r.json();
          const arr = Array.isArray(j) ? j : (j.items ?? j.data ?? j.rows ?? j.result ?? []);
          if (Array.isArray(arr)) {
            setElencos(
              arr.map((e: any) => ({
                id: e.id,
                nome: e.nome ?? e.titulo ?? "Elenco",
                atletasIds: e.atletasIds ?? e.atletas?.map((a: any) => a.id) ?? [],
              }))
            );
            return;
          }
        }
        setElencos([]);
      } catch {
        setElencos([]);
      }
    })();
  }, []);

  useEffect(() => {
    const tipoPersistido = (
      localStorage.getItem("tipoUsuario") ??
      sessionStorage.getItem("tipoUsuario") ??
      (Storage as any).tipoSalvo ??
      ""
    )
      .toString()
      .trim()
      .toLowerCase();

    const tipoNormalizado = tipoPersistido === "escolinha" ? "escola" : tipoPersistido;
    const permitidos = ["escola", "clube", "professor", "atleta"] as const;

    if (permitidos.includes(tipoNormalizado as any)) {
      setUsuario({ tipo: tipoNormalizado as (typeof permitidos)[number] });
    } else {
      console.warn("tipoUsuario inválido/inesperado:", { tipoPersistido, tipoNormalizado });
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
        const exOld = Array.isArray(saved.exerciciosSelecionados) ? saved.exerciciosSelecionados : [];
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
      }
      restoredRef.current = true;
    }

    setIniciado(true);
  }, []);

  useEffect(() => {
    if (!iniciado) return;

    const token =
      (Storage as any).token ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      "";

    const opt: RequestInit = token ? { headers: { Authorization: `Bearer ${token}` } as any } : {};

    (async () => {
      try {
        const urls = [
          `${API.BASE_URL}/api/treinos/disponiveis?tipoUsuarioId=${(Storage as any).tipoUsuarioId ?? ""}`,
          `${API.BASE_URL}/api/treinosprogramados`,
          `${API.BASE_URL}/api/treinos`,
        ];

        for (const url of urls) {
          const r = await fetch(url, opt);
          if (!r.ok) continue;

          const j = await r.json();
          const arr = Array.isArray(j) ? j : j.items ?? j.data ?? j.treinos ?? j.rows ?? j.result ?? [];
          if (Array.isArray(arr) && arr.length) {
            setTreinosDisponiveis(normalizaTreinos(arr));
            return;
          }
        }
        setTreinosDisponiveis([]);
      } catch (e) {
        console.error("Falha ao carregar treinos:", e);
        setTreinosDisponiveis([]);
      }
    })();
  }, [iniciado]);

  useEffect(() => {
    let cancel = { v: false };

    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const r = await fetch(`${API.BASE_URL}/api/treinos/exercicios`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!r.ok) return;
        const data = await r.json();
        const arr: Exercicio[] = Array.isArray(data) ? data : data.items ?? data.data ?? [];
        if (!cancel.v) {
          setExerciciosDisponiveis(
            arr.map((e: any) => ({
              id: e.id,
              nome: e.nome ?? e.titulo ?? "",
              videoDemonstrativoUrl: e.videoDemonstrativoUrl,
              descricao: e.descricao,
              nivel: e.nivel,
            }))
          );
        }
      } catch {}
    })();

    (async () => {
      try {
        const token =
          (Storage as any).token ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token") ||
          "";

        const tipoRaw = (
          (Storage as any).tipoSalvo ??
          localStorage.getItem("tipoUsuario") ??
          sessionStorage.getItem("tipoUsuario") ??
          ""
        )
          .toString()
          .trim()
          .toLowerCase();

        const vinculo = tipoRaw === "escolinha" ? "escola" : tipoRaw;

        const id =
          (Storage as any).tipoUsuarioId ||
          localStorage.getItem("tipoUsuarioId") ||
          sessionStorage.getItem("tipoUsuarioId") ||
          (Storage as any).usuarioId;

        if (!id || !["professor", "escola", "clube"].includes(vinculo)) return;

        const r = await fetch(
          `${API.BASE_URL}/api/relacoes/atletas?vinculo=${encodeURIComponent(vinculo)}&id=${encodeURIComponent(id)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );

        let raw: any[] | undefined;
        if (r.ok) {
          const data = await r.json();
          raw = Array.isArray(data)
            ? data
            : data.items ?? data.data ?? data.rows ?? data.result ?? data.atletasVinculados ?? [];
        }

        if (!raw || raw.length === 0) {
          const r2 = await fetch(
            `${API.BASE_URL}/api/treinos/atletas-vinculados?tipoUsuarioId=${encodeURIComponent(id)}`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
          );
          if (r2.ok) {
            const d2 = await r2.json();
            raw = Array.isArray(d2) ? d2 : d2.items ?? d2.data ?? [];
          }
        }

        const lista: AtletaVinculado[] = (raw ?? [])
          .map((a: any) => ({
            id: a.usuarioId ?? a.id ?? a.atletaId ?? a?.atleta?.id ?? a?.usuario?.id ?? "",
            nome: a.nome ?? a?.atleta?.usuario?.nome ?? a?.usuario?.nome ?? a?.atleta?.nome ?? "Atleta",
            foto: a.foto ?? a?.atleta?.usuario?.foto ?? a?.usuario?.foto ?? a?.fotoUrl ?? undefined,
          }))
          .filter((x) => x.id);

        setAtletasVinculados(lista);
      } catch (e) {
        console.error("Erro ao carregar atletas vinculados:", e);
        setAtletasVinculados([]);
      }
    })();

    return () => {
      cancel.v = true;
    };
  }, []);

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
  ]);

  const incluirElencoNoTreino = () => {
    if (!elencoSelecionado) return;
    const el = elencos.find(e => e.id === elencoSelecionado);
    if (!el || !el.atletasIds?.length) return;

    setAtletasSelecionados(prev => {
      const set = new Set(prev);
      el.atletasIds!.forEach(id => set.add(id));
      return Array.from(set);
    });
  };

  const [completedUntil, setCompletedUntil] = useState<number>(1);
  const goTo = (n: number) => {
    setEtapa(n);
    setCompletedUntil((prev) => Math.max(prev, n));
  };

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
      { idCatalogo: null, nome: "", descricao: "", repeticoes: "", ordem: prev.length + 1, series: "" },
    ]);
  };

  const atualizarExercicio = (index: number, campo: keyof ExItemUI | "series", valor: string) => {
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
    setExerciciosSelecionados((prev) => [
      ...prev,
      {
        idCatalogo: exercicio.id,
        nome: exercicio.nome,
        descricao: "",
        repeticoes: "",
        ordem: prev.length + 1,
        series: "",
      },
    ]);
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
      String(tipoRaw).trim().toLowerCase() === "escola" || String(tipoRaw).trim().toLowerCase() === "escolinha"
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

    return { tipoUsuario: normalized as "Professor" | "Clube" | "Escolinha" | null, tipoUsuarioId };
  }

  type DonoLiteral = "professor" | "clube" | "escolinha";
  function isDono(v: string): v is DonoLiteral {
    return v === "professor" || v === "clube" || v === "escolinha";
  }

  const criarTreino = async () => {
    try {
      const { tipoUsuario, tipoUsuarioId } = getDono();
      const tipoUsuarioNormRaw = (tipoUsuario ?? "").toLowerCase();

      if (!tipoUsuario || !tipoUsuarioId) {
        alert("Erro: não foi possível determinar o dono do treino (Professor/Clube/Escolinha).");
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

      const mapNivel = (s: string) => ({ Base: "Base", Avancado: "Avancado", Performance: "Performance" } as const)[s] ?? "Base";
      const mapTipoTreino = (s: string) => ({ Tecnico: "Tecnico", Fisico: "Fisico", Tatico: "Tatico" } as const)[s] ?? null;
      const mapCategoria = (s: string) => (s ? s.replace("-", "").toUpperCase() : "Sub13");

      const codigo =
        `${nome}`.trim()
          ? `${nome}`.toUpperCase().replace(/\s+/g, "-").slice(0, 24) + "-" + Date.now().toString(36)
          : "TP-" + Date.now().toString(36);

      const payload: TreinoCreatePayload = {
        codigo,
        nome,
        descricao: descricao || null,
        nivel: mapNivel(nivel),
        usuarioId,
        tipoUsuario: tipoUsuarioNorm,
        tipoUsuarioId,
        categoria: categoria ? [mapCategoria(categoria)] : [],
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

      await TreinosApi.criar(payload);
      alert("Treino criado com sucesso!");
      sessionStorage.removeItem(SAVE_KEY);
      setEtapa(1);
      setCompletedUntil(1);
    } catch (e: any) {
      console.error("Falha inesperada ao criar treino:", e?.response?.data || e);
      alert(e?.response?.data?.error || e?.response?.data?.message || "Erro inesperado ao criar treino.");
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
      const quandoISO = prazoSelecionado
        ? new Date(prazoSelecionado).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${API.BASE_URL}/api/treinos/agendados`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: t.nome,
          dataTreino: quandoISO,
          dataExpiracao: quandoISO,
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
      navigate("/treinos");

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("treino:agendado", { detail: novo }));
      }, 50);

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
        Você precisa estar logado como <b>Escola</b>, <b>Clube</b> ou <b>Professor</b> para criar treinos.
      </div>
    );

  if (usuario.tipo === "atleta") {
    return (
      <div className="p-4 max-w-xl mx-auto mb-5">
        <h2 className="text-lg font-bold mb-4">Treinos Disponíveis</h2>

        {treinosDisponiveis.length === 0 ? (
          <p className="text-gray-600">Nenhum treino disponível no momento.</p>
        ) : (
          treinosDisponiveis.map((t) => (
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
                onChange={(e) => setPrazos((prev) => ({ ...prev, [t.id]: e.target.value }))}
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
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* Cabeçalho com badge de pontos central */}
        <div className="grid grid-cols-3 items-center mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-bold col-start-1">Criar Novo Treino</h2>

          <div
            className="justify-self-center col-start-2"
            title={
              `Nível: +${score.nivel} • Tipo: +${score.tipo} • ` +
              `Exercícios (${score.exCount}): +${score.exercicios} • ` +
              `Duração: +${score.duracao} • Dicas: +${score.dicas}`
            }
          >
            <span className="
              inline-flex items-center gap-1 rounded-full px-3 py-1
              text-sm font-semibold bg-amber-100 text-amber-900 border border-amber-300
            ">
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
            <label className="block text-sm text-gray-700 mb-1">Título do Treino</label>
            <input
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Título do Treino"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />

            <label className="block text-sm text-gray-700 mb-1">Descrição</label>
            <textarea
              className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
              placeholder="Descrição do Treino"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Nível do Treino</label>
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
                <label className="block text-sm text-gray-700 mb-1">Categoria (Faixa Etária)</label>
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
                <label className="block text-sm text-gray-700 mb-1">Tipo do Treino</label>
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
                <label className="block text-sm text-gray-700 mb-1">Duração do Treino (minutos)</label>
                <input
                  className="border w-full mb-2 p-2 rounded text-sm sm:text-base"
                  type="number"
                  min={1}
                  value={duracao}
                  onChange={(e) => setDuracao(parseInt(e.target.value || "0") || 0)}
                />
              </div>
            </div>

            <label className="block text-sm text-gray-700 mb-1">Data Agendada (prazo para envio)</label>
            <input
              className="border w-full mb-4 p-2 rounded text-sm sm:text-base"
              type="datetime-local"
              value={dataTreino}
              onChange={(e) => setDataTreino(e.target.value)}
            />

            <div className="flex justify-end">
              <button onClick={() => goTo(2)} className="bg-green-800 text-white px-4 py-2 rounded">
                Próximo
              </button>
            </div>
          </StepCard>
        )}

        {etapa === 2 && (
          <>
            <StepCard title="Exercícios Selecionados">
              {exerciciosSelecionados.length === 0 && (
                <div className="text-sm text-gray-600 mb-3">Nenhum exercício adicionado ainda.</div>
              )}

              <div className="space-y-3">
                {exerciciosSelecionados.map((ex, i) => {
                  const base = ex.idCatalogo ? exerciciosDisponiveis.find((e) => e.id === ex.idCatalogo) : undefined;

                  const videoSrc = base?.videoDemonstrativoUrl
                    ? base.videoDemonstrativoUrl.startsWith("http")
                      ? base.videoDemonstrativoUrl
                      : `${API.BASE_URL}${base.videoDemonstrativoUrl}`
                    : "";

                  const nomeFinal = base?.nome ?? ex.nome ?? "";
                  const nivelFinal = base?.nivel ?? undefined;
                  const descFinal = base?.descricao ?? ex.descricao ?? "";

                  const ehDoBanco = Boolean(ex.idCatalogo);

                  return (
                    <div key={i} className="border rounded-lg p-3 relative bg-white shadow-sm">
                      <button
                        onClick={() => removerExercicio(i)}
                        className="absolute top-2 right-2 text-red-600 text-sm"
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
                              <div className="font-semibold">{nomeFinal}</div>
                            ) : (
                              <input
                                className="border p-1 rounded w-full"
                                placeholder="Nome do exercício"
                                value={ex.nome || ""}
                                onChange={(e) => atualizarExercicio(i, "nome", e.target.value)}
                              />
                            )}

                            {nivelFinal ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {nivelFinal}
                              </span>
                            ) : null}
                          </div>

                          {ehDoBanco ? (
                            <p className="text-sm text-gray-700 mb-2 whitespace-pre-line">{descFinal || "Sem descrição."}</p>
                          ) : (
                            <textarea
                              className="border w-full mb-2 p-1 rounded"
                              placeholder="Descrição"
                              value={ex.descricao || ""}
                              onChange={(e) => atualizarExercicio(i, "descricao", e.target.value)}
                            />
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Séries</label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 3"
                                value={ex.series || ""}
                                onChange={(e) => atualizarExercicio(i, "series", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Repetições</label>
                              <input
                                className="border w-full p-1 rounded"
                                placeholder="ex.: 12"
                                value={ex.repeticoes || ""}
                                onChange={(e) => atualizarExercicio(i, "repeticoes", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={adicionarExercicio} className="bg-gray-200 px-3 py-1 rounded mb-2 mt-3">
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
                  const videoParcial = exercicio.videoDemonstrativoUrl;
                  const videoSrc = videoParcial
                    ? videoParcial.startsWith("http")
                      ? videoParcial
                      : `${API.BASE_URL}${videoParcial}`
                    : "";

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
                            <div className="font-semibold truncate">{exercicio.nome}</div>
                            {exercicio.nivel ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                                {exercicio.nivel}
                              </span>
                            ) : null}
                          </div>
                          {exercicio.descricao ? (
                            <p className="text-sm text-gray-700 mt-1 line-clamp-2">{exercicio.descricao}</p>
                          ) : null}
                        </div>

                        <button
                          onClick={() => adicionarExercicioExistente(exercicio)}
                          className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded w-full sm:w-auto"
                          title="Adicionar ao treino"
                        >
                          Adicionar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
                <button onClick={() => goTo(1)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                  Voltar
                </button>
                <button onClick={() => goTo(3)} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
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
              <button onClick={adicionarDica} className="bg-gray-300 px-3 py-2 rounded">
                + Adicionar
              </button>
            </div>

            <ul className="list-disc pl-5 text-sm text-gray-700">
              {dicas.map((dica, i) => (
                <li key={i}>{dica}</li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button onClick={() => goTo(2)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                Voltar
              </button>
              <button onClick={() => goTo(4)} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
                Próximo
              </button>
            </div>
          </StepCard>
        )}

        {etapa === 4 && (
          <StepCard title="Selecionar Atletas Vinculados">
            {atletasVinculados.length === 0 ? (
              <div className="bg-gray-100 text-gray-600 text-center py-6 rounded">
                Nenhum atleta vinculado encontrado.
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
                          selecionado ? prev.filter((id) => id !== atleta.id) : [...prev, atleta.id]
                        )
                      }
                      className={`cursor-pointer p-4 rounded-xl shadow-md text-center border-2 transition-all duration-200 ${
                        selecionado ? "border-green-500 bg-green-50" : "border-gray-200"
                      }`}
                    >
                      <img
                        src={atleta.foto ? `${atleta.foto}` : "https://via.placeholder.com/80"}
                        alt={atleta.nome}
                        className="w-20 h-20 mx-auto rounded-full object-cover mb-2"
                      />
                      <p className="font-semibold text-sm sm:text-base">{atleta.nome}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm text-gray-700 mb-1">Elenco</label>
                <select
                  className="border w-full p-2 rounded"
                  value={elencoSelecionado}
                  onChange={e => setElencoSelecionado(e.target.value)}
                >
                  <option value="">— Selecionar elenco —</option>
                  {elencos.map(el => (
                    <option key={el.id} value={el.id}>{el.nome}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={incluirElencoNoTreino}
                className="bg-green-700 text-white px-3 py-2 rounded"
              >
                Incluir elenco
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-2 mt-6">
              <button onClick={() => goTo(3)} className="bg-gray-200 px-4 py-2 rounded w-full sm:w-auto">
                Voltar
              </button>
              <button onClick={criarTreino} className="bg-green-800 text-white px-4 py-2 rounded w-full sm:w-auto">
                Salvar Treino
              </button>
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}

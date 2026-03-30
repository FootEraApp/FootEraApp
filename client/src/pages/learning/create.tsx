// client/src/pages/learning/create.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Upload,
  Video,
  Dumbbell,
  FileText,
  Trophy,
} from "lucide-react";
import {
  createMetodologia,
  updateMetodologia,
  getMetodologiaById,
  createMetodologiaEstruturas,
  updateMetodologiaEstrutura,
  deleteMetodologiaEstrutura,
  createMetodologiaEstruturaItens,
  deleteMetodologiaEstruturaItens,
  uploadMetodologiaFile,
  listMinhasMetodologiasCriadas,
  type LearningEstruturaInput,
  type LearningEstruturaItemInput,
  type LearningEstruturaTipo,
  type LearningItemTipo,
  type LearningMetodoTipo,
  type LearningModoExecucao,
} from "../../services/metodologias.js";
import LearningHeader from "../../components/learning/LearningHeader.js";
import LearningTypeChooser from "../../components/learning/LearningTypeChooser.js";
import { API } from "@/config.js";

type AreaOption =
  | "TECNICO"
  | "FISICO"
  | "TATICO"
  | "MENTAL"
  | "GOLEIROS"
  | "PSICOLOGIA"
  | "INOVACAO"
  | "ANALISE_DESEMPENHO"
  | "OUTRO";

type PublicoOption = "ATLETAS" | "PROFISSIONAIS" | "AMBOS";

type TreinoSelecionavel = {
  id: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  imagemUrl?: string | null;
  criadorLabel?: string | null;
  origem?: "MEU" | "VINCULADO";
  exercicios?: Array<{
    id?: string;
    nome: string;
    codigo?: string | null;
    descricao?: string | null;
    series?: number | null;
    repeticoes?: string | null;
    duracao?: string | null;
    descanso?: string | null;
    videoDemonstrativoUrl?: string | null;
    donoLabel?: string | null;
  }>;
};

type LocalItem = LearningEstruturaItemInput & {
  id?: string;
  localId: string;
  uploading?: boolean;
  treinoSelecionado?: TreinoSelecionavel | null;
  videoPreviewUrl?: string | null;
  videoFileName?: string | null;
  videoModalOpen?: boolean;
  materialFileName?: string | null;
  materialPreviewUrl?: string | null;
};

type LocalEstrutura = LearningEstruturaInput & {
  id?: string;
  localId: string;
  expanded: boolean;
  itens: LocalItem[];
};

type LearningDraft = {
  step: 1 | 2;
  tipoMetodologia: LearningMetodoTipo | null;
  estruturaTipo: LearningEstruturaTipo | null;
  titulo: string;
  descricao: string;
  publicoAlvo: PublicoOption;
  area: AreaOption;
  geraCertificado: boolean;
  geraBadge: boolean;
  capaUrl: string;
  capaPreviewUrl: string | null;
  estruturas: LocalEstrutura[];
};

const LEARNING_DRAFT_KEY = "learning_create_draft_v1";
const DURACOES = [2, 4, 6, 8];
const MODOS: { value: LearningModoExecucao; label: string }[] = [
  { value: "LIVRE", label: "Livre" },
  { value: "PRAZO_SUGERIDO", label: "Com prazo sugerido" },
  { value: "DESAFIO_FECHADO", label: "Desafio fechado" },
];

const AREAS: { value: AreaOption; label: string }[] = [
  { value: "TECNICO", label: "Técnico" },
  { value: "FISICO", label: "Físico" },
  { value: "TATICO", label: "Tático" },
  { value: "MENTAL", label: "Mental" },
  { value: "GOLEIROS", label: "Goleiros" },
  { value: "PSICOLOGIA", label: "Psicologia" },
  { value: "INOVACAO", label: "Inovação" },
  { value: "ANALISE_DESEMPENHO", label: "Análise de desempenho" },
  { value: "OUTRO", label: "Outro" },
];

const PUBLICOS: { value: PublicoOption; label: string }[] = [
  { value: "ATLETAS", label: "Para atletas" },
  { value: "PROFISSIONAIS", label: "Para profissionais" },
  { value: "AMBOS", label: "Ambos" },
];

const ITEM_TYPES_TRILHA: { value: LearningItemTipo; label: string; icon: React.ReactNode }[] = [
  { value: "TREINO", label: "Treino", icon: <Dumbbell className="w-4 h-4" /> },
  { value: "VIDEO", label: "Vídeo", icon: <Video className="w-4 h-4" /> },
  { value: "DESAFIO", label: "Desafio", icon: <Trophy className="w-4 h-4" /> },
];

const ITEM_TYPES_MODULO: { value: LearningItemTipo; label: string; icon: React.ReactNode }[] = [
  { value: "AULA", label: "Aula", icon: <Video className="w-4 h-4" /> },
  { value: "VIDEO", label: "Vídeo", icon: <Video className="w-4 h-4" /> },
  { value: "MATERIAL", label: "Material", icon: <FileText className="w-4 h-4" /> },
  { value: "DESAFIO", label: "Desafio", icon: <Trophy className="w-4 h-4" /> },
];

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function requiredLabel(label: string, required = false) {
  return required ? `${label}*` : `${label} (Opcional)`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}

function getTipoSalvo() {
  return (
    localStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("tipoUsuario") ||
    ""
  );
}

function getTipoUsuarioId() {
  return (
    localStorage.getItem("tipoUsuarioId") ||
    sessionStorage.getItem("tipoUsuarioId") ||
    ""
  );
}

function tipoParaVinculoFront(tipo: string) {
  const t = String(tipo || "").toLowerCase().trim();
  if (t === "clube") return "clube";
  if (t === "escolinha" || t === "escola") return "escolinha";
  if (t === "professor") return "professor";
  return undefined;
}

function autorEhDoLogado(autor: any, tipoSalvo: string, tipoUsuarioId: string) {
  const tipoAutorEsperado =
    tipoSalvo === "clube"
      ? "clube"
      : tipoSalvo === "escolinha" || tipoSalvo === "escola"
        ? "escolinha"
        : tipoSalvo === "professor"
          ? "professor"
          : "";

  if (!tipoAutorEsperado || !tipoUsuarioId) return false;
  if (!autor?.id || !autor?.tipo) return false;

  return (
    String(autor.id) === String(tipoUsuarioId) &&
    String(autor.tipo).toLowerCase() === tipoAutorEsperado
  );
}

function normalizeTreinoSelecionavel(t: any): TreinoSelecionavel {
  const exercicios = Array.isArray(t?.exercicios)
    ? t.exercicios.map((e: any) => {
        const resolved =
          e?.exercicio ||
          e?.exercicioTemporario ||
          e?.exercicioPersonalizado ||
          e;

        const videoUrl =
          resolved?.videoUrl ||
          resolved?.videoDemonstrativoUrl ||
          null;

        const donoExercicio =
          resolved?.criadorUsuario?.nome ||
          resolved?.autor?.nome ||
          resolved?.professor?.nome ||
          resolved?.clube?.nome ||
          resolved?.escolinha?.nome ||
          null;

        return {
          id: resolved?.id ? String(resolved.id) : undefined,
          nome: String(resolved?.nome ?? "Exercício"),
          codigo: resolved?.codigo ?? null,
          descricao: resolved?.descricao ?? resolved?.objetivo ?? null,
          series: e?.series ?? resolved?.series ?? null,
          repeticoes: e?.repeticoes ?? resolved?.repeticoes ?? null,
          duracao: e?.duracao ?? resolved?.duracao ?? null,
          descanso: e?.descanso ?? resolved?.descanso ?? null,
          videoDemonstrativoUrl: videoUrl,
          donoLabel: donoExercicio ? `Criado por: ${donoExercicio}` : null,
        };
      })
    : [];

  return {
    id: String(t?.id ?? ""),
    nome: String(t?.nome ?? "Treino"),
    codigo: t?.codigo ?? null,
    descricao: t?.descricao ?? null,
    imagemUrl: t?.imagemUrl ?? null,
    criadorLabel: t?.autor?.nome
      ? `${t?.autor?.tipo ?? "Autor"}: ${t.autor.nome}`
      : null,
    origem: "MEU",
    exercicios,
  };
}

function emptyItem(tipo: LearningItemTipo = "VIDEO"): LocalItem {
  return {
    localId: uid("item"),
    titulo: "",
    descricao: "",
    tipo,
    ordem: undefined,
    videoUrl: "",
    thumbUrl: "",
    arquivoUrl: "",
    materialUrl: "",
    treinoProgramadoId: "",
    pontos: null,
    duracaoMin: null,
    obrigatorio: true,
    publicado: true,
    videoPreviewUrl: null,
    videoFileName: null,
    videoModalOpen: false,
    materialFileName: null,
    materialPreviewUrl: null,
  };
}

function emptyEstrutura(tipo: LearningEstruturaTipo): LocalEstrutura {
  const isTrilha = tipo === "TRILHA";

  return {
    localId: uid("estrutura"),
    expanded: true,
    tipo,
    titulo: "",
    descricao: "",
    objetivo: "",
    ordem: undefined,
    duracaoSemanas: isTrilha ? 4 : null,
    treinosPorSemana: isTrilha ? 3 : null,
    quantidadeMinConclusao: isTrilha ? 12 : null,
    modoExecucao: isTrilha ? "LIVRE" : null,
    pontosPorItem: isTrilha ? 10 : null,
    bonusConsistencia: isTrilha ? 20 : null,
    bonusFinal: isTrilha ? 50 : null,
    prazoInicio: null,
    prazoFinal: null,
    percentualPerdaAtraso: isTrilha ? 20 : null,
    permiteAtraso: true,
    ativo: true,
    itens: [emptyItem(isTrilha ? "TREINO" : "AULA")],
  };
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <div className="text-[15px] font-bold text-[#193b2e]">{title}</div>
      {subtitle ? (
        <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>
      ) : null}
    </div>
  );
}

function ChipButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 h-10 text-sm font-medium transition ${
        active
          ? "bg-[#216c43] text-white border-[#216c43]"
          : "bg-white text-slate-700 border-slate-300 hover:border-[#216c43]"
      }`}
    >
      {children}
    </button>
  );
}

export default function LearningCreatePage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [tipoMetodologia, setTipoMetodologia] = useState<LearningMetodoTipo | null>(null);
  const [estruturaTipo, setEstruturaTipo] = useState<LearningEstruturaTipo | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState<PublicoOption>("AMBOS");
  const [area, setArea] = useState<AreaOption>("TECNICO");
  const [geraCertificado, setGeraCertificado] = useState(false);
  const [geraBadge, setGeraBadge] = useState(false);
  const [capaUrl, setCapaUrl] = useState("");
  const [capaPreviewUrl, setCapaPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [estruturas, setEstruturas] = useState<LocalEstrutura[]>([]);
  const [treinoModalOpen, setTreinoModalOpen] = useState(false);
  const [treinosLoading, setTreinosLoading] = useState(false);
  const [treinosBusca, setTreinosBusca] = useState("");
  const [editMetodologiaId, setEditMetodologiaId] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [validandoPermissaoCriacao, setValidandoPermissaoCriacao] = useState(true);
  const [podeCriarMetodologia, setPodeCriarMetodologia] = useState(false);
  const [treinoExpandidoId, setTreinoExpandidoId] = useState<string | null>(null);
  const [treinosDisponiveis, setTreinosDisponiveis] = useState<{
    meusTreinos: TreinoSelecionavel[];
    treinosVinculados: TreinoSelecionavel[];
  }>({
    meusTreinos: [],
    treinosVinculados: [],
  });
  const [targetTreinoPicker, setTargetTreinoPicker] = useState<{
    estruturaLocalId: string;
    itemLocalId: string;
  } | null>(null);

  const itemTypeOptions = useMemo(
    () => (estruturaTipo === "TRILHA" ? ITEM_TYPES_TRILHA : ITEM_TYPES_MODULO),
    [estruturaTipo]
  );

  useEffect(() => {
    if (editMetodologiaId) {
      setDraftReady(true);
      return;
    }

    try {
      const raw = localStorage.getItem(LEARNING_DRAFT_KEY);
      if (!raw) {
        setDraftReady(true);
        return;
      }

      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object") {
        setDraftReady(true);
        return;
      }

      setStep(draft.step ?? 1);
      setTipoMetodologia(draft.tipoMetodologia ?? null);
      setEstruturaTipo(draft.estruturaTipo ?? null);
      setTitulo(draft.titulo ?? "");
      setDescricao(draft.descricao ?? "");
      setPublicoAlvo(draft.publicoAlvo ?? "AMBOS");
      setArea(draft.area ?? "TECNICO");
      setGeraCertificado(!!draft.geraCertificado);
      setGeraBadge(!!draft.geraBadge);
      setCapaUrl(draft.capaUrl ?? "");
      setCapaPreviewUrl(draft.capaPreviewUrl ?? null);
      setEstruturas(Array.isArray(draft.estruturas) ? draft.estruturas : []);
    } catch {
    } finally {
      setDraftReady(true);
    }
  }, [editMetodologiaId]);

  useEffect(() => {
    if (editMetodologiaId) return;
    if (!draftReady) return;

    const draft = {
      step,
      tipoMetodologia,
      estruturaTipo,
      titulo,
      descricao,
      publicoAlvo,
      area,
      geraCertificado,
      geraBadge,
      capaUrl,
      capaPreviewUrl,
      estruturas,
    };

    try {
      localStorage.setItem(LEARNING_DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [
    editMetodologiaId,
    draftReady,
    step,
    tipoMetodologia,
    estruturaTipo,
    titulo,
    descricao,
    publicoAlvo,
    area,
    geraCertificado,
    geraBadge,
    capaUrl,
    capaPreviewUrl,
    estruturas,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tipo = params.get("tipo");
    const id = params.get("id");

    if (id) {
      setEditMetodologiaId(id);
      setLoadingExisting(true);
      setStep(2);
    } else {
      setEditMetodologiaId(null);
    }

    if (tipo === "TRILHAS_TREINO") {
      setTipoMetodologia("TRILHAS_TREINO");
      setEstruturaTipo("TRILHA");
      setStep(2);

      if (!id) {
        setEstruturas([emptyEstrutura("TRILHA")]);
      }
      return;
    }

    if (tipo === "CURSO_FORMACAO") {
      setTipoMetodologia("CURSO_FORMACAO");
      setEstruturaTipo("MODULO");
      setStep(2);

      if (!id) {
        setEstruturas([emptyEstrutura("MODULO")]);
      }
      return;
    }

    if (!id) {
      setStep(1);
    }
  }, []);

  useEffect(() => {
    if (!editMetodologiaId) return;

    let ativo = true;

    (async () => {
      try {
        setLoadingExisting(true);

        const res = await getMetodologiaById(editMetodologiaId);
        const item = res?.item;

        if (!ativo) return;

        if (!item) {
          throw new Error("Metodologia não encontrada para edição.");
        }

        setTitulo(item.titulo || "");
        setDescricao(item.descricao || "");
        setPublicoAlvo((item.publicoAlvo || "AMBOS") as PublicoOption);
        setArea((item.area || "TECNICO") as AreaOption);
        setGeraBadge(!!item.geraBadge);
        setGeraCertificado(!!item.geraCertificado);
        setCapaUrl(item.capaUrl || "");
        setCapaPreviewUrl(item.capaUrl || null);
        setTipoMetodologia(item.tipo);
        setEstruturaTipo(item.estruturaTipo);
        setStep(2);

        const estruturasMapped: LocalEstrutura[] = Array.isArray(item.estruturas)
          ? item.estruturas.map((estrutura: any, idx: number) => ({
              localId: estrutura.id || uid("estrutura"),
              expanded: true,
              id: estrutura.id,
              tipo: estrutura.tipo,
              titulo: estrutura.titulo || "",
              descricao: estrutura.descricao || "",
              objetivo: estrutura.objetivo || "",
              ordem: estrutura.ordem ?? idx + 1,
              duracaoSemanas: estrutura.duracaoSemanas ?? null,
              treinosPorSemana: estrutura.treinosPorSemana ?? null,
              quantidadeMinConclusao: estrutura.quantidadeMinConclusao ?? null,
              modoExecucao: estrutura.modoExecucao ?? null,
              pontosPorItem: estrutura.pontosPorItem ?? null,
              bonusConsistencia: estrutura.bonusConsistencia ?? null,
              bonusFinal: estrutura.bonusFinal ?? null,
              prazoInicio: estrutura.prazoInicio
                ? String(estrutura.prazoInicio).slice(0, 10)
                : null,
              prazoFinal: estrutura.prazoFinal
                ? String(estrutura.prazoFinal).slice(0, 10)
                : null,
              percentualPerdaAtraso: estrutura.percentualPerdaAtraso ?? null,
              permiteAtraso: !!estrutura.permiteAtraso,
              ativo: estrutura.ativo ?? true,
              itens: Array.isArray(estrutura.itens)
                ? estrutura.itens.map((it: any, itemIdx: number) => ({
                    localId: it.id || uid("item"),
                    id: it.id,
                    titulo: it.titulo || "",
                    descricao: it.descricao || "",
                    tipo: it.tipo,
                    ordem: it.ordem ?? itemIdx + 1,
                    videoUrl: it.videoUrl || "",
                    thumbUrl: it.thumbUrl || "",
                    arquivoUrl: it.arquivoUrl || "",
                    materialUrl: it.materialUrl || "",
                    treinoProgramadoId: it.treinoProgramadoId || "",
                    pontos: it.pontos ?? null,
                    duracaoMin: it.duracaoMin ?? null,
                    obrigatorio: it.obrigatorio ?? true,
                    publicado: it.publicado ?? true,
                    videoPreviewUrl: it.videoUrl || null,
                    videoFileName: it.videoUrl ? String(it.videoUrl).split("/").pop() || "video" : null,
                    videoModalOpen: false,
                    materialFileName:
                      it.arquivoUrl || it.materialUrl
                        ? String(it.arquivoUrl || it.materialUrl).split("/").pop() || "arquivo"
                        : null,
                    materialPreviewUrl: it.arquivoUrl || it.materialUrl || null,
                    treinoSelecionado: it.treinoProgramado
                      ? {
                          id: String(it.treinoProgramado.id),
                          nome: it.treinoProgramado.nome || "Treino",
                          codigo: it.treinoProgramado.codigo || null,
                          descricao: it.treinoProgramado.objetivo || null,
                          imagemUrl: it.treinoProgramado.imagemUrl || null,
                          criadorLabel: null,
                          origem: "MEU",
                          exercicios: [],
                        }
                      : null,
                  }))
                : [],
            }))
          : [];

        setEstruturas(estruturasMapped.length ? estruturasMapped : [emptyEstrutura(item.estruturaTipo)]);
      } catch (e: any) {
        alert(e?.message || "Falha ao carregar metodologia para edição.");
        navigate("/learning");
      } finally {
        if (ativo) setLoadingExisting(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [editMetodologiaId, navigate]);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        setValidandoPermissaoCriacao(true);

        const params = new URLSearchParams(window.location.search);
        const idDaUrl = params.get("id");

        const res = await listMinhasMetodologiasCriadas();
        const podeCriar = !!res?.permissaoCriacao?.podeCriar;

        if (!ativo) return;

        setPodeCriarMetodologia(idDaUrl ? true : podeCriar);

        if (!podeCriar && !idDaUrl) {
          navigate("/learning");
        }
      } catch (e) {
        if (!ativo) return;
        navigate("/learning");
      } finally {
        if (ativo) setValidandoPermissaoCriacao(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [navigate]);

  function escolherTipo(tipo: LearningMetodoTipo, estrutura: LearningEstruturaTipo) {
    setTipoMetodologia(tipo);
    setEstruturaTipo(estrutura);
    setEstruturas([emptyEstrutura(estrutura)]);
    setStep(2);
  }

  function handleModoExecucaoChange(localId: string, modo: LearningModoExecucao) {
    setEstruturas((prev) =>
      prev.map((e) => {
        if (e.localId !== localId) return e;

        if (modo === "LIVRE") {
          return {
            ...e,
            modoExecucao: modo,
            prazoInicio: null,
            prazoFinal: null,
            percentualPerdaAtraso: null,
            permiteAtraso: true,
          };
        }

        if (modo === "PRAZO_SUGERIDO") {
          return {
            ...e,
            modoExecucao: modo,
            prazoInicio: null,
            prazoFinal: e.prazoFinal ?? "",
            percentualPerdaAtraso: e.percentualPerdaAtraso ?? 20,
            permiteAtraso: true,
          };
        }

        return {
          ...e,
          modoExecucao: modo,
          prazoInicio: e.prazoInicio ?? "",
          prazoFinal: e.prazoFinal ?? "",
          percentualPerdaAtraso: e.percentualPerdaAtraso ?? 20,
          permiteAtraso: false,
        };
      })
    );
  }

  function addEstrutura() {
    if (!estruturaTipo) return;
    setEstruturas((prev) => [...prev, emptyEstrutura(estruturaTipo)]);
  }

  function removeEstrutura(localId: string) {
    setEstruturas((prev) => prev.filter((e) => e.localId !== localId));
  }

  function updateEstrutura(localId: string, patch: Partial<LocalEstrutura>) {
    setEstruturas((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, ...patch } : e))
    );
  }

  function addItem(estruturaLocalId: string, tipo?: LearningItemTipo) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? { ...e, itens: [...e.itens, emptyItem(tipo || (e.tipo === "TRILHA" ? "TREINO" : "AULA"))] }
          : e
      )
    );
  }

  function updateItem(
    estruturaLocalId: string,
    itemLocalId: string,
    patch: Partial<LocalItem>
  ) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? {
              ...e,
              itens: e.itens.map((it) =>
                it.localId === itemLocalId ? { ...it, ...patch } : it
              ),
            }
          : e
      )
    );
  }

  function removeItem(estruturaLocalId: string, itemLocalId: string) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? { ...e, itens: e.itens.filter((it) => it.localId !== itemLocalId) }
          : e
      )
    );
  }

  function removerMaterialItem(estruturaLocalId: string, itemLocalId: string) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? {
              ...e,
              itens: e.itens.map((it) =>
                it.localId === itemLocalId
                  ? {
                      ...it,
                      arquivoUrl: "",
                      materialUrl: "",
                      materialFileName: null,
                      materialPreviewUrl: null,
                    }
                  : it
              ),
            }
          : e
      )
    );
  }

  function removerVideoItem(estruturaLocalId: string, itemLocalId: string) {
    setEstruturas((prev) =>
      prev.map((e) =>
        e.localId === estruturaLocalId
          ? {
              ...e,
              itens: e.itens.map((it) =>
                it.localId === itemLocalId
                  ? {
                      ...it,
                      videoUrl: "",
                      videoPreviewUrl: null,
                      videoFileName: null,
                      videoModalOpen: false,
                      duracaoMin: null,
                    }
                  : it
              ),
            }
          : e
      )
    );
  }

  function selecionarTreinoNoItem(treino: TreinoSelecionavel) {
    if (!targetTreinoPicker) return;

    updateItem(targetTreinoPicker.estruturaLocalId, targetTreinoPicker.itemLocalId, {
      treinoProgramadoId: treino.id,
      treinoSelecionado: treino,
      titulo: treino.nome || "",
      descricao: treino.descricao || "",
      pontos: null,
    });

    setTreinoExpandidoId(null);
    setTreinoModalOpen(false);
    setTargetTreinoPicker(null);
  }

  async function abrirSeletorTreino(estruturaLocalId: string, itemLocalId: string) {
    try {
      setTargetTreinoPicker({ estruturaLocalId, itemLocalId });
      setTreinoModalOpen(true);
      setTreinosLoading(true);
      setTreinoExpandidoId(null);
      setTreinosBusca("");

      const token = getToken();
      const tipoSalvo = getTipoSalvo();
      const tipoUsuarioId = getTipoUsuarioId();
      const vinculo = tipoParaVinculoFront(tipoSalvo);

      const url = new URL(`${API.BASE_URL}/api/gerenciar/treinosprogramados/visiveis`);

      if (vinculo) url.searchParams.set("vinculo", vinculo);
      if (tipoUsuarioId) url.searchParams.set("id", tipoUsuarioId);

      const res = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Erro ao carregar treinos.");

      const listaBase = Array.isArray(json?.items)
        ? json.items
        : Array.isArray(json)
          ? json
          : [];

      const normalizados = listaBase
        .map((t: any) => normalizeTreinoSelecionavel(t))
        .filter((t: TreinoSelecionavel) => !!t.id);

      const meusTreinos = normalizados
        .filter((t: TreinoSelecionavel) =>
          autorEhDoLogado(
            listaBase.find((x: any) => String(x?.id) === String(t.id))?.autor,
            tipoSalvo,
            tipoUsuarioId
          )
        )
        .map((t: TreinoSelecionavel) => ({ ...t, origem: "MEU" as const }));

      const treinosVinculados = normalizados
        .filter(
          (t: TreinoSelecionavel) =>
            !meusTreinos.some((m: TreinoSelecionavel) => String(m.id) === String(t.id))
        )
        .map((t: TreinoSelecionavel) => ({ ...t, origem: "VINCULADO" as const }));
        
      setTreinosDisponiveis({
        meusTreinos,
        treinosVinculados,
      });
    } catch (e: any) {
      alert(e?.message || "Falha ao carregar treinos.");
    } finally {
      setTreinosLoading(false);
    }
  }

  function removerCapa() {
    setCapaUrl("");
    setCapaPreviewUrl(null);
  }

  async function handleCoverUpload(file: File) {
    const localPreview = URL.createObjectURL(file);

    try {
      setUploadingCover(true);
      setCapaPreviewUrl(localPreview);

      const up = await uploadMetodologiaFile(file);
      setCapaUrl(up.url);
      setCapaPreviewUrl(up.url);
    } catch (e: any) {
      setCapaUrl("");
      setCapaPreviewUrl(null);
      alert(e?.message || "Falha ao enviar capa.");
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleItemFileUpload(
    estruturaLocalId: string,
    itemLocalId: string,
    file: File,
    target: "videoUrl" | "arquivoUrl" | "materialUrl"
  ) {
    const localPreview =
      target === "videoUrl" ? URL.createObjectURL(file) : URL.createObjectURL(file);

    try {
      updateItem(estruturaLocalId, itemLocalId, {
        uploading: true,
        ...(target === "videoUrl"
          ? {
              videoPreviewUrl: localPreview,
              videoFileName: file.name,
            }
          : {
              materialPreviewUrl: localPreview,
              materialFileName: file.name,
            }),
      });

      const up = await uploadMetodologiaFile(file);

      updateItem(estruturaLocalId, itemLocalId, {
        [target]: up.url,
        uploading: false,
        ...(target === "videoUrl"
          ? {
              videoPreviewUrl: up.url,
              videoFileName: file.name,
            }
          : {
              arquivoUrl: up.url,
              materialPreviewUrl: up.url,
              materialFileName: file.name,
            }),
      } as Partial<LocalItem>);
    } catch (e: any) {
      updateItem(estruturaLocalId, itemLocalId, {
        uploading: false,
        ...(target === "videoUrl"
          ? {
              videoUrl: "",
              videoPreviewUrl: null,
              videoFileName: null,
              videoModalOpen: false,
            }
          : {
              arquivoUrl: "",
              materialPreviewUrl: null,
              materialFileName: null,
            }),
      });

      alert(e?.message || "Falha ao enviar arquivo.");
    }
  }

  function validar() {
    if (!tipoMetodologia || !estruturaTipo) {
      alert("Escolha o tipo da metodologia.");
      return false;
    }

    if (!titulo.trim()) {
      alert("Informe o nome da metodologia.");
      return false;
    }

    if (!estruturas.length) {
      alert("Adicione pelo menos uma trilha ou módulo.");
      return false;
    }

    for (const [indexEstrutura, estrutura] of estruturas.entries()) {
      if (!estrutura.titulo?.trim()) {
        alert(`Preencha o título da ${estruturaTipo === "TRILHA" ? "trilha" : "módulo"} ${indexEstrutura + 1}.`);
        return false;
      }

      if (estruturaTipo === "TRILHA") {
        if (!estrutura.duracaoSemanas || estrutura.duracaoSemanas <= 0) {
          alert(`Defina a duração da trilha "${estrutura.titulo || indexEstrutura + 1}".`);
          return false;
        }
        if (!estrutura.treinosPorSemana || estrutura.treinosPorSemana <= 0) {
          alert(`Defina os treinos por semana da trilha "${estrutura.titulo || indexEstrutura + 1}".`);
          return false;
        }
        const modo = estrutura.modoExecucao;

        if (!modo) {
          alert(`Escolha o modo de execução da trilha "${estrutura.titulo || indexEstrutura + 1}".`);
          return false;
        }

        const hoje = startOfToday();
        const minInicio = hoje;
        const maxInicio = addDays(hoje, 42); // 6 semanas
        const minFinal = addDays(hoje, 14);  // 2 semanas
        const maxFinal = addDays(hoje, 56);  // 8 semanas

        const semanas = Number(estrutura.duracaoSemanas || 0);
        const prazoEsperadoMs = semanas * 7 * 24 * 60 * 60 * 1000;
        const toleranciaMs = 7 * 24 * 60 * 60 * 1000;

        if (modo === "LIVRE") {
          // não exige prazo
        }

        if (modo === "PRAZO_SUGERIDO") {
          if (!estrutura.prazoFinal) {
            alert(`A trilha "${estrutura.titulo}" precisa de prazo final no modo "Com prazo sugerido".`);
            return false;
          }

          const prazoFinal = new Date(estrutura.prazoFinal);
          prazoFinal.setHours(0, 0, 0, 0);

          if (prazoFinal < minFinal) {
            alert(`O prazo final da trilha "${estrutura.titulo}" deve ser no mínimo 2 semanas a partir de hoje.`);
            return false;
          }

          if (prazoFinal > maxFinal) {
            alert(`O prazo final da trilha "${estrutura.titulo}" não pode passar de 8 semanas a partir de hoje.`);
            return false;
          }

          const diff = prazoFinal.getTime() - hoje.getTime();
          if (Math.abs(diff - prazoEsperadoMs) > toleranciaMs) {
            alert(`O prazo final da trilha "${estrutura.titulo}" deve ficar próximo da duração do ciclo (${semanas} semanas).`);
            return false;
          }
        }

        if (modo === "DESAFIO_FECHADO") {
          if (!estrutura.prazoInicio) {
            alert(`A trilha "${estrutura.titulo}" precisa de prazo de início.`);
            return false;
          }

          if (!estrutura.prazoFinal) {
            alert(`A trilha "${estrutura.titulo}" precisa de prazo final.`);
            return false;
          }

          const prazoInicio = new Date(estrutura.prazoInicio);
          const prazoFinal = new Date(estrutura.prazoFinal);
          prazoInicio.setHours(0, 0, 0, 0);
          prazoFinal.setHours(0, 0, 0, 0);

          if (prazoInicio < minInicio) {
            alert(`O prazo de início da trilha "${estrutura.titulo}" não pode estar no passado.`);
            return false;
          }

          if (prazoInicio > maxInicio) {
            alert(`O prazo de início da trilha "${estrutura.titulo}" não pode passar de 6 semanas a partir de hoje.`);
            return false;
          }

          if (prazoFinal < minFinal) {
            alert(`O prazo final da trilha "${estrutura.titulo}" deve ser no mínimo 2 semanas a partir de hoje.`);
            return false;
          }

          if (prazoFinal > maxFinal) {
            alert(`O prazo final da trilha "${estrutura.titulo}" não pode passar de 8 semanas a partir de hoje.`);
            return false;
          }

          if (prazoFinal <= prazoInicio) {
            alert(`Na trilha "${estrutura.titulo}", o prazo final precisa ser maior que o prazo de início.`);
            return false;
          }

          const diff = prazoFinal.getTime() - prazoInicio.getTime();
          if (Math.abs(diff - prazoEsperadoMs) > toleranciaMs) {
            alert(`O intervalo entre início e fim da trilha "${estrutura.titulo}" deve ficar próximo da duração do ciclo (${semanas} semanas).`);
            return false;
          }
        }
      }

      if (!estrutura.itens.length) {
        alert(`Adicione ao menos um item em "${estrutura.titulo || indexEstrutura + 1}".`);
        return false;
      }

      for (const [indexItem, item] of estrutura.itens.entries()) {
        if (item.tipo !== "TREINO" && !item.titulo?.trim()) {
          alert(`Preencha o título do item ${indexItem + 1} da estrutura "${estrutura.titulo}".`);
          return false;
        }

        if (item.tipo === "TREINO" && !item.treinoProgramadoId?.trim()) {
          alert(`O item ${indexItem + 1} da estrutura "${estrutura.titulo}" precisa ter um treino selecionado.`);
          return false;
        }

        if ((item.tipo === "VIDEO" || item.tipo === "AULA") && !item.videoUrl?.trim()) {
          alert(`O item "${item.titulo}" precisa ter vídeo.`);
          return false;
        }

        if (item.tipo === "MATERIAL" && !item.arquivoUrl?.trim() && !item.materialUrl?.trim()) {
          alert(`O item "${item.titulo}" precisa ter arquivo ou link do material.`);
          return false;
        }
      }
    }

    return true;
  }

  function cancelarCriacao() {
    localStorage.removeItem(LEARNING_DRAFT_KEY);
    navigate("/learning");
  }

  async function salvarTudo() {
    if (!validar() || !tipoMetodologia || !estruturaTipo) return;

    try {
      setSaving(true);

      const metodologiaResp = editMetodologiaId
        ? await updateMetodologia(editMetodologiaId, {
            titulo: titulo.trim(),
            descricao: descricao.trim() || null,
            capaUrl: capaUrl.trim() || null,
            publicoAlvo,
            tipo: tipoMetodologia,
            estruturaTipo,
            area,
            geraBadge,
            geraCertificado,
            ativo: true,
          })
        : await createMetodologia({
            titulo: titulo.trim(),
            descricao: descricao.trim() || null,
            capaUrl: capaUrl.trim() || null,
            publicoAlvo,
            tipo: tipoMetodologia,
            estruturaTipo,
            area,
            geraBadge,
            geraCertificado,
            ativo: true,
          });

      const metodologiaId = editMetodologiaId || metodologiaResp?.item?.id;
      if (!metodologiaId) throw new Error("Não foi possível salvar a metodologia.");

      const estruturaIdsAtuais = estruturas
        .map((e) => e.id)
        .filter(Boolean) as string[];

      const metodologiaExistente = editMetodologiaId
        ? await getMetodologiaById(metodologiaId)
        : null;

      const estruturasAntigas = Array.isArray(metodologiaExistente?.item?.estruturas)
        ? metodologiaExistente.item.estruturas
        : [];

      const estruturasRemovidas = estruturasAntigas.filter(
        (old: any) => !estruturaIdsAtuais.includes(old.id)
      );

      for (const estruturaRemovida of estruturasRemovidas) {
        await deleteMetodologiaEstrutura(metodologiaId, estruturaRemovida.id);
      }

      for (let i = 0; i < estruturas.length; i++) {
        const estrutura = estruturas[i];

        const payloadEstrutura = {
          titulo: estrutura.titulo.trim(),
          descricao: estrutura.descricao?.trim() || null,
          objetivo: estrutura.objetivo?.trim() || null,
          tipo: estruturaTipo,
          ordem: i + 1,

          duracaoSemanas:
            estruturaTipo === "TRILHA" ? Number(estrutura.duracaoSemanas || 0) : null,
          treinosPorSemana:
            estruturaTipo === "TRILHA" ? Number(estrutura.treinosPorSemana || 0) : null,
          quantidadeMinConclusao:
            estruturaTipo === "TRILHA" ? Number(estrutura.quantidadeMinConclusao || 0) : null,
          modoExecucao:
            estruturaTipo === "TRILHA" ? estrutura.modoExecucao || null : null,
          pontosPorItem:
            estruturaTipo === "TRILHA" ? Number(estrutura.pontosPorItem || 0) : null,
          bonusConsistencia:
            estruturaTipo === "TRILHA" ? Number(estrutura.bonusConsistencia || 0) : null,
          bonusFinal:
            estruturaTipo === "TRILHA" ? Number(estrutura.bonusFinal || 0) : null,

          prazoInicio:
            estruturaTipo === "TRILHA" && estrutura.modoExecucao === "DESAFIO_FECHADO"
              ? estrutura.prazoInicio || null
              : null,

          prazoFinal:
            estruturaTipo === "TRILHA"
              ? (estrutura.modoExecucao !== "LIVRE" ? estrutura.prazoFinal || null : null)
              : (estrutura.prazoFinal || null),

          percentualPerdaAtraso:
            estruturaTipo === "TRILHA" && estrutura.modoExecucao !== "LIVRE"
              ? Number(estrutura.percentualPerdaAtraso ?? 20)
              : null,

          permiteAtraso:
            estruturaTipo === "TRILHA"
              ? (estrutura.modoExecucao === "DESAFIO_FECHADO" ? false : !!estrutura.permiteAtraso)
              : true,

          ativo: true,
        };
        let estruturaId = estrutura.id;

        if (estrutura.id) {
          await updateMetodologiaEstrutura(metodologiaId, estrutura.id, payloadEstrutura);
        } else {
          const estruturaResp = await createMetodologiaEstruturas(metodologiaId, payloadEstrutura);
          estruturaId = estruturaResp?.estruturas?.[0]?.id;
        }

        if (!estruturaId) {
          throw new Error(`Falha ao salvar a estrutura "${estrutura.titulo}".`);
        }

        if (estrutura.id) {
          await deleteMetodologiaEstruturaItens(metodologiaId, estruturaId);
        }

        await createMetodologiaEstruturaItens(metodologiaId, estruturaId, {
          itens: estrutura.itens.map((item, itemIndex) => ({
            titulo: item.titulo.trim(),
            descricao: item.descricao?.trim() || null,
            tipo: item.tipo,
            ordem: itemIndex + 1,
            videoUrl: item.videoUrl?.trim() || null,
            thumbUrl: item.thumbUrl?.trim() || null,
            arquivoUrl: item.arquivoUrl?.trim() || null,
            materialUrl: item.materialUrl?.trim() || null,
            duracaoMin: item.duracaoMin ? Number(item.duracaoMin) : null,
            treinoProgramadoId: item.treinoProgramadoId?.trim() || null,
            pontos: item.pontos ? Number(item.pontos) : null,
            obrigatorio: item.obrigatorio !== false,
            publicado: item.publicado !== false,
            videoPreviewUrl: item.videoUrl || null,
            videoFileName: item.videoUrl ? String(item.videoUrl).split("/").pop() || "video" : null,
            videoModalOpen: false,
          })),
        });
      }

      alert(editMetodologiaId ? "Metodologia atualizada com sucesso!" : "Metodologia criada com sucesso!");
      localStorage.removeItem(LEARNING_DRAFT_KEY);
      navigate(`/learning/${metodologiaId}`);
    } catch (e: any) {
      alert(e?.message || (editMetodologiaId ? "Erro ao atualizar metodologia." : "Erro ao criar metodologia."));
    } finally {
      setSaving(false);
    }
  }

  if (validandoPermissaoCriacao) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] pb-24">
        <div className="max-w-4xl mx-auto px-4 pt-5">
          <div className="rounded-[20px] bg-white border border-slate-200 shadow-sm p-6 text-slate-600">
            Validando permissão...
          </div>
        </div>
      </div>
    );
  }

  if (!podeCriarMetodologia && !editMetodologiaId) {
    return null;
  }

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-[#f7f7f4] pb-24">
        <div className="max-w-4xl mx-auto px-4 pt-5">
          <div className="rounded-[20px] bg-white border border-slate-200 shadow-sm p-6 text-slate-600">
            Carregando metodologia...
          </div>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#f6f6f3] pb-16">
        <div className="max-w-3xl mx-auto px-3 pt-5">
          <LearningHeader
            title={editMetodologiaId ? "Editar Metodologia" : "Criar Metodologia"}
            backHref="/learning"
          />
          <LearningTypeChooser onChoose={escolherTipo} />
        </div>
      </div>
    );
  }

  const hojeInput = toInputDate(startOfToday());
  const minInicioInput = toInputDate(addDays(startOfToday(), 0));
  const maxInicioInput = toInputDate(addDays(startOfToday(), 42));
  const minFinalInput = toInputDate(addDays(startOfToday(), 14));
  const maxFinalInput = toInputDate(addDays(startOfToday(), 56));

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-5">
        <LearningHeader
          title={
            editMetodologiaId
              ? estruturaTipo === "TRILHA"
                ? "Editar Trilha"
                : "Editar Curso"
              : estruturaTipo === "TRILHA"
                ? "Nova Trilha"
                : "Novo Curso"
          }
          subtitle={
            editMetodologiaId
              ? "Edite sua metodologia e salve as alterações."
              : "Monte sua metodologia no novo formato de Learning."
          }
          backHref="/learning"
        />

        <div className="space-y-4">
          <div className="rounded-[20px] bg-white border border-slate-200 shadow-sm p-4">
            <SectionTitle
              title="Informações da metodologia"
              subtitle="Esses dados aparecem na capa e nas listagens."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {requiredLabel("Nome da metodologia", true)}
                </label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Método Keeper Academy"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#216c43]/20"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {requiredLabel("Descrição", false)}
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o objetivo da metodologia"
                  className="w-full min-h-[100px] rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-[#216c43]/20"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {requiredLabel("Público", true)}
                </label>
                <select
                  value={publicoAlvo}
                  onChange={(e) => setPublicoAlvo(e.target.value as PublicoOption)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                >
                  {PUBLICOS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {requiredLabel("Área", true)}
                </label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as AreaOption)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                >
                  {AREAS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {requiredLabel("Capa da metodologia", false)}
                </label>

                {!capaPreviewUrl ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                      <Upload className="w-4 h-4" />
                      {uploadingCover ? "Enviando..." : "Enviar capa"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleCoverUpload(file);
                        }}
                      />
                    </label>

                    <input
                      value={capaUrl}
                      onChange={(e) => {
                        setCapaUrl(e.target.value);
                        setCapaPreviewUrl(e.target.value || null);
                      }}
                      placeholder="Ou cole a URL da capa"
                      className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                        <Upload className="w-4 h-4" />
                        Trocar capa
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCoverUpload(file);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={removerCapa}
                        className="text-red-600 underline text-sm"
                      >
                        Remover imagem
                      </button>
                    </div>

                    <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img
                        src={capaPreviewUrl}
                        alt="Prévia da capa da metodologia"
                        className="w-full h-[220px] object-cover"
                      />
                    </div>

                    <input
                      value={capaUrl}
                      onChange={(e) => {
                        setCapaUrl(e.target.value);
                        setCapaPreviewUrl(e.target.value || null);
                      }}
                      placeholder="Ou cole a URL da capa"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={geraCertificado}
                    onChange={(e) => setGeraCertificado(e.target.checked)}
                  />
                  Gerar certificado
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={geraBadge}
                    onChange={(e) => setGeraBadge(e.target.checked)}
                  />
                  Gerar badge
                </label>
              </div>
            </div>
          </div>

          {estruturas.map((estrutura, index) => (
            <div
              key={estrutura.localId}
              className="rounded-[20px] bg-white border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div className="text-lg font-extrabold text-[#193b2e]">
                    {estruturaTipo === "TRILHA" ? `Trilha ${index + 1}` : `Módulo ${index + 1}`}
                  </div>
                  <div className="text-sm text-slate-500">
                    {estrutura.titulo?.trim() || "Sem título ainda"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateEstrutura(estrutura.localId, { expanded: !estrutura.expanded })
                    }
                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600"
                  >
                    {estrutura.expanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => removeEstrutura(estrutura.localId)}
                    className="h-10 w-10 rounded-xl border border-red-200 text-red-600 flex items-center justify-center"
                    disabled={estruturas.length <= 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {estrutura.expanded ? (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Nome da {estruturaTipo === "TRILHA" ? "trilha" : "módulo"} *
                      </label>
                      <input
                        value={estrutura.titulo || ""}
                        onChange={(e) =>
                          updateEstrutura(estrutura.localId, { titulo: e.target.value })
                        }
                        placeholder={
                          estruturaTipo === "TRILHA"
                            ? "Ex.: Explosão e Impulsão"
                            : "Ex.: Módulo 1 - Fundamentos"
                        }
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Objetivo da {estruturaTipo === "TRILHA" ? "trilha" : "estrutura"} (Opcional)
                      </label>
                      <textarea
                        value={estrutura.objetivo || ""}
                        onChange={(e) =>
                          updateEstrutura(estrutura.localId, { objetivo: e.target.value })
                        }
                        placeholder={
                          estruturaTipo === "TRILHA"
                            ? "Desenvolver a impulsão e o poder explosivo nos goleiros."
                            : "Explique o que o aluno vai aprender neste módulo."
                        }
                        className="w-full min-h-[96px] rounded-xl border border-slate-300 px-4 py-3 outline-none"
                      />
                    </div>

                    {estruturaTipo === "TRILHA" ? (
                      <>
                        <div className="md:col-span-2 mt-1">
                          <SectionTitle
                            title="Plano de execução"
                            subtitle="Configure o ciclo e a gamificação da trilha."
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Duração do ciclo*
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {DURACOES.map((dur) => (
                              <ChipButton
                                key={dur}
                                active={Number(estrutura.duracaoSemanas) === dur}
                                onClick={() =>
                                  updateEstrutura(estrutura.localId, {
                                    duracaoSemanas: dur,
                                  })
                                }
                              >
                                {dur} semanas
                              </ChipButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Treinos por semana*
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={estrutura.treinosPorSemana ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                treinosPorSemana: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Meta mínima para concluir*
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={estrutura.quantidadeMinConclusao ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                quantidadeMinConclusao: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            {requiredLabel("Modo de execução", true)}
                          </label>

                          <div className="flex flex-wrap gap-2">
                            {MODOS.map((modo) => (
                              <ChipButton
                                key={modo.value}
                                active={estrutura.modoExecucao === modo.value}
                                onClick={() => handleModoExecucaoChange(estrutura.localId, modo.value)}
                              >
                                {modo.label}
                              </ChipButton>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Pontuação por treino/item (Opcional)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.pontosPorItem ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                pontosPorItem: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Bônus por consistência semanal*
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.bonusConsistencia ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                bonusConsistencia: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Bônus final*
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={estrutura.bonusFinal ?? ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, {
                                bonusFinal: Number(e.target.value || 0),
                              })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        {estrutura.modoExecucao === "PRAZO_SUGERIDO" ? (
                          <>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {requiredLabel("Prazo final", true)}
                              </label>
                              <input
                                type="date"
                                min={minFinalInput}
                                max={maxFinalInput}
                                value={estrutura.prazoFinal || ""}
                                onChange={(e) =>
                                  updateEstrutura(estrutura.localId, { prazoFinal: e.target.value })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                Sugestão: use um prazo próximo da duração do ciclo selecionado.
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700">
                                {requiredLabel("Perda de pontos após o prazo (%)", false)}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={estrutura.percentualPerdaAtraso ?? 20}
                                onChange={(e) =>
                                  updateEstrutura(estrutura.localId, {
                                    percentualPerdaAtraso: Number(e.target.value || 0),
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>
                          </>
                        ) : null}

                        {estrutura.modoExecucao === "DESAFIO_FECHADO" ? (
                          <>
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {requiredLabel("Prazo de início", true)}
                              </label>
                              <input
                                type="date"
                                min={minInicioInput}
                                max={maxInicioInput}
                                value={estrutura.prazoInicio || ""}
                                onChange={(e) =>
                                  updateEstrutura(estrutura.localId, { prazoInicio: e.target.value })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {requiredLabel("Prazo final", true)}
                              </label>
                              <input
                                type="date"
                                min={minFinalInput}
                                max={maxFinalInput}
                                value={estrutura.prazoFinal || ""}
                                onChange={(e) =>
                                  updateEstrutura(estrutura.localId, { prazoFinal: e.target.value })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                {requiredLabel("Perda de pontos após o prazo (%)", false)}
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={estrutura.percentualPerdaAtraso ?? 20}
                                onChange={(e) =>
                                  updateEstrutura(estrutura.localId, {
                                    percentualPerdaAtraso: Number(e.target.value || 0),
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Descrição curta (Opcional)
                          </label>
                          <input
                            value={estrutura.descricao || ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, { descricao: e.target.value })
                            }
                            placeholder="Resumo do módulo"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            Prazo final (Opcional)
                          </label>
                          <input
                            type="date"
                            min={minFinalInput}
                            max={maxFinalInput}
                            value={estrutura.prazoFinal || ""}
                            onChange={(e) =>
                              updateEstrutura(estrutura.localId, { prazoFinal: e.target.value })
                            }
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="text-base font-bold text-[#193b2e]">
                          Itens da {estruturaTipo === "TRILHA" ? "trilha" : "estrutura"}
                        </div>
                        <div className="text-sm text-slate-500">
                          Adicione treinos, vídeos, aulas, materiais ou desafios.
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {itemTypeOptions.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => addItem(estrutura.localId, opt.value)}
                            className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 inline-flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      {estrutura.itens.map((item, itemIndex) => (
                        <div
                          key={item.localId}
                          className="rounded-2xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100">
                                {itemTypeOptions.find((t) => t.value === item.tipo)?.icon}
                                {item.tipo}
                              </span>
                              Item {itemIndex + 1}
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(estrutura.localId, item.localId)}
                              className="h-9 w-9 rounded-xl border border-red-200 text-red-600 flex items-center justify-center"
                              disabled={estrutura.itens.length <= 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Tipo do item*
                              </label>
                              <select
                                value={item.tipo}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    tipo: e.target.value as LearningItemTipo,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white outline-none"
                              >
                                {itemTypeOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {item.tipo !== "TREINO" ? (
                              <>
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {requiredLabel("Título", true)}
                                  </label>
                                  <input
                                    value={item.titulo || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        titulo: e.target.value,
                                      })
                                    }
                                    placeholder="Nome do item"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {requiredLabel("Descrição", false)}
                                  </label>
                                  <textarea
                                    value={item.descricao || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        descricao: e.target.value,
                                      })
                                    }
                                    placeholder="Descrição do item"
                                    className="w-full min-h-[86px] rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>
                              </>
                            ) : null}

                            {(item.tipo === "VIDEO" || item.tipo === "AULA") && (
                              <>
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Enviar vídeo*
                                  </label>

                                  {!item.videoPreviewUrl ? (
                                    <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                      <Upload className="w-4 h-4" />
                                      {item.uploading ? "Enviando..." : "Enviar vídeo"}
                                      <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            handleItemFileUpload(
                                              estrutura.localId,
                                              item.localId,
                                              file,
                                              "videoUrl"
                                            );
                                          }
                                        }}
                                      />
                                    </label>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                        <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                          <Upload className="w-4 h-4" />
                                          Trocar vídeo
                                          <input
                                            type="file"
                                            accept="video/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                handleItemFileUpload(
                                                  estrutura.localId,
                                                  item.localId,
                                                  file,
                                                  "videoUrl"
                                                );
                                              }
                                            }}
                                          />
                                        </label>

                                        <span className="text-sm text-slate-500 truncate">
                                          {item.videoFileName || "Vídeo selecionado"}
                                        </span>
                                      </div>

                                      {item.videoPreviewUrl ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            updateItem(estrutura.localId, item.localId, {
                                              videoModalOpen: true,
                                            })
                                          }
                                          className="relative block w-full max-w-[460px] overflow-hidden rounded-2xl border border-slate-200"
                                        >
                                          <video
                                            src={item.videoPreviewUrl}
                                            className="w-full h-[260px] object-cover"
                                            muted
                                            playsInline
                                            preload="metadata"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <div className="h-16 w-16 rounded-full bg-black/55 text-white flex items-center justify-center text-2xl">
                                              ▶
                                            </div>
                                          </div>
                                        </button>
                                      ) : null}

                                      <button
                                        type="button"
                                        onClick={() => removerVideoItem(estrutura.localId, item.localId)}
                                        className="text-red-600 underline text-sm"
                                      >
                                        Remover vídeo
                                      </button>

                                      {item.videoModalOpen && item.videoPreviewUrl ? (
                                        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                                          <div className="w-full max-w-3xl rounded-[28px] bg-white p-5">
                                            <div className="flex justify-end mb-3">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  updateItem(estrutura.localId, item.localId, {
                                                    videoModalOpen: false,
                                                  })
                                                }
                                                className="text-xl font-semibold text-slate-700"
                                              >
                                                Fechar
                                              </button>
                                            </div>

                                            <video
                                              src={item.videoPreviewUrl}
                                              controls
                                              autoPlay
                                              className="w-full rounded-2xl"
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    URL do vídeo (Opcional)
                                  </label>
                                  <input
                                    value={item.videoUrl || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        videoUrl: e.target.value,
                                        videoPreviewUrl: e.target.value || null,
                                        videoFileName: e.target.value
                                          ? String(e.target.value).split("/").pop() || "video"
                                          : null,
                                      })
                                    }
                                    placeholder="Cole a URL do vídeo"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "MATERIAL" && (
                              <>
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Enviar material*
                                  </label>

                                  {!item.materialPreviewUrl ? (
                                    <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                      <Upload className="w-4 h-4" />
                                      {item.uploading ? "Enviando..." : "Selecionar arquivo"}
                                      <input
                                        type="file"
                                        accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            handleItemFileUpload(
                                              estrutura.localId,
                                              item.localId,
                                              file,
                                              "arquivoUrl"
                                            );
                                          }
                                        }}
                                      />
                                    </label>
                                  ) : (
                                    <div className="space-y-3">
                                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                        <label className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-slate-300 bg-white cursor-pointer text-sm font-medium text-slate-700">
                                          <Upload className="w-4 h-4" />
                                          Trocar arquivo
                                          <input
                                            type="file"
                                            accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                handleItemFileUpload(
                                                  estrutura.localId,
                                                  item.localId,
                                                  file,
                                                  "arquivoUrl"
                                                );
                                              }
                                            }}
                                          />
                                        </label>

                                        <span className="text-sm text-slate-500 break-all">
                                          {item.materialFileName || "Arquivo selecionado"}
                                        </span>

                                        {(item.arquivoUrl || item.materialUrl) && (
                                          <a
                                            href={item.arquivoUrl || item.materialUrl || "#"}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700"
                                          >
                                            Baixar / abrir
                                          </a>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => removerMaterialItem(estrutura.localId, item.localId)}
                                        className="text-red-600 underline text-sm"
                                      >
                                        Remover arquivo
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    URL do material (Opcional)
                                  </label>
                                  <input
                                    value={item.materialUrl || item.arquivoUrl || ""}
                                    onChange={(e) =>
                                      updateItem(estrutura.localId, item.localId, {
                                        materialUrl: e.target.value,
                                        materialPreviewUrl: e.target.value || null,
                                        materialFileName: e.target.value
                                          ? String(e.target.value).split("/").pop() || "arquivo"
                                          : null,
                                      })
                                    }
                                    placeholder="Cole a URL do material"
                                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                                  />
                                </div>
                              </>
                            )}

                            <div>
                              {item.tipo === "TREINO" ? (
                                <div className="md:col-span-2 space-y-3">
                                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                                    {requiredLabel("Treino programado", true)}
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() => abrirSeletorTreino(estrutura.localId, item.localId)}
                                    className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700"
                                  >
                                    {item.treinoProgramadoId ? "Trocar treino" : "Selecionar treino"}
                                  </button>

                                  {item.treinoSelecionado ? (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                      <div className="text-base font-bold text-[#193b2e]">
                                        {item.treinoSelecionado.nome}
                                        {item.treinoSelecionado.codigo ? ` (${item.treinoSelecionado.codigo})` : ""}
                                      </div>

                                      {item.treinoSelecionado.criadorLabel ? (
                                        <div className="text-sm text-slate-600 mt-1">
                                          {item.treinoSelecionado.criadorLabel}
                                        </div>
                                      ) : null}

                                      {!!item.treinoSelecionado.exercicios?.length && (
                                        <div className="mt-3 space-y-2">
                                          <div className="text-sm font-semibold text-slate-700">Exercícios</div>

                                          {item.treinoSelecionado.exercicios.map((ex, idx) => (
                                            <div
                                              key={`${item.localId}_${idx}`}
                                              className="rounded-xl border border-slate-200 bg-white p-3"
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div>
                                                  <div className="font-semibold text-slate-800">
                                                    {idx + 1}. {ex.nome}
                                                    {ex.codigo ? ` (${ex.codigo})` : ""}
                                                  </div>

                                                  {ex.descricao ? (
                                                    <div className="text-sm text-slate-500 mt-1">{ex.descricao}</div>
                                                  ) : null}

                                                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                                                    {ex.series ? <div>Séries: {ex.series}</div> : null}
                                                    {ex.repeticoes ? <div>Repetições: {ex.repeticoes}</div> : null}
                                                    {ex.duracao ? <div>Duração: {ex.duracao}</div> : null}
                                                    {ex.descanso ? <div>Descanso: {ex.descanso}</div> : null}
                                                    {ex.donoLabel ? <div>{ex.donoLabel}</div> : null}
                                                  </div>
                                                </div>

                                                <div className="shrink-0">
                                                  <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                                      ex.videoDemonstrativoUrl
                                                        ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                                                        : "text-slate-500 border-slate-300 bg-slate-50"
                                                    }`}
                                                  >
                                                    {ex.videoDemonstrativoUrl ? "VÍDEO" : "SEM VÍDEO"}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-slate-500">
                                      Nenhum treino selecionado.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Pontos do item*
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={item.pontos ?? ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    pontos: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Duração em minutos (Opcional)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={item.duracaoMin ?? ""}
                                onChange={(e) =>
                                  updateItem(estrutura.localId, item.localId, {
                                    duracaoMin: e.target.value ? Number(e.target.value) : null,
                                  })
                                }
                                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                              />
                            </div>

                            <div className="md:col-span-2 flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={item.obrigatorio !== false}
                                  onChange={(e) =>
                                    updateItem(estrutura.localId, item.localId, {
                                      obrigatorio: e.target.checked,
                                    })
                                  }
                                />
                                Obrigatório
                              </label>

                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={item.publicado !== false}
                                  onChange={(e) =>
                                    updateItem(estrutura.localId, item.localId, {
                                      publicado: e.target.checked,
                                    })
                                  }
                                />
                                Publicado
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={addEstrutura}
            className="w-full h-12 rounded-2xl border border-dashed border-[#216c43] text-[#216c43] font-bold inline-flex items-center justify-center gap-2 bg-white"
          >
            <Plus className="w-4 h-4" />
            {estruturaTipo === "TRILHA" ? "Nova trilha" : "Novo módulo"}
          </button>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={cancelarCriacao}
              className="h-12 px-5 rounded-2xl border border-slate-300 bg-white text-slate-700 font-semibold"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={salvarTudo}
              disabled={saving}
              className="h-12 px-5 rounded-2xl border border-slate-300 bg-green-900 text-white text-slate-700 font-semibold"
            >
              {saving ? "Salvando..." : editMetodologiaId ? "Salvar alterações" : "Criar metodologia"}
            </button>
          </div>
        </div>
      </div>
      {treinoModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <div className="text-lg font-bold text-[#193b2e]">Selecionar treino</div>
                <div className="text-sm text-slate-500">
                  Escolha um treino para vincular ao item da trilha
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTreinoModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700"
              >
                Fechar
              </button>
            </div>

            <div className="p-4 border-b">
              <input
                value={treinosBusca}
                onChange={(e) => setTreinosBusca(e.target.value)}
                placeholder="Buscar treino por nome, código ou autor..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
              />
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-6">
              {treinosLoading ? (
                <div className="text-sm text-slate-500">Carregando treinos...</div>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-bold text-[#193b2e] mb-3">Seus treinos</div>

                    <div className="space-y-3">
                      {treinosDisponiveis.meusTreinos
                        .filter((t) => {
                          const q = treinosBusca.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            t.nome?.toLowerCase().includes(q) ||
                            String(t.codigo || "").toLowerCase().includes(q) ||
                            String(t.criadorLabel || "").toLowerCase().includes(q)
                          );
                        })
                        .map((treino) => {
                          const aberto = treinoExpandidoId === treino.id;

                          return (
                            <div
                              key={treino.id}
                              className={`rounded-2xl border ${
                                aberto ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setTreinoExpandidoId((prev) => (prev === treino.id ? null : treino.id))
                                }
                                className="w-full text-left p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg font-bold text-slate-900">
                                      {treino.nome}
                                      {treino.codigo ? ` (${treino.codigo})` : ""}
                                    </div>

                                    {treino.criadorLabel ? (
                                      <div className="text-sm text-slate-500 mt-1">{treino.criadorLabel}</div>
                                    ) : null}

                                    {treino.descricao ? (
                                      <div className="text-sm text-slate-600 mt-1">{treino.descricao}</div>
                                    ) : null}
                                  </div>

                                  <div className="text-sm text-slate-500">
                                    {aberto ? "Recolher" : "Ver exercícios"}
                                  </div>
                                </div>
                              </button>

                              {aberto ? (
                                <div className="border-t border-emerald-200 px-4 pb-4 pt-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-slate-700">Exercícios</div>
                                    <button
                                      type="button"
                                      onClick={() => selecionarTreinoNoItem(treino)}
                                      className="rounded-xl bg-[#0f9b6b] text-white px-4 py-2 text-sm font-semibold"
                                    >
                                      Selecionar treino
                                    </button>
                                  </div>

                                  {treino.exercicios?.map((ex, idx) => (
                                    <div key={`${treino.id}_${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="font-semibold text-slate-800">
                                            {idx + 1}. {ex.nome}
                                            {ex.codigo ? ` (${ex.codigo})` : ""}
                                          </div>

                                          {ex.descricao ? (
                                            <div className="text-sm text-slate-500 mt-1">{ex.descricao}</div>
                                          ) : null}

                                          <div className="mt-2 space-y-1 text-sm text-slate-600">
                                            {ex.series ? <div>Séries: {ex.series}</div> : null}
                                            {ex.repeticoes ? <div>Repetições: {ex.repeticoes}</div> : null}
                                            {ex.duracao ? <div>Duração: {ex.duracao}</div> : null}
                                            {ex.descanso ? <div>Descanso: {ex.descanso}</div> : null}
                                            {ex.donoLabel ? <div>{ex.donoLabel}</div> : null}
                                          </div>
                                        </div>

                                        <div className="shrink-0">
                                          <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                              ex.videoDemonstrativoUrl
                                                ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                                                : "text-slate-500 border-slate-300 bg-slate-50"
                                            }`}
                                          >
                                            {ex.videoDemonstrativoUrl ? "VÍDEO" : "SEM VÍDEO"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  {!treino.exercicios?.length ? (
                                    <div className="text-sm text-slate-500">Esse treino não possui exercícios.</div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-[#193b2e] mb-3">
                      Treinos vinculados a você
                    </div>

                    <div className="space-y-3">
                      {treinosDisponiveis.treinosVinculados
                        .filter((t: TreinoSelecionavel) => {
                          const q = treinosBusca.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            t.nome?.toLowerCase().includes(q) ||
                            String(t.codigo || "").toLowerCase().includes(q) ||
                            String(t.criadorLabel || "").toLowerCase().includes(q)
                          );
                        })
                        .map((treino: TreinoSelecionavel) => {
                          const aberto = treinoExpandidoId === treino.id;

                          return (
                            <div
                              key={`vinc_${treino.id}`}
                              className={`rounded-2xl border ${
                                aberto ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setTreinoExpandidoId((prev) => (prev === treino.id ? null : treino.id))
                                }
                                className="w-full text-left p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-lg font-bold text-slate-900">
                                      {treino.nome}
                                      {treino.codigo ? ` (${treino.codigo})` : ""}
                                    </div>

                                    {treino.criadorLabel ? (
                                      <div className="text-sm text-slate-500 mt-1">{treino.criadorLabel}</div>
                                    ) : null}

                                    {treino.descricao ? (
                                      <div className="text-sm text-slate-600 mt-1">{treino.descricao}</div>
                                    ) : null}
                                  </div>

                                  <div className="text-sm text-slate-500">
                                    {aberto ? "Recolher" : "Ver exercícios"}
                                  </div>
                                </div>
                              </button>

                              {aberto ? (
                                <div className="border-t border-emerald-200 px-4 pb-4 pt-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-slate-700">Exercícios</div>
                                    <button
                                      type="button"
                                      onClick={() => selecionarTreinoNoItem(treino)}
                                      className="rounded-xl bg-[#0f9b6b] text-white px-4 py-2 text-sm font-semibold"
                                    >
                                      Selecionar treino
                                    </button>
                                  </div>

                                  {treino.exercicios?.map((ex, idx) => (
                                    <div
                                      key={`vinc_${treino.id}_${idx}`}
                                      className="rounded-xl border border-slate-200 bg-white p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <div className="font-semibold text-slate-800">
                                            {idx + 1}. {ex.nome}
                                            {ex.codigo ? ` (${ex.codigo})` : ""}
                                          </div>

                                          {ex.descricao ? (
                                            <div className="text-sm text-slate-500 mt-1">{ex.descricao}</div>
                                          ) : null}

                                          <div className="mt-2 space-y-1 text-sm text-slate-600">
                                            {ex.series ? <div>Séries: {ex.series}</div> : null}
                                            {ex.repeticoes ? <div>Repetições: {ex.repeticoes}</div> : null}
                                            {ex.duracao ? <div>Duração: {ex.duracao}</div> : null}
                                            {ex.descanso ? <div>Descanso: {ex.descanso}</div> : null}
                                            {ex.donoLabel ? <div>{ex.donoLabel}</div> : null}
                                          </div>
                                        </div>

                                        <div className="shrink-0">
                                          <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                              ex.videoDemonstrativoUrl
                                                ? "text-emerald-700 border-emerald-300 bg-emerald-50"
                                                : "text-slate-500 border-slate-300 bg-slate-50"
                                            }`}
                                          >
                                            {ex.videoDemonstrativoUrl ? "VÍDEO" : "SEM VÍDEO"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}

                                  {!treino.exercicios?.length ? (
                                    <div className="text-sm text-slate-500">
                                      Esse treino não possui exercícios.
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                      {!treinosDisponiveis.treinosVinculados.length ? (
                        <div className="text-sm text-slate-500">
                          Nenhum treino vinculado encontrado.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
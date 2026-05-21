// client/src/pages/learning/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation} from "wouter";
import {
  Pencil,
  Trash2,
  Radio,
  CalendarClock,
  Users,
  PlayCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  listMetodologiasVisiveis,
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
  type LearningPermissaoCriacao,
  deleteMetodologia,
  deleteMetodologiaAvulsa,
} from "../../services/metodologias.js";
import LearningHeader from "../../components/learning/LearningHeader.js";
import LearningCard from "../../components/learning/LearningCard.js";
import { API } from "@/config.js";

type TabKey = "explorar" | "minhas" | "criar";

type LearningCriadasResponse = {
  items: any[];
  permissaoCriacao?: LearningPermissaoCriacao;
};

type AulaAoVivoResumo = {
  id: string;
  titulo: string;
  descricao?: string | null;
  status: "AGENDADA" | "AO_VIVO" | "FINALIZADA" | "CANCELADA";
  dataInicio: string;
  dataFim?: string | null;
  inscricaoInicio?: string | null;
  inscricaoFim?: string | null;
  thumbUrl?: string | null;
  chatAtivo?: boolean;
  gravacaoAtiva?: boolean;
  replayDisponivel?: boolean;
  totalParticipantes?: number | null;
  totalMensagens?: number | null;

  origemTipo?: "EVENTO_AVULSO" | "LEARNING" | "AVULSA";
  origemLabel?: string;
  preco?: number | null;
  precoLabel?: string | null;
  criadorNome?: string | null;

  criadorUsuario?: {
    id: string;
    nome?: string | null;
    foto?: string | null;
    tipo?: string | null;
    nomeDeUsuario?: string | null;
  } | null;

  metodologiaId?: string | null;
  metodologiaTitulo?: string | null;

  metodologia?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
    publicoAlvo?: string | null;
  } | null;

  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
    publicoAlvo?: string | null;
    precoAssinaturaMensal?: number | null;
  } | null;

  convidados?: Array<{
    id?: string;
    nome?: string | null;
    descricao?: string | null;
    usuario?: {
      id: string;
      nome?: string | null;
      foto?: string | null;
      tipo?: string | null;
      nomeDeUsuario?: string | null;
    } | null;
  }>;
};

const FALLBACK_PERMISSAO_CRIACAO: LearningPermissaoCriacao = {
  podeCriar: false,
  ehProfessorParceiro: false,
  temPlanoElegivel: false,
  planoPrincipal: null,
  motivoBloqueio:
    "Apenas professor, clube, escolinha ou admin podem criar metodologias.",
  planosPermitidos: [],
};

const FALLBACK_CRIADAS_RESPONSE: LearningCriadasResponse = {
  items: [],
  permissaoCriacao: FALLBACK_PERMISSAO_CRIACAO,
};

function getToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
}

async function listMinhasAulasAoVivo(): Promise<{ items: AulaAoVivoResumo[] }> {
  const token = getToken();

  const res = await fetch(`${API.BASE_URL}/api/aulas-ao-vivo/minhas`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Erro ao carregar aulas ao vivo.");
  }

  return {
    items: Array.isArray(json?.items) ? json.items : [],
  };
}

async function listEventosAoVivoVisiveis(): Promise<{ items: AulaAoVivoResumo[] }> {
  const token = getToken();

  const res = await fetch(`${API.BASE_URL}/api/metodologias/eventos-ao-vivo/visiveis`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.message || "Erro ao carregar eventos ao vivo.");
  }

  return {
    items: Array.isArray(json?.items) ? json.items : [],
  };
}

function formatarDataHoraLive(value?: string | null) {
  if (!value) return "Sem data definida";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLiveStatusInfo(status?: string) {
  const s = String(status || "").toUpperCase();

  if (s === "AO_VIVO") {
    return {
      label: "Ao vivo agora",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <Radio className="w-4 h-4" />,
      buttonLabel: "Voltar para live",
    };
  }

  if (s === "FINALIZADA") {
    return {
      label: "Finalizada",
      className: "bg-slate-100 text-slate-700 border-slate-200",
      icon: <CheckCircle2 className="w-4 h-4" />,
      buttonLabel: "Ver detalhes",
    };
  }

  if (s === "CANCELADA") {
    return {
      label: "Cancelada",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-4 h-4" />,
      buttonLabel: "Ver detalhes",
    };
  }

  return {
    label: "Agendada",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <CalendarClock className="w-4 h-4" />,
    buttonLabel: "Preparar transmissão",
  };
}

function normalizarTexto(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getEventoPublicoUrl(aula: AulaAoVivoResumo) {
  const texto = normalizarTexto(
    [
      aula?.titulo,
      aula?.descricao,
      aula?.metodologia?.titulo,
      aula?.metodologiaAvulsa?.titulo,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const deveUsarSalaCopa =
    texto.includes("sala copa") ||
    texto.includes("copa") ||
    texto.includes("copa do mundo") ||
    texto.includes("mundial");

  if (!deveUsarSalaCopa) {
    return `/learning/evento/${aula.id}`;
  }

  const origem = aula?.metodologiaAvulsa?.id ? "avulsa" : "learning";
  const metodologiaId =
    aula?.metodologiaAvulsa?.id ||
    aula?.metodologia?.id ||
    "";

  return `/learning/evento/sala-copa?aulaId=${aula.id}&origem=${origem}&metodologiaId=${metodologiaId}`;
}

function TabButton({
  active,
  children,
}: {
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`h-11 px-4 rounded-xl text-sm font-semibold flex items-center justify-center ${
        active
          ? "bg-[#216c43] text-white"
          : "bg-white border border-slate-200 text-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function EventoAoVivoExploreCard({
  aula,
  onVerEvento,
  onVerMetodologia,
}: {
  aula: AulaAoVivoResumo;
  onVerEvento: () => void;
  onVerMetodologia?: () => void;
}) {
  const statusInfo = getLiveStatusInfo(aula.status);
  const origemTipo = String(aula.origemTipo || "").toUpperCase();

  const origemBadge =
    origemTipo === "EVENTO_AVULSO"
      ? {
          label: "Evento avulso",
          className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        }
      : origemTipo === "AVULSA"
        ? {
            label: "Premium / Avulsa",
            className: "bg-purple-50 text-purple-700 border-purple-200",
          }
        : {
            label: "Metodologia",
            className: "bg-blue-50 text-blue-700 border-blue-200",
          };

  const imagem =
    aula.thumbUrl ||
    aula.metodologiaAvulsa?.capaUrl ||
    aula.metodologia?.capaUrl ||
    "/assets/usuarios/footera-logo-fundo-verde.png";

  const nomeMetodologia =
    aula.metodologiaAvulsa?.titulo ||
    aula.metodologia?.titulo ||
    aula.metodologiaTitulo ||
    "";

  const precoTexto =
    aula.precoLabel ||
    (origemTipo === "LEARNING"
      ? "Disponível via plano Learning"
      : "Preço não definido");

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        <div className="h-44 md:h-full min-h-[170px] overflow-hidden rounded-xl bg-emerald-950">
          <img
            src={imagem}
            alt={aula.titulo}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${statusInfo.className}`}
            >
              {statusInfo.icon}
              {statusInfo.label}
            </span>

            <span
              className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold ${origemBadge.className}`}
            >
              {origemBadge.label}
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-[#092f24] leading-tight">
            {aula.titulo}
          </h3>

          {aula.descricao ? (
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
              {aula.descricao}
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-emerald-700" />
              <span>{formatarDataHoraLive(aula.dataInicio)}</span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" />
              <span>
                Criador:{" "}
                <b>{aula.criadorNome || aula.criadorUsuario?.nome || "Creator FootEra"}</b>
              </span>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <div>
              <b>Acesso:</b> {precoTexto}
            </div>

            {nomeMetodologia ? (
              <div className="mt-1">
                <b>
                  {origemTipo === "AVULSA"
                    ? "Metodologia avulsa:"
                    : origemTipo === "LEARNING"
                      ? "Metodologia Learning:"
                      : "Conteúdo:"}
                </b>{" "}
                {nomeMetodologia}
              </div>
            ) : null}

            {origemTipo === "LEARNING" ? (
              <div className="mt-1 text-xs text-emerald-800">
                Para liberar, assine o plano Learning e escolha essa metodologia.
              </div>
            ) : null}

            {origemTipo === "AVULSA" ? (
              <div className="mt-1 text-xs text-emerald-800">
                Para liberar, compre essa metodologia avulsa.
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onVerEvento}
              className="rounded-xl bg-[#216c43] px-4 py-3 text-sm font-black text-white hover:bg-[#185333]"
            >
              Ver página do evento
            </button>

            {onVerMetodologia ? (
              <button
                type="button"
                onClick={onVerMetodologia}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                Ver metodologia
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LearningPage() {
  const [tab, setTab] = useState<TabKey>("explorar");
  const [loading, setLoading] = useState(true);
  const [explorar, setExplorar] = useState<any[]>([]);
  const [assinadas, setAssinadas] = useState<any[]>([]);
  const [criadas, setCriadas] = useState<any[]>([]);

  const [livesCriadas, setLivesCriadas] = useState<AulaAoVivoResumo[]>([]);
  const [eventosAoVivo, setEventosAoVivo] = useState<AulaAoVivoResumo[]>([]);

  const [buscaEvento, setBuscaEvento] = useState("");
  const [filtroOrigemEvento, setFiltroOrigemEvento] = useState<
    "TODOS" | "EVENTO_AVULSO" | "LEARNING" | "AVULSA"
  >("TODOS");
  const [filtroStatusEvento, setFiltroStatusEvento] = useState<
    "TODOS" | "AGENDADA" | "AO_VIVO" | "FINALIZADA"
  >("TODOS");

  const [filtroPublico, setFiltroPublico] = useState<
    "TODOS" | "AMBOS" | "PROFISSIONAIS" | "ATLETAS"
  >("TODOS");

  const [filtroEstrutura, setFiltroEstrutura] = useState<
    "TODOS" | "TRILHA" | "MODULO"
  >("TODOS");

  const [filtroCertificado, setFiltroCertificado] = useState<
    "TODOS" | "COM" | "SEM"
  >("TODOS");

  const [filtroBadge, setFiltroBadge] = useState<
    "TODOS" | "COM" | "SEM"
  >("TODOS");

  const [filtroMaterial, setFiltroMaterial] = useState<
    "TODOS" | "VIDEO" | "TREINO" | "MATERIAL"
  >("TODOS");

  const [filtroOrigem, setFiltroOrigem] = useState<
    "TODOS" | "LEARNING" | "AVULSA"
  >("TODOS");

  const [busca, setBusca] = useState("");
  const [, navigate] = useLocation();
  const [permissaoCriacao, setPermissaoCriacao] = useState<{
    podeCriar: boolean;
    ehProfessorParceiro?: boolean;
    temPlanoElegivel?: boolean;
    planoPrincipal?: string | null;
    motivoBloqueio?: string | null;
    planosPermitidos?: string[];
  }>({
    podeCriar: false,
    ehProfessorParceiro: false,
    temPlanoElegivel: false,
    planoPrincipal: null,
    motivoBloqueio: null,
    planosPermitidos: [],
  });

  const tipoUsuario =
    (localStorage.getItem("tipoUsuario") ||
        sessionStorage.getItem("tipoUsuario") ||
        "")
        .toLowerCase()
        .trim();

  const isAtleta = tipoUsuario === "atleta";
  const podeCriarMetodologia = !isAtleta && !!permissaoCriacao?.podeCriar;

  async function handleDeleteMetodologia(
    id: string,
    titulo?: string,
    origemRegistro?: "LEARNING" | "AVULSA"
  ) {
    const ok = window.confirm(
      `Tem certeza que deseja apagar a metodologia "${titulo || "sem título"}"?`
    );
    if (!ok) return;

    try {
      if (origemRegistro === "AVULSA") {
        await deleteMetodologiaAvulsa(id);
      } else {
        await deleteMetodologia(id);
      }

      setCriadas((prev) => prev.filter((item) => String(item.id) !== String(id)));
    } catch (e: any) {
      alert(e?.message || "Falha ao apagar metodologia.");
    }
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const promises = [
          listMetodologiasVisiveis(),
          listMinhasMetodologiasAssinadas(),
          isAtleta
            ? Promise.resolve(FALLBACK_CRIADAS_RESPONSE)
            : listMinhasMetodologiasCriadas(),
          isAtleta
            ? Promise.resolve({ items: [] })
            : listMinhasAulasAoVivo(),
          listEventosAoVivoVisiveis(),
        ] as const;

        const [visiveisRes, assinadasRes, criadasRes, livesRes, eventosRes] = await Promise.allSettled(promises);

        if (!mounted) return;

        setExplorar(
          visiveisRes.status === "fulfilled" ? visiveisRes.value?.items || [] : []
        );
        setAssinadas(
          assinadasRes.status === "fulfilled" ? assinadasRes.value?.items || [] : []
        );
        setCriadas(
          criadasRes.status === "fulfilled" ? criadasRes.value?.items || [] : []
        );
        setLivesCriadas(
          livesRes.status === "fulfilled" ? livesRes.value?.items || [] : []
        );
        setEventosAoVivo(
          eventosRes.status === "fulfilled" ? eventosRes.value?.items || [] : []
        );
        if (!isAtleta) {
          setPermissaoCriacao(
            criadasRes.status === "fulfilled"
              ? criadasRes.value?.permissaoCriacao || FALLBACK_PERMISSAO_CRIACAO
              : {
                  ...FALLBACK_PERMISSAO_CRIACAO,
                  motivoBloqueio:
                    "Não foi possível validar sua permissão de criação agora. Tente novamente.",
                }
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAtleta]);

  const minhasCount = useMemo(
    () => (isAtleta ? assinadas.length : assinadas.length + criadas.length),
    [isAtleta, assinadas, criadas]
  );

  const criadasLearning = useMemo(
    () => criadas.filter((item) => item?.origemRegistro === "LEARNING"),
    [criadas]
  );

  const criadasAvulsas = useMemo(
    () => criadas.filter((item) => item?.origemRegistro === "AVULSA"),
    [criadas]
  );

  const assinadasLearning = useMemo(
    () => assinadas.filter((item) => item?.origemRegistro === "LEARNING"),
    [assinadas]
  );

  const assinadasAvulsas = useMemo(
    () => assinadas.filter((item) => item?.origemRegistro === "AVULSA"),
    [assinadas]
  );

  const explorarFiltrado = useMemo(() => {
    let items = [...explorar];

    if (filtroOrigem !== "TODOS") {
      items = items.filter(
        (item) => String(item?.origemRegistro || "").toUpperCase() === filtroOrigem
      );
    }

    if (filtroPublico !== "TODOS") {
        items = items.filter((item) => String(item?.publicoAlvo || "").toUpperCase() === filtroPublico);
    }

    if (filtroEstrutura !== "TODOS") {
        items = items.filter((item) => String(item?.estruturaTipo || "").toUpperCase() === filtroEstrutura);
    }

    if (filtroCertificado === "COM") {
        items = items.filter((item) => !!item?.geraCertificado);
    }

    if (filtroCertificado === "SEM") {
        items = items.filter((item) => !item?.geraCertificado);
    }

    if (filtroBadge === "COM") {
        items = items.filter((item) => !!item?.geraBadge);
    }

    if (filtroBadge === "SEM") {
        items = items.filter((item) => !item?.geraBadge);
    }

    if (filtroMaterial === "VIDEO") {
        items = items.filter((item) => Number(item?.videoCount || 0) > 0);
    }

    if (filtroMaterial === "TREINO") {
        items = items.filter((item) => Number(item?.treinoCount || 0) > 0);
    }

    if (filtroMaterial === "MATERIAL") {
        items = items.filter((item) => Number(item?.materialCount || 0) > 0);
    }

    if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        items = items.filter((item) => {
        const titulo = String(item?.titulo || "").toLowerCase();
        const descricao = String(item?.descricao || "").toLowerCase();
        const area = String(item?.area || "").toLowerCase();
        return titulo.includes(q) || descricao.includes(q) || area.includes(q);
        });
    }

    return items;
    }, [
    explorar,
    filtroPublico,
    filtroEstrutura,
    filtroCertificado,
    filtroBadge,
    filtroMaterial,
    filtroOrigem,
    busca,
  ]);

  const explorarLearning = useMemo(
    () => explorarFiltrado.filter((item) => item?.origemRegistro === "LEARNING"),
    [explorarFiltrado]
  );

  const explorarAvulsas = useMemo(
    () => explorarFiltrado.filter((item) => item?.origemRegistro === "AVULSA"),
    [explorarFiltrado]
  );

  const eventosAoVivoFiltrados = useMemo(() => {
    let items = [...eventosAoVivo];

    if (filtroOrigemEvento !== "TODOS") {
      items = items.filter(
        (item) => String(item?.origemTipo || "").toUpperCase() === filtroOrigemEvento
      );
    }

    if (filtroStatusEvento !== "TODOS") {
      items = items.filter(
        (item) => String(item?.status || "").toUpperCase() === filtroStatusEvento
      );
    }

    if (buscaEvento.trim()) {
      const q = normalizarTexto(buscaEvento.trim());

      items = items.filter((item) => {
        const texto = normalizarTexto(
          [
            item.titulo,
            item.descricao,
            item.criadorNome,
            item.criadorUsuario?.nome,
            item.metodologia?.titulo,
            item.metodologiaAvulsa?.titulo,
            item.metodologiaTitulo,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return texto.includes(q);
      });
    }

    return items.sort((a, b) => {
      const da = new Date(a.dataInicio || 0).getTime();
      const db = new Date(b.dataInicio || 0).getTime();
      return da - db;
    });
  }, [eventosAoVivo, buscaEvento, filtroOrigemEvento, filtroStatusEvento]);

  function getOrigemEventoBadge(aula: AulaAoVivoResumo) {
    const tipo = String(aula.origemTipo || "").toUpperCase();

    if (tipo === "EVENTO_AVULSO") {
      return {
        label: "Evento avulso",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (tipo === "AVULSA") {
      return {
        label: "Premium / Avulsa",
        className: "bg-purple-50 text-purple-700 border-purple-200",
      };
    }

    return {
      label: "Metodologia",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  function getMetodologiaEventoHref(aula: AulaAoVivoResumo) {
    if (aula.metodologiaAvulsa?.id) {
      return `/learning/${aula.metodologiaAvulsa.id}?origem=avulsa`;
    }

    if (aula.metodologia?.id) {
      return `/learning/${aula.metodologia.id}`;
    }

    return "";
  }

  const totalLearningFiltrado = explorarLearning.length;
  const totalAvulsasFiltrado = explorarAvulsas.length;
  const totalEventosFiltrado = eventosAoVivoFiltrados.length;

  function pluralMetodologia(qtd: number) {
    return qtd === 1 ? "metodologia" : "metodologias";
  }

  function pluralEvento(qtd: number) {
    return qtd === 1 ? "evento" : "eventos";
  }

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-20">
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <LearningHeader
            title="Learning"
            subtitle={
                isAtleta
                ? "Explore e acompanhe metodologias disponíveis para assinatura."
                : "Explore, acompanhe e crie metodologias com trilhas ou módulos."
            }
            backHref="/treinos"
        />

        <div className={`grid ${isAtleta ? "grid-cols-2" : "grid-cols-3"} gap-3 mb-5`}>
        <button type="button" onClick={() => setTab("explorar")}>
            <TabButton active={tab === "explorar"}>Explorar</TabButton>
        </button>

        <button type="button" onClick={() => setTab("minhas")}>
            <TabButton active={tab === "minhas"}>Minhas</TabButton>
        </button>

        {!isAtleta && (
          <button
            type="button"
            onClick={() => {
              if (podeCriarMetodologia) {
                navigate("/learning/create");
              } else {
                setTab("criar");
              }
            }}
            className={!podeCriarMetodologia ? "opacity-50" : ""}
          >
            <TabButton active={tab === "criar"}>Criar</TabButton>
          </button>
        )}
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            Carregando Learning...
          </div>
        ) : null}

        {!loading && tab === "explorar" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-[#193b2e]">
                      Metodologias
                    </h2>
                    <p className="text-sm text-slate-500">
                      Filtre cursos, trilhas e metodologias avulsas disponíveis.
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {totalLearningFiltrado} Learning
                    </span>

                    <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {totalAvulsasFiltrado} Avulsas
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar metodologia por nome, descrição ou área"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                  />

                  <select
                    value={filtroPublico}
                    onChange={(e) =>
                      setFiltroPublico(
                        e.target.value as "TODOS" | "AMBOS" | "PROFISSIONAIS" | "ATLETAS"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Todos os públicos</option>
                    <option value="AMBOS">Ambos</option>
                    <option value="PROFISSIONAIS">Profissionais</option>
                    <option value="ATLETAS">Atletas</option>
                  </select>

                  <select
                    value={filtroEstrutura}
                    onChange={(e) =>
                      setFiltroEstrutura(e.target.value as "TODOS" | "TRILHA" | "MODULO")
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Todos os formatos</option>
                    <option value="TRILHA">Com trilhas</option>
                    <option value="MODULO">Com módulos</option>
                  </select>

                  <select
                    value={filtroCertificado}
                    onChange={(e) =>
                      setFiltroCertificado(e.target.value as "TODOS" | "COM" | "SEM")
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Com ou sem certificado</option>
                    <option value="COM">Com certificado</option>
                    <option value="SEM">Sem certificado</option>
                  </select>

                  <select
                    value={filtroBadge}
                    onChange={(e) =>
                      setFiltroBadge(e.target.value as "TODOS" | "COM" | "SEM")
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Com ou sem badge</option>
                    <option value="COM">Com badge</option>
                    <option value="SEM">Sem badge</option>
                  </select>

                  <select
                    value={filtroMaterial}
                    onChange={(e) =>
                      setFiltroMaterial(
                        e.target.value as "TODOS" | "VIDEO" | "TREINO" | "MATERIAL"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Todos os materiais</option>
                    <option value="VIDEO">Com vídeos/aulas</option>
                    <option value="TREINO">Com treinos</option>
                    <option value="MATERIAL">Com materiais</option>
                  </select>

                  <select
                    value={filtroOrigem}
                    onChange={(e) =>
                      setFiltroOrigem(e.target.value as "TODOS" | "LEARNING" | "AVULSA")
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white md:col-span-2"
                  >
                    <option value="TODOS">Todas as metodologias</option>
                    <option value="LEARNING">Só Learning</option>
                    <option value="AVULSA">Só Avulsas</option>
                  </select>
                </div>

                <div className="mt-3 flex sm:hidden flex-wrap items-center gap-2">
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {totalLearningFiltrado} Learning
                  </span>

                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {totalAvulsasFiltrado} Avulsas
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-extrabold text-[#193b2e]">
                      Eventos
                    </h2>
                    <p className="text-sm text-slate-500">
                      Filtre aulas ao vivo únicas, eventos de metodologia e eventos premium.
                    </p>
                  </div>

                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {totalEventosFiltrado} {pluralEvento(totalEventosFiltrado)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={buscaEvento}
                    onChange={(e) => setBuscaEvento(e.target.value)}
                    placeholder="Buscar evento, criador ou metodologia"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
                  />

                  <select
                    value={filtroOrigemEvento}
                    onChange={(e) =>
                      setFiltroOrigemEvento(
                        e.target.value as "TODOS" | "EVENTO_AVULSO" | "LEARNING" | "AVULSA"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Todos os eventos ao vivo</option>
                    <option value="EVENTO_AVULSO">Só evento único</option>
                    <option value="LEARNING">Só eventos de metodologia Learning</option>
                    <option value="AVULSA">Só eventos premium/avulsa</option>
                  </select>

                  <select
                    value={filtroStatusEvento}
                    onChange={(e) =>
                      setFiltroStatusEvento(
                        e.target.value as "TODOS" | "AGENDADA" | "AO_VIVO" | "FINALIZADA"
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                  >
                    <option value="TODOS">Todos os status</option>
                    <option value="AGENDADA">Agendados</option>
                    <option value="AO_VIVO">Ao vivo agora</option>
                    <option value="FINALIZADA">Finalizados / replay</option>
                  </select>
                </div>
              </div>
            </div>

            {explorarFiltrado.length || eventosAoVivoFiltrados.length ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-bold text-[#193b2e]">
                        Eventos ao vivo
                      </div>
                      <p className="text-sm text-slate-500">
                        Aulas ao vivo únicas, eventos de metodologias e eventos premium/avulsos.
                      </p>
                    </div>

                    <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {totalEventosFiltrado} {pluralEvento(totalEventosFiltrado)}
                    </span>
                  </div>

                  {eventosAoVivoFiltrados.length ? (
                    eventosAoVivoFiltrados.map((aula) => {
                      const metodologiaHref = getMetodologiaEventoHref(aula);

                      return (
                        <EventoAoVivoExploreCard
                          key={`evento_live_${aula.id}`}
                          aula={aula}
                          onVerEvento={() => navigate(getEventoPublicoUrl(aula))}
                          onVerMetodologia={
                            metodologiaHref
                              ? () => navigate(metodologiaHref)
                              : undefined
                          }
                        />
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border bg-white p-6 text-slate-600">
                      Nenhum evento ao vivo encontrado com esses filtros.
                    </div>
                  )}
                </div>
                {(filtroOrigem === "TODOS" || filtroOrigem === "LEARNING") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-bold text-[#193b2e]">Learning</div>

                      <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        {totalLearningFiltrado} {pluralMetodologia(totalLearningFiltrado)}
                      </span>
                    </div>

                    {explorarLearning.length ? (
                      explorarLearning.map((item) => (
                        <LearningCard
                          key={`learning_${item.id}`}
                          item={item}
                          href={`/learning/${item.id}`}
                          actionLabel="Ver metodologia"
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border bg-white p-6 text-slate-600">
                        Nenhuma metodologia Learning encontrada.
                      </div>
                    )}
                  </div>
                )}

                {(filtroOrigem === "TODOS" || filtroOrigem === "AVULSA") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-base font-bold text-[#193b2e]">Avulsas</div>

                      <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold text-slate-600">
                        {totalAvulsasFiltrado} {pluralMetodologia(totalAvulsasFiltrado)}
                      </span>
                    </div>
                    {explorarAvulsas.length ? (
                      explorarAvulsas.map((item) => (
                        <LearningCard
                          key={`avulsa_${item.id}`}
                          item={item}
                          href={`/learning/${item.id}?origem=avulsa`}
                          actionLabel="Ver metodologia"
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border bg-white p-6 text-slate-600">
                        Nenhuma metodologia avulsa encontrada.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-6 text-slate-600">
                Nenhuma metodologia ou evento ao vivo encontrado com os filtros selecionados.
              </div>
            )}
          </div>
        ) : null}

        {!loading && tab === "minhas" ? (
          <div className="space-y-5">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="text-lg font-extrabold text-[#193b2e]">Minhas metodologias</div>
              <div className="text-sm text-slate-500 mt-1">
                  {minhasCount} metodologias relacionadas à sua conta.
              </div>

              <div className="mt-4 flex flex-wrap gap-3">   
                  {!isAtleta && (
                    <button
                      type="button"
                      onClick={() => {
                        if (podeCriarMetodologia) {
                          navigate("/learning/create");
                        } else {
                          setTab("criar");
                        }
                      }}
                      className={`inline-flex h-10 px-4 rounded-xl font-semibold items-center ${
                        podeCriarMetodologia
                          ? "bg-[#216c43] text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Criar nova metodologia
                    </button>
                  )}
              </div>
              </div>
              <div>
                {!isAtleta && (
                  <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-3">
                      <div>
                        <div className="text-base font-bold text-[#193b2e]">
                          Próximas aulas ao vivo
                        </div>
                        <div className="text-sm text-slate-500">
                          Acompanhe e inicie as transmissões programadas nas suas metodologias.
                        </div>
                      </div>

                      <div className="text-sm text-slate-500">
                        {livesCriadas.length} {livesCriadas.length === 1 ? "live encontrada" : "lives encontradas"}
                      </div>
                    </div>

                    {livesCriadas.length ? (
                      <div className="space-y-3">
                        {livesCriadas.map((aula) => {
                          const statusInfo = getLiveStatusInfo(aula.status);
                          const metodologiaTitulo =
                            aula.metodologia?.titulo ||
                            aula.metodologiaAvulsa?.titulo ||
                            "Metodologia";

                          const capa =
                            aula.metodologia?.capaUrl ||
                            aula.metodologiaAvulsa?.capaUrl ||
                            "/assets/usuarios/footera-logo.png";

                          const eventoUrl = getEventoPublicoUrl(aula);
                            
                          return (
                            <div
                              key={`live_${aula.id}`}
                              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                            >
                              <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                                <div className="flex gap-4 min-w-0">
                                  <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[#073b25] border border-slate-200 shrink-0">
                                    <img
                                      src={capa}
                                      alt={metodologiaTitulo}
                                      className="h-full w-full object-cover"
                                      onError={(e) => {
                                        e.currentTarget.src = "/assets/usuarios/footera-logo.png";
                                      }}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      <span
                                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${statusInfo.className}`}
                                      >
                                        {statusInfo.icon}
                                        {statusInfo.label}
                                      </span>

                                      {aula.gravacaoAtiva ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                          <PlayCircle className="w-4 h-4" />
                                          Gravação ativa
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="text-lg font-extrabold text-slate-900 truncate">
                                      {aula.titulo}
                                    </div>

                                    <div className="text-sm text-slate-500 truncate">
                                      {metodologiaTitulo}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                                      <span className="inline-flex items-center gap-1.5">
                                        <CalendarClock className="w-4 h-4 text-[#216c43]" />
                                        {formatarDataHoraLive(aula.dataInicio)}
                                      </span>

                                      <span className="inline-flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-[#216c43]" />
                                        {aula.totalParticipantes || 0} participantes
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/learning/live-studio?aulaId=${aula.id}`)}
                                    className={`inline-flex h-11 px-4 rounded-xl font-semibold items-center justify-center ${
                                      aula.status === "AO_VIVO"
                                        ? "bg-red-600 text-white"
                                        : "bg-[#216c43] text-white"
                                    }`}
                                  >
                                    {statusInfo.buttonLabel}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => navigate(eventoUrl)}
                                    className="inline-flex h-11 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold items-center justify-center"
                                  >
                                    Ver página do evento
                                  </button>

                                  {(aula.metodologia?.id || aula.metodologiaAvulsa?.id) ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (aula.metodologiaAvulsa?.id) {
                                          navigate(`/learning/${aula.metodologiaAvulsa.id}?origem=avulsa`);
                                          return;
                                        }

                                        if (aula.metodologia?.id) {
                                          navigate(`/learning/${aula.metodologia.id}`);
                                        }
                                      }}
                                      className="inline-flex h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold items-center justify-center"
                                    >
                                      Ver metodologia
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border bg-white p-6 text-slate-600">
                        Você ainda não possui aulas ao vivo programadas.
                      </div>
                    )}
                  </div>
                )}

                {!isAtleta && (
                  <div>
                    <div className="text-base font-bold text-[#193b2e] mb-3">Criadas • Learning</div>
                      <div className="space-y-4">
                        {criadasLearning.length ? (
                          criadasLearning.map((item: any) => (
                            <LearningCard
                              key={`cr_learning_${item.id}`}
                              item={item}
                              href={`/learning/${item.id}`}
                              extraActions={
                                <>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/learning/${item.id}`)}
                                    className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
                                  >
                                    Gerenciar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(`/learning/create?id=${item.id}&tipo=${item.tipo}&origem=learning`)
                                    }
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 h-10 text-slate-700"
                                    title="Editar metodologia"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMetodologia(item.id, item.titulo, item.origemRegistro)}
                                    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 h-10 text-red-600"
                                    title="Apagar metodologia"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-2xl border bg-white p-6 text-slate-600">
                            Você ainda não criou nenhuma metodologia Learning.
                          </div>
                        )}
                      </div>

                      <div className="text-base font-bold text-[#193b2e] mb-3 mt-6">Criadas • Avulsas</div>
                      <div className="space-y-4">
                        {criadasAvulsas.length ? (
                          criadasAvulsas.map((item: any) => (
                            <LearningCard
                              key={`cr_avulsa_${item.id}`}
                              item={item}
                              href={`/learning/${item.id}?origem=avulsa`}
                              extraActions={
                                <>
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/learning/${item.id}?origem=avulsa`)}
                                    className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
                                  >
                                    Gerenciar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(`/learning/create?id=${item.id}&tipo=${item.tipo}&origem=avulsa`)
                                    }
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 h-10 text-slate-700"
                                    title="Editar metodologia avulsa"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMetodologia(item.id, item.titulo, item.origemRegistro)}
                                    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 h-10 text-red-600"
                                    title="Apagar metodologia avulsa"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              }
                            />
                          ))
                        ) : (
                          <div className="rounded-2xl border bg-white p-6 text-slate-600">
                            Você ainda não criou nenhuma metodologia avulsa.
                          </div>
                        )}
                      </div>
                  </div>
                )}
              </div>
            <div className="text-base font-bold text-[#193b2e] mb-3">Assinadas • Learning</div>
              <div className="space-y-4">
                {assinadasLearning.length ? (
                  assinadasLearning.map((item: any) => (
                    <LearningCard
                      key={`ass_learning_${item.id}`}
                      item={item}
                      href={`/learning/${item.id}`}
                      actionLabel={
                        String(item?.status || "").toUpperCase() === "CONCLUIDA" || !!item?.concluiuEm
                          ? "Ver conclusão"
                          : "Continuar"
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border bg-white p-6 text-slate-600">
                    Você ainda não assinou nenhuma metodologia Learning.
                  </div>
                )}
              </div>

              <div className="text-base font-bold text-[#193b2e] mb-3 mt-6">Assinadas • Avulsas</div>
              <div className="space-y-4">
                {assinadasAvulsas.length ? (
                  assinadasAvulsas.map((item: any) => (
                    <LearningCard
                      key={`ass_avulsa_${item.id}`}
                      item={item}
                      href={`/learning/${item.id}?origem=avulsa`}
                      actionLabel={
                        String(item?.status || "").toUpperCase() === "CONCLUIDA" || !!item?.concluiuEm
                          ? "Ver conclusão"
                          : "Continuar"
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border bg-white p-6 text-slate-600">
                    Você ainda não assinou nenhuma metodologia avulsa.
                  </div>
                )}
              </div>
          </div>
        ) : null}
        {!loading && tab === "criar" ? (
          podeCriarMetodologia ? (
            (() => {
              navigate("/learning/create");
              return null;
            })()
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="text-lg font-extrabold text-[#193b2e]">
                  Criação de metodologia bloqueada
                </div>
                <div className="text-sm text-slate-600 mt-2">
                  {permissaoCriacao?.motivoBloqueio ||
                    "Apenas professor, clube, escolinha ou admin podem criar metodologias."}
                </div>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
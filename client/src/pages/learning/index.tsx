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
  chatAtivo?: boolean;
  gravacaoAtiva?: boolean;
  replayDisponivel?: boolean;
  totalParticipantes?: number | null;
  totalMensagens?: number | null;
  metodologia?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
  } | null;
  metodologiaAvulsa?: {
    id: string;
    titulo: string;
    capaUrl?: string | null;
  } | null;
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

function formatarDataHoraLive(value?: string | null) {
  if (!value) return "Sem data definida";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
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

export default function LearningPage() {
  const [tab, setTab] = useState<TabKey>("explorar");
  const [loading, setLoading] = useState(true);
  const [explorar, setExplorar] = useState<any[]>([]);
  const [assinadas, setAssinadas] = useState<any[]>([]);
  const [criadas, setCriadas] = useState<any[]>([]);

  const [livesCriadas, setLivesCriadas] = useState<AulaAoVivoResumo[]>([]);

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
        ] as const;

        const [visiveisRes, assinadasRes, criadasRes, livesRes] = await Promise.allSettled(promises);

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
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por nome, descrição ou área"
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
                          className="w-full rounded-xl border border-slate-300 px-4 py-3 bg-white"
                        >
                          <option value="TODOS">Todas as metodologias</option>
                          <option value="LEARNING">Só Learning</option>
                          <option value="AVULSA">Só Avulsas</option>
                        </select>
                    </div>
                  </div>

            {explorarFiltrado.length ? (
              <div className="space-y-6">
                {(filtroOrigem === "TODOS" || filtroOrigem === "LEARNING") && (
                  <div className="space-y-4">
                    <div className="text-base font-bold text-[#193b2e]">Learning</div>

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
                    <div className="text-base font-bold text-[#193b2e]">Avulsas</div>

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
                Nenhuma metodologia encontrada com os filtros selecionados.
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
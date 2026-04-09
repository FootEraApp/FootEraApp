// client/src/pages/learning/index.tsx
import { useEffect, useMemo, useState } from "react";
import { useLocation} from "wouter";
import { Pencil, Trash2 } from "lucide-react";
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

type TabKey = "explorar" | "minhas" | "criar";

type LearningCriadasResponse = {
  items: any[];
  permissaoCriacao?: LearningPermissaoCriacao;
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
        ] as const;

        const [visiveisRes, assinadasRes, criadasRes] = await Promise.allSettled(promises);

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
                                      navigate(
                                        `/learning/create?id=${item.id}&tipo=${item.tipo}&origem=${
                                          item.origemRegistro === "AVULSA" ? "avulsa" : "learning"
                                        }`
                                      )
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
                      actionLabel="Continuar"
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
                      actionLabel="Continuar"
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
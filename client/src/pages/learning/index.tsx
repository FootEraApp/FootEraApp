// client/src/pages/learning/index.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation} from "wouter";
import {
  listMetodologiasVisiveis,
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
} from "../../services/metodologias.js";
import LearningHeader from "../../components/learning/LearningHeader.js";
import LearningCard from "../../components/learning/LearningCard.js";

type TabKey = "explorar" | "minhas" | "criar";

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

  const [filtroMaterial, setFiltroMaterial] = useState<
    "TODOS" | "VIDEO" | "TREINO" | "MATERIAL"
  >("TODOS");

  const [busca, setBusca] = useState("");
  const [, navigate] = useLocation();

  const tipoUsuario =
    (localStorage.getItem("tipoUsuario") ||
        sessionStorage.getItem("tipoUsuario") ||
        "")
        .toLowerCase()
        .trim();

  const isAtleta = tipoUsuario === "atleta";
  const isInstrutor = ["professor", "clube", "escolinha", "escola", "admin"].includes(tipoUsuario);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const promises = [
            listMetodologiasVisiveis(),
            listMinhasMetodologiasAssinadas(),
            isAtleta ? Promise.resolve({ items: [] }) : listMinhasMetodologiasCriadas(),
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

  const explorarFiltrado = useMemo(() => {
    let items = [...explorar];

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
    filtroMaterial,
    busca,
    ]);

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
                onClick={() => navigate("/learning/create")}
            >
                <TabButton active={false}>Criar</TabButton>
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
                    </div>
                  </div>

            {explorarFiltrado.length ? (
              explorarFiltrado.map((item) => (
                <LearningCard
                  key={item.id}
                  item={item}
                  href={`/learning/${item.id}`}
                  actionLabel="Ver metodologia"
                />
              ))
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
                <Link
                    href="/learning/create"
                    className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
                >
                    Criar nova metodologia
                </Link>
                )}
            </div>
            </div>
            <div>
        
            {!isAtleta && (
            <div>
                <div className="text-base font-bold text-[#193b2e] mb-3">Criadas</div>
                <div className="space-y-4">
                {criadas.length ? (
                    criadas.map((item) => (
                    <LearningCard
                        key={`cri_${item.id}`}
                        item={item}
                        href={`/learning/${item.id}`}
                        actionLabel="Gerenciar"
                    />
                    ))
                ) : (
                    <div className="rounded-2xl border bg-white p-6 text-slate-600">
                    Você ainda não criou nenhuma metodologia.
                    </div>
                )}
                </div>
            </div>
            )}
        </div>
        <div className="text-base font-bold text-[#193b2e] mb-3">Assinadas</div>
                <div className="space-y-4">
                    {assinadas.length ? (
                    assinadas.map((item) => (
                        <LearningCard
                        key={`ass_${item.id}`}
                        item={item}
                        href={`/learning/${item.id}`}
                        actionLabel="Continuar"
                        />
                    ))
                    ) : (
                    <div className="rounded-2xl border bg-white p-6 text-slate-600">
                        Você ainda não assinou nenhuma metodologia.
                    </div>
                    )}
                </div>
            </div>
        ) : null}
      </div>
    </div>
  );
}
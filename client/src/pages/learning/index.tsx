// client/src/pages/learning/index.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation} from "wouter";
import { Sparkles } from "lucide-react";
import {
  listMetodologiasVisiveis,
  listMinhasMetodologiasAssinadas,
  listMinhasMetodologiasCriadas,
} from "../../services/metodologias.js";
import LearningHeader from "../../components/learning/LearningHeader.js";
import LearningCard from "../../components/learning/LearningCard.js";
import LearningTypeChooser from "../../components/learning/LearningTypeChooser.js";

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
  const [, navigate] = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const [visiveisRes, assinadasRes, criadasRes] = await Promise.allSettled([
          listMetodologiasVisiveis(),
          listMinhasMetodologiasAssinadas(),
          listMinhasMetodologiasCriadas(),
        ]);

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
  }, []);

  const minhasCount = useMemo(() => assinadas.length + criadas.length, [assinadas, criadas]);

  return (
    <div className="min-h-screen bg-[#f7f7f4] pb-20">
      <div className="max-w-6xl mx-auto px-4 pt-5">
        <LearningHeader
            title="Learning"
            subtitle="Explore, acompanhe e crie metodologias com trilhas ou módulos."
            backHref="/treinos"
            createHref="/learning/create"
            createLabel="Criar"
        />

        <div className="grid grid-cols-3 gap-3 mb-5">
          <button type="button" onClick={() => setTab("explorar")}>
            <TabButton active={tab === "explorar"}>Explorar</TabButton>
          </button>

          <button type="button" onClick={() => setTab("minhas")}>
            <TabButton active={tab === "minhas"}>Minhas</TabButton>
          </button>

          <button type="button" onClick={() => setTab("criar")}>
            <TabButton active={tab === "criar"}>Criar</TabButton>
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            Carregando Learning...
          </div>
        ) : null}

        {!loading && tab === "explorar" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[#216c43]" />
                <div>
                  <div className="text-lg font-extrabold text-[#193b2e]">
                    Explore metodologias
                  </div>
                  <div className="text-sm text-slate-500">
                    Veja trilhas de treino e cursos disponíveis para assinatura.
                  </div>
                </div>
              </div>
            </div>

            {explorar.length ? (
              explorar.map((item) => (
                <LearningCard
                  key={item.id}
                  item={item}
                  href={`/learning/${item.id}`}
                  actionLabel="Ver metodologia"
                />
              ))
            ) : (
              <div className="rounded-2xl border bg-white p-6 text-slate-600">
                Nenhuma metodologia visível no momento.
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
                <Link
                  href="/learning/minhas"
                  className="inline-flex h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold items-center"
                >
                  Abrir página completa
                </Link>

                <Link
                  href="/learning/create"
                  className="inline-flex h-10 px-4 rounded-xl bg-[#216c43] text-white font-semibold items-center"
                >
                  Criar nova
                </Link>
              </div>
            </div>

            <div>
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
          </div>
        ) : null}

        {!loading && tab === "criar" ? (
            <LearningTypeChooser
                onChoose={(tipo, estrutura) => {
                if (tipo === "TRILHAS_TREINO" && estrutura === "TRILHA") {
                    navigate("/learning/create?tipo=TRILHAS_TREINO");
                    return;
                }

                navigate("/learning/create?tipo=CURSO_FORMACAO");
                }}
            />
        ) : null}
      </div>
    </div>
  );
}
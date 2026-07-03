import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  BadgeCheck,
  BookOpen,
  Coins,
  DollarSign,
  Eye,
  TrendingUp,
  Users,
} from "lucide-react";
import CreatorCard from "../../components/CreatorCard";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const token = () =>
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type DashboardData = {
  creator: any;
  resumo: {
    comissaoFootera: number;
    percentualCreator: number;
    receitaTotal: number;
    valorCreatorTotal: number;
    valorFooteraTotal: number;
    receitaMes: number;
    valorCreatorMes: number;
    valorFooteraMes: number;
    totalVendas: number;
    totalVendasMes: number;
    totalConteudos: number;
    totalAlunos: number;
  };
  conteudos: any[];
  vendas: any[];
};

export default function CreatorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ativando, setAtivando] = useState(false);

  const tipoUsuario =
    localStorage.getItem("tipoUsuario") ||
    sessionStorage.getItem("tipoUsuario") ||
    localStorage.getItem("usuarioTipoRaw") ||
    sessionStorage.getItem("usuarioTipoRaw") ||
    "";

  const tipoNorm = String(tipoUsuario).toLowerCase();
  const bloqueiaCreator = tipoNorm === "atleta" || tipoNorm === "learning";
  
  const carregar = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/creator/dashboard`, {
        headers: { Authorization: `Bearer ${token()}` },
      });

      if (res.status === 404) {
        setData(null);
        return;
      }

      if (!res.ok) throw new Error("Erro ao carregar dashboard.");

      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const ativarCreator = async () => {
    setAtivando(true);

    try {
      const res = await fetch(`${API}/api/creator/ativar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
            headline: "Creator FootEra",
        }),
      });

      if (!res.ok) throw new Error("Erro ao ativar Creator.");

      await carregar();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível ativar o Creator.");
    } finally {
      setAtivando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  if (bloqueiaCreator) {
    return (
        <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center p-6">
        <div className="max-w-lg bg-white rounded-2xl border shadow-sm p-6 text-center">
            <h1 className="font-extrabold text-2xl text-emerald-950">
            Creator indisponível
            </h1>
            <p className="text-slate-500 mt-2">
            Perfis de atleta não podem ativar ou acessar o painel Creator.
            </p>
            <button
            type="button"
            onClick={() => (window.location.href = "/perfil")}
            className="mt-5 bg-emerald-600 text-white font-bold rounded-xl px-5 py-3"
            >
            Voltar ao perfil
            </button>
        </div>
        </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center">
        <div className="font-semibold text-emerald-900">Carregando dashboard Creator...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f5f7f3] flex items-center justify-center p-6">
        <div className="max-w-lg bg-white rounded-2xl border shadow-sm p-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
            <BadgeCheck />
          </div>

          <h1 className="font-extrabold text-2xl text-emerald-950">
            Ative seu perfil Creator
          </h1>

          <p className="text-slate-500 mt-2">
            O Creator libera página pública, painel de ganhos, métricas de vendas e conteúdos publicados no Learning.
          </p>

          <button
            onClick={ativarCreator}
            disabled={ativando}
            className="mt-5 bg-emerald-600 text-white font-bold rounded-xl px-5 py-3 disabled:opacity-60"
          >
            {ativando ? "Ativando..." : "Ativar Creator"}
          </button>
        </div>
      </div>
    );
  }

  const { resumo, conteudos, vendas, creator } = data;

  return (
    <div className="min-h-screen bg-[#f5f7f3]">
      <header className="bg-[#163d29] text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-emerald-200 text-xs uppercase tracking-widest font-bold">
            Painel Creator
          </p>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-2">
            <div>
              <h1 className="text-3xl font-extrabold">
                {creator.nomePublico || creator.usuario?.nome || "Creator"}
              </h1>
              <p className="text-white/60 mt-1">
                Acompanhe vendas, repasses e desempenho dos conteúdos.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[320px]">
              <a
                href={`/creator/profile?id=${creator.usuarioId}`}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold hover:bg-white/15 text-left flex items-center justify-start"
              >
                Ver perfil público
              </a>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/creator/eventos";
                }}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold hover:bg-white/15 text-left flex items-center justify-start"
              >
                Gerenciar eventos, lives e webinars
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="grid md:grid-cols-4 gap-4">
          <Stat icon={<DollarSign />} title="Receita do mês" value={money(resumo.receitaMes)} />
          <Stat icon={<Coins />} title="Seu repasse mês" value={money(resumo.valorCreatorMes)} />
          <Stat icon={<TrendingUp />} title="Vendas mês" value={String(resumo.totalVendasMes)} />
          <Stat icon={<Users />} title="Usuários assinantes" value={String(resumo.totalAlunos)} />
        </section>

        <section className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-5">
            <h2 className="font-bold text-emerald-950 mb-4">Resumo financeiro</h2>

            <div className="space-y-3">
              <Line label="Receita bruta total" value={money(resumo.receitaTotal)} />
              <Line label="Repasse total Creator" value={money(resumo.valorCreatorTotal)} />
              <Line label="Comissão total FootEra" value={money(resumo.valorFooteraTotal)} />
              <Line label="Comissão FootEra" value={`${Math.round(resumo.comissaoFootera * 100)}%`} />
              <Line label="Percentual Creator" value={`${Math.round(resumo.percentualCreator * 100)}%`} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h2 className="font-bold text-emerald-950 mb-4">Impacto</h2>

            <div className="grid grid-cols-2 gap-3">
              <Mini icon={<BookOpen />} label="Conteúdos" value={resumo.totalConteudos} />
              <Mini icon={<TrendingUp />} label="Vendas" value={resumo.totalVendas} />
              <Mini icon={<Users />} label="Alunos" value={resumo.totalAlunos} />
              <Mini icon={<Eye />} label="Views estimadas" value={resumo.totalVendas * 120} />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-emerald-950 text-xl">Seus conteúdos</h2>
            <a href="/learning/create" className="text-sm font-bold text-emerald-700">
              Criar conteúdo
            </a>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conteudos.map((item) => (
                <CreatorCard
                    key={`${item.origem}-${item.id}`}
                    {...item}
                    onClick={() => {
                    const origem = item.origem === "PREMIUM" ? "avulsa" : "learning";
                    window.location.href = `/learning/${item.id}?origem=${origem}`;
                    }}
                />
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-bold text-emerald-950">Últimas vendas</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left p-3">Conteúdo</th>
                  <th className="text-left p-3">Aluno</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Creator</th>
                  <th className="text-left p-3">FootEra</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {vendas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-5 text-center text-slate-500">
                      Nenhuma venda registrada ainda.
                    </td>
                  </tr>
                ) : (
                  vendas.map((venda) => {
                    const conteudo =
                      venda.metodologia?.titulo ||
                      venda.metodologiaAvulsa?.titulo ||
                      "Conteúdo Creator";

                    return (
                      <tr key={venda.id} className="border-t">
                        <td className="p-3 font-semibold text-slate-800">{conteudo}</td>
                        <td className="p-3 text-slate-500">
                          {venda.comprador?.nome || "Aluno"}
                        </td>
                        <td className="p-3">{money(Number(venda.valorBruto))}</td>
                        <td className="p-3 text-emerald-700 font-bold">
                          {money(Number(venda.valorCreator))}
                        </td>
                        <td className="p-3 text-slate-500">
                          {money(Number(venda.valorFootera))}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                            {venda.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <div className="text-emerald-600 mb-3 [&_svg]:w-5 [&_svg]:h-5">{icon}</div>
      <div className="text-2xl font-extrabold text-emerald-950">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
    </div>
  );
}

function Mini({ icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-[#f5f7f3] rounded-xl p-4">
      <div className="text-emerald-600 [&_svg]:w-4 [&_svg]:h-4">{icon}</div>
      <div className="font-extrabold text-emerald-950 mt-1">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-3">
      <span className="text-slate-500">{label}</span>
      <strong className="text-emerald-900">{value}</strong>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import { Activity, CalendarClock, Users, Trophy } from "lucide-react";

type Props = {
  ownerTipo: "Clube" | "Escolinha";
  ownerId: string;
};

type DashboardResp = {
  kpis: {
    treinosLancadosTotal: number;
    treinosLancadosMes: number;
    agendamentosMes: number;
    concluidosMes: number;
    alunosAtivos30d: number;
    taxaConclusaoMes: number; // 0..100
  };
  historicoPorMes: Array<{ mes: string; lancados: number; concluidos: number; agendados: number }>;
  topFrequencia: Array<{ atletaId: string; nome: string; foto?: string | null; presencasMes: number }>;
  porTurma?: Array<{ turmaId: string; nome: string; alunos: number; presencasMes: number }>;
};

function CardKpi({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="bg-white/80 rounded-2xl border border-green-100 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-green-700" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-green-900/70">{label}</div>
          <div className="text-xl font-bold text-green-900">{value}</div>
          {sub ? <div className="text-xs text-green-900/60 mt-1">{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function DashboardOrganizacao({ ownerTipo, ownerId }: Props) {
  const token = Storage.token;
  const headers = token
  ? {
      Authorization: `Bearer ${token}`,
      "x-tipo-usuario": String(Storage.tipoSalvo || "").toLowerCase(), // garante "clube" | "escolinha" | "admin"
      "x-tipo-usuario-id": String(Storage.tipoUsuarioId || ""),        // garante string
    }
  : undefined;
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoAtual);
  const [data, setData] = useState<DashboardResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!token || !ownerId) return;

    let cancel = false;
    (async () => {
      setLoading(true);
      setErro("");
      try {
        const r = await axios.get(`${API.BASE_URL}/api/dashboard/organizacao`, {
          headers,
          params: { ownerTipo, ownerId, ano },
        });
        if (!cancel) setData(r.data);
      } catch (e: any) {
        if (!cancel) setErro(e?.response?.data?.message || "Não foi possível carregar o dashboard.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, [token, ownerTipo, ownerId, ano]);

  const anosOptions = useMemo(() => {
    const arr: number[] = [];
    for (let y = anoAtual; y >= anoAtual - 5; y--) arr.push(y);
    return arr;
  }, [anoAtual]);

  if (loading) return <div className="text-sm text-green-900/70">Carregando dashboard…</div>;
  if (erro) return <div className="text-sm text-red-600">{erro}</div>;
  if (!data) return <div className="text-sm text-green-900/70">Sem dados.</div>;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-green-900">Dashboard</div>
          <div className="text-sm text-green-900/70">
            Métricas internas de treinos e presença ({ownerTipo})
          </div>
        </div>

        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
        >
          {anosOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CardKpi icon={Activity} label="Treinos lançados (total)" value={data.kpis.treinosLancadosTotal} />
        <CardKpi icon={CalendarClock} label="Treinos lançados (mês)" value={data.kpis.treinosLancadosMes} />
        <CardKpi icon={Users} label="Alunos ativos (30d)" value={data.kpis.alunosAtivos30d} />
        <CardKpi icon={CalendarClock} label="Agendamentos (mês)" value={data.kpis.agendamentosMes} />
        <CardKpi icon={Trophy} label="Concluídos (mês)" value={data.kpis.concluidosMes} />
        <CardKpi
          icon={Trophy}
          label="Taxa de conclusão (mês)"
          value={`${data.kpis.taxaConclusaoMes.toFixed(0)}%`}
        />
      </div>

      <div className="bg-white/80 rounded-2xl border border-green-100 shadow-sm p-4">
        <div className="font-semibold text-green-900 mb-2">Histórico por mês</div>
        <div className="grid gap-2">
          {data.historicoPorMes.map((m) => (
            <div key={m.mes} className="flex items-center justify-between text-sm border-b border-green-50 py-2">
              <div className="text-green-900 font-medium">{m.mes}</div>
              <div className="text-green-900/80">
                Lançados: <b>{m.lancados}</b> • Agendados: <b>{m.agendados}</b> • Concluídos: <b>{m.concluidos}</b>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/80 rounded-2xl border border-green-100 shadow-sm p-4">
        <div className="font-semibold text-green-900 mb-2">Top frequência do mês</div>
        {data.topFrequencia.length ? (
          <ul className="grid gap-2">
            {data.topFrequencia.slice(0, 10).map((a) => (
              <li key={a.atletaId} className="flex items-center justify-between border border-green-50 rounded-xl p-3">
                <div className="text-sm text-green-900 font-medium">{a.nome}</div>
                <div className="text-sm text-green-900/80">{a.presencasMes} presenças</div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-green-900/70">Sem presença registrada no mês.</div>
        )}
      </div>

      {data.porTurma?.length ? (
        <div className="bg-white/80 rounded-2xl border border-green-100 shadow-sm p-4">
          <div className="font-semibold text-green-900 mb-2">Presença por turma (mês)</div>
          <ul className="grid gap-2">
            {data.porTurma.map((t) => (
              <li key={t.turmaId} className="flex items-center justify-between border border-green-50 rounded-xl p-3">
                <div className="text-sm text-green-900 font-medium">{t.nome}</div>
                <div className="text-sm text-green-900/80">
                  {t.alunos} alunos • {t.presencasMes} presenças
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
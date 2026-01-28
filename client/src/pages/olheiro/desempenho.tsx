import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { ArrowLeft } from "lucide-react";

const COLORS = ["#22c55e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6"];

type Serie = { label: string; value: number };
type Dia = { dia: string; curtidas: number; comentarios: number; submissoes: number };

type Payload = {
  atleta: { id: string; nome: string; foto?: string|null };
  kpis: { curtidas7d: number; submissoes7d: number; pontos7d: number; consistencia30d: number };
  porDia30d: Dia[];
  porTipo: Serie[];
};

export default function DesempenhoAtleta() {
  const [, nav] = useLocation();
  const url = new URLSearchParams(location.search);
  const atletaId = url.get("atletaId") || "";
  const token = Storage.token;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=> {
    let cancel=false;
    (async ()=>{
      setLoading(true);
      try{
        const r = await fetch(`${API.BASE_URL}/api/desempenho/atleta/${atletaId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const json = await r.json();
        if(!cancel) setData(json);
      } finally { if(!cancel) setLoading(false); }
    })();
    return ()=>{ cancel=true; };
  }, [atletaId, token]);

  if (!atletaId) return <div className="p-6">Passe ?atletaId=… na URL</div>;
  if (loading) return <div className="p-6">Carregando…</div>;
  if (!data) return <div className="p-6 text-red-600">Sem dados.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <button
        onClick={() => nav("/olheiros")}
        className="mb-2 inline-flex items-center gap-2 text-green-800"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-xl font-bold mb-2">Desempenho — {data.atleta.nome}</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Curtidas (7d)" value={data.kpis.curtidas7d}/>
        <Kpi label="Submissões (7d)" value={data.kpis.submissoes7d}/>
        <Kpi label="Pontos (7d)" value={data.kpis.pontos7d}/>
        <Kpi label="Consistência (30d)" value={data.kpis.consistencia30d}/>
      </div>

      <Card title="Atividade diária (30 dias)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.porDia30d}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="dia"/>
              <YAxis allowDecimals={false}/>
              <Tooltip />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
              />

              <Line
                type="monotone"
                dataKey="submissoes"
                name="Submissões"
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="curtidas"
                name="Curtidas"
                stroke={COLORS[1]}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="comentarios"
                name="Comentários"
                stroke={COLORS[2]}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Tipo de conteúdo (últ. 30d)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.porTipo}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="label"/>
                <YAxis allowDecimals={false}/>
                <Tooltip/>
                <Bar dataKey="value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({label, value}:{label:string; value:number}) {
  return (
    <div className="rounded-xl border p-3 bg-white">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
function Card({title, children}:{title:string; children:React.ReactNode}) {
  return (
    <div className="rounded-xl border bg-white">
      <div className="px-3 py-2 border-b font-semibold">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { ArrowLeft } from "lucide-react";

type Serie = { label: string; value: number };
type Dia = { dia: string; curtidas: number; comentarios: number; submissoes: number };

type Payload = {
  atleta: { id: string; nome: string; foto?: string|null };
  kpis: { curtidas7d: number; submissoes7d: number; pontos7d: number };
  porDia30d: Dia[];
  porTipo: Serie[];     
  porCategoria: Serie[]; 
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
      } finally{ if(!cancel) setLoading(false); }
    })();
    return ()=>{ cancel=true; };
  }, [atletaId, token]);

  if (!atletaId) return <div className="p-6">Passe ?atletaId=… na URL</div>;
  if (loading) return <div className="p-6">Carregando…</div>;
  if (!data) return <div className="p-6 text-red-600">Sem dados.</div>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <button onClick={()=>nav(`/perfil/${data.atleta.id}`)} className="mb-2 inline-flex items-center gap-2 text-green-800">
        <ArrowLeft className="w-4 h-4"/> Voltar ao perfil
      </button>

      <h1 className="text-xl font-bold mb-2">Desempenho — {data.atleta.nome}</h1>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Curtidas (7d)" value={data.kpis.curtidas7d}/>
        <Kpi label="Submissões (7d)" value={data.kpis.submissoes7d}/>
        <Kpi label="Pontos (7d)" value={data.kpis.pontos7d}/>
      </div>

      <Card title="Atividade diária (30 dias)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.porDia30d}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis dataKey="dia"/>
              <YAxis allowDecimals={false}/>
              <Tooltip/>
              <Line type="monotone" dataKey="submissoes" />
              <Line type="monotone" dataKey="curtidas" />
              <Line type="monotone" dataKey="comentarios" />
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
        <Card title="Categorias de desafio (últ. 30d)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.porCategoria} nameKey="label" dataKey="value" outerRadius={100}>
                  {data.porCategoria.map((_, i) => <Cell key={i} />)}
                </Pie>
                <Tooltip/>
              </PieChart>
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

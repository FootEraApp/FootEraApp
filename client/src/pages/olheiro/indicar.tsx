import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";
import { X, Send, Search } from "lucide-react";

type Clube = { id: string; nome: string; username?: string; logo?: string | null };

function debounce<T extends (...a:any[])=>void>(fn:T, ms=400){ let t:any; return (...a:Parameters<T>)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} }

export default function IndicarParaClube() {
  const [, nav] = useLocation();
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const params = new URLSearchParams(location.search);
  const [atletaId, setAtletaId] = useState(params.get("atletaId") || "");
  const [q, setQ] = useState("");
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [sel, setSel] = useState<Clube | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const buscarClubes = useMemo(
    () => debounce(async (query: string) => {
      if (!query || query.trim().length < 2) return setClubes([]);
      try {
        const r = await axios.get(`${API.BASE_URL}/api/cadastro/buscar`, {
          params: { query, tipo: "Clube" }, headers
        });
        const arr: Clube[] = (Array.isArray(r.data)? r.data:[])
          .filter((c:any)=>c?.tipo==="Clube")
          .map((c:any)=>({ id:String(c.id), nome:String(c.nome), username:c.username, logo:c.fotoUrl ?? null }));
        setClubes(arr);
      } catch { setClubes([]); }
    }, 350),
    [headers]
  );

  useEffect(() => { buscarClubes(q); }, [q]);

  async function enviar() {
    setMsg(null);
    if (!atletaId) return setMsg("Informe o ID do atleta.");
    if (!sel) return setMsg("Selecione um clube.");
    try {
      setEnviando(true);
      await axios.post(`${API.BASE_URL}/api/indicacoes`, { atletaId, clubeId: sel.id }, {
        headers: { "Content-Type": "application/json", ...(headers||{}) },
      });
      setMsg("Indicação enviada! ✅");
      setTimeout(()=>nav("/perfil"), 1200);
    } catch (e:any) {
      setMsg(e?.response?.data?.error || "Não foi possível enviar a indicação.");
    } finally { setEnviando(false); }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Indicar para clube</h1>
        <button onClick={()=>history.back()} className="p-2 rounded hover:bg-gray-100"><X/></button>
      </div>

      <label className="block text-sm mb-1">ID do Atleta</label>
      <input className="w-full border rounded px-3 py-2 mb-3"
             placeholder="ex.: uuid…" value={atletaId}
             onChange={e=>setAtletaId(e.target.value)} />

      <label className="block text-sm mb-1">Buscar clube</label>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-500"/>
        <input className="w-full border rounded pl-8 pr-3 py-2"
               placeholder="Digite 2+ letras"
               value={q} onChange={e=>setQ(e.target.value)} />
      </div>

      {q && (
        <div className="border rounded mt-2 max-h-56 overflow-auto">
          {clubes.map(c=>(
            <button key={c.id}
              onClick={()=>setSel(c)}
              className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 ${sel?.id===c.id?"bg-green-50":""}`}>
              <div className="font-medium">{c.nome}</div>
              {c.username && <div className="text-xs text-gray-500">@{c.username}</div>}
            </button>
          ))}
          {clubes.length===0 && <div className="px-3 py-2 text-sm text-gray-500">Nenhum clube encontrado</div>}
        </div>
      )}

      {sel && <p className="mt-2 text-sm">Selecionado: <b>{sel.nome}</b></p>}
      {msg && <p className="mt-3 text-sm">{msg}</p>}

      <button disabled={enviando} onClick={enviar}
              className="mt-4 w-full bg-green-700 text-white rounded py-2 flex items-center justify-center gap-2">
        <Send className="w-4 h-4"/>{enviando ? "Enviando…" : "Enviar indicação"}
      </button>
    </div>
  );
}
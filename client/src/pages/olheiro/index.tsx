import { useEffect, useState } from "react";
import { Link } from "wouter";
import axios from "axios";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

type Atleta = { id:string; nome:string; foto?:string|null; posicao?:string|null; idade?:number|null };

export default function PainelOlheiro() {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const tipoId = Storage.tipoUsuarioId;

  const [obs, setObs] = useState<Atleta[]>([]);

  useEffect(()=> {
    (async ()=>{
      try{
        const r = await axios.get(`${API.BASE_URL}/api/observados`, { headers });
        setObs(Array.isArray(r.data) ? r.data : []);
      } catch { setObs([]); }
    })();
  }, [tipoId]);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-3">Painel do Olheiro</h1>
      {obs.length===0 ? <p className="text-gray-600">Você ainda não observa atletas.</p> : (
        <ul className="grid gap-3">
          {obs.map(a=>(
            <li key={a.id} className="rounded-lg border p-3 bg-white flex items-center gap-3">
              <img src={a.foto || `${API.BASE_URL}/assets/default-user.png`} className="w-10 h-10 rounded-full object-cover"/>
              <div className="flex-1">
                <div className="font-medium">{a.nome}</div>
                <div className="text-xs text-gray-600">{[a.posicao, a.idade?`${a.idade} anos`: null].filter(Boolean).join(" • ")}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/olheiro/desempenho?atletaId=${a.id}`}><a className="text-green-700 underline">Desempenho</a></Link>
                <Link href={`/olheiro/indicar?atletaId=${a.id}`}><a className="underline">Indicar</a></Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

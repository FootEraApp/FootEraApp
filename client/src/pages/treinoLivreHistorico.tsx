import { useEffect, useState } from "react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type TL = { id: string; data: string; descricao: string; duracaoMin: number; tipoAtividade?: string | null; categoria?: string | null; };

export default function TreinosLivresHistorico() {
  const [itens, setItens] = useState<TL[]>([]);

  useEffect(() => {
    (async () => {
      const token = (Storage as any).token ?? localStorage.getItem("token");
      const atletaId = (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");
      if (!token || !atletaId) return;
      const r = await fetch(`${API.BASE_URL}/api/treinos-livres?atletaId=${encodeURIComponent(atletaId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setItens(await r.json());
    })();
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
       <Link
              href="/treinos"
              aria-label="Voltar para treinos"
              title="Voltar para explorar"
              className="inline-flex h-10 w-10 items-center justify-center
                rounded-full border border-green-800 bg-white text-green-900
                shadow-sm hover:bg-green-50 focus:outline-none
                focus:ring-2 focus:ring-green-700/30 mt-2 ml-2"
              >
              <ArrowLeft className="h-5 w-5" />
            </Link>
      <h2 className="text-lg font-bold mb-4">Treinos Livres</h2>
      {itens.length === 0 ? (
        <p className="text-gray-600">Nenhum treino livre registrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map(t => (
            <li key={t.id} className="p-3 rounded border bg-white">
              <div className="font-semibold">{t.descricao}</div>
              <div className="text-sm text-gray-600">
                {new Date(t.data).toLocaleString("pt-BR")} • {t.duracaoMin} min
                {t.tipoAtividade ? ` • ${t.tipoAtividade}` : ""}{t.categoria ? ` • ${t.categoria}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
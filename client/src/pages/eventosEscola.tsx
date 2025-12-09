// client/src/pages/eventosEscola.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

type EventoListItem = {
  id: string;
  titulo: string;
  tipo: "PENEIRA" | "EVENTO";
  descricao?: string | null;
  inicio: string;
  cidade?: string | null;
  estado?: string | null;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
  linkInscricao?: string | null;
};

export default function PaginaEventosEscola({ escolaId }: { escolaId: string }) {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const [lista, setLista] = useState<EventoListItem[]>([]);

  useEffect(() => {
    axios
      .get(`${API.BASE_URL}/api/eventos/escolas/${escolaId}`, { headers })
      .then(({ data }) => setLista(Array.isArray(data) ? data : []))
      .catch(() => setLista([]));
  }, [escolaId, headers]);

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 p-4 text-white text-center text-xl font-bold">
        Eventos & Peneiras da Escolinha
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Próximos eventos</h2>
          <Link
            href={`/eventos/escolas/${escolaId}/novo`}
            className="px-3 py-2 rounded bg-green-700 text-white"
          >
            + Criar novo
          </Link>
        </div>

        {lista.length === 0 ? (
          <div className="text-center text-green-900/70 py-8">
            Nenhum evento cadastrado.
          </div>
        ) : (
          <ul className="grid gap-3">
            {lista.map((e) => (
              <li key={e.id} className="bg-white rounded-lg border p-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">{e.titulo}</div>
                    <div className="text-sm text-green-900/70">
                      {e.tipo} • {new Date(e.inicio).toLocaleString()}
                      {e.cidade
                        ? ` • ${e.cidade}${
                            e.estado ? " - " + e.estado : ""
                          }`
                        : ""}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-900">
                    {e.status}
                  </span>
                </div>

                {e.descricao && (
                  <p className="text-sm text-green-900/90 mt-2 line-clamp-3">
                    {e.descricao}
                  </p>
                )}

                {e.linkInscricao && (
                  <a
                    className="inline-block mt-2 text-sm text-green-800 underline"
                    href={e.linkInscricao}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Link de inscrição
                  </a>
                )}

                <div className="mt-2">
                  <Link
                    href={`/eventos/${e.id}`}
                    className="text-sm text-green-800 underline"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

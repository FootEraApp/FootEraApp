import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import Storage from "../../utils/storage.js";
import { API } from "../../config.js";
import { EventoTipo, labelEventoTipo } from "@/utils/eventos.js";

type EventoListItem = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  tipoLabel?: string;
  descricao?: string | null;
  dataEvento: string;
  cidade?: string | null;
  estado?: string | null;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
  linkInscricao?: string | null;
};

export default function CreatorEventosPage() {
  const token = Storage.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [lista, setLista] = useState<EventoListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API.BASE_URL}/api/eventos/creator/me`, { headers })
      .then(({ data }) => setLista(Array.isArray(data) ? data : []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-cream text-green-900 pb-20">
      <div className="bg-green-900 text-white p-5">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 rounded-full border border-white/30 px-3 py-1 text-sm"
        >
          Voltar
        </button>

        <h1 className="text-2xl font-extrabold">Eventos do Creator</h1>
        <p className="text-white/80 text-sm mt-1">
          Crie e gerencie aulas ao vivo, webinars, lives, palestras, peneiras e eventos.
        </p>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl border p-4 mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-lg">Seus eventos</h2>
              <p className="text-sm text-green-900/70">
                Eventos criados aparecem no seu perfil Creator e podem ser usados para lives, webinars ou inscrições.
              </p>
            </div>

            <Link
              href="/creator/eventos/novo"
              className="shrink-0 rounded-xl bg-green-700 px-4 py-2 text-white font-bold text-sm"
            >
              + Criar
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando eventos...</div>
        ) : lista.length === 0 ? (
          <div className="bg-white rounded-2xl border p-6 text-center text-green-900/70">
            Nenhum evento criado ainda.
          </div>
        ) : (
          <ul className="grid gap-3">
            {lista.map((e) => (
              <li key={e.id} className="bg-white rounded-2xl border p-4 shadow-sm">
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-bold">{e.titulo}</div>
                    <div className="text-sm text-green-900/70">
                      {e.tipoLabel || labelEventoTipo(e.tipo)} •{" "}
                      {new Date(e.dataEvento).toLocaleString()}
                      {e.cidade ? ` • ${e.cidade}${e.estado ? " - " + e.estado : ""}` : ""}
                    </div>
                  </div>

                  <span className="h-fit text-xs px-2 py-1 rounded bg-green-100 text-green-900">
                    {e.status}
                  </span>
                </div>

                {e.descricao && (
                  <p className="text-sm text-green-900/80 mt-2 line-clamp-3">
                    {e.descricao}
                  </p>
                )}

                <div className="mt-3 flex gap-3">
                  <Link href={`/eventos/${e.id}`} className="text-sm underline text-green-800">
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
import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { EventoTipo, labelEventoTipo } from "@/utils/eventos.js";
import { UserContext } from "../context/UserContext.js";

type EventoListItem = {
  id: string;
  titulo: string;
  tipo: EventoTipo;
  descricao?: string | null;
  dataEvento: string;
  cidade?: string | null;
  estado?: string | null;
  status: "ABERTO" | "ENCERRADO" | "CANCELADO";
  linkInscricao?: string | null;
};

export default function PaginaEventosEscola({ escolaId }: { escolaId: string }) {
  const authContext =
    useContext(
      UserContext
    );

  const activeContext =
    authContext?.activeContext;

  const isAdmin =
    authContext?.can(
      "VER_ADMIN"
    ) ?? false;

  const contextoEscolaCorreto =
    activeContext?.kind ===
      "ORGANIZATION" &&
    String(
      activeContext.organizationType ||
        ""
    ).toUpperCase() ===
      "ESCOLA" &&
    String(
      activeContext.legacyOrganizationId ||
        ""
    ) === String(escolaId);

  const podeCriarEvento =
    isAdmin ||
    (
      contextoEscolaCorreto &&
      (
        authContext?.can(
          "CRIAR_EVENTO"
        ) ?? false
      )
    );
  const [lista, setLista] = useState<EventoListItem[]>([]);

  const token =
    Storage.token;

  useEffect(() => {
    const headers =
      token
        ? {
            Authorization:
              `Bearer ${token}`,
          }
        : undefined;

    axios
      .get(
        `${API.BASE_URL}/api/eventos/escolas/${escolaId}`,
        {
          headers,
        }
      )
      .then(({ data }) =>
        setLista(
          Array.isArray(data)
            ? data
            : []
        )
      )
      .catch(() =>
        setLista([])
      );
  }, [
    escolaId,
    token,
  ]);

  return (
    <div className="min-h-screen bg-cream text-green-900">
      <div className="bg-green-900 p-4 text-white text-center text-xl font-bold">
        Eventos & Peneiras da Escolinha
      </div>

      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Próximos eventos</h2>
          {podeCriarEvento && (
            <Link
              href={`/eventos/escolas/${escolaId}/novo`}
              className="px-3 py-2 rounded bg-green-700 text-white"
            >
              + Criar novo
            </Link>
          )}
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
                      {labelEventoTipo(e.tipo)} •{" "}
                      {new Date(e.dataEvento).toLocaleString()}
                      {e.cidade
                        ? ` • ${e.cidade}${e.estado ? " - " + e.estado : ""}`
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
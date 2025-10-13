import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import { formatarUrlFoto } from "../utils/formatarFoto.js";

type StatusSolicitacao = "pendente" | "ativa";

interface Solicitacao {
  id: string;
  remetenteId: string;
  status: StatusSolicitacao;
  criadaEm?: string;
  remetente: {
    id: string;
    nomeDeUsuario: string;
    foto: string | null;
  };
}

export default function PaginaNotificacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = Storage.token;
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`GET /solicitacoes-treino falhou (${resp.status}): ${txt}`);
        }
        const data: Solicitacao[] = await resp.json();
        setSolicitacoes(data);
      } catch (err) {
        console.error("Erro ao buscar solicitações:", err);
      }
    })();
  }, []);

  const responderSolicitacao = async (id: string, aceitar: boolean) => {
    const token = Storage.token;
    if (!token) {
      alert("Você precisa estar logado para responder a solicitação.");
      return;
    }

    try {
      const url = `${API.BASE_URL}/api/solicitacoes-treino/${id}/${aceitar ? "aceitar" : "recusar"}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Falha ao ${aceitar ? "aceitar" : "recusar"} (HTTP ${resp.status}): ${txt}`);
      }

      setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Erro ao responder solicitação:", err);
      alert("Não foi possível processar a solicitação agora.");
    }
  };

  const irParaPerfil = (id: string) => setLocation(`/perfil/${id}`);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Notificações</h2>

      {solicitacoes.length === 0 ? (
        <p className="text-gray-500">Nenhuma solicitação no momento.</p>
      ) : (
        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => {
            const foto = solicitacao.remetente?.foto;
            const fotoSrc = foto ? formatarUrlFoto(foto, "usuarios") : "";

            const podeResponder = solicitacao.status === "pendente" || solicitacao.status === "ativa";

            return (
              <div
                key={solicitacao.id}
                className="bg-white shadow-md rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
                onClick={() => irParaPerfil(solicitacao.remetenteId)}
              >
                <div className="flex items-center gap-4">
                  {foto ? (
                    <img
                      src={fotoSrc}
                      alt={`Foto de ${solicitacao.remetente.nomeDeUsuario}`}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center">
                      {(solicitacao.remetente.nomeDeUsuario || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <div>
                    <p className="font-semibold">
                      {solicitacao.remetente.nomeDeUsuario}
                    </p>
                    <p className="text-sm text-gray-600">
                      {solicitacao.status === "pendente"
                        ? "quer treinar junto com você"
                        : "solicitação ativa — responda"}
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                {podeResponder && (
                  <>
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white rounded px-3 py-1"
                      onClick={() => responderSolicitacao(solicitacao.id, true)}
                    >
                      Aceitar
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white rounded px-3 py-1"
                      onClick={() => responderSolicitacao(solicitacao.id, false)}
                    >
                      Rejeitar
                    </button>
                  </>
                )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
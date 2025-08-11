import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Storage from "../../../server/utils/storage";
import {API} from "../config";

interface Solicitacao {
  id: string;
  remetenteId: string;
  remetente: {
    id: string;
    nomeDeUsuario: string;   
    foto: string | null;  
  };
}

export default function PaginaNotificacoes() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [location, setLocation] = useLocation();

  

  useEffect(() => {
    const token = Storage.token;

    fetch(`${API.BASE_URL}/api/solicitacoes-treino`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setSolicitacoes(data))
      .catch((err) => console.error("Erro ao buscar solicitações:", err));
  }, []);

  const responderSolicitacao = async (id: string, aceitar: boolean) => {
  const token = Storage.token;

  if (!token) {
    alert("Você precisa estar logado para responder a solicitação.");
    return;
  }

  try {
    await fetch(`${API.BASE_URL}/api/solicitacoes-treino/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ aceitar }),
    });

    setSolicitacoes((prev) => prev.filter((s) => s.id !== id));
  } catch (err) {
    console.error("Erro ao responder solicitação:", err);
  }
};


  const irParaPerfil = (id: string) => {
    setLocation(`/perfil/${id}`);
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Notificações</h2>

      {solicitacoes.length === 0 ? (
        <p className="text-gray-500">Nenhuma solicitação no momento.</p>
      ) : (
        <div className="space-y-4">
          {solicitacoes.map((solicitacao) => (
            <div
              key={solicitacao.id}
              className="bg-white shadow-md rounded-xl p-4 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
              onClick={() => irParaPerfil(solicitacao.remetenteId)}
            >
              <div className="flex items-center gap-4">
                <img
                  src={solicitacao.remetente.foto ?? "https://via.placeholder.com/50"}
                  alt={`Foto de ${solicitacao.remetente.nomeDeUsuario}`}
                  className="w-12 h-12 rounded-full object-cover"
                />

                <div>
                  <p className="font-semibold">{solicitacao.remetente.nomeDeUsuario}</p>
                  <p className="text-sm text-gray-600">
                    quer treinar junto com você
                  </p>
                </div>
              </div>

              <div
                className="flex gap-2"
                onClick={(e) => e.stopPropagation()}
              >
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Send, Share2 } from "lucide-react";
import Storage from "../../../server/utils/storage";
import { API } from "../config";

interface Usuario {
  id: string;
  nome: string;
  foto?: string;
}

interface Mensagem {
  id: string;
  deId: string;
  paraId: string;
  conteudo: string;
  criadaEm: string;
}

export default function PaginaMensagens() {
  const [usuariosMutuos, setUsuariosMutuos] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [, navigate] = useLocation();

  const usuarioId = Storage.usuarioId;
  const token = Storage.token;

useEffect(() => {
  async function carregarDados() {
    try {
      const mutuos = await getUsuariosMutuos();
      setUsuariosMutuos(mutuos);
    } catch (err) {
      console.error(err);
    }
  }
  carregarDados();
}, []);


  useEffect(() => {
    if (usuarioSelecionado) {
      carregarMensagens(usuarioSelecionado.id);
    }
  }, [usuarioSelecionado]);

  const carregarMensagens = async (usuarioIdAlvo: string) => {
    try {
      const res = await fetch(`${API.BASE_URL}/mensagens/${usuarioIdAlvo}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data: Mensagem[] = await res.json();
      setMensagens(data);
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !usuarioSelecionado) return;

    await fetch(`${API.BASE_URL}/mensagens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        paraId: usuarioSelecionado.id,
        conteudo: novaMensagem,
      }),
    });

    setMensagens((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        criadaEm: new Date().toISOString(),
        conteudo: novaMensagem,
        deId: usuarioId,
        paraId: usuarioSelecionado.id,
      },
    ]);

    setNovaMensagem("");
  };

  async function getUsuariosMutuos(): Promise<Usuario[]> {
  const token = Storage.token;

  const res = await fetch(`${API.BASE_URL}/api/seguidores/mutuos`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Erro ao buscar usuários mutuos");
  }

  return await res.json();
}

  return (
    <div className="flex h-screen">
      {/* Sidebar de contatos */}
      <aside className="w-1/4 border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-2">Conversas</h2>
        {usuariosMutuos.map((usuario) => (
          <div
            key={usuario.id}
            className={`flex items-center gap-3 p-3 mb-3 rounded-lg cursor-pointer border shadow-sm transition-all ${
              usuarioSelecionado?.id === usuario.id
                ? "bg-blue-100 border-blue-400"
                : "hover:bg-gray-100 bg-white"
            }`}
            onClick={() => setUsuarioSelecionado(usuario)}
          >
            <img
              src={ `${API.BASE_URL}${usuario.foto}` || "https://via.placeholder.com/40"} 
              alt={`Foto de ${usuario.nome}`}
              className="w-12 h-12 rounded-full object-cover border"
            />
            <div className="flex flex-col">
              <span className="font-medium text-sm">{usuario.nome}</span>
              <span className="text-xs text-gray-500">Clique para conversar</span>
            </div>
          </div>
        ))}
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col justify-between p-4">
        {usuarioSelecionado ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{usuarioSelecionado.nome}</h2>
              <button className="flex items-center gap-2 text-blue-500 hover:underline">
                <Share2 size={18} />
                Compartilhar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 border rounded p-2 mb-4 bg-gray-50">
              {mensagens.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded max-w-sm ${
                    msg.deId === usuarioId ? "bg-blue-100 self-end ml-auto" : "bg-gray-200"
                  }`}
                >
                  {msg.conteudo}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 border p-2 rounded"
                value={novaMensagem}
                onChange={(e) => setNovaMensagem(e.target.value)}
                placeholder="Digite sua mensagem..."
              />
              <button
                onClick={enviarMensagem}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-500">Selecione uma conversa para começar</p>
        )}
      </main>
    </div>
  );
}
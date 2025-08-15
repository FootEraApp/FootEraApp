import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Send, Share2 } from "lucide-react";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";
import socket from "../services/socket.js";

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

  const limite = 20;
  const [temMais, setTemMais] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const usuarioId = Storage.usuarioId;
  const token = Storage.token;

  function requireUserId(): string {
    if (!usuarioId) {
      throw new Error("Usuário não autenticado");
    }
    return usuarioId;
  }

  const usuarioSelecionadoRef = useRef<Usuario | null>(null);

  useEffect(() => {
    usuarioSelecionadoRef.current = usuarioSelecionado;
  }, [usuarioSelecionado]);

useEffect(() => {
  socket.connect();

  socket.on("connect", () => {
    console.log("Socket conectado", socket.id);
    if (usuarioId) {
      socket.emit("join", usuarioId);
    }
  });

  socket.on("novaMensagem", (mensagem: Mensagem) => {
    const selecionado = usuarioSelecionadoRef.current;
    if (
      selecionado &&
      (mensagem.deId === selecionado.id || mensagem.paraId === selecionado.id)
    ) {
      setMensagens((prev) => [...prev, mensagem]);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket desconectado");
  });

  return () => {
    socket.off("novaMensagem");
    socket.disconnect();
  };
}, []);

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

  const carregarMensagens = async (usuarioIdAlvo: string, append = false) => {
  try {
    const ultimoId = append && mensagens.length > 0 ? mensagens[0].id : undefined;

    const params: Record<string, string> = {
      deId: requireUserId(),
      paraId: usuarioIdAlvo,
      limit: String(limite),
    };
    if (usuarioId) params.deId = usuarioId;
    if (ultimoId) params.cursor = ultimoId;

    const query = new URLSearchParams(params);

    const res = await fetch(`${API.BASE_URL}/api/mensagem?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

      const novas: Mensagem[] = await res.json();
      if (novas.length < limite) setTemMais(false);

      const novasOrdenadas = novas.reverse();

      if (append) {
        setMensagens((prev) => {
          const combined = [...novasOrdenadas, ...prev];
          const uniqueMap = new Map<string, Mensagem>();
          for (const msg of combined) uniqueMap.set(msg.id, msg);
          return Array.from(uniqueMap.values()).sort(
            (a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime()
          );
        });
      } else {
        setMensagens(novasOrdenadas);
      }

      const chave = `conversa_${usuarioId}_${usuarioIdAlvo}`;
      const mensagensSalvas = append ? [...novasOrdenadas, ...mensagens] : novasOrdenadas;
      const ultimas100 = mensagensSalvas.slice(-100);
      localStorage.setItem(chave, JSON.stringify(ultimas100));
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  };

  useEffect(() => {
    if (!usuarioSelecionado) {
      setMensagens([]);
      setTemMais(true);
      return;
    }

    const chave = `conversa_${usuarioId}_${usuarioSelecionado.id}`;
    const cache = JSON.parse(localStorage.getItem(chave) || "[]");
    setMensagens(cache);
    setTemMais(true);
    carregarMensagens(usuarioSelecionado.id, false);
  }, [usuarioSelecionado]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (top < 50 && temMais && !carregandoMais && usuarioSelecionado) {
      setCarregandoMais(true);
      carregarMensagens(usuarioSelecionado.id, true).finally(() => {
        setCarregandoMais(false);
      });
    }
  };

const enviarMensagem = async () => {
  const myUsuarioId = requireUserId();
  if (!novaMensagem.trim() || !usuarioSelecionado) return;

  if (!usuarioId) {
    alert("Faça login para enviar mensagens.");
    return;
  }

  const payload = {
    paraId: usuarioSelecionado.id,
    conteudo: novaMensagem,
  };

  await fetch(`${API.BASE_URL}/api/mensagem`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const novaMsg: Mensagem = {
    id: Date.now().toString(),
    criadaEm: new Date().toISOString(),
    conteudo: novaMensagem,
    deId: myUsuarioId,            
    paraId: usuarioSelecionado.id,
  };

  setMensagens((prev) => [...prev, novaMsg]);
  socket.emit("sendMessage", novaMsg);
  setNovaMensagem("");
};

  async function getUsuariosMutuos(): Promise<Usuario[]> {
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
              src={usuario.foto ? `${API.BASE_URL}${usuario.foto}` : "https://via.placeholder.com/40"}
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

            <div
              className="flex-1 overflow-y-auto space-y-2 border rounded p-2 mb-4 bg-gray-50"
              onScroll={handleScroll}
            >
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
              {carregandoMais && <p className="text-center text-sm text-gray-400">Carregando mais...</p>}
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
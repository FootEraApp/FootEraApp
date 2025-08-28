import { useEffect, useState } from "react";
import { API } from "@/config.js";

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  grupoId: string;
  token: string;
  onCriado?: () => void | Promise<void>;
}

interface DesafioOficial {
  id: string;
  titulo: string;
  descricao: string;
  imagemUrl?: string | null;
  nivel?: string | null;
  pontuacao?: number | null;
  categoria?: string[];
  createdAt: string;
}

export function ModalDesafiosGrupo({
  aberto,
  onFechar,
  grupoId,
  token,
  onCriado,
}: ModalProps) {
  const [desafios, setDesafios] = useState<DesafioOficial[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [desafioSelecionado, setDesafioSelecionado] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;

    const fetchDesafios = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API.BASE_URL}/api/desafios/oficiais`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Erro ao carregar desafios oficiais");
        const data = await res.json();
        setDesafios(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDesafios();
  }, [aberto, grupoId, token]);

  const handleSelecionar = (id: string) => {
    setDesafioSelecionado((prev) => (prev === id ? null : id));
  };

  const handleConfirmar = async () => {
    if (!desafioSelecionado || salvando) return;

    try {
      setSalvando(true);
      const res = await fetch(`${API.BASE_URL}/api/desafios/em-grupo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          grupoId,
          desafioOficialId: desafioSelecionado,
        }),
      });

      if (!res.ok) throw new Error("Erro ao criar desafio em grupo");

      await res.json();
      await onCriado?.();

      onFechar();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar desafio em grupo.");
    } finally {
      setSalvando(false);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Desafios Oficiais</h2>
          <button onClick={onFechar} className="text-gray-600 hover:text-gray-900">
            ✕
          </button>
        </div>

        {loading && <p className="text-center text-gray-500">Carregando...</p>}
        {!loading && desafios.length === 0 && (
          <p className="text-center text-gray-500">Nenhum desafio oficial encontrado.</p>
        )}

        <div className="space-y-4">
          {desafios.map((d) => (
            <div
              key={d.id}
              onClick={() => handleSelecionar(d.id)}
              className={`cursor-pointer border-2 rounded-lg p-3 shadow-sm hover:shadow-md transition bg-gray-50 ${
                desafioSelecionado === d.id ? "border-yellow-400" : "border-gray-200"
              }`}
            >
              <h3 className="font-semibold text-sm">{d.titulo}</h3>
              {d.imagemUrl && (
                <img
                  src={`${API.BASE_URL}${d.imagemUrl}`}
                  alt={d.titulo}
                  className="w-full h-32 object-cover rounded my-2"
                />
              )}
              <p className="text-sm text-gray-600 mb-2">{d.descricao}</p>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Nível: {d.nivel ?? "—"}</span>
                <span>Pontos: {d.pontuacao ?? "—"}</span>
                <span>{new Date(d.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>

        {desafioSelecionado && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleConfirmar}
              disabled={salvando}
              className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition disabled:opacity-60"
            >
              {salvando ? "Confirmando..." : "Confirmar Seleção"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
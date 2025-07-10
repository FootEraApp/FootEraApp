
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Dialog } from "@headlessui/react";

interface Exercicio {
  nome: string;
  reps: string;
  icone: string;
}

interface Treino {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  pontuacao: number;
  exercicios: Exercicio[];
  tipo: "treino" | "desafio";
  feito: boolean;
}

export default function PaginaTreinos() {
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [treinoSelecionado, setTreinoSelecionado] = useState<Treino | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    async function carregarTreinos() {
     const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:3001/api/treinos", {
        headers: {
         Authorization: `Bearer ${token}`,
        },
      });
      const dados = await res.json();
      setTreinos(dados);
    }
    carregarTreinos();
  }, []);

  const handleConcluirTreino = (treino: Treino) => {
    setTreinoSelecionado(treino);
    setIsModalOpen(true);
  };

  const enviarValidacao = () => {
    if (!treinoSelecionado) return;
    setTreinos((prev) =>
      prev.map((t) =>
        t.id === treinoSelecionado.id ? { ...t, feito: true } : t
      )
    );
    setIsModalOpen(false);
    setVideoUrl(null);
    setFeedback("");
  };

  const pontosGanhos = treinos.filter(t => t.feito).reduce((acc, t) => acc + t.pontuacao, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-900 text-white p-4 rounded-lg mb-6 text-center">
          <h2 className="text-xl font-bold">Pontuação dos Treinos</h2>
          <p className="text-3xl font-semibold">{pontosGanhos} pts</p>
        </div>

        {treinos.map((treino) => (
          <div
            key={treino.id}
            className={`border p-4 mb-4 rounded-lg shadow-md ${
              treino.tipo === "desafio" ? "bg-yellow-100 border-yellow-400" : "bg-white"
            }`}
          >
            <h3 className={`text-lg font-bold truncate ${
              treino.tipo === "desafio" ? "text-yellow-800" : "text-green-800"
            }`}>{treino.nome}</h3>
            <p className="text-sm text-gray-600 truncate">{treino.descricao}</p>

            <ul className="mt-3 space-y-2">
              {treino.exercicios.map((ex, index) => (
                <li key={index} className="flex items-center">
                  <span className="text-xl mr-2">{ex.icone}</span>
                  <span className="truncate">{ex.nome} ({ex.reps})</span>
                </li>
              ))}
            </ul>

            <p className="mt-2 text-sm text-gray-700">Vale {treino.pontuacao} pts</p>

            {treino.feito ? (
              <p className="text-green-600 font-semibold mt-2">Treino concluído</p>
            ) : (
              <button
                onClick={() => handleConcluirTreino(treino)}
                className="mt-3 px-4 py-2 bg-green-800 text-white rounded hover:bg-green-700"
              >
                Enviar Treino
              </button>
            )}
          </div>
        ))}

        <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="fixed inset-0 z-50">
          <div className="flex items-center justify-center min-h-screen">
            <Dialog.Panel className="bg-white p-6 rounded shadow-lg max-w-md w-full">
              <Dialog.Title className="text-lg font-bold mb-2">
                Validar Treino
              </Dialog.Title>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setVideoUrl(e.target.value)}
                className="mb-2"
              />
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Deixe um feedback sobre o treino..."
                className="w-full border rounded p-2 mb-4"
              />
              <button
                onClick={enviarValidacao}
                className="px-4 py-2 bg-green-800 text-white rounded hover:bg-green-700"
              >
                Enviar
              </button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>

      {/* Barra de navegação inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-green-900 text-white px-6 py-3 flex justify-around items-center shadow-md">
        
        
        <Link href="/feed" className="hover:underline">Feed</Link>
        <Link href="/search" className="hover:underline">Explorar</Link>
        <Link href="/post" className="hover:underline">Publicar</Link>
        <Link href="/treinos" className="hover:underline">Treinos</Link>
        <Link href="/perfil" className="hover:underline">Perfil</Link>

      </nav>
    </div>
  );
}
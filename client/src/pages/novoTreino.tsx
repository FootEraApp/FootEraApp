import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface UsuarioLogado {
  tipo: 'atleta' | 'escola' | 'clube' | 'professor' | 'admin';
  usuarioId: string;
  tipoUsuarioId: string;
}

interface Exercicio {
  id: string;
  nome: string;
  repeticoes?: string;
}

interface TreinoProgramado {
  id: string;
  nome: string;
  descricao?: string;
  nivel: string;
  duracao?: number;
  objetivo?: string;
  dicas?: string[];
  exercicios: Exercicio[];
}

export default function NovoTreinoParaAtleta() {
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);
  const [treinos, setTreinos] = useState<TreinoProgramado[]>([]);
  const [, navigate] = useLocation();

  useEffect(() => {
    const tipo = localStorage.getItem("tipoUsuario");
    const usuarioId = localStorage.getItem("usuarioId");
    const tipoUsuarioId = localStorage.getItem("tipoUsuarioId");

    if (tipo && usuarioId && tipoUsuarioId) {
      setUsuario({
        tipo: tipo as UsuarioLogado["tipo"],
        usuarioId,
        tipoUsuarioId,
      });

      fetch("http://localhost:3001/api/treinosprogramados")
        .then(res => res.json())
        .then(data => setTreinos(data || []));
    }
  }, []);

  const agendarTreino = async (treinoId: string) => {
    if (!usuario) return;

    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:3001/api/treinos/agendar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        atletaId: usuario.tipoUsuarioId,
        treinoProgramadoId: treinoId,
        dataTreino: new Date().toISOString()
      }),
    });

    const json = await res.json();
    if (res.ok) {
      alert("Treino agendado com sucesso!");
      navigate("/treinos");
    } else {
      alert("Erro ao agendar treino: " + json.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Escolha um treino para agendar</h2>

      {treinos.length === 0 ? (
        <p>Nenhum treino disponível.</p>
      ) : (
        treinos.map((treino) => (
          <div key={treino.id} className="bg-white p-4 rounded shadow border mb-4">
            <h4 className="text-lg font-semibold text-green-700">{treino.nome}</h4>
            <p className="text-sm text-gray-600 mb-1">{treino.descricao}</p>
            <p className="text-sm text-gray-500"><strong>Nível:</strong> {treino.nivel}</p>
            <button
              onClick={() => agendarTreino(treino.id)}
              className="mt-2 bg-green-700 text-white px-4 py-2 rounded"
            >
              Agendar treino
            </button>
          </div>
        ))
      )}
    </div>
  );
}

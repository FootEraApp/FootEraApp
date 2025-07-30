import { useEffect, useState } from "react";
import axios from "axios";

interface Training {
  titulo: string;
  dataHora: string;
  local: string;
}

export default function TrainingProgress({ userId }: { userId: string }) {
  const [treinos, setTreinos] = useState<Training[]>([]);

  useEffect(() => {
    axios.get(`http://localhost:3001/api/perfil/${userId}/treinos`)
      .then(res => setTreinos(res.data))
      .catch(err => console.error("Erro ao carregar treinos:", err));
  }, [userId]);

  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Progresso de Treinos</h2>
      {treinos.length === 0 && <p className="text-gray-500">Nenhum treino registrado.</p>}
      <ul className="space-y-2">
        {treinos.map((treino, index) => (
          <li key={index} className="bg-white shadow rounded p-3">
            <p className="font-semibold">{treino.titulo}</p>
            <p className="text-sm text-gray-500">{new Date(treino.dataHora).toLocaleString()}</p>
            <p className="text-sm text-gray-500">{treino.local}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

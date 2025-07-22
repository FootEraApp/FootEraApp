"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function EditarTreino() {
  const router = useRouter();
  const { id } = router.query;

  const [treino, setTreino] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:3001/api/treinosprogramados/${id}`)
      .then(res => res.json())
      .then(data => setTreino(data))
      .catch(console.error);
  }, [id]);

  if (!treino) return <div className="p-6">Carregando treino...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Editar Treino</h1>

      <form className="bg-white p-4 rounded shadow grid gap-4">
        <input
          className="border p-2 rounded"
          value={treino.nome}
          onChange={(e) => setTreino({ ...treino, nome: e.target.value })}
        />
        <input
          className="border p-2 rounded"
          value={treino.codigo}
          onChange={(e) => setTreino({ ...treino, codigo: e.target.value })}
        />
        <textarea
          className="border p-2 rounded"
          value={treino.descricao}
          onChange={(e) => setTreino({ ...treino, descricao: e.target.value })}
        />
        <button
          type="button"
          className="bg-green-700 text-white px-4 py-2 rounded"
          onClick={async () => {
            const response = await fetch(`http://localhost:3001/api/treinosprogramados/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(treino),
            });

            if (response.ok) {
              alert("Treino atualizado com sucesso!");
              window.location.href = "/admin"
            } else {
              alert("Erro ao atualizar treino.");
            }
          }}
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}

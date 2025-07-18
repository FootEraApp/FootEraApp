"use client";

import { useState } from "react";

export default function CriarDesafio() {
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [categoriaIdade, setCategoriaIdade] = useState("");
  const [pontuacao, setPontuacao] = useState(0);
  const [prazoSubmissao, setPrazoSubmissao] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("http://localhost:3001/api/desafios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, objetivo, categoriaIdade, pontuacao, prazoSubmissao }),
    });

    alert("Desafio criado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Criar Desafio</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow grid gap-4">
        <input
          type="text"
          placeholder="Título"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <input
          type="text"
          placeholder="Objetivo"
          value={objetivo}
          onChange={(e) => setObjetivo(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="text"
          placeholder="Categoria de Idade"
          value={categoriaIdade}
          onChange={(e) => setCategoriaIdade(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="number"
          placeholder="Pontuação"
          value={pontuacao}
          onChange={(e) => setPontuacao(Number(e.target.value))}
          className="border p-2 rounded"
        />

        <input
          type="date"
          value={prazoSubmissao}
          onChange={(e) => setPrazoSubmissao(e.target.value)}
          className="border p-2 rounded"
        />

        <div className="flex gap-4">
          <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded">
            Criar
          </button>
          <button type="button" className="bg-gray-300 px-4 py-2 rounded">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
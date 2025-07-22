"use client";

import { useState, useEffect } from "react";

export default function CreateExercicio() {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState("");
  const [video, setVideo] = useState<File | null>(null);

  const opcoesCategorias = [
    "Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"
  ];

  const handleAddCategoria = () => {
    if (categoriaAtual && !categorias.includes(categoriaAtual)) {
      setCategorias([...categorias, categoriaAtual]);
      setCategoriaAtual("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:3001/api/exercicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          nome,
          descricao,
          nivel,
          categorias,
          videoDemonstrativoUrl: "", // você pode adicionar lógica de upload depois
        }),
      });

      if (!res.ok) {
        const erro = await res.text();
        alert("Erro ao criar exercício: " + erro);
        return;
      }

      alert("Exercício criado com sucesso!");
      window.location.href = "/admin";
    } catch (err) {
      alert("Erro ao criar exercício: " + err);
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Novo Exercício</h2>

      <label className="text-base text-green-800 mb-2">Código</label>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="EX001"
        className="border p-2 w-full rounded mb-4"
      />

      <label className="text-base text-green-800 mb-2">Nome</label>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do exercício"
        className="border p-2 w-full rounded mb-4"
      />

      <label className="text-base text-green-800 mb-2">Descrição</label>
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição do exercício"
        className="border p-2 w-full rounded mb-4"
      />

      <label className="text-base text-green-800 mb-2">Nível</label>
      <select
        value={nivel}
        onChange={(e) => setNivel(e.target.value)}
        className="border p-2 w-full rounded mb-4"
      >
        <option>Base</option>
        <option>Avancado</option>
        <option>Performance</option>
      </select>

      <label className="text-base text-green-800 mb-2">Categorias</label>
      <div className="flex gap-2 mb-2">
        <select
          value={categoriaAtual}
          onChange={(e) => setCategoriaAtual(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Selecione</option>
          {opcoesCategorias.map((cat, i) => (
            <option key={i} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="bg-green-600 text-white px-3 py-1 rounded"
          onClick={handleAddCategoria}
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {categorias.map((cat, i) => (
          <span
            key={i}
            className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm"
          >
            {cat}
          </span>
        ))}
      </div>

      <label className="text-base text-green-800 mb-2">Vídeo do Exercício (opcional)</label>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setVideo(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <div className="flex justify-end gap-4">
        <button className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
        <button
          className="px-4 py-2 bg-green-700 text-white rounded"
          onClick={handleSubmit}
        >
          Criar
        </button>
      </div>
    </div>
  );
}

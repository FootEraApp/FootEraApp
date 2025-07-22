"use client";

import { useEffect, useState } from "react";

export default function CriarDesafio() {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [pontuacao, setPontuacao] = useState(0);
  const [prazoSubmissao, setPrazoSubmissao] = useState("");
  const [categoriaAtual, setCategoriaAtual] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [opcoesCategorias, setOpcoesCategorias] = useState<string[]>([]);

  useEffect(() => {
    async function carregarCategorias() {
      try {
        const res = await fetch("http://localhost:3001/api/categorias");
        const data = await res.json();
        setOpcoesCategorias(data);
      } catch (err) {
        console.error("Erro ao carregar categorias:", err);
      }
    }

    carregarCategorias();
  }, []);

  const handleAddCategoria = () => {
    if (categoriaAtual && !categorias.includes(categoriaAtual)) {
      setCategorias([...categorias, categoriaAtual]);
      setCategoriaAtual("");
    }
  };

    const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    const res = await fetch("http://localhost:3001/api/desafios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo,
        descricao,
        imagemUrl,
        nivel,
        pontuacao: Number(pontuacao),
        categorias,
        prazoSubmissao,
      }),
    });

    if (!res.ok) {
      const erro = await res.text();
      alert("Erro ao criar desafio: " + erro);
      return;
    }

    alert("Desafio criado com sucesso!");
    window.location.href = "/admin";
  } catch (err) {
    alert("Erro ao criar desafio: " + err);
    console.error(err);
  }
};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Criar Desafio</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow grid gap-4">
        <label className="text-base -mb-2 text-green-800">Titulo do desafio</label>
        <input
          type="text"
          placeholder="Ex: Desafio de Embaixadinhas"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <label className="text-base -mb-2 text-green-800">Descrição</label>
        <textarea
          placeholder="Descreva o desafio e seus objetivos..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <label className="text-base -mb-2 text-green-800">Url da imagem</label>
        <input
          type="url"
          placeholder="https://example.com/imagem.jpg"
          value={imagemUrl}
          onChange={(e) => setImagemUrl(e.target.value)}
          className="border p-2 rounded"
        />

        <label className="text-base -mb-2 text-green-800">Nivel</label>
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="border p-2 rounded"
        >
          <option>Base</option>
          <option>Avancado</option>
          <option>Performance</option>
        </select>

        <label className="text-base -mb-2 text-green-800">Pontos</label>
        <input
          type="number"
          value={pontuacao}
          onChange={(e) => setPontuacao(Number(e.target.value))}
          className="border p-2 rounded"
        />

        <label className="text-base -mb-2 text-green-800">Categorias</label>
        <div className="flex gap-2 mb-2">
          <select
            value={categoriaAtual}
            onChange={(e) => setCategoriaAtual(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">Selecione</option>
            {opcoesCategorias.map((cat) => (
              <option key={cat} value={cat}>
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

        <ul className="list-disc pl-5 text-sm text-gray-700">
          {categorias.map((cat, i) => (
            <li key={i}>{cat}</li>
          ))}
        </ul>

        <label className="text-base -mb-2 text-green-800">Prazo de Submissão</label>
        <input
          type="date"
          value={prazoSubmissao}
          onChange={(e) => setPrazoSubmissao(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <div className="flex gap-4 mt-4">
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

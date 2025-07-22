"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function EditarDesafio() {
  const router = useRouter();
  const { id } = router.query;

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pontos, setPontos] = useState(0);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:3001/api/desafios/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setTitulo(data.titulo);
        setDescricao(data.descricao);
        setCategoria(data.categoria);
        setPontos(data.pontos);
      });
  }, [id]);

  const handleSalvar = async () => {
    const response = await fetch(`http://localhost:3001/api/desafios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descricao, categoria, pontos }),
    });

    if (response.ok) {
      alert("Desafio atualizado!");
      window.location.href = "/admin"
    } else {
      alert("Erro ao atualizar desafio.");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-4">Editar Desafio</h2>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="w-full mb-2 border px-3 py-2 rounded" />
      <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição" className="w-full mb-2 border px-3 py-2 rounded"></textarea>
      <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria" className="w-full mb-2 border px-3 py-2 rounded" />
      <input type="number" value={pontos} onChange={(e) => setPontos(Number(e.target.value))} placeholder="Pontos" className="w-full mb-4 border px-3 py-2 rounded" />
      <button onClick={handleSalvar} className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
        Salvar
      </button>
    </div>
  );
}

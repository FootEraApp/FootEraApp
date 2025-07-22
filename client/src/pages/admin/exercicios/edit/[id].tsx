"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function EditarExercicio() {
  const router = useRouter();
  const { id } = router.query;

  const [form, setForm] = useState({
    nome: "",
    codigo: "",
    descricao: "",
    nivel: "INICIANTE",
    tipoMidia: "VIDEO",
    midiaUrl: "",
  });

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:3001/api/exercicios/${id}`)
        .then(res => res.json())
        .then(data => setForm(data))
        .catch(err => console.error("Erro ao carregar exercicio:", err));
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch(`http://localhost:3001/api/exercicios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      alert("Exercício atualizado com sucesso!");
      window.location.href = "/admin"
    } else {
      const error = await response.json();
      alert("Erro ao atualizar: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
        <h1 className="text-2xl font-bold mb-4">Editar Exercício</h1>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input name="nome" placeholder="Nome" value={form.nome} onChange={handleChange} className="border p-2 rounded" required />
          <input name="codigo" placeholder="Código" value={form.codigo} onChange={handleChange} className="border p-2 rounded" required />
          <textarea name="descricao" placeholder="Descrição" value={form.descricao} onChange={handleChange} className="border p-2 rounded" />

          <select name="nivel" value={form.nivel} onChange={handleChange} className="border p-2 rounded">
            <option value="Base">Base</option>
            <option value="Avancado">Avancado</option>
            <option value="Performance">Performance</option>
          </select>

          <select name="tipoMidia" value={form.tipoMidia} onChange={handleChange} className="border p-2 rounded">
            <option value="VIDEO">Vídeo</option>
            <option value="IMAGEM">Imagem</option>
          </select>

          <input name="midiaUrl" placeholder="URL da Mídia" value={form.midiaUrl} onChange={handleChange} className="border p-2 rounded" />

          <div className="flex justify-end gap-2">
            <button type="button" className="bg-gray-300 px-4 py-2 rounded" onClick={() => router.back()}>
              Cancelar
            </button>
            <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function CriarTreino() {
  const [titulo, setTitulo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nivel, setNivel] = useState("BASICO");
  const [descricao, setDescricao] = useState("");
  const [exercicios, setExercicios] = useState<any[]>([]);
  const [professores, setProfessores] = useState<any[]>([]);
  const [exSelecionados, setExSelecionados] = useState<string[]>([]);
  const [profSelecionado, setProfSelecionado] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/api/exercicios").then(res => res.json()).then(setExercicios);
    fetch("http://localhost:3001/api/professores").then(res => res.json()).then(setProfessores);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("http://localhost:3001/api/treinos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, codigo, nivel, descricao, exerciciosIds: exSelecionados, professorId: profSelecionado }),
    });

    alert("Treino criado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Criar Treino</h1>
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
          placeholder="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="border p-2 rounded"
        />

        <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="border p-2 rounded">
          <option value="BASICO">Básico</option>
          <option value="INTERMEDIARIO">Intermediário</option>
          <option value="AVANCADO">Avançado</option>
        </select>

        <textarea
          placeholder="Descrição"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="border p-2 rounded"
        />

        <label className="font-semibold">Exercícios</label>
        <div className="grid gap-1">
          {exercicios.map((ex) => (
            <label key={ex.id} className="flex gap-2 items-center">
              <input type="checkbox" value={ex.id} onChange={(e) => {
                const checked = e.target.checked;
                setExSelecionados(prev => checked ? [...prev, ex.id] : prev.filter(id => id !== ex.id));
              }} />
              {ex.nome}
            </label>
          ))}
        </div>

        <label className="font-semibold">Professor Responsável</label>
        <select value={profSelecionado} onChange={(e) => setProfSelecionado(e.target.value)} className="border p-2 rounded">
          <option value="">Selecione</option>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>{p.usuario?.nome || "Professor"}</option>
          ))}
        </select>

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

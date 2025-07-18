"use client";

import { useState } from "react";

export default function CriarProfessor() {
  const [nome, setNome] = useState("");
  const [cref, setCref] = useState("");
  const [areaFormacao, setAreaFormacao] = useState("");
  const [qualificacoes, setQualificacoes] = useState("");
  const [certificacoes, setCertificacoes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch("http://localhost:3001/api/professores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cref,
        areaFormacao,
        qualificacoes,
        certificacoes,
        nome,
      }),
    });

    alert("Professor criado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Criar Professor</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow grid gap-4">
        <input
          type="text"
          placeholder="Nome do Professor"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border p-2 rounded"
          required
        />

        <input
          type="text"
          placeholder="CREF"
          value={cref}
          onChange={(e) => setCref(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="text"
          placeholder="Área de Formação"
          value={areaFormacao}
          onChange={(e) => setAreaFormacao(e.target.value)}
          className="border p-2 rounded"
        />

        <textarea
          placeholder="Qualificações"
          value={qualificacoes}
          onChange={(e) => setQualificacoes(e.target.value)}
          className="border p-2 rounded"
        />

        <textarea
          placeholder="Certificações"
          value={certificacoes}
          onChange={(e) => setCertificacoes(e.target.value)}
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

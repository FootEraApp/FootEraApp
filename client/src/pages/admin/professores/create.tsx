"use client";

import { useState } from "react";

export default function CriarProfessor() {
  const [codigo, setCodigo] = useState("");
  const [cref, setCref] = useState("");
  const [nome, setNome] = useState("");
  const [formacao, setFormacao] = useState("");
  const [statusCref, setStatusCref] = useState("Ativo");
  const [qualificacoes, setQualificacoes] = useState<string[]>([]);
  const [certificacoes, setCertificacoes] = useState<string[]>([]);
  const [qualificacaoAtual, setQualificacaoAtual] = useState("");
  const [certificacaoAtual, setCertificacaoAtual] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const adicionarQualificacao = () => {
    if (qualificacaoAtual.trim()) {
      setQualificacoes([...qualificacoes, qualificacaoAtual]);
      setQualificacaoAtual("");
    }
  };

  const adicionarCertificacao = () => {
    if (certificacaoAtual.trim()) {
      setCertificacoes([...certificacoes, certificacaoAtual]);
      setCertificacaoAtual("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("codigo", codigo);
    formData.append("cref", cref);
    formData.append("nome", nome);
    formData.append("formacao", formacao);
    formData.append("statusCref", statusCref);
    qualificacoes.forEach((q, i) => formData.append(`qualificacoes[${i}]`, q));
    certificacoes.forEach((c, i) => formData.append(`certificacoes[${i}]`, c));
    if (foto) formData.append("foto", foto);

    try {
      const res = await fetch("http://localhost:3001/api/professores", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const erro = await res.text();
        alert("Erro ao criar professor: " + erro);
        return;
      }

      alert("Professor criado com sucesso!");
      window.location.href = "/admin";
    } catch (err) {
      alert("Erro ao criar professor: " + err);
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Novo Professor</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow space-y-4">
        <div className="flex gap-4">
          <div className="w-1/2">
            <label className="text-base text-green-800 mb-2 block">Código</label>
            <input
              type="text"
              placeholder="PROF001"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="border p-2 rounded w-full"
              required
            />
          </div>
          <div className="w-1/2">
            <label className="text-base text-green-800 mb-2 block">CREF</label>
            <input
              type="text"
              placeholder="12345-G/ES"
              value={cref}
              onChange={(e) => setCref(e.target.value)}
              className="border p-2 rounded w-full"
            />
          </div>
        </div>

        <label className="text-base text-green-800 block -mb-2">Nome completo</label>
        <input
          type="text"
          placeholder="Nome completo do professor"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border p-2 rounded w-full"
          required
        />

        <label className="text-base text-green-800 block -mb-2">Área de formação</label>
        <input
          type="text"
          placeholder="Ex: Educação Física - UFES"
          value={formacao}
          onChange={(e) => setFormacao(e.target.value)}
          className="border p-2 rounded w-full"
        />

        <label className="text-base text-green-800 block -mb-2">Status CREF</label>
        <select
          value={statusCref}
          onChange={(e) => setStatusCref(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
          <option value="Pendente">Pendente</option>
        </select>

        <div>
          <label className="text-base text-green-800 mb-1">Qualificações</label>
          <div className="flex gap-2 mb-2">
            <input
              value={qualificacaoAtual}
              onChange={(e) => setQualificacaoAtual(e.target.value)}
              className="border p-2 rounded w-full"
              placeholder="Ex: Mestrado em Educação Física"
            />
            <button
              type="button"
              className="bg-green-800 text-white px-3 py-1 rounded"
              onClick={adicionarQualificacao}
            >
              +
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {qualificacoes.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>

        <div>
          <label className="text-base text-green-800 -mb-2">Certificações</label>
          <div className="flex gap-2 mb-2">
            <input
              value={certificacaoAtual}
              onChange={(e) => setCertificacaoAtual(e.target.value)}
              className="border p-2 rounded w-full"
              placeholder="Ex: Curso de Preparação Física"
            />
            <button
              type="button"
              className="bg-green-800 text-white px-3 py-1 rounded"
              onClick={adicionarCertificacao}
            >
              +
            </button>
          </div>
          <ul className="list-disc pl-5 text-sm text-gray-700">
            {certificacoes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>

        <div>
          <label className="text-base text-green-800 -mb-2">Foto do Professor (opcional)</label>
          <input
            type="file"
            accept="image/png, image/jpeg"
            onChange={(e) => setFoto(e.target.files?.[0] || null)}
            className="border p-2 rounded w-full"
          />
          <p className="text-sm text-gray-500">Formatos aceitos: JPG, PNG (máx. 5MB)</p>
        </div>

        <div className="flex gap-4 justify-end">
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

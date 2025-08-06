"use client";

import { useEffect, useState } from "react";

export default function CriarOuEditarProfessor() {
  const [id, setId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [cref, setCref] = useState("");
  const [nome, setNome] = useState("");
  const [areaFormacao, setAreaFormacao] = useState("");
  const [statusCref, setStatusCref] = useState("Ativo");
  const [qualificacoes, setQualificacoes] = useState<string[]>([]);
  const [certificacoes, setCertificacoes] = useState<string[]>([]);
  const [qualificacaoAtual, setQualificacaoAtual] = useState("");
  const [certificacaoAtual, setCertificacaoAtual] = useState("");
  const [fotoUrl, setFotoUrl] = useState<File | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profId = params.get("id");
    if (profId) {
      setId(profId);
      fetch(`http://localhost:3001/api/professores/${profId}`)
        .then(res => res.json())
        .then(data => {
          setCodigo(data.codigo || "");
          setCref(data.cref || "");
          setNome(data.nome || "");
          setAreaFormacao(data.areaFormacao || "");
          setStatusCref(data.statusCref || "Ativo");
          setQualificacoes(data.qualificacoes || []);
          setCertificacoes(data.certificacoes || []);
        })
        .catch(err => console.error("Erro ao carregar professor:", err));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("codigo", codigo);
    formData.append("cref", cref);
    formData.append("nome", nome);
    formData.append("areaFormacao", areaFormacao);
    formData.append("statusCref", statusCref);
    formData.append("qualificacoes", JSON.stringify(qualificacoes));
    formData.append("certificacoes", JSON.stringify(certificacoes));

    if (fotoUrl) formData.append("fotoUrl", fotoUrl);

    try {
      const res = await fetch(`http://localhost:3001/api/professores${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: formData,
      });

      if (!res.ok) {
        const erro = await res.text();
        alert("Erro ao salvar professor: " + erro);
        return;
      }

      alert(`Professor ${id ? "editado" : "criado"} com sucesso!`);
      window.location.href = "/admin";
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar professor");
    }
  };

  const handleAddQualificacao = () => {
    if (qualificacaoAtual && !qualificacoes.includes(qualificacaoAtual)) {
      setQualificacoes([...qualificacoes, qualificacaoAtual]);
      setQualificacaoAtual("");
    }
  };

  const handleAddCertificacao = () => {
    if (certificacaoAtual && !certificacoes.includes(certificacaoAtual)) {
      setCertificacoes([...certificacoes, certificacaoAtual]);
      setCertificacaoAtual("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded shadow max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-green-800">{id ? "Editar" : "Novo"} Professor</h1>

      <label className="text-green-800">Código</label>
      <input
        className="border p-2 w-full mb-4"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        required
      />

      <label className="text-green-800">CREF</label>
      <input
        className="border p-2 w-full mb-4"
        value={cref}
        onChange={(e) => setCref(e.target.value)}
        required
      />

      <label className="text-green-800">Nome</label>
      <input
        className="border p-2 w-full mb-4"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
      />

      <label className="text-green-800">Área de Formação</label>
      <input
        className="border p-2 w-full mb-4"
        value={areaFormacao}
        onChange={(e) => setAreaFormacao(e.target.value)}
      />

      <label className="text-green-800">Status do CREF</label>
      <select
        className="border p-2 w-full mb-4"
        value={statusCref}
        onChange={(e) => setStatusCref(e.target.value)}
      >
        <option value="Ativo">Ativo</option>
        <option value="Inativo">Inativo</option>
      </select>

      <label className="text-green-800">Qualificações</label>
      <div className="flex gap-2 mb-2">
        <input
          value={qualificacaoAtual}
          onChange={(e) => setQualificacaoAtual(e.target.value)}
          className="border p-2 flex-grow"
        />
        <button type="button" onClick={handleAddQualificacao} className="bg-green-600 text-white px-4 py-1 rounded">
          +
        </button>
      </div>
      <ul className="list-disc pl-5 mb-4">
        {qualificacoes.map((q, i) => <li key={i}>{q}</li>)}
      </ul>

      <label className="text-green-800">Certificações</label>
      <div className="flex gap-2 mb-2">
        <input
          value={certificacaoAtual}
          onChange={(e) => setCertificacaoAtual(e.target.value)}
          className="border p-2 flex-grow"
        />
        <button type="button" onClick={handleAddCertificacao} className="bg-green-600 text-white px-4 py-1 rounded">
          +
        </button>
      </div>
      <ul className="list-disc pl-5 mb-4">
        {certificacoes.map((c, i) => <li key={i}>{c}</li>)}
      </ul>

      <label className="text-green-800 text-base mb-2">Foto do Professor (opcional) </label>
      <div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFotoUrl(e.target.files?.[0] || null)}
          className="mb-6"
        />
      </div>

      <div className="flex justify-end gap-4">
        <button type="submit" className="bg-green-700 text-white px-4 py-2 rounded">
          {id ? "Salvar Alterações" : "Criar"}
        </button>
        <button type="button" className="bg-gray-300 px-4 py-2 rounded" onClick={() => window.location.href = "/admin"}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

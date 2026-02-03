"use client";

import { useEffect, useState } from "react";
import { API } from "../../../config.js";

const getToken = () =>
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

type StatusCrefUI = "ATIVO" | "INATIVO";

export default function CriarOuEditarProfessor() {
  const [id, setId] = useState<string | null>(null);
  const [cref, setCref] = useState("");
  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState<string>("");
  const [areaFormacao, setAreaFormacao] = useState("");
  const [statusCref, setStatusCref] = useState<StatusCrefUI>("ATIVO");
  const [qualificacoes, setQualificacoes] = useState<string[]>([]);
  const [certificacoes, setCertificacoes] = useState<string[]>([]);
  const [qualificacaoAtual, setQualificacaoAtual] = useState("");
  const [certificacaoAtual, setCertificacaoAtual] = useState("");
  const [fotoUrl, setFotoUrl] = useState<File | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const profId = params.get("id");

    if (!profId) return;

    setId(profId);

    fetch(`${API.BASE_URL}/api/professores/${profId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setCref(data.cref || "");
        setNome(data.nome || "");

        if (data.dataNascimento) {
          const d = new Date(data.dataNascimento);
          if (!Number.isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            setDataNascimento(`${yyyy}-${mm}-${dd}`);
          }
        } else {
          setDataNascimento("");
        }

        setAreaFormacao(data.areaFormacao || "");
        const sc = String(data.statusCref || "ATIVO").toUpperCase();
        setStatusCref(sc === "INATIVO" ? "INATIVO" : "ATIVO");
        setQualificacoes(Array.isArray(data.qualificacoes) ? data.qualificacoes : []);
        setCertificacoes(Array.isArray(data.certificacoes) ? data.certificacoes : []);
      })
      .catch((err) => console.error("Erro ao carregar professor:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      alert("Informe o nome do professor.");
      return;
    }

    const formData = new FormData();

    if (cref.trim()) formData.append("cref", cref.trim());

    formData.append("nome", nome.trim());

    if (dataNascimento) formData.append("dataNascimento", dataNascimento);
    if (areaFormacao.trim()) formData.append("areaFormacao", areaFormacao.trim());

    formData.append("statusCref", statusCref);
    formData.append("qualificacoes", JSON.stringify(qualificacoes));
    formData.append("certificacoes", JSON.stringify(certificacoes));

    if (fotoUrl) formData.append("fotoUrl", fotoUrl);

    try {
      const res = await fetch(
        `${API.BASE_URL}/api/professores${id ? `/${id}` : ""}`,
        {
          method: id ? "PUT" : "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
          body: formData,
        }
      );

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
    const v = qualificacaoAtual.trim();
    if (v && !qualificacoes.includes(v)) {
      setQualificacoes([...qualificacoes, v]);
      setQualificacaoAtual("");
    }
  };

  const handleAddCertificacao = () => {
    const v = certificacaoAtual.trim();
    if (v && !certificacoes.includes(v)) {
      setCertificacoes([...certificacoes, v]);
      setCertificacaoAtual("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded shadow max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-green-800">
        {id ? "Editar" : "Novo"} Professor
      </h1>

      <label className="text-green-800">Nome</label>
      <input
        className="border p-2 w-full mb-4"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        required
      />

      <label className="text-green-800">CREF (opcional)</label>
      <input
        className="border p-2 w-full mb-4"
        value={cref}
        onChange={(e) => setCref(e.target.value)}
        placeholder="Ex: 12345-G/UF"
      />

      <label className="text-green-800">Status do CREF</label>
      <select
        className="border p-2 w-full mb-4"
        value={statusCref}
        onChange={(e) => setStatusCref(e.target.value as StatusCrefUI)}
      >
        <option value="ATIVO">Ativo</option>
        <option value="INATIVO">Inativo</option>
      </select>

      <label className="text-green-800">Data de Nascimento</label>
      <input
        type="date"
        className="border p-2 w-full mb-4"
        value={dataNascimento}
        onChange={(e) => setDataNascimento(e.target.value)}
      />

      <label className="text-green-800">Área de Formação</label>
      <input
        className="border p-2 w-full mb-4"
        value={areaFormacao}
        onChange={(e) => setAreaFormacao(e.target.value)}
      />

      <label className="text-green-800">Qualificações</label>
      <div className="flex gap-2 mb-2">
        <input
          value={qualificacaoAtual}
          onChange={(e) => setQualificacaoAtual(e.target.value)}
          className="border p-2 flex-grow"
        />
        <button
          type="button"
          onClick={handleAddQualificacao}
          className="bg-green-600 text-white px-4 py-1 rounded"
        >
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
        <button
          type="button"
          onClick={handleAddCertificacao}
          className="bg-green-600 text-white px-4 py-1 rounded"
        >
          +
        </button>
      </div>
      <ul className="list-disc pl-5 mb-4">
        {certificacoes.map((c, i) => <li key={i}>{c}</li>)}
      </ul>

      <label className="text-green-800 text-base mb-2">Foto do Professor (opcional)</label>
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
        <button
          type="button"
          className="bg-gray-300 px-4 py-2 rounded"
          onClick={() => (window.location.href = "/admin")}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
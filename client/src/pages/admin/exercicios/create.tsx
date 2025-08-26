"use client";

import { useEffect, useState } from "react";
import UploadVideo from "@/components/UploadVideo.js";
import { API } from "../../../config.js";

export default function CreateOrEditExercicio() {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaAtual, setCategoriaAtual] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [video, setVideo] = useState<File | null>(null); 

  const opcoesCategorias = ["Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exercicioId = params.get("id");
    if (exercicioId) {
      setId(exercicioId);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    fetch(`${API.BASE_URL}/api/exercicios/${id}`)
      .then(res => res.json())
      .then(data => {
        setCodigo(data.codigo);
        setNome(data.nome);
        setDescricao(data.descricao);
        setNivel(data.nivel);
        setCategorias(data.categorias || []);
      })
      .catch(() => alert("Erro ao carregar exercício"));
  }, [id]);

  const handleAddCategoria = () => {
    if (categoriaAtual && !categorias.includes(categoriaAtual)) {
      setCategorias([...categorias, categoriaAtual]);
      setCategoriaAtual("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("codigo", codigo);
    formData.append("nome", nome);
    formData.append("descricao", descricao);
    formData.append("nivel", nivel);
    formData.append("categorias", JSON.stringify(categorias));
    if (video) formData.append("video", video);

    try {
      const res = await fetch(`${API.BASE_URL}/api/exercicios${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: formData,
      });

      if (!res.ok) {
        const erro = await res.text();
        alert(`Erro ao ${id ? "editar" : "criar"} exercício: ${erro}`);
        return;
      }

      alert(`Exercício ${id ? "atualizado" : "criado"} com sucesso!`);
      window.location.href = "/admin";
    } catch (err) {
      alert("Erro ao enviar dados: " + err);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">{id ? "Editar Exercício" : "Novo Exercício"}</h2>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <label className="text-green-800">Código</label>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="border p-2 w-full rounded mb-4" />

        <label className="text-green-800">Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="border p-2 w-full rounded mb-4" />

        <label className="text-green-800">Descrição</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="border p-2 w-full rounded mb-4" />

        <label className="text-green-800">Nível</label>
        <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="border p-2 w-full rounded mb-4">
          <option>Base</option>
          <option>Avancado</option>
          <option>Performance</option>
        </select>

        <label className="text-green-800">Categorias</label>
        <div className="flex gap-2 mb-2">
          <select value={categoriaAtual} onChange={(e) => setCategoriaAtual(e.target.value)} className="border p-2 rounded w-full">
            <option value="">Selecione</option>
            {opcoesCategorias.map((cat, i) => (
              <option key={i} value={cat}>{cat}</option>
            ))}
          </select>
          <button type="button" onClick={handleAddCategoria} className="bg-green-600 text-white px-3 py-1 rounded">+</button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {categorias.map((cat, i) => (
            <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">{cat}</span>
          ))}
        </div>

        <UploadVideo onVideoSelect={setVideo} />

        <div className="flex justify-end gap-4">
          <button type="button" onClick={() => window.location.href = "/admin"} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-green-700 text-white rounded">
            {id ? "Salvar" : "Criar"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { API } from "../../../config.js";

export default function CriarOuEditarTreino() {
  const [id, setId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [professorId, setProfessorId] = useState("");
  const [exerciciosDisponiveis, setExerciciosDisponiveis] = useState<any[]>([]);
  const [professoresDisponiveis, setProfessoresDisponiveis] = useState<any[]>([]);
  const [exercicios, setExercicios] = useState<{ id: string; ordem: number; repeticoes: string }[]>([]);
  const [metas, setMetas] = useState("");
  const [pontuacao, setPontuacao] = useState<number | undefined>(undefined);
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);
  const opcoesCategorias = ["Sub9", "Sub11", "Sub13", "Sub15", "Sub17", "Sub20", "Livre"];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const treinoId = params.get("id");
    if (treinoId) {
      setId(treinoId);

      fetch(`${API.BASE_URL}/api/treinosprogramados/${treinoId}`)
        .then(res => res.json())
        .then(data => {
          setCodigo(data.codigo || "");
          setNome(data.nome || "");
          setDescricao(data.descricao || "");
          setNivel(data.nivel || "Base");
          setProfessorId(data.professorId || "");
          setMetas(data.metas || "");
          setPontuacao(data.pontuacao || 5);
          setExercicios(data.exercicios?.map((e: any) => ({
            id: e.exercicioId,
            ordem: e.ordem,
            repeticoes: e.repeticoes,
          })) || []);
          setCategoriasSelecionadas(data.categoria || []);
        });
    }

    fetch(`${API.BASE_URL}/api/exercicios`)
      .then(res => res.json())
      .then(setExerciciosDisponiveis);

    fetch(`${API.BASE_URL}/api/professores`)
      .then(res => res.json())
      .then(setProfessoresDisponiveis);
  }, []);

  const adicionarExercicio = () => {
    setExercicios([...exercicios, { id: "", ordem: exercicios.length + 1, repeticoes: "" }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (exercicios.some(e => !e.id)) {
      alert("Todos os exercícios devem estar selecionados.");
      return;
    }

    const payload = {
      codigo,
      nome,
      descricao,
      nivel,
      professorId,
      metas,
      pontuacao,
      categoria: categoriasSelecionadas,
      exercicios: exercicios
        .filter(e => e.id) 
        .map((ex, i) => ({
          exercicioId: ex.id,
          ordem: Number(ex.ordem ?? i + 1),
          repeticoes: ex.repeticoes ?? "",
        })),
    };

    const url = `${API.BASE_URL}/api/treinosprogramados${id ? `/${id}` : ""}`;
    const res = await fetch(url, {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("PUT/POST status:", res.status);
    const body = await res.json().catch(() => ({}));
    console.log("PUT/POST body:", body);

    if (!res.ok) {
      alert("Erro ao salvar treino.");
      return;
    }

    alert(`Treino ${id ? "atualizado" : "criado"} com sucesso!`);
    window.location.href = "/admin";
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white rounded shadow max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-green-800">{id ? "Editar" : "Novo"} Treino</h1>

      <label className="text-green-800">Código</label>
      <input className="border p-2 w-full mb-4" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />

      <label className="text-green-800">Nome</label>
      <input className="border p-2 w-full mb-4" value={nome} onChange={(e) => setNome(e.target.value)} required />

      <label className="text-green-800">Descrição</label>
      <textarea className="border p-2 w-full mb-4" value={descricao} onChange={(e) => setDescricao(e.target.value)} />

      <label className="text-green-800">Nível</label>
      <select className="border p-2 w-full mb-4" value={nivel} onChange={(e) => setNivel(e.target.value)}>
        <option value="Base">Base</option>
        <option value="Avancado">Avancado</option>
        <option value="Performance">Performance</option>
      </select>

      <label className="text-green-800">Professor</label>
      <select
        className="border p-2 w-full mb-4"
        value={professorId}
        onChange={(e) => setProfessorId(e.target.value)}
        required
      >
        <option value="">Selecione um professor</option>
        {professoresDisponiveis.map((prof) => (
          <option key={prof.id} value={prof.id}>
            {prof.nome} ({prof.codigo}) - {prof.cref}
          </option>
        ))}
      </select>

      <label className="text-green-800">Metas</label>
        <textarea
          className="border p-2 w-full mb-4"
          value={metas}
          onChange={(e) => setMetas(e.target.value)}
        />

        <label className="text-green-800">Pontuação</label>
        <input
          type="number"
          className="border p-2 w-full mb-4"
          value={pontuacao}
          onChange={(e) => setPontuacao(parseInt(e.target.value))}
        />

        <label className="text-green-800">Categorias</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {opcoesCategorias.map((cat) => (
            <label key={cat} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={categoriasSelecionadas.includes(cat)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCategoriasSelecionadas([...categoriasSelecionadas, cat]);
                  } else {
                    setCategoriasSelecionadas(categoriasSelecionadas.filter((c) => c !== cat));
                  }
                }}
              />
              {cat}
            </label>
          ))}
        </div>

      <label className="text-green-800">Exercícios do Treino</label>
      {exercicios.map((ex, idx) => (
        <div key={idx} className="mb-4 border p-3 rounded">
          <select
            className="border p-2 w-full mb-2"
            value={ex.id}
            onChange={(e) => {
              const novos = [...exercicios];
              novos[idx].id = e.target.value;
              setExercicios(novos);
            }}
            required
          >
            <option value="">Selecione um exercício</option>
            {exerciciosDisponiveis.map((exOpt) => (
              <option key={exOpt.id} value={exOpt.id}>
                {exOpt.nome} ({exOpt.codigo})
              </option>
            ))}
          </select>

          <div className="flex gap-4">
            <div className="flex-1">
              <label>Ordem</label>
              <input
                type="number"
                className="border p-2 w-full"
                value={ex.ordem}
                onChange={(e) => {
                  const novos = [...exercicios];
                  novos[idx].ordem = parseInt(e.target.value);
                  setExercicios(novos);
                }}
              />
            </div>

            <div className="flex-1">
              <label>Repetições</label>
              <input
                type="text"
                className="border p-2 w-full"
                value={ex.repeticoes}
                onChange={(e) => {
                  const novos = [...exercicios];
                  novos[idx].repeticoes = e.target.value;
                  setExercicios(novos);
                }}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={adicionarExercicio} className="bg-green-800 text-white px-3 ml-3 py-1 rounded mb-4">
        + Adicionar Exercício
      </button>

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

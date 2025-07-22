"use client";

import { useEffect, useState } from "react";

interface Exercicio {
  id: string;
  nome: string;
  codigo: string;
}

interface Professor {
  id: string;
  usuario?: { nome: string };
  codigo: string;
  cref: string;
}

interface TreinoExercicio {
  exercicioId: string;
  ordem: number;
  repeticoes: string;
}

export default function CriarTreino() {
  const [titulo, setTitulo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nivel, setNivel] = useState("Base");
  const [descricao, setDescricao] = useState("");
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [profSelecionado, setProfSelecionado] = useState("");
  const [treinoExercicios, setTreinoExercicios] = useState<TreinoExercicio[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/exercicios")
      .then((res) => res.json())
      .then((data) => {
        setExercicios(data);
      });

    fetch("http://localhost:3001/api/professores")
      .then((res) => res.json())
      .then((data) => {
        setProfessores(data);
      });
  }, []);

  const adicionarExercicio = () => {
    setTreinoExercicios((prev) => [
      ...prev,
      { exercicioId: "", ordem: prev.length + 1, repeticoes: "" },
    ]);
  };

  const atualizarExercicio = <K extends keyof TreinoExercicio>(
    index: number,
    campo: K,
    valor: TreinoExercicio[K]
  ) => {
    const atualizados = [...treinoExercicios];
    atualizados[index][campo] = valor;
    setTreinoExercicios(atualizados);
  };

  const removerExercicio = (index: number) => {
    const atualizados = [...treinoExercicios];
    atualizados.splice(index, 1);
    setTreinoExercicios(atualizados);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const temExercicioSemId = treinoExercicios.some((ex) => !ex.exercicioId);
      if (temExercicioSemId) {
        alert("Por favor, selecione todos os exercícios.");
        return;
      }
    if (!profSelecionado) {
      alert("Por favor, selecione um professor responsável.");  
      return;
    }
    if (!titulo || !codigo || !profSelecionado) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }


    const response = await fetch("http://localhost:3001/api/treinosprogramados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: titulo,
        codigo,
        nivel,
        descricao,
        professorId: profSelecionado,
        exercicios: treinoExercicios,
      }),
    });

    if (response.status === 400) {
      const erro = await response.json();
      alert(erro.message);
      return;
    }

    if (response.ok) {
      alert("Treino criado com sucesso!");
      window.location.href = "/admin"; 
    } else {
      const error = await response.json();
      console.error("Erro ao criar treino:", error);
      alert("Erro ao criar treino.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-4">Novo Treino</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-base -mb-2  text-green-800">Codigo</label>
          <input
            type="text"
            placeholder="TR001"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="border p-2 rounded"
            required
          />

          <label className="text-base -mb-2 text-green-800">Nível</label>
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="Base">Base</option>
            <option value="Avancado">Avançado</option>
            <option value="Performance">Performance</option>
          </select>
        </div>

        <label className="text-base -mb-2  text-green-800">Professor </label>
          
        <select
          value={profSelecionado}
          onChange={(e) => setProfSelecionado(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Professor Responsável</option>
          {professores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.usuario?.nome} ({p.codigo}) - CREF: {p.cref}
            </option>
          ))}
        </select>

          <label className="text-base -mb-2  text-green-800">Nome</label>
          
       <input
          type="text"
          placeholder="Nome do treino"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="border p-2 rounded"
        />

<label className="text-base -mb-2  text-green-800">Descrição </label>
          
       <textarea
          placeholder="Descrição do treino"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="border p-2 rounded"
        />

        <div>
          <h2 className="font-semibold text-green-800 mb-2">Exercícios do Treino</h2>
          {treinoExercicios.map((item, index) => (
            <div key={index} className="flex gap-2 mb-2 items-center">
              <select
                value={item.exercicioId}
                onChange={(e) =>
                  atualizarExercicio(index, "exercicioId", e.target.value)
                }
                className="border p-2 rounded w-1/2"
              >
                <option value="">Selecione o exercício</option>
                {exercicios.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.nome} ({ex.codigo})
                  </option>
                ))}
              </select>

              <input
                type="number"
                value={item.ordem}
                onChange={(e) =>
                  atualizarExercicio(index, "ordem", Number(e.target.value))
                }
                className="border p-2 rounded w-16"
                min={1}
              />

              <input
                type="text"
                placeholder="3x10 ou 30s"
                value={item.repeticoes}
                onChange={(e) =>
                  atualizarExercicio(index, "repeticoes", e.target.value)
                }
                className="border p-2 rounded w-32"
              />

              <button
                type="button"
                onClick={() => removerExercicio(index)}
                className="text-red-500 text-xl"
              >
                🗑
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={adicionarExercicio}
            className="text-green-700 font-semibold mt-2 flex items-center gap-1"
          >
            <span className="text-xl text-green-800">+</span> Adicionar Exercício
          </button>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            type="submit"
            className="bg-green-700 text-white px-4 py-2 rounded"
          >
            Criar
          </button>
          <button
            type="button"
            className="bg-gray-300 px-4 py-2 rounded"
            onClick={() => history.back()}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

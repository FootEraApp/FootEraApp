import { useState } from "react";
import { useLocation } from "wouter";
import Storage from "../../../server/utils/storage.js";
import { API } from "../config.js";

export default function TreinoLivreNovo() {
  const [, navigate] = useLocation();
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState("");
  const [duracaoMin, setDuracaoMin] = useState<number>(30);
  const [tipoAtividade, setTipoAtividade] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");

  async function salvar() {
    const token = (Storage as any).token ?? localStorage.getItem("token");
    const atletaId = (Storage as any).tipoUsuarioId ?? localStorage.getItem("tipoUsuarioId");
    if (!token || !atletaId) return alert("Sessão expirada.");

    try {
      const r = await fetch(`${API.BASE_URL}/api/treinos-livres`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          atletaId,
          descricao,
          data: data ? new Date(data).toISOString() : new Date().toISOString(),
          duracaoMin,
          tipoAtividade: tipoAtividade || null,
          categoria: categoria || null,
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        console.error("Falha ao salvar treino livre:", r.status, txt);
        return alert("Não foi possível salvar o treino.");
      }
      alert("Treino livre registrado!");
      navigate("/treinos/livre");
    } catch (e) {
      console.error(e);
      alert("Erro inesperado.");
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-lg font-bold mb-4">Registrar Treino Livre</h2>
      <label className="block text-sm mb-1">Descrição da atividade</label>
      <input
        className="border w-full p-2 rounded mb-3"
        placeholder='Ex.: "Corrida de 5km" ou "Chute a gol 30min"'
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <label className="block text-sm mb-1">Data</label>
      <input
        type="datetime-local"
        className="border w-full p-2 rounded mb-3"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <label className="block text-sm mb-1">Duração (min)</label>
      <input
        type="number"
        min={1}
        className="border w-full p-2 rounded mb-3"
        value={duracaoMin}
        onChange={(e) => setDuracaoMin(parseInt(e.target.value || "0") || 0)}
      />

      <label className="block text-sm mb-1">Tipo</label>
      <select
        className="border w-full p-2 rounded mb-3"
        value={tipoAtividade}
        onChange={(e) => setTipoAtividade(e.target.value)}
      >
        <option value="">—</option>
        <option value="Fisico">Físico</option>
        <option value="Tecnico">Técnico</option>
        <option value="Tatico">Tático</option>
        <option value="Outro">Outro</option>
      </select>

      <label className="block text-sm mb-1">Categoria (opcional)</label>
      <input
        className="border w-full p-2 rounded mb-4"
        placeholder='Ex.: "Base", "Avançado"'
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      />

      <div className="flex gap-2 justify-end">
        <button onClick={() => navigate("/treinos")} className="px-4 py-2 rounded border">
          Cancelar
        </button>
        <button onClick={salvar} className="px-4 py-2 rounded bg-emerald-700 text-white">
          Salvar
        </button>
      </div>
    </div>
  );
}
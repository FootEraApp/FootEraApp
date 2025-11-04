import { useEffect, useState } from "react";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

export default function ScoutNotes({ atletaId }: { atletaId: string }) {
  const [texto, setTexto] = useState("");
  const [houveAumento, setHouAum] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch(`${API.BASE_URL}/scout/notes?atletaId=${atletaId}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${Storage.token}` }
      });
      const j = await r.json();
      setTexto(j.texto || "");
      setHouAum(!!j.houveAumento);
    })();
  }, [atletaId]);

  async function salvar(markSeen = false) {
    setSalvando(true);
    await fetch(`${API.BASE_URL}/scout/notes`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Storage.token}`,
      },
      body: JSON.stringify({ atletaId, texto, markSeen }),
      credentials: "include",
    });
    setSalvando(false);
    if (markSeen) setHouAum(false);
  }

  return (
    <div className="rounded-lg border p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Minhas anotações</h3>
        {houveAumento && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">⚡ Pontuação ↑ desde a última visita</span>}
      </div>
      <textarea
        className="w-full border rounded p-2 min-h-[120px]"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva suas observações aqui..."
      />
      <div className="flex gap-2 mt-2">
        <button onClick={() => salvar(false)} disabled={salvando} className="px-3 py-1 rounded bg-green-700 text-white">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button onClick={() => salvar(true)} disabled={salvando} className="px-3 py-1 rounded border">
          Salvar e marcar como visto
        </button>
      </div>
    </div>
  );
}
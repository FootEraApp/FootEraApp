import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { API } from "../../config.js";
import Storage from "../../../../server/utils/storage.js";

type Status = "PENDING" | "IN_PROGRESS" | "COMPLETED";

type Props = {
  treinoId: string;         
  className?: string;
};

export default function AcoesTreino({ treinoId, className }: Props) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [loading, setLoading] = useState(false);
  const [openFinish, setOpenFinish] = useState(false);
  const [tempoSeg, setTempoSeg] = useState<number | "">("");
  const [repeticoes, setRepeticoes] = useState<number | "">("");
  const [observacao, setObservacao] = useState("");
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = Storage.token;
    if (!token || !treinoId) return;

    (async () => {
      try {
        const r = await fetch(
          `${API.BASE_URL}/api/treinos/${encodeURIComponent(
            treinoId
          )}/status`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const d = await r.json();
        setStatus((d?.status as Status) ?? "PENDING");
      } catch {
        setStatus("PENDING");
      }
    })();
  }, [treinoId]);

  async function start() {
    const token = Storage.token;
    if (!token) return toast.error("Sessão expirada.");
    try {
      setLoading(true);
      const r = await fetch(
        `${API.BASE_URL}/api/treinos/${encodeURIComponent(
          treinoId
        )}/start`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!r.ok) {
        const err = await r.json().catch(() => null);
        const msg =
          err?.mensagem ||
          err?.message ||
          err?.error ||
          "Não foi possível iniciar o treino.";
        toast.error(msg);
        return;
      }

      setStatus("IN_PROGRESS");
      setInfoMsg(null);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível iniciar o treino.");
    } finally {
      setLoading(false);
    }
  }

  async function complete() {
    const token = Storage.token;
    if (!token) return toast.error("Sessão expirada.");
    try {
      setLoading(true);
      const r = await fetch(
        `${API.BASE_URL}/api/treinos/${encodeURIComponent(
          treinoId
        )}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tempoSeg: tempoSeg === "" ? undefined : Number(tempoSeg),
            repeticoes:
              repeticoes === "" ? undefined : Number(repeticoes),
            observacao: observacao || undefined,
          }),
        }
      );

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        const msg =
          data?.mensagem ||
          data?.message ||
          data?.error ||
          "Não foi possível concluir o treino.";
        toast.error(msg);
        return;
      }

      const penalidade = !!data?.penalidadeAtraso;
      const minutosConsiderados = data?.minutosConsiderados ?? null;

      let msg: string;

      if (penalidade) {
        msg =
          data?.mensagem ||
          "Treino finalizado com atraso. Você recebeu menos pontos e só parte do tempo de treino.";
      } else {
        msg =
          data?.mensagem ||
          "Treino concluído com sucesso! Pontos e minutos contabilizados normalmente.";
      }

      if (minutosConsiderados != null) {
        msg += ` (Tempo considerado: ${minutosConsiderados} min.)`;
      }

      setStatus("COMPLETED");
      setOpenFinish(false);
      setInfoMsg(msg);
      toast.error(msg);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível concluir o treino.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      {status === "PENDING" && (
        <button
          onClick={start}
          disabled={loading}
          className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-60"
        >
          {loading ? "Iniciando..." : "Iniciar treino"}
        </button>
      )}

      {status === "IN_PROGRESS" && (
        <button
          onClick={() => setOpenFinish(true)}
          className="px-4 py-2 rounded bg-amber-500 text-white"
        >
          Concluir treino
        </button>
      )}

      {status === "COMPLETED" && (
        <span className="px-3 py-1 rounded bg-green-100 text-green-800 text-sm">
          Concluído
        </span>
      )}

      {infoMsg && (
        <p className="mt-2 text-xs text-amber-700 max-w-xs">
          {infoMsg}
        </p>
      )}

      {openFinish && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-80">
            <h3 className="font-semibold mb-3">Finalizar treino</h3>

            <label className="block text-sm mb-1">Tempo (segundos)</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2 mb-3"
              value={tempoSeg}
              onChange={(e) =>
                setTempoSeg(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />

            <label className="block text-sm mb-1">Repetições</label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2 mb-3"
              value={repeticoes}
              onChange={(e) =>
                setRepeticoes(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />

            <label className="block text-sm mb-1">
              Observação (opcional)
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 mb-4"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Como foi o treino?"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setOpenFinish(false)}
                className="px-3 py-2 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={complete}
                disabled={loading}
                className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-60"
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
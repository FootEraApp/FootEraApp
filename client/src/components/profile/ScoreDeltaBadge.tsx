import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowUp } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

type Props = { usuarioId: string };

export default function ScoreDeltaBadge({ usuarioId }: Props) {
  const [delta, setDelta] = useState(0);
  const token = Storage.token;

  useEffect(() => {
    if (!usuarioId || !token) return;
    (async () => {
      const { data } = await axios.get(
        `${API.BASE_URL}/api/perfil/${encodeURIComponent(usuarioId)}/pontuacao`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const perf = Number(data?.performance) || 0;
      const disc = Number(data?.disciplina) || 0;
      const resp = Number(data?.responsabilidade) || 0;
      const totalAtual = perf + disc + resp;

      const viewerId = String(Storage?.usuarioId ?? "");
      const key = `lastSeenScore:${viewerId}:${usuarioId}`;
      const last = Number(localStorage.getItem(key) ?? 0);
      const d = Math.max(0, totalAtual - last);
      setDelta(d);

      setTimeout(() => {
        try { localStorage.setItem(key, String(totalAtual)); } catch {}
      }, 2000);
    })().catch(() => {});
  }, [usuarioId, token]);

  if (delta <= 0) return null;

  return (
    <div title={`+${delta} desde sua última visita`} className="flex items-center gap-1 text-green-200 text-xs bg-green-900/30 border border-green-200/30 rounded px-2 py-0.5">
      <ArrowUp size={16} />
      <span>+{delta}</span>
    </div>
  );
}

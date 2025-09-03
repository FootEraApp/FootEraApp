import React, { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { BarChart2, Clock3, ShieldCheck } from "lucide-react";
import Storage from "../../../../server/utils/storage.js";
import { API } from "../../config.js";

type ScorePanelProps = {
  performance?: number;
  disciplina?: number;
  responsabilidade?: number;
};

export default function ScorePanel({
  performance,
  disciplina,
  responsabilidade,
}: ScorePanelProps) {
  const [matched, params] = useRoute<{ id?: string }>("/perfil/:id");

  const me = String(Storage?.usuarioId ?? "");
  const targetId = matched && params?.id ? params.id! : me;
  const isOwn = !matched || params?.id === me; // mantém só pra navegação da UI

  const [vals, setVals] = useState({
    performance: performance ?? 0,
    disciplina: disciplina ?? 0,
    responsabilidade: responsabilidade ?? 0,
  });

  // props -> estado
  useEffect(() => {
    setVals({
      performance: performance ?? 0,
      disciplina: disciplina ?? 0,
      responsabilidade: responsabilidade ?? 0,
    });
  }, [performance, disciplina, responsabilidade]);

  // API -> estado (sempre /perfil/:id/pontuacao)
  useEffect(() => {
    if (!targetId) return;
    const token = Storage?.token || "";
    const url = `${API.BASE_URL}/api/perfil/${encodeURIComponent(targetId)}/pontuacao`;

    (async () => {
      try {
        const r = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r.ok) return; // 404/401/etc -> mantém valores atuais
        const data = await r.json();
        setVals({
          performance: Number(data?.performance) || 0,
          disciplina: Number(data?.disciplina) || 0,
          responsabilidade: Number(data?.responsabilidade) || 0,
        });
      } catch {}
    })();
  }, [targetId]);

  const hrefPontuacao = isOwn ? "/perfil/pontuacao" : `/perfil/${targetId}/pontuacao`;

  return (
    <Link href={hrefPontuacao} className="no-underline block">
      <h1 className="text-green-900 text-xl p-4">Pontuação Detalhada</h1>
      <div className="grid gap-3 cursor-pointer">
        <div className="flex items-center justify-between bg-transparent border rounded-lg p-3 hover:bg-green-50 transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-green-900 text-white flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-green-900 uppercase">
              PERFORMANCE
            </span>
          </div>
          <span className="text-sm font-bold text-green-900">{vals.performance} pts</span>
        </div>

        <div className="flex items-center justify-between bg-transparent border rounded-lg p-3 hover:bg-blue-50 transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-blue-900 text-white flex items-center justify-center">
              <Clock3 className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-blue-900 uppercase">
              DISCIPLINA
            </span>
          </div>
          <span className="text-sm font-bold text-blue-900">{vals.disciplina} pts</span>
        </div>

        <div className="flex items-center justify-between bg-transparent border rounded-lg p-3 hover:bg-amber-50 transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-amber-700 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold tracking-wide text-amber-800 uppercase">
              RESPONSABILIDADE
            </span>
          </div>
          <span className="text-sm font-bold text-amber-800">{vals.responsabilidade} pts</span>
        </div>
      </div>
    </Link>
  );
}

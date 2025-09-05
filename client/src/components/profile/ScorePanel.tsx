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

function pickNumber(...vals: any[]): number {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const m = v.match(/-?\d+(?:\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return 0;
}

const treinoNomeToPontos: Record<string, number> = {
  "resistencia fisica": 15,
  "resistência física": 15, // deixe a acentuada também p/ segurança
  // adicione outros mapeamentos locais se quiser fallback quando o servidor não mandar
};

function normalizaTitulo(t?: string) {
  return (t || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// antes: função grande que vasculha qualquer número
function pontosDoEvento(event: any): number {
  const direto = pickNumber(
    event?.pontuacao, event?.pontos, event?.pontosPerformance, event?.pontosDesafio,
    event?.score, event?.totalPontos, event?.valor, event?.xp
  );
  if (direto) return direto;

  // ⛔️ REMOVA a varredura "walk" que somava números de QUALQUER lugar
  // ...

  const titulo = normalizaTitulo(event?.titulo || event?.nome || event?.descricao);
  let porNome = 0;
  for (const [nome, pts] of Object.entries(treinoNomeToPontos)) {
    if (titulo.includes(normalizaTitulo(nome))) porNome = Math.max(porNome, pts);
  }
  return porNome;
}

 function sumPointsFromCategories(cats: any): number {
  if (!cats || typeof cats !== "object") return 0;
  let sum = 0;
  const reChave = /(ponto|pontu|score|nota|valor|total|perf)/i;

  const walk = (obj: any) => {
    if (obj == null) return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number" && Number.isFinite(v) && reChave.test(k)) sum += v;
        else if (typeof v === "string" && reChave.test(k)) {
          const n = pickNumber(v);
          if (n) sum += n;
        } else {
          walk(v);
        }
      }
    }
  };

  walk(cats);
  return sum;
}

function computeFromHistorico(wire?: any) {
  const hist: any[] = Array.isArray(wire?.historico) ? wire.historico : [];

  const isTreino = (t: any) =>
    /treino/i.test(String(t?.tipo ?? t?.categoria ?? ""));
  const isDesafio = (t: any) =>
    /desaf/i.test(String(t?.tipo ?? t?.categoria ?? ""));
  const isConcluido = (t: any) => {
    const s = String(t?.status ?? t?.situacao ?? "").toLowerCase();
    return !s || s.includes("conclu");
  };

  const treinos  = hist.filter((t) => isTreino(t)  && isConcluido(t));
  const desafios = hist.filter((t) => isDesafio(t) && isConcluido(t));

  const perfHist = [...treinos, ...desafios].reduce((acc, ev) => acc + pontosDoEvento(ev), 0);

  const perfCats = sumPointsFromCategories(wire?.categorias);

  const perfApi  = Number(wire?.performance ?? 0);
  const performance = Math.max(perfHist, perfCats, perfApi);

  const disciplina       = treinos.length  * 2;
  const responsabilidade = desafios.length * 2;

  return {
    performance,
    disciplina,
    responsabilidade,
    total: performance + disciplina + responsabilidade,
  };
}

export default function ScorePanel({
  performance,
  disciplina,
  responsabilidade,
}: ScorePanelProps) {
  const [matched, params] = useRoute<{ id?: string }>("/perfil/:id");

  const me = String(Storage?.usuarioId ?? "");
  const targetId = matched && params?.id ? params.id! : me;
  const isOwn = !matched || params?.id === me;

  const [vals, setVals] = useState({
    performance: performance ?? 0,
    disciplina: disciplina ?? 0,
    responsabilidade: responsabilidade ?? 0,
  });

  useEffect(() => {
    setVals({
      performance: performance ?? 0,
      disciplina: disciplina ?? 0,
      responsabilidade: responsabilidade ?? 0,
    });
  }, [performance, disciplina, responsabilidade]);

    useEffect(() => {
      if (!targetId) return;
      const token = Storage?.token || "";
      const url = API.BASE_URL + `/api/perfil/${encodeURIComponent(targetId)}/pontuacao`;

      (async () => {
        try {
          const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
          if (r.status !== 200) return;
          const data = await r.json();

          console.log("[ScorePanel] payload /pontuacao:", data);

          // 1º: confiar no servidor
          const perfApi = Number(data?.performance) || 0;
          const discApi = Number(data?.disciplina) || 0;
          const respApi = Number(data?.responsabilidade) || 0;

          if (perfApi || discApi || respApi) {
            setVals({ performance: perfApi, disciplina: discApi, responsabilidade: respApi });
            // debug:
            console.table((data?.historico || []).map((h: any) => ({
              tipo: h.tipo, titulo: h.titulo, origem: h.origem, pts: h.pontuacao
            })));
            console.log("[ScorePanel] totais API =>", {
              perf: data?.performance, disc: data?.disciplina, resp: data?.responsabilidade
            });
            return;
          }

          // 2º: fallback calculado localmente
          const calc = computeFromHistorico(data);
          console.log("[ScorePanel] calculado (fallback):", calc);
          setVals({
            performance: calc.performance,
            disciplina: calc.disciplina,
            responsabilidade: calc.responsabilidade,
          });
        } catch (e) {
          console.error(e);
        }
      })();
    }, [targetId]);

  const hrefPontuacao = `/perfil/pontuacao`;

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

        <div className="flex items-center justify-between bg-transparent border rounded-lg p-3 hover:bg-amber-50 transition mb-10">
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

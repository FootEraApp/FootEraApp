import type { ExItemUI } from "./treinos.types.js";

type ExPayloadExistente = {
  exercicioId: string;
  ordem: number;
  repeticoes: string | null;
  exercicioPersonalizadoId?: string | null;
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
};

type ExPayloadTemporario = {
  nome: string;
  descricao: string | null;
  series: string | null;
  repeticoes: string | null;
  ordem: number;
  exercicioPersonalizadoId?: string | null;
  videoDemonstrativoUrl?: string | null;
  videoPosterUrl?: string | null;
};

type ExPayload = ExPayloadExistente | ExPayloadTemporario;

function normalizeText(v: unknown) {
  return (v ?? "").toString().trim();
}

function montarRepsTexto(item: ExItemUI) {
  const seriesRaw = normalizeText(item.series);
  const repsRaw = normalizeText(item.repeticoes);

  const repeticoesTexto = normalizeText((item as any).repeticoesTexto);
  if (repeticoesTexto) return repeticoesTexto;

  if (seriesRaw && repsRaw) return `${seriesRaw}x ${repsRaw}`;
  if (repsRaw) return repsRaw;
  if (seriesRaw) return `${seriesRaw}x`;

  return "";
}

type ExPayloadOrNull = ExPayload | null;

function isExPayload(x: ExPayloadOrNull): x is ExPayload {
  return x !== null;
}

export function montarExerciciosParaPayload(lista: ExItemUI[]): ExPayload[] {
  return lista
    .map<ExPayloadOrNull>((item, idx) => {
      const ordem = idx + 1;
      const repsTexto = montarRepsTexto(item);
      const persId = normalizeText((item as any).exercicioPersonalizadoId);

      if (item.exercicioId && !persId) {
        return {
          exercicioId: item.exercicioId,
          ordem,
          repeticoes: repsTexto || null,
        } satisfies ExPayloadExistente;
      }

      const nome = normalizeText(item.nome);
      if (!nome) return null;

      const seriesRaw = normalizeText(item.series);

      return {
        nome,
        descricao: (item.descricao ?? null) as string | null,
        series: seriesRaw || null,
        repeticoes: repsTexto || null,
        ordem,
        exercicioPersonalizadoId: persId || null,
        videoDemonstrativoUrl:
          normalizeText((item as any).videoDemonstrativoUrl || (item as any).videoUrl) ||
          null,

        videoPosterUrl: normalizeText((item as any).videoPosterUrl) || null,
      } satisfies ExPayloadTemporario;
    })
    .filter(isExPayload);
}

export function parseRepeticoesStr(str?: string) {
  if (!str) return { series: "", repeticoes: "" };

  const trimmed = str.trim();
  const m = trimmed.match(/^(\d+)\s*[xX]\s*(\d+)$/);

  if (!m) {
    return { series: "", repeticoes: trimmed };
  }

  return { series: m[1], repeticoes: m[2] };
}

import type { ExItemUI } from "./treinos.types.js";

type ExPayloadExistente = {
  exercicioId: string;
  ordem: number;
  repeticoes: string | null;
};

type ExPayloadTemporario = {
  nome: string;
  descricao: string | null;
  series: string | null;
  repeticoes: string | null;
  ordem: number;
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

export function montarExerciciosParaPayload(lista: ExItemUI[]): ExPayload[] {
  return lista
    .map((item, idx) => {
      const ordem = idx + 1;
      const repsTexto = montarRepsTexto(item);

      if (item.exercicioId) {
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
      } satisfies ExPayloadTemporario;
    })
    .filter((x): x is ExPayload => x !== null);
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

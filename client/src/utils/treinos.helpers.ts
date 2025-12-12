// client/src/utils/treinos.helpers.ts
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
  repeticoes: string | null; // aqui você pode mandar "3x 12" também se quiser
  ordem: number;
};

type ExPayload = ExPayloadExistente | ExPayloadTemporario;

function normalizeText(v: unknown) {
  return (v ?? "").toString().trim();
}

/**
 * Monta o texto final que vai pro BD em TreinoProgramadoExercicio.repeticoes
 * Preferência:
 * 1) repeticoesTexto
 * 2) series + repeticoes => "3x 12"
 * 3) repeticoes => "12"
 * 4) series => "3x"
 */
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

/**
 * Payload para salvar no TreinoProgramado (backend normalmente cria TreinoProgramadoExercicio)
 * - Exercício existente: { exercicioId, ordem, repeticoes }
 * - Exercício personalizado: { nome, descricao, series, repeticoes, ordem }
 */
export function montarExerciciosParaPayload(lista: ExItemUI[]): ExPayload[] {
  return lista
    .map((item, idx) => {
      const ordem = idx + 1;
      const repsTexto = montarRepsTexto(item);

      // 1) Exercício existente
      if (item.exercicioId) {
        return {
          exercicioId: item.exercicioId,
          ordem,
          repeticoes: repsTexto || null,
        } satisfies ExPayloadExistente;
      }

      // 2) Personalizado
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

/**
 * Parse do formato "3x 12" para preencher inputs separados.
 * Se não bater, joga tudo em repeticoes.
 */
export function parseRepeticoesStr(str?: string) {
  if (!str) return { series: "", repeticoes: "" };

  const trimmed = str.trim();
  const m = trimmed.match(/^(\d+)\s*[xX]\s*(\d+)$/);

  if (!m) {
    return { series: "", repeticoes: trimmed };
  }

  return { series: m[1], repeticoes: m[2] };
}

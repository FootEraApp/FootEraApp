export type TipoInferido = "Físico" | "Técnico" | "Tático" | "Mental" | null;

export function inferirTipoTreino(input: {
  nome?: string | null;
  tipoTreino?: string | null;   
  categorias?: string[] | null;
}): TipoInferido {
  const items = [
    input.tipoTreino,
    ...(input.categorias ?? []),
    input.nome,
  ].filter(Boolean) as string[];

  if (items.length === 0) return null;

  const base = items
    .join(" ")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (/(fisic|resist|forc|condicionament|corrid|agach|abdom)/.test(base)) return "Físico";
  if (/(tecnic|passe|dribl|finaliz|conduc|bola|domini)/.test(base))       return "Técnico";
  if (/(tatic|posicion|estrateg|press|marcac|jogo posicional)/.test(base)) return "Tático";
  if (/(mental|concentr|psicol|emocion)/.test(base))                      return "Mental";
  return null;
}
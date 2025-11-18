export type PlanoAtleta = "FREE" | "PRO" | string;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getRangeFromQuery(
  query: any,
  defaultDays: number
): { from: Date; to: Date } {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from
    ? new Date(String(query.from))
    : new Date(to.getTime() - defaultDays * DAY_MS);

  return { from, to };
}

export function validarJanelaAtleta(
  plano: PlanoAtleta,
  from: Date,
  to: Date
) {
  const diffMs = to.getTime() - from.getTime();
  const diffDias = diffMs / DAY_MS;

  const limite = plano === "FREE" ? 30 : 365;

  if (diffDias > limite) {
    const msg =
      plano === "FREE"
        ? "No plano Free você só pode consultar até 30 dias de histórico."
        : "No plano Pro você só pode consultar no máximo 12 meses de histórico.";

    const err: any = new Error(msg);
    err.code = "WINDOW_TOO_LARGE";
    err.limiteDias = limite;
    throw err;
  }
}

export function aplicarCorteEscolinha(
  from: Date,
  to: Date
): { from: Date; to: Date } {
  const limiteMs = 365 * DAY_MS;
  const diffMs = to.getTime() - from.getTime();

  if (diffMs > limiteMs) {
    const novoFrom = new Date(to.getTime() - limiteMs);
    return { from: novoFrom, to };
  }

  return { from, to };
}

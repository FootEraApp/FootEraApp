// client/src/utils/treinos.helpers.ts
import type { ExItemUI } from "./treinos.types";

export function montarExerciciosParaPayload(itensUI: ExItemUI[]) {
  return (itensUI || [])
    .map((it, idx) => {
      const ordem = typeof it.ordem === "number" ? it.ordem : idx + 1;

      if (it.idCatalogo) {
        // exercício do banco
        return {
          exercicioId: it.idCatalogo,
          repeticoes: it.repeticoes ?? null,
          ordem,
        };
      }

      // exercício temporário
      return {
        nome: (it.nome || "").trim(),
        descricao: it.descricao ?? null,
        repeticoes: it.repeticoes ?? null,
        ordem,
      };
    })
    // remove temporário sem nome
    .filter((e) => ("exercicioId" in e) || (typeof (e as any).nome === "string" && (e as any).nome.length > 0));
}

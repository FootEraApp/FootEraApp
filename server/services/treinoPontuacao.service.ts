import { prisma } from "../prisma.js";

export type ExercicioPontuavel = {
  exercicioId?: string | null;
  exercicioPersonalizadoId?: string | null;
  exercicioTemporarioId?: string | null;
  nivel?: string | null;
};

export type EntradaPontuacaoTreino = {
  nivel?: string | null;
  tipoTreino?: string | null;
  duracao?: number | string | null;
  exercicios: ExercicioPontuavel[];
};

const normalizar = (valor: unknown): string =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const PONTOS_NIVEL: Record<string, number> = {
  base: 0,
  avancado: 10,
  performance: 20,
};
const PONTOS_TIPO: Record<string, number> = {
  tecnico: 5,
  fisico: 6,
  tatico: 8,
  mental: 5,
};
const PONTOS_EXERCICIO: Record<string, number> = {
  base: 4,
  avancado: 6,
  performance: 8,
};

export function calcularPontuacaoTreinoOficial(entrada: EntradaPontuacaoTreino) {
  const nivel = normalizar(entrada.nivel);
  const tipo = normalizar(entrada.tipoTreino);
  const duracao = Number(entrada.duracao ?? 0);
  const pontosNivel = PONTOS_NIVEL[nivel] ?? 0;
  const pontosTipo = PONTOS_TIPO[tipo] ?? 0;
  const pontosDuracao =
    Number.isFinite(duracao) && duracao > 0 ? Math.floor(duracao / 15) : 0;
  const pontosExercicios = entrada.exercicios.reduce((total, exercicio) => {
    const nivelExercicio = normalizar(exercicio.nivel) || nivel;
    return total + (PONTOS_EXERCICIO[nivelExercicio] ?? PONTOS_EXERCICIO[nivel] ?? 4);
  }, 0);
  return {
    total: pontosNivel + pontosTipo + pontosDuracao + pontosExercicios,
    nivel: pontosNivel,
    tipo: pontosTipo,
    duracao: pontosDuracao,
    exercicios: pontosExercicios,
    quantidadeExercicios: entrada.exercicios.length,
  };
}

/** Resolve dificuldade por ID real no banco, nunca confia no nível enviado pelo cliente. */
export async function calcularPontuacaoTreinoPersistencia(entrada: EntradaPontuacaoTreino) {
  const catalogoIds = [...new Set(entrada.exercicios.map(e => e.exercicioId).filter((id): id is string => Boolean(id)))];
  const personalizadosIds = [...new Set(entrada.exercicios.map(e => e.exercicioPersonalizadoId).filter((id): id is string => Boolean(id)))];
  const temporariosIds = [...new Set(entrada.exercicios.map(e => e.exercicioTemporarioId).filter((id): id is string => Boolean(id)))];

  const [catalogo, personalizados, temporarios] = await Promise.all([
    catalogoIds.length ? prisma.exercicio.findMany({ where: { id: { in: catalogoIds } }, select: { id: true, nivel: true } }) : [],
    personalizadosIds.length ? prisma.exercicioPersonalizado.findMany({ where: { id: { in: personalizadosIds } }, select: { id: true, nivel: true } }) : [],
    temporariosIds.length ? prisma.exercicioTemporario.findMany({ where: { id: { in: temporariosIds } }, select: { id: true, nivel: true } }) : [],
  ]);
  const niveis = new Map<string, string | null>();
  for (const item of [...catalogo, ...personalizados, ...temporarios]) {
    niveis.set(item.id, item.nivel ?? null);
  }

  return calcularPontuacaoTreinoOficial({
    ...entrada,
    exercicios: entrada.exercicios.map(ex => ({
      ...ex,
      nivel: niveis.get(ex.exercicioId ?? ex.exercicioPersonalizadoId ?? ex.exercicioTemporarioId ?? "") ?? entrada.nivel,
    })),
  });
}
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type TreinoUsoInput = {
  treinoId: string;                
  professorId?: string | null;    
};

type ExercicioIncluidoInput = {
  treinoId: string;              
  exercicioId: string;              
  professorId?: string | null;    
};

export async function onTreinoUsadoPorProfessor(input: TreinoUsoInput) {
  const { treinoId, professorId } = input;
  if (!treinoId) return;

  const now = new Date();

  await prisma.$transaction([
    prisma.estatisticaTreino.upsert({
      where: { treinoId },
      create: {
        treinoId,
        usosProfessores: 1,
        ultimoUsoEm: now,
      },
      update: {
        usosProfessores: { increment: 1 },
        ultimoUsoEm: now,
      },
    }),
    ...(professorId
      ? [
          prisma.treinoProfessorUso.upsert({
            where: { treinoId_professorId: { treinoId, professorId } },
            create: {
              treinoId,
              professorId,
              usos: 1,
              ultimoUsoEm: now,
            },
            update: {
              usos: { increment: 1 },
              ultimoUsoEm: now,
            },
          }),
        ]
      : []),
  ]);
}

export async function onTreinoFeitoPorAlunoFromSubmissao(submissaoId: string) {
  if (!submissaoId) return;

  const sub = await prisma.submissaoTreino.findUnique({
    where: { id: submissaoId },
    select: {
      treinoAgendado: { select: { treinoProgramadoId: true } },
    },
  });

  const treinoId = sub?.treinoAgendado?.treinoProgramadoId;
  if (!treinoId) return;

  await incrementFeitoPorAluno(treinoId);
}

export async function onTreinoFeitoPorAlunoFromRealizado(treinoProgramadoId: string) {
  if (!treinoProgramadoId) return;
  await incrementFeitoPorAluno(treinoProgramadoId);
}
 
export async function onExercicioIncluidoNoTreino(input: ExercicioIncluidoInput) {
  const { exercicioId, professorId } = input;
  if (!exercicioId) return;

  const now = new Date();

  await prisma.estatisticaExercicio.upsert({
    where: { exercicioId },
    create: {
      exercicioId,
      inclusoesEmTreinos: 1,
      ultimoIncluidoEm: now,
      recomendadoPorProfessorId: professorId ?? null,
      ultimoProfessorId: professorId ?? null,
    },
    update: {
      inclusoesEmTreinos: { increment: 1 },
      ultimoIncluidoEm: now,
      ...(professorId ? { ultimoProfessorId: professorId } : {}),
    },
  });
}

async function incrementFeitoPorAluno(treinoId: string) {
  const now = new Date();
  await prisma.estatisticaTreino.upsert({
    where: { treinoId },
    create: {
      treinoId,
      feitosAlunos: 1,
      ultimoFeitoEm: now,
    },
    update: {
      feitosAlunos: { increment: 1 },
      ultimoFeitoEm: now,
    },
  });
}

export async function recomputeInclusoesExerciciosDoTreino(treinoId: string) {
  if (!treinoId) return;

  const exsBanco = await prisma.treinoProgramadoExercicio.findMany({
    where: { treinoProgramadoId: treinoId },
    select: { exercicioId: true },
  });

  const oficiais = exsBanco.map(e => e.exercicioId).filter(Boolean) as string[];
  for (const exId of new Set(oficiais)) {
    await recomputeInclusoesExercicio(exId);
  }
}

export async function recomputeInclusoesExercicio(exercicioId: string) {
  if (!exercicioId) return;

  const now = new Date();

  const total = await prisma.treinoProgramadoExercicio.count({
    where: { exercicioId },
  });

  await prisma.estatisticaExercicio.upsert({
    where: { exercicioId },
    create: {
      exercicioId,
      inclusoesEmTreinos: total,
      ultimoIncluidoEm: total > 0 ? now : null,
    },
    update: {
      inclusoesEmTreinos: total,
      ultimoIncluidoEm: total > 0 ? now : null,
    },
  });
}
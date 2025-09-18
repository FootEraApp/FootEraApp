import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function recomputePontuacaoAtleta(atletaId: string) {
  const [{ totTreinos }] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COALESCE(SUM(COALESCE(st."pontosCreditados", st."pontuacaoSnapshot", tp."pontuacao", 0)), 0) AS "totTreinos"
    FROM "SubmissaoTreino" st
    LEFT JOIN "TreinoAgendado" ta ON ta.id = st."treinoAgendadoId"
    LEFT JOIN "TreinoProgramado" tp ON tp.id = ta."treinoProgramadoId"
    WHERE st."atletaId" = $1 AND COALESCE(st."aprovado", true) = true
  `, atletaId);

  const [{ totDesafios }] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COALESCE(SUM(COALESCE(d."pontuacao", 0)), 0) AS "totDesafios"
    FROM "SubmissaoDesafio" sd
    JOIN "DesafioOficial" d ON d.id = sd."desafioId"
    WHERE sd."atletaId" = $1 AND COALESCE(sd."aprovado", true) = true
  `, atletaId);

  const [{ qtdTreinosUnicos }] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(DISTINCT st."treinoAgendadoId") AS "qtdTreinosUnicos"
    FROM "SubmissaoTreino" st
    WHERE st."atletaId" = $1 AND COALESCE(st."aprovado", true) = true
  `, atletaId);

  const [{ qtdDesafiosUnicos }] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(DISTINCT sd."desafioId") AS "qtdDesafiosUnicos"
    FROM "SubmissaoDesafio" sd
    WHERE sd."atletaId" = $1 AND COALESCE(sd."aprovado", true) = true
  `, atletaId);

  const performance = (Number(totTreinos) || 0) + (Number(totDesafios) || 0);
  const disciplina = (Number(qtdTreinosUnicos) || 0) * 2;
  const responsabilidade = (Number(qtdDesafiosUnicos) || 0) * 2;
  const total = performance + disciplina + responsabilidade;

  await prisma.pontuacaoAtleta.upsert({
    where: { atletaId },
    create: {
      atletaId,
      pontuacaoTotal: total,
      pontuacaoPerformance: performance,
      pontuacaoDisciplina: disciplina,
      pontuacaoResponsabilidade: responsabilidade,
    },
    update: {
      pontuacaoTotal: total,
      pontuacaoPerformance: performance,
      pontuacaoDisciplina: disciplina,
      pontuacaoResponsabilidade: responsabilidade,
      ultimaAtualizacao: new Date(),
    },
  });

  await prisma.atleta.update({
    where: { id: atletaId },
    data: { pontosTotal: total },
  });
}

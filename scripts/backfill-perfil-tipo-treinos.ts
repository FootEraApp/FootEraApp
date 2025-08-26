import { PrismaClient } from "@prisma/client";
import { inferirTipoTreino } from "../server/utils/inferirTipoTreino.js";
import process from 'node:process'

const prisma = new PrismaClient();

async function run() {
  const atletas = await prisma.atleta.findMany({ select: { id: true } });
  let atualizados = 0;

  for (const a of atletas) {
    const sub = await prisma.submissaoTreino.findFirst({
      where: { atletaId: a.id },
      orderBy: { criadoEm: "desc" },
      include: {
        treinoAgendado: { include: { treinoProgramado: true } },
      },
    });

    const tp = sub?.treinoAgendado?.treinoProgramado;
    if (!tp) continue;

    const tipo = inferirTipoTreino({
      nome: tp.nome ?? undefined,
      tipoTreino: tp.tipoTreino ?? null,
      categorias: tp.categoria ?? null,
    });

    if (tipo) {
      await prisma.atleta.update({
        where: { id: a.id },
        data: {
          perfilTipoTreino: tipo,
          perfilTipoTreinoAtualizadoEm: new Date(),
        },
      });
      atualizados++;
    }
  }

  console.log("OK! Atletas atualizados:", atualizados);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
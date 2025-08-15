import { PrismaClient, TipoTreino } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.usuario.findFirst({
    where: {
      OR: [
        { nomeDeUsuario: "aaaaa" },
        { nome: "aaaaa" }
      ]
    }
  });
  if (!user) throw new Error("Usuário 'aaaaa' não encontrado");

  const atleta = await prisma.atleta.findUnique({ where: { usuarioId: user.id } });
  if (!atleta) throw new Error("Atleta para o usuário 'aaaaa' não encontrado");

  const treino = await prisma.treinoProgramado.upsert({
    where: { nome: "Resistência Física (seed)" },
    update: {},
    create: {
      codigo: "RES-FIS-SEED",
      nome: "Resistência Física (seed)",
      nivel: "Base",
      tipoTreino: "Físico" as TipoTreino,
      duracao: 60,
      pontuacao: 4,
      naoExpira: true
    }
  });

  const agendado = await prisma.treinoAgendado.create({
    data: {
      titulo: treino.nome,
      dataHora: new Date(),
      dataTreino: new Date(),
      atletaId: atleta.id,
      treinoProgramadoId: treino.id
    }
  });

  const sub = await prisma.submissaoTreino.create({
    data: {
      atletaId: atleta.id,
      treinoAgendadoId: agendado.id,
      aprovado: true,
      duracaoMinutos: 60
    }
  });

  await prisma.$transaction(async (tx) => {
    const pontos = treino.pontuacao ?? 0;

    await tx.submissaoTreino.update({
      where: { id: sub.id },
      data: {
        treinoTituloSnapshot: treino.nome,
        tipoTreinoSnapshot: treino.tipoTreino,
        pontuacaoSnapshot: pontos,
        pontosCreditados: pontos
      }
    });

    await tx.estatisticaAtleta.upsert({
      where: { atletaId: atleta.id },
      update: {
        totalTreinos:   { increment: 1 },
        horasTreinadas: { increment: 1 },
        totalPontos:    { increment: pontos },
        fisico:         { increment: 1 }
      },
      create: {
        atletaId: atleta.id,
        totalTreinos: 1,
        horasTreinadas: 1,
        totalPontos: pontos,
        fisico: 1,
        tecnico: 0,
        tatico: 0,
        mental: 0,
        totalDesafios: 0
      }
    });

    await tx.pontuacaoAtleta.upsert({
      where: { atletaId: atleta.id },
      update: {
        pontuacaoPerformance: { increment: pontos },
        pontuacaoTotal:       { increment: pontos }
      },
      create: {
        atletaId: atleta.id,
        pontuacaoPerformance: pontos,
        pontuacaoTotal: pontos,
        pontuacaoDisciplina: 0,
        pontuacaoResponsabilidade: 0
      }
    });
  });

  console.log("OK! Adicionado 1 treino concluído para 'aaaaa'.");
}

main().catch((e) => { console.error(e); process.exit(1); })
       .finally(async () => { await prisma.$disconnect(); });

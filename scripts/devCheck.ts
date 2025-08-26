import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function resolveAtletaId({
  atletaId,
  usuarioId,
}: {
  atletaId?: string;
  usuarioId?: string;
}) {
  if (atletaId) return atletaId;
  if (!usuarioId) return undefined;
  const a = await prisma.atleta.findFirst({
    where: { usuarioId },
    select: { id: true },
  });
  return a?.id;
}

async function main() {
  const atletaIdArg = arg("--atleta");
  const usuarioIdArg = arg("--usuario");
  const tituloFiltro = arg("--titulo");

  const atletaId = await resolveAtletaId({
    atletaId: atletaIdArg,
    usuarioId: usuarioIdArg,
  });

  if (!atletaId) {
    console.error("Informe --atleta <atletaId> ou --usuario <usuarioId>");
    process.exit(1);
  }

  const treino = await prisma.treinoAgendado.findFirst({
    where: {
      atletaId,
      ...(tituloFiltro
        ? { titulo: { contains: tituloFiltro, mode: "insensitive" as const } }
        : {}),
    },
    include: {
      treinoProgramado: {
        include: { exercicios: true },
      },
      submissaoTreinos: {
        where: { aprovado: true as any },
        orderBy: { criadoEm: "desc" },
        take: 1,
      },
    },
  });

  if (!treino) {
    console.log("Nenhum TreinoAgendado encontrado para esse filtro.");
    return;
  }

  const sub = treino.submissaoTreinos[0];
  const fromCredit = Number(sub?.pontosCreditados ?? 0);
  const fromSnap = Number(sub?.pontuacaoSnapshot ?? 0);
  const fromProg = Number(treino.treinoProgramado?.pontuacao ?? 0);
  const fromExLen = Number(treino.treinoProgramado?.exercicios?.length ?? 0);

  const pontos =
    fromCredit > 0
      ? fromCredit
      : fromSnap > 0
      ? fromSnap
      : fromProg > 0
      ? fromProg
      : fromExLen > 0
      ? fromExLen
      : 0;

  const resumo = {
    atletaId,
    treinoAgendadoId: treino.id,
    titulo: treino.titulo,
    programado: {
      id: treino.treinoProgramado?.id,
      nome: treino.treinoProgramado?.nome,
      pontuacao: fromProg,
      exerciciosCount: fromExLen,
      duracao: treino.treinoProgramado?.duracao ?? null,
    },
    submissaoAprovada: sub
      ? {
          id: sub.id,
          criadoEm: sub.criadoEm,
          pontosCreditados: fromCredit,
          pontuacaoSnapshot: fromSnap,
          duracaoMinutos: sub.duracaoMinutos ?? null,
        }
      : null,
    calculoFinalQueDeveriaAparecerNoHistorico: pontos,
  };

  console.log(JSON.stringify(resumo, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
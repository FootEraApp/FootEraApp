
import { prisma } from "./server/prisma.js";

async function main() {
  const banco = new URL(
    process.env.DATABASE_URL || ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    banco.hostname !== "127.0.0.1" ||
    banco.port !== "5433" ||
    banco.pathname !== "/footera_billing_qa" ||
    process.env.ENABLE_CHAT_AUDIO_WORKER !== "false"
  ) {
    throw new Error("BANCO_QA_INCORRETO");
  }

  const pendencias =
    await prisma.exclusaoAudioMensagemPendente.findMany({
      take: 100,
      orderBy: {
        criadoEm: "desc",
      },
      select: {
        id: true,
        audioKey: true,
        tentativas: true,
        ultimoErro: true,
        proximaTentativaEm: true,
        reservadoPor: true,
        reservadoAte: true,
      },
    });

  const total =
    await prisma.exclusaoAudioMensagemPendente.count();

  let vinculados = 0;
  let semVinculo = 0;

  for (const pendencia of pendencias) {
    const [privado, grupo] = await Promise.all([
      prisma.mensagem.findFirst({
        where: {
          audioKey: pendencia.audioKey,
        },
        select: {
          id: true,
        },
      }),
      prisma.mensagemGrupo.findFirst({
        where: {
          audioKey: pendencia.audioKey,
        },
        select: {
          id: true,
        },
      }),
    ]);

    if (privado || grupo) {
      vinculados++;
    } else {
      semVinculo++;
    }
  }

  console.log("CHAT_AUDIO_AUDITORIA_QA", {
    totalPendencias: total,
    pendenciasInspecionadas: pendencias.length,
    aindaVinculadas: vinculados,
    semVinculo,
    comFalhas: pendencias.filter(
      (p) => p.tentativas > 0
    ).length,
    comReserva: pendencias.filter(
      (p) =>
        p.reservadoAte &&
        p.reservadoAte > new Date()
    ).length,
  });

  if (total > pendencias.length) {
    console.log(
      "AVISO: existem mais pendencias do que as 100 inspecionadas."
    );
  }

  console.log(
    "CHAT_AUDIO_AUDITORIA_QA_OK — SOMENTE LEITURA"
  );
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
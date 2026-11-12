
import assert from "node:assert/strict";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_ABORTADO: ambiente inseguro");
  }

  const { prisma } = await import("./server/prisma.js");

  let aprovados = 0;
  let falhas = 0;
  let ignorados = 0;

  async function testar(
    descricao: string,
    executar: () => Promise<void>
  ) {
    try {
      await executar();
      aprovados++;
      console.log("✔", descricao);
    } catch (erro) {
      falhas++;
      console.error("✖", descricao, erro);
    }
  }

  function ignorar(mensagem: string) {
    ignorados++;
    console.log("○ IGNORADO:", mensagem);
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    const {
      assertEventoDisponivelParaCompra,
      assertAulaAoVivoDisponivelParaCompra,
    } = await import(
      "./server/controllers/billingController.js"
    );

    const agora = new Date();

    // ===================================
    // CENARIO 1: EVENTO ABERTO
    // ===================================

    const eventos = await prisma.evento.findMany({
      where: {
        status: "ABERTO",
        dataEvento: { gt: agora },
        valorInscricao: { gt: 0 },
        linkInscricao: null,
      },
      select: {
        id: true,
        titulo: true,
        vagas: true,
        inscricaoInicio: true,
        inscricaoFim: true,
      },
      take: 100,
    });

    const atletas = await prisma.atleta.findMany({
      select: { usuarioId: true },
      take: 100,
    });

    let eventoEscolhido: {
      id: string;
      titulo: string;
      usuarioId: string;
    } | null = null;

    for (const evento of eventos) {
      if (
        (evento.inscricaoInicio &&
          evento.inscricaoInicio > agora) ||
        (evento.inscricaoFim &&
          evento.inscricaoFim < agora)
      ) {
        continue;
      }

      for (const atleta of atletas) {
        const inscricao =
          await prisma.inscricaoEvento.findUnique({
            where: {
              eventoId_usuarioId: {
                eventoId: evento.id,
                usuarioId: atleta.usuarioId,
              },
            },
          });

        if (
          inscricao &&
          ["CONFIRMADA", "PRESENCA_OK"].includes(
            String(inscricao.status)
          )
        ) {
          continue;
        }

        if (evento.vagas !== null) {
          const ocupadas =
            await prisma.inscricaoEvento.count({
              where: {
                eventoId: evento.id,
                usuarioId: {
                  not: atleta.usuarioId,
                },
                status: { not: "CANCELADA" },
              },
            });

          if (ocupadas >= evento.vagas) {
            continue;
          }
        }

        eventoEscolhido = {
          id: evento.id,
          titulo: evento.titulo,
          usuarioId: atleta.usuarioId,
        };

        break;
      }

      if (eventoEscolhido) break;
    }

    if (eventoEscolhido) {
      const escolhido = eventoEscolhido;

      await testar(
        "Evento aberto aceita compra",
        async () => {
          const resultado =
            await assertEventoDisponivelParaCompra(
              `EVENTO:${escolhido.id}`,
              escolhido.usuarioId
            );

          assert.equal(
            resultado.id,
            escolhido.id
          );

          assert.ok(resultado.valor > 0);

          console.log(
            "[QA] Evento valido:",
            escolhido.titulo
          );
        }
      );
    } else {
      ignorar(
        "Nenhum evento aberto com vaga e atleta disponivel"
      );
    }

    // ===================================
    // CENARIO 2: AULA AGENDADA
    // ===================================

    const aulaAgendada =
      await prisma.aulaAoVivo.findFirst({
        where: {
          acessoPago: true,
          precoAcesso: { gt: 0 },
          status: "AGENDADA",
          dataInicio: { gt: agora },
        },
        select: {
          id: true,
          titulo: true,
        },
      });

    if (aulaAgendada) {
      await testar(
        "Aula agendada aceita compra",
        async () => {
          const resultado =
            await assertAulaAoVivoDisponivelParaCompra(
              `AULA_AO_VIVO:${aulaAgendada.id}`
            );

          assert.ok(resultado);

          assert.equal(
            resultado.id,
            aulaAgendada.id
          );

          assert.equal(
            resultado.status,
            "AGENDADA"
          );

          console.log(
            "[QA] Aula valida:",
            aulaAgendada.titulo
          );
        }
      );
    } else {
      ignorar(
        "Nenhuma aula paga futura AGENDADA"
      );
    }

    // ===================================
    // CENARIO 3: REPLAY NO PRAZO
    // ===================================

    const limite = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const replays =
      await prisma.aulaAoVivo.findMany({
        where: {
          status: "FINALIZADA",
          acessoPago: true,
          precoAcesso: { gt: 0 },
          replayDisponivel: true,
          videoGravadoUrl: { not: null },
          OR: [
            { finalizouEm: { gt: limite } },
            {
              finalizouEm: null,
              dataFim: { gt: limite },
            },
          ],
        },
        select: {
          id: true,
          titulo: true,
          videoGravadoUrl: true,
        },
        take: 100,
      });

    const replay = replays.find(
      (item) =>
        Boolean(item.videoGravadoUrl?.trim())
    );

    if (replay) {
      await testar(
        "Replay dentro do prazo aceita compra",
        async () => {
          const resultado =
            await assertAulaAoVivoDisponivelParaCompra(
              `AULA_AO_VIVO:${replay.id}`
            );

          assert.ok(resultado);

          assert.equal(
            resultado.id,
            replay.id
          );

          assert.equal(
            resultado.status,
            "FINALIZADA"
          );

          console.log(
            "[QA] Replay valido:",
            replay.titulo
          );
        }
      );
    } else {
      ignorar(
        "Nenhum replay pago dentro dos sete dias"
      );
    }

    console.log(
      `\nRESULTADO: ${aprovados} aprovados, ${falhas} falhas, ${ignorados} ignorados`
    );

    if (falhas > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
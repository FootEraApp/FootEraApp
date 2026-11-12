
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  // Validar o ambiente antes de acessar o banco.
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

  const eventoId = randomUUID();
  const aulaId = randomUUID();
  const replayId = randomUUID();

  const criados: Array<{
    tipo: "EVENTO" | "AULA";
    id: string;
  }> = [];

  let passou = 0;
  let falhou = 0;

  function dias(diferenca: number): Date {
    return new Date(
      Date.now() + diferenca * 24 * 60 * 60 * 1000
    );
  }

  async function testar(
    descricao: string,
    executar: () => Promise<void>
  ) {
    try {
      await executar();
      passou++;
      console.log("✔", descricao);
    } catch (erro) {
      falhou++;
      console.error("✖", descricao, erro);
    }
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    // Usar somente a identidade do atleta.
    // Nenhuma informação do atleta será alterada.
    const atleta = await prisma.atleta.findFirst({
      select: {
        usuarioId: true,
      },
    });

    if (!atleta) {
      throw new Error(
        "QA_SEM_ATLETA: nao existe perfil Atleta no banco QA"
      );
    }

    console.log("[QA] Atleta:", atleta.usuarioId);

    const {
      assertEventoDisponivelParaCompra,
      assertAulaAoVivoDisponivelParaCompra,
    } = await import(
      "./server/controllers/billingController.js"
    );

    // =========================================
    // 1. EVENTO PAGO ABERTO
    // =========================================

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Evento Elegibilidade ${eventoId}`,
        descricao: "Evento temporario de teste",
        status: "ABERTO",
        dataEvento: dias(10),
        inscricaoInicio: dias(-1),
        inscricaoFim: dias(9),
        vagas: 50,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

    criados.push({
      tipo: "EVENTO",
      id: eventoId,
    });

    await testar(
      "Evento aberto permite compra",
      async () => {
        const resultado =
          await assertEventoDisponivelParaCompra(
            `EVENTO:${eventoId}`,
            atleta.usuarioId
          );

        assert.equal(resultado.id, eventoId);
        assert.equal(resultado.valor, 25);
        assert.equal(resultado.status, "ABERTO");

        const inscricoes =
          await prisma.inscricaoEvento.count({
            where: {
              eventoId,
              usuarioId: atleta.usuarioId,
            },
          });

        assert.equal(inscricoes, 0);
      }
    );

    // =========================================
    // 2. AULA PAGA FUTURA
    // =========================================

    await prisma.aulaAoVivo.create({
      data: {
        id: aulaId,
        titulo: `QA Aula Agendada ${aulaId}`,
        descricao: "Aula temporaria de teste",
        status: "AGENDADA",
        dataInicio: dias(5),
        dataFim: dias(5.1),
        acessoPago: true,
        precoAcesso: "20.00",
        replayDisponivel: false,
      },
    });

    criados.push({
      tipo: "AULA",
      id: aulaId,
    });

    await testar(
      "Aula paga futura permite compra",
      async () => {
        const resultado =
          await assertAulaAoVivoDisponivelParaCompra(
            `AULA_AO_VIVO:${aulaId}`
          );

        assert.ok(resultado);
        assert.equal(resultado.id, aulaId);
        assert.equal(resultado.status, "AGENDADA");
        assert.equal(Number(resultado.precoAcesso), 20);
      }
    );

    // =========================================
    // 3. REPLAY PAGO DENTRO DO PRAZO
    // =========================================

    await prisma.aulaAoVivo.create({
      data: {
        id: replayId,
        titulo: `QA Replay Valido ${replayId}`,
        descricao: "Replay temporario de teste",
        status: "FINALIZADA",
        dataInicio: dias(-2),
        dataFim: dias(-1),
        finalizouEm: dias(-1),
        acessoPago: true,
        precoAcesso: "15.00",
        replayDisponivel: true,
        // URL ficticia para testar somente a
        // elegibilidade. Nenhum video sera enviado.
        videoGravadoUrl:
          "https://example.invalid/qa/replay.mp4",
      },
    });

    criados.push({
      tipo: "AULA",
      id: replayId,
    });

    await testar(
      "Replay dentro de sete dias permite compra",
      async () => {
        const resultado =
          await assertAulaAoVivoDisponivelParaCompra(
            `AULA_AO_VIVO:${replayId}`
          );

        assert.ok(resultado);
        assert.equal(resultado.id, replayId);
        assert.equal(resultado.status, "FINALIZADA");
        assert.equal(resultado.replayDisponivel, true);
      }
    );

    // =========================================
    // 4. GARANTIR QUE NADA FOI COBRADO
    // =========================================

    await testar(
      "Validacoes nao criam pagamentos ou acessos",
      async () => {
        const planos = [
          `EVENTO:${eventoId}`,
          `AULA_AO_VIVO:${aulaId}`,
          `AULA_AO_VIVO:${replayId}`,
        ];

        const pagamentos = await prisma.pagamento.count({
          where: {
            plano: { in: planos },
          },
        });

        const inscricoes =
          await prisma.inscricaoEvento.count({
            where: { eventoId },
          });

        const acessos =
          await prisma.aulaAoVivoAcesso.count({
            where: {
              aulaAoVivoId: {
                in: [aulaId, replayId],
              },
            },
          });

        assert.equal(pagamentos, 0);
        assert.equal(inscricoes, 0);
        assert.equal(acessos, 0);
      }
    );
  } finally {
    // Limpar somente os IDs gerados por este teste,
    // sem alterar produtos preexistentes.
    try {
      for (const item of criados.reverse()) {
        if (item.tipo === "EVENTO") {
          const inscricoes =
            await prisma.inscricaoEvento.count({
              where: { eventoId: item.id },
            });

          if (inscricoes !== 0) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: evento possui inscricoes"
            );
          }

          await prisma.evento.delete({
            where: { id: item.id },
          });
        } else {
          const acessos =
            await prisma.aulaAoVivoAcesso.count({
              where: { aulaAoVivoId: item.id },
            });

          if (acessos !== 0) {
            throw new Error(
              "QA_CLEANUP_ABORTADO: aula possui acessos"
            );
          }

          await prisma.aulaAoVivo.delete({
            where: { id: item.id },
          });
        }
      }

      console.log(
        "[QA] Fixtures temporarias removidas."
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    `\nRESULTADO: ${passou}/${passou + falhou}`
  );

  if (falhou > 0) {
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
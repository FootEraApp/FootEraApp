
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  let url: URL;

  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    prepararIntencaoEnvioEstornoQa,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const {
    finalizarCompensacaoEventoTransacionalQa,
  } = await import(
    "./server/services/billingCompensacaoEventoFinalizacaoService.js"
  );

  const {
    aprovarPagamentoEventoConcorrenciaQa,
  } = await import(
    "./server/controllers/billingController.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const providerRef = `${Date.now()}887766`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let testeAprovado = false;
  let verificacoes = 0;

  function ok(nome: string) {
    verificacoes += 1;
    console.log("✔", nome);
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    ok("Conexao exclusiva com o banco QA");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Concorrencia ${eventoId}`,
        descricao: "Teste de concorrencia sem dinheiro real",
        status: "ABERTO",
        dataEvento: new Date(Date.now() + 10 * 86400000),
        inscricaoInicio: new Date(Date.now() - 86400000),
        inscricaoFim: new Date(Date.now() + 9 * 86400000),
        vagas: 1,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

    eventoCriado = true;

    await prisma.pagamento.create({
      data: {
        id: pagamentoId,
        usuarioId: atleta.usuarioId,
        plano: `EVENTO:${eventoId}`,
        periodicidade: "Mensal",
        metodo: "PIX",
        status: "PENDENTE",
        valor: "25.00",
        moeda: "BRL",
        provider: "MERCADOPAGO",
        providerRef,
        contextoKind: "PERSONAL",
        contextoTipo: "Atleta",
      },
    });

    pagamentoCriado = true;

    await prisma.billingPendenciaEvento.create({
      data: {
        pagamentoId,
        eventoId,
        motivo: "BILLING_EVENT_CAPACITY_EXCEEDED",
        status: "PENDENTE_ANALISE",
        providerRef,
        valor: "25.00",
        moeda: "BRL",
      },
    });

    configurarConsultorMercadoPagoQa(async (id) => {
      assert.equal(id, providerRef);

      return {
        id: providerRef,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId,
        metadata: { pagamentoId },
        transaction_amount: 25,
        currency_id: "BRL",
      };
    });

    const intencao = await prepararIntencaoEnvioEstornoQa(
      pagamentoId
    );

    assert.equal(intencao.intencaoRegistrada, true);
    assert.equal(intencao.executouEstorno, false);

    ok("Intencao de compensacao QA persistida");

    const resultados = await Promise.allSettled([
      aprovarPagamentoEventoConcorrenciaQa(
        pagamentoId,
        eventoId
      ),

      finalizarCompensacaoEventoTransacionalQa(
        pagamentoId
      ),
    ]);

    const resultadoAprovacao = resultados[0];
    const resultadoFinalizacao = resultados[1];

    assert.equal(
      resultadoAprovacao.status,
      "rejected",
      "QA_APROVACAO_INDEVIDA"
    );

    if (resultadoAprovacao.status === "rejected") {
      const erro = resultadoAprovacao.reason as {
        code?: string;
        message?: string;
        meta?: { code?: string };
      };

      const mensagem = String(erro?.message ?? "");
      const conflito =
        erro?.code === "P2034" ||
        (
          erro?.code === "P2010" &&
          ["40001", "40P01"].includes(
            String(erro?.meta?.code ?? "")
          )
        );

      const bloqueioFinanceiro =
        mensagem.includes(
          "BILLING_EVENT_FINANCIAL_RECONCILIATION_REQUIRED"
        ) ||
        mensagem.includes(
          "BILLING_APROVACAO_QA_PAGAMENTO_INVALIDO"
        ) ||
        mensagem.includes(
          "PAYMENT_NOT_PENDING"
        ) ||
        mensagem.includes(
          "Este pagamento não está pendente."
        );

      assert.ok(
        bloqueioFinanceiro || conflito,
        `QA_APROVACAO_ERRO_INESPERADO: ${mensagem}`
      );
    }

    ok("Aprovacao nao concedeu acesso financeiro");

    if (resultadoFinalizacao.status === "rejected") {
      const erro = resultadoFinalizacao.reason as {
        code?: string;
        message?: string;
        meta?: { code?: string };
      };

      const conflito =
        erro?.code === "P2034" ||
        (
          erro?.code === "P2010" &&
          ["40001", "40P01"].includes(
            String(erro?.meta?.code ?? "")
          )
        );

      if (!conflito) {
        throw resultadoFinalizacao.reason;
      }

      // A concorrencia pode abortar a transacao.
      // Reexecutar somente a finalizacao local,
      // nunca um novo envio externo de estorno.
      const repeticao =
        await finalizarCompensacaoEventoTransacionalQa(
          pagamentoId
        );

      assert.equal(repeticao.idempotente, false);
    }

    const [pagamento, pendencia, compensacao] =
      await Promise.all([
        prisma.pagamento.findUniqueOrThrow({
          where: { id: pagamentoId },
        }),
        prisma.billingPendenciaEvento.findUniqueOrThrow({
          where: { pagamentoId },
        }),
        prisma.billingCompensacaoEvento.findUniqueOrThrow({
          where: { pagamentoId },
        }),
      ]);

    assert.equal(pagamento.status, "REEMBOLSADO");
    assert.ok(pagamento.reembolsadoEm);

    assert.equal(pendencia.status, "ESTORNO_CONFIRMADO");
    assert.ok(pendencia.resolvidoEm);

    assert.equal(compensacao.status, "CONFIRMADA");
    assert.ok(compensacao.confirmadoEm);

    ok("Tres estados finalizados na mesma operacao");

    const inscricoes = await prisma.inscricaoEvento.count({
      where: {
        eventoId,
        usuarioId: atleta.usuarioId,
        status: { not: "CANCELADA" },
      },
    });

    const beneficios = await prisma.pagamentoBeneficio.count({
      where: { pagamentoId },
    });

    assert.equal(inscricoes, 0);
    assert.equal(beneficios, 0);

    ok("Nenhuma inscricao ou beneficio indevido");

    const totalTentativas =
      await prisma.billingCompensacaoTentativa.count({
        where: { compensacaoId: compensacao.id },
      });

    assert.equal(totalTentativas, 1);

    const tentativa =
      await prisma.billingCompensacaoTentativa.findFirstOrThrow({
        where: { compensacaoId: compensacao.id },
      });

    assert.equal(tentativa.ambiente, "QA");
    assert.equal(tentativa.operacaoExternaExecutada, false);
    assert.equal(tentativa.estornoProviderRef, null);
    assert.equal(tentativa.requisicaoEnviadaEm, null);

    ok("Uma tentativa e nenhum estorno externo");

    const consultaPosterior =
      await finalizarCompensacaoEventoTransacionalQa(
        pagamentoId
      );

    assert.equal(consultaPosterior.idempotente, true);

    await assert.rejects(
      aprovarPagamentoEventoConcorrenciaQa(
        pagamentoId,
        eventoId
      ),
      /BILLING_APROVACAO_QA_PAGAMENTO_INVALIDO/
    );

    ok("Reexecucao idempotente e aprovacao posterior bloqueada");

    testeAprovado = true;

    console.log(`\nRESULTADO: ${verificacoes}/7`);
  } finally {
    configurarConsultorMercadoPagoQa(null);

    try {
      if (testeAprovado && pagamentoCriado) {
        await prisma.$transaction(async (tx) => {
          const compensacao =
            await tx.billingCompensacaoEvento.findUniqueOrThrow({
              where: { pagamentoId },
            });

          const pagamento =
            await tx.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(
            compensacao.status,
            "CONFIRMADA"
          );
          assert.equal(
            pagamento.status,
            "REEMBOLSADO"
          );

          assert.equal(
            await tx.pagamentoBeneficio.count({
              where: { pagamentoId },
            }),
            0
          );

          assert.equal(
            await tx.inscricaoEvento.count({
              where: {
                eventoId,
                usuarioId: pagamento.usuarioId,
                status: { not: "CANCELADA" },
              },
            }),
            0
          );

          await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
            where: { compensacaoId: compensacao.id },
          });

          await tx.billingCompensacaoTentativa.deleteMany({
            where: { compensacaoId: compensacao.id },
          });

          await tx.billingCompensacaoEvento.delete({
            where: { id: compensacao.id },
          });

          await tx.billingPendenciaEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });

        if (eventoCriado) {
          await prisma.evento.delete({
            where: { id: eventoId },
          });
        }

        console.log("[QA] Fixtures removidas.");
      } else {
        console.warn(
          "[QA] Fixtures preservadas para auditoria:",
          { pagamentoId, eventoId }
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(
    "QA_WEBHOOK_COMPENSACAO_FALHOU:",
    erro
  );

  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const { configurarConsultorMercadoPagoQa } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    prepararIntencaoEnvioEstornoQa,
    executarFluxoEstornoIntegradoQa,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const providerRef = `${Date.now()}998877`;

  let passou = false;
  let chamadas = 0;
  let fixturesCriadas = false;

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    // Usuário existente somente como referência.
    // Nenhum benefício ou assinatura dele é alterado.
    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Estorno ${eventoId}`,
        descricao: "QA sem dinheiro real",
        status: "ABERTO",
        dataEvento: new Date(
          Date.now() + 10 * 86400000
        ),
        inscricaoInicio: new Date(
          Date.now() - 86400000
        ),
        inscricaoFim: new Date(
          Date.now() + 9 * 86400000
        ),
        vagas: 1,
        valorInscricao: "25.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

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
        meta: {
          qaEstornoTransporteIntegrado: true,
        },
      },
    });

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

    fixturesCriadas = true;

    // Consulta externa simulada.
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

    // Registra a intenção antes de qualquer transporte.
    const intencao =
      await prepararIntencaoEnvioEstornoQa(pagamentoId);

    assert.equal(
      intencao.intencaoRegistrada,
      true
    );

    console.log(
      "✔ Intenção de estorno persistida no banco QA"
    );

    // Transporte falso: simula falha da rede.
    // Não existe chamada real ao Mercado Pago.
    const fetchSimulado: typeof fetch = async () => {
      chamadas++;

      throw new Error(
        "QA_FALHA_DE_REDE_DEPOIS_DA_AQUISICAO"
      );
    };

    const evidencia = {
      pagamentoProviderRef: providerRef,
      estornoProviderRef: "990000000003",
      valor: "25.00",
      moeda: "BRL",
      status: "approved",
    };

    // TESTE 2 — Primeiro transporte falha.
    const primeiro =
      await executarFluxoEstornoIntegradoQa(
        pagamentoId,
        fetchSimulado,
        evidencia
      );

    assert.equal(primeiro.adquirida, true);

    assert.equal(
      primeiro.requerConciliacao,
      true
    );

    assert.equal(chamadas, 1);

    console.log(
      "✔ Falha do transporte preservada como conciliação pendente"
    );

    // TESTE 3 — Reentrada sem novo transporte.
    const segundo =
      await executarFluxoEstornoIntegradoQa(
        pagamentoId,
        fetchSimulado,
        evidencia
      );

    assert.equal(segundo.adquirida, false);
    assert.equal(segundo.executouTransporte, false);
    assert.equal(chamadas, 1);

    const compensacao =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
        include: {
          historicoTentativas: true,
        },
      });

    assert.equal(
      compensacao.historicoTentativas.length,
      1
    );

    assert.ok(
      compensacao.historicoTentativas[0].requisicaoEnviadaEm
    );

    assert.equal(
      compensacao.historicoTentativas[0]
        .operacaoExternaExecutada,
      false
    );

    const pagamento =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId },
      });

    assert.equal(pagamento.status, "PENDENTE");

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      0
    );

    console.log(
      "✔ Reentrada não disparou segundo transporte nem alterou pagamento"
    );

    passou = true;

    console.log(
      "\nRESULTADO: 3/3 (transporte interceptado, sem estorno real)"
    );
  } finally {
    configurarConsultorMercadoPagoQa(null);

    try {
      if (passou && fixturesCriadas) {
        await prisma.$transaction(async (tx) => {
          const pagamento =
            await tx.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(pagamento.status, "PENDENTE");

          assert.equal(
            (
              pagamento.meta as {
                qaEstornoTransporteIntegrado?: boolean;
              }
            )?.qaEstornoTransporteIntegrado,
            true
          );

          const comp =
            await tx.billingCompensacaoEvento.findUniqueOrThrow({
              where: { pagamentoId },
            });

          assert.equal(
            comp.status,
            "AGUARDANDO_CONFIRMACAO"
          );

          await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
            where: {
              compensacaoId: comp.id,
            },
          });

          await tx.billingCompensacaoTentativa.deleteMany({
            where: {
              compensacaoId: comp.id,
            },
          });

          await tx.billingCompensacaoEvento.delete({
            where: { id: comp.id },
          });

          await tx.billingPendenciaEvento.delete({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });

          await tx.evento.delete({
            where: { id: eventoId },
          });
        });

        console.log("[QA] Fixtures removidas");
      } else if (fixturesCriadas) {
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
    "QA_ESTORNO_TRANSPORTE_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
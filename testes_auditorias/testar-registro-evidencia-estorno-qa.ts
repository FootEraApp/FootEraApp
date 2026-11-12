
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const { configurarConsultorMercadoPagoQa } =
    await import(
      "./server/services/billingMercadoPagoGateway.js"
    );

  const {
    prepararIntencaoEnvioEstornoQa,
    adquirirExecucaoEnvioEstornoQa,
    registrarResultadoEnvioEstornoQa,
    executarFluxoEstornoIntegradoQa,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const pagamentoId = randomUUID();
  const eventoId = randomUUID();
  const providerRef = `${Date.now()}557799`;
  const estornoRef = "887766551122";

  let eventoCriado = false;
  let pagamentoCriado = false;
  let aprovado = false;
  let verificacoes = 0;

  const ok = (mensagem: string) => {
    verificacoes++;
    console.log("✔", mensagem);
  };

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");
    ok("Banco QA confirmado");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Evidencia ${eventoId}`,
        descricao: "Teste sem estorno externo",
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

    const preparacao =
      await prepararIntencaoEnvioEstornoQa(pagamentoId);

    assert.equal(preparacao.intencaoRegistrada, true);

    ok("Intencao preparada sem HTTP");

    const evidencia = {
      pagamentoProviderRef: providerRef,
      estornoProviderRef: estornoRef,
      valor: "25.00",
      moeda: "BRL",
      status: "approved",
    };

    await assert.rejects(
      registrarResultadoEnvioEstornoQa(
        pagamentoId,
        estornoRef,
        {
          ...evidencia,
          pagamentoProviderRef: "123456",
        }
      ),
      /BILLING_RESULTADO_EVIDENCIA_DIVERGENTE/
    );

    ok("Identidade externa divergente bloqueada");

    await assert.rejects(
      registrarResultadoEnvioEstornoQa(
        pagamentoId,
        estornoRef,
        {
          ...evidencia,
          valor: "20.00",
        }
      ),
      /BILLING_RESULTADO_EVIDENCIA_DIVERGENTE/
    );

    ok("Valor externo divergente bloqueado");

    const antes =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
        include: { historicoTentativas: true },
      });

    assert.equal(
      antes.historicoTentativas[0].estornoProviderRef,
      null
    );

    assert.equal(
      antes.historicoTentativas[0].operacaoExternaExecutada,
      false
    );
    
    let quantidadePostsSimulados = 0;

    const fetchSimulado: typeof fetch =
    async (_input, init) => {
        quantidadePostsSimulados++;

        assert.equal(init?.method, "POST");

        const cabecalhos =
        new Headers(init?.headers);

        assert.equal(
        cabecalhos.get("X-Idempotency-Key"),
        `footera-evento-refund-${pagamentoId}`
        );

        return new Response(
        JSON.stringify({
            id: estornoRef,
            payment_id: providerRef,
            amount: 25,
            status: "approved",
        }),
        {
            status: 201,
            headers: {
            "Content-Type": "application/json",
            },
        }
        );
    };

    const fluxo =
    await executarFluxoEstornoIntegradoQa(
        pagamentoId,
        fetchSimulado,
        evidencia
    );

    assert.equal(fluxo.adquirida, true);
    assert.equal(fluxo.executouTransporte, true);
    assert.equal(fluxo.requerConciliacao, false);
    assert.equal(fluxo.motivo, "EVIDENCIA_QA_PERSISTIDA");
    assert.equal(quantidadePostsSimulados, 1);

    if (!("registro" in fluxo) || !fluxo.registro) {
    throw new Error(
        "QA_FLUXO_SEM_REGISTRO"
    );
    }

    assert.equal(fluxo.registro.registrada, true);
    assert.equal(fluxo.registro.idempotente, false);

    // Simula o processo recebendo a mesma ordem novamente.
    const repeticaoFluxo =
    await executarFluxoEstornoIntegradoQa(
        pagamentoId,
        fetchSimulado,
        evidencia
    );

    assert.equal(
    repeticaoFluxo.adquirida,
    false
    );

    assert.equal(
    repeticaoFluxo.executouTransporte,
    false
    );

    assert.equal(
    quantidadePostsSimulados,
    1,
    "QA_POST_SIMULADO_DUPLICADO"
    );

    ok("Evidencia simulada persistida");

    const repeticao =
      await registrarResultadoEnvioEstornoQa(
        pagamentoId,
        estornoRef,
        evidencia
      );

    assert.equal(repeticao.idempotente, true);

    ok("Registro idempotente");

    const tentativa =
      await prisma.billingCompensacaoTentativa.findFirstOrThrow({
        where: {
          compensacao: { pagamentoId },
        },
      });

    assert.equal(tentativa.ambiente, "QA");
    assert.equal(tentativa.estornoProviderRef, estornoRef);
    assert.equal(tentativa.operacaoExternaExecutada, true);
    assert.ok(tentativa.requisicaoEnviadaEm);

    const pagamento =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId },
      });

    assert.equal(pagamento.status, "PENDENTE");
    assert.equal(pagamento.reembolsadoEm, null);

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      0
    );

    ok("Nenhuma finalizacao ou beneficio indevido");

    aprovado = true;
    console.log(`\nRESULTADO: ${verificacoes}/7`);
  } finally {
    configurarConsultorMercadoPagoQa(null);

    try {
      if (aprovado && pagamentoCriado) {
        await prisma.$transaction(async (tx) => {
          const c =
            await tx.billingCompensacaoEvento.findUniqueOrThrow({
              where: { pagamentoId },
            });

          const pg =
            await tx.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            });

          assert.equal(pg.status, "PENDENTE");

          const t =
            await tx.billingCompensacaoTentativa.findFirstOrThrow({
              where: { compensacaoId: c.id },
            });

          assert.equal(t.ambiente, "QA");

          await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
            where: { compensacaoId: c.id },
          });

          await tx.billingCompensacaoTentativa.deleteMany({
            where: { compensacaoId: c.id },
          });

          await tx.billingCompensacaoEvento.delete({
            where: { id: c.id },
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
  console.error("QA_REGISTRO_EVIDENCIA_FALHOU:", erro);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

function conflitoSerializacao(erro: unknown): boolean {
  const e = erro as {
    code?: string;
    meta?: { code?: string };
  };

  return (
    e?.code === "P2034" ||
    (
      e?.code === "P2010" &&
      ["40001", "40P01"].includes(
        String(e?.meta?.code ?? "")
      )
    )
  );
}

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
    process.env.ENABLE_EVENT_REFUNDS_REAL === "true" ||
    url.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import(
    "./server/prisma.js"
  );

  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    prepararIntencaoEnvioEstornoQa,
    adquirirExecucaoEnvioEstornoQa,
    adquirirExecucaoEnvioEstornoReal,
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const providerRef = `${Date.now()}667788`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let passou = false;
  let verificacoes = 0;

  function ok(nome: string) {
    verificacoes++;
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

    ok("Banco QA confirmado");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Aquisicao ${eventoId}`,
        descricao: "Teste sem estorno externo",
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
      await prepararIntencaoEnvioEstornoQa(
        pagamentoId
      );

    assert.equal(
      preparacao.intencaoRegistrada,
      true
    );

    assert.equal(
      preparacao.executouEstorno,
      false
    );

    ok("Intencao QA persistida");

    await assert.rejects(
      adquirirExecucaoEnvioEstornoReal(
        pagamentoId
      ),
      /BILLING_ESTORNO_REAL_DESABILITADO/
    );

    ok("Entrada real bloqueada em QA");

    const resultados = await Promise.allSettled([
      adquirirExecucaoEnvioEstornoQa(pagamentoId),
      adquirirExecucaoEnvioEstornoQa(pagamentoId),
    ]);

    const adquiridos = resultados.filter(
      (resultado) =>
        resultado.status === "fulfilled" &&
        resultado.value.adquirida === true
    );

    assert.equal(
      adquiridos.length,
      1,
      "QA_AQUISICAO_DUPLICADA_OU_AUSENTE"
    );

    for (const resultado of resultados) {
      if (resultado.status === "rejected") {
        if (!conflitoSerializacao(resultado.reason)) {
          throw resultado.reason;
        }

        console.log(
          "[QA] Conflito serializavel reconhecido"
        );
      }
    }

    ok("Duas aquisicoes: uma unica autorizada");

    const repeticao =
      await adquirirExecucaoEnvioEstornoQa(
        pagamentoId
      );

    assert.equal(
      repeticao.adquirida,
      false,
      "QA_REENTRADA_AUTORIZADA"
    );

    ok("Reentrada nao adquire segundo envio");

    const compensacao =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
        include: {
          historicoTentativas: true,
        },
      });

    assert.equal(
      compensacao.status,
      "AGUARDANDO_CONFIRMACAO"
    );

    assert.equal(
      compensacao.tentativas,
      1
    );

    assert.equal(
      compensacao.historicoTentativas.length,
      1
    );

    const tentativa =
      compensacao.historicoTentativas[0];

    assert.equal(tentativa.ambiente, "QA");

    assert.equal(
      tentativa.status,
      "CONFIRMACAO_EXTERNA_PENDENTE"
    );

    assert.ok(
      tentativa.requisicaoEnviadaEm,
      "QA_INICIO_NAO_PERSISTIDO"
    );

    assert.equal(
      tentativa.estornoProviderRef,
      null
    );

    assert.equal(
      tentativa.operacaoExternaExecutada,
      false
    );

    ok("Inicio persistido sem evidencia fabricada");

    const pagamento =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId },
      });

    const pendencia =
      await prisma.billingPendenciaEvento.findUniqueOrThrow({
        where: { pagamentoId },
      });

    assert.equal(
      pagamento.status,
      "PENDENTE"
    );

    assert.equal(
      pagamento.reembolsadoEm,
      null
    );

    assert.equal(
      pendencia.status,
      "PENDENTE_ANALISE"
    );

    assert.equal(
      pendencia.resolvidoEm,
      null
    );

    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: { pagamentoId },
      }),
      0
    );

    assert.equal(
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,
          usuarioId: atleta.usuarioId,
          status: { not: "CANCELADA" },
        },
      }),
      0
    );

    ok("Nenhum pagamento ou acesso alterado");

    const segundaLeitura =
      await prisma.billingCompensacaoTentativa.findUniqueOrThrow({
        where: { id: tentativa.id },
      });

    assert.equal(
      segundaLeitura.requisicaoEnviadaEm?.getTime(),
      tentativa.requisicaoEnviadaEm?.getTime()
    );

    assert.equal(
      segundaLeitura.chaveIdempotenciaOperacao,
      `footera-evento-refund-${pagamentoId}`
    );
        
    ok("Reentrada preservou chave e data do envio");

    // TESTE NOVO: consumo exclusivo da autorização do POST.
    // Apenas atualiza a tentativa fictícia no banco QA.
    // Não chama o Mercado Pago.

    const tentarConsumirAutorizacao = async () => {
    return prisma.billingCompensacaoTentativa.updateMany({
        where: {
        id: tentativa.id,
        compensacaoId: compensacao.id,
        numero: 1,
        ambiente: "QA",
        status: "CONFIRMACAO_EXTERNA_PENDENTE",
        chaveIdempotenciaOperacao:
            `footera-evento-refund-${pagamentoId}`,
        requisicaoEnviadaEm: { not: null },
        postAutorizacaoConsumidaEm: null,
        estornoProviderRef: null,
        operacaoExternaExecutada: false,
        compensacao: {
            is: {
            status: "AGUARDANDO_CONFIRMACAO",
            tentativas: 1,
            confirmadoEm: null,
            },
        },
        },
        data: {
        postAutorizacaoConsumidaEm: new Date(),
        observacao:
            "QA: autorização consumida sem HTTP externo.",
        },
    });
    };

    const consumosConcorrentes = await Promise.allSettled([
    tentarConsumirAutorizacao(),
    tentarConsumirAutorizacao(),
    ]);

    const consumosEfetivos = consumosConcorrentes
    .filter(
        (r): r is PromiseFulfilledResult<{ count: number }> =>
        r.status === "fulfilled"
    )
    .reduce((total, r) => total + r.value.count, 0);

    assert.equal(
    consumosEfetivos,
    1,
    "QA_AUTORIZACAO_CONSUMIDA_MAIS_DE_UMA_VEZ"
    );

    for (const resultado of consumosConcorrentes) {
    if (
        resultado.status === "rejected" &&
        !conflitoSerializacao(resultado.reason)
    ) {
        throw resultado.reason;
    }
    }

    const aposConsumo =
    await prisma.billingCompensacaoTentativa.findUniqueOrThrow({
        where: { id: tentativa.id },
    });

    assert.ok(
    aposConsumo.postAutorizacaoConsumidaEm,
    "QA_AUTORIZACAO_NAO_PERSISTIDA"
    );

    assert.equal(aposConsumo.ambiente, "QA");
    assert.equal(
    aposConsumo.operacaoExternaExecutada,
    false
    );
    assert.equal(aposConsumo.estornoProviderRef, null);

    ok("Autorização concorrente consumida uma única vez");

    const novaTentativaConsumo =
    await tentarConsumirAutorizacao();

    assert.equal(
    novaTentativaConsumo.count,
    0,
    "QA_REENTRADA_CONSUMIU_AUTORIZACAO"
    );

    const consumoPersistido =
    await prisma.billingCompensacaoTentativa.findUniqueOrThrow({
        where: { id: tentativa.id },
    });

    assert.equal(
    consumoPersistido.postAutorizacaoConsumidaEm?.getTime(),
    aposConsumo.postAutorizacaoConsumidaEm?.getTime()
    );

    assert.equal(
    consumoPersistido.operacaoExternaExecutada,
    false
    );

    ok("Reentrada não consome novamente a autorização");

    passou = true;

    console.log(
      `\nRESULTADO: ${verificacoes}/10`
    );
  } finally {
    configurarConsultorMercadoPagoQa(null);

    try {
      if (passou && pagamentoCriado) {
        await prisma.$transaction(async (tx) => {
          const c =
            await tx.billingCompensacaoEvento.findUniqueOrThrow({
              where: { pagamentoId },
            });

          assert.equal(
            c.status,
            "AGUARDANDO_CONFIRMACAO"
          );

          assert.equal(c.tentativas, 1);

          const t =
            await tx.billingCompensacaoTentativa.findFirstOrThrow({
              where: { compensacaoId: c.id },
            });

          assert.equal(t.ambiente, "QA");
          assert.ok(
            t.postAutorizacaoConsumidaEm,
            "QA_LIMPEZA_AUTORIZACAO_NAO_CONSUMIDA"
            );
          assert.equal(
            t.operacaoExternaExecutada,
            false
          );
          assert.equal(t.estornoProviderRef, null);

          await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
            where: { compensacaoId: c.id },
          });

          await tx.billingCompensacaoTentativa.deleteMany({
            where: { compensacaoId: c.id },
          });

          await tx.billingCompensacaoEvento.delete({
            where: { id: c.id },
          });

          await tx.billingPendenciaEvento.delete({
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
    "QA_PERSISTENCIA_ESTORNO_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
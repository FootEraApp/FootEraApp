
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  let db: URL;

  try {
    db = new URL(
      process.env.DATABASE_URL ?? ""
    );
  } catch {
    throw new Error(
      "QA_DATABASE_URL_INVALIDA"
    );
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      db.hostname
    ) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "QA_AMBIENTE_INSEGURO"
    );
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
  } = await import(
    "./server/services/billingCompensacaoEventoEnvioService.js"
  );

  const {
    finalizarCompensacaoEventoTransacionalQa,
    finalizarCompensacaoEventoVerificada,
  } = await import(
    "./server/services/billingCompensacaoEventoFinalizacaoService.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const providerRef =
    `${Date.now()}998877`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let passou = false;
  let quantidade = 0;

  function ok(descricao: string) {
    quantidade += 1;
    console.log("✔", descricao);
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

    const atleta =
      await prisma.atleta.findFirst({
        select: {
          usuarioId: true,
        },
      });

    assert.ok(
      atleta,
      "QA_SEM_ATLETA"
    );

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo:
          `QA Finalizacao ${eventoId}`,
        descricao:
          "Fixture QA sem dinheiro real",
        status: "ABERTO",
        dataEvento: new Date(
          Date.now() +
          10 * 86400000
        ),
        inscricaoInicio: new Date(
          Date.now() - 86400000
        ),
        inscricaoFim: new Date(
          Date.now() +
          9 * 86400000
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
        motivo:
          "BILLING_EVENT_CAPACITY_EXCEEDED",
        status: "PENDENTE_ANALISE",
        providerRef,
        valor: "25.00",
        moeda: "BRL",
      },
    });

    configurarConsultorMercadoPagoQa(
      async (id) => {
        assert.equal(
          id,
          providerRef
        );

        return {
          id: providerRef,
          status: "approved",
          status_detail: "accredited",
          external_reference:
            pagamentoId,
          metadata: {
            pagamentoId,
          },
          transaction_amount: 25,
          currency_id: "BRL",
        };
      }
    );

    const intencao =
      await prepararIntencaoEnvioEstornoQa(
        pagamentoId
      );

    assert.equal(
      intencao.intencaoRegistrada,
      true
    );

    assert.equal(
      intencao.executouEstorno,
      false
    );

    ok(
      "Intencao QA persistida sem estorno externo"
    );

    await assert.rejects(
      finalizarCompensacaoEventoVerificada(
        pagamentoId
      ),
      /BILLING_COMPENSACAO_FINALIZACAO_REAL_INDISPONIVEL/
    );

    ok(
      "Entrada real permanece bloqueada em QA"
    );

    await assert.rejects(
      finalizarCompensacaoEventoTransacionalQa(
        pagamentoId,
        {
          falharDepoisPagamento: true,
        }
      ),
      /QA_FALHA_FORCADA_APOS_PAGAMENTO/
    );

    const pagamentoAntes =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: pagamentoId,
        },
      });

    const pendenciaAntes =
      await prisma.billingPendenciaEvento.findUniqueOrThrow({
        where: {
          pagamentoId,
        },
      });

    const compensacaoAntes =
      await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: {
          pagamentoId,
        },
      });

    assert.equal(
      pagamentoAntes.status,
      "PENDENTE"
    );

    assert.equal(
      pagamentoAntes.reembolsadoEm,
      null
    );

    assert.equal(
      pendenciaAntes.status,
      "PENDENTE_ANALISE"
    );

    assert.equal(
      pendenciaAntes.resolvidoEm,
      null
    );

    assert.equal(
      compensacaoAntes.status,
      "AGUARDANDO_CONFIRMACAO"
    );

    assert.equal(
      compensacaoAntes.confirmadoEm,
      null
    );

    ok(
      "Rollback reverte todos os estados"
    );
        
    const resultadosConcorrentes = await Promise.allSettled([
    finalizarCompensacaoEventoTransacionalQa(pagamentoId),
    finalizarCompensacaoEventoTransacionalQa(pagamentoId),
    ]);

    const sucessos = resultadosConcorrentes
    .filter(
        (resultado): resultado is PromiseFulfilledResult<{
        pagamentoId: string;
        idempotente: boolean;
        }> => resultado.status === "fulfilled"
    )
    .map((resultado) => resultado.value);

    const falhas = resultadosConcorrentes.filter(
    (resultado) => resultado.status === "rejected"
    );

    assert.ok(
    sucessos.length >= 1,
    "QA_NENHUMA_FINALIZACAO_CONCLUIDA"
    );

    assert.equal(
    sucessos.filter(
        (resultado) => resultado.idempotente === false
    ).length,
    1,
    "QA_DUPLA_TRANSICAO_FINANCEIRA"
    );

    for (const falha of falhas) {
    if (falha.status !== "rejected") {
        continue;
    }

    const erro = falha.reason as {
        code?: string;
        message?: string;
        meta?: {
        code?: string;
        message?: string;
        };
    };

    const codigoPrisma = erro?.code;
    const codigoPostgres = String(
        erro?.meta?.code ?? ""
    );

    // P2034: conflito de concorrência reconhecido
    // diretamente pelo Prisma.
    const conflitoPrisma =
        codigoPrisma === "P2034";

    // P2010: erro de consulta SQL.
    // Somente aceitar se o PostgreSQL informar
    // explicitamente um conflito de serialização
    // ou deadlock.
    const conflitoPostgres =
        codigoPrisma === "P2010" &&
        ["40001", "40P01"].includes(codigoPostgres);

    if (!conflitoPrisma && !conflitoPostgres) {
        console.error(
        "[QA] Falha concorrente não reconhecida:",
        {
            codigoPrisma,
            codigoPostgres,
            mensagem: erro?.message,
            meta: erro?.meta,
        }
        );

        throw new Error(
        "QA_FALHA_CONCORRENTE_INESPERADA"
        );
    }

    console.log(
        "[QA] Conflito de concorrência detectado:",
        codigoPrisma,
        codigoPostgres || "(sem SQLSTATE)"
    );
    }

    const resultadoFinal =
    await finalizarCompensacaoEventoTransacionalQa(
        pagamentoId
    );

    assert.equal(
    resultadoFinal.idempotente,
    true
    );

    ok(
    "Duas finalizacoes concorrentes sem dupla transicao"
    );

    const [pg, pd, co] =
      await Promise.all([
        prisma.pagamento.findUniqueOrThrow({
          where: {
            id: pagamentoId,
          },
        }),

        prisma.billingPendenciaEvento.findUniqueOrThrow({
          where: {
            pagamentoId,
          },
        }),

        prisma.billingCompensacaoEvento.findUniqueOrThrow({
          where: {
            pagamentoId,
          },
        }),
      ]);

    assert.equal(
      pg.status,
      "REEMBOLSADO"
    );

    assert.ok(
      pg.reembolsadoEm
    );

    assert.equal(
      pd.status,
      "ESTORNO_CONFIRMADO"
    );

    assert.ok(
      pd.resolvidoEm
    );

    assert.equal(
      co.status,
      "CONFIRMADA"
    );

    assert.ok(
      co.confirmadoEm
    );

    ok(
      "Tres atualizacoes transacionais concluidas"
    );

    const repeticao =
      await finalizarCompensacaoEventoTransacionalQa(
        pagamentoId
      );

    assert.equal(
      repeticao.idempotente,
      true
    );

    const totalTentativas =
      await prisma.billingCompensacaoTentativa.count({
        where: {
          compensacaoId: co.id,
        },
      });

    assert.equal(
      totalTentativas,
      1
    );

    ok(
      "Reexecucao idempotente sem nova tentativa"
    );

    const beneficios =
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId,
        },
      });

    const inscricoes =
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,
          usuarioId:
            atleta.usuarioId,
          status: {
            not: "CANCELADA",
          },
        },
      });

    assert.equal(
      beneficios,
      0
    );

    assert.equal(
      inscricoes,
      0
    );

    const tentativa =
      await prisma.billingCompensacaoTentativa.findFirstOrThrow({
        where: {
          compensacaoId: co.id,
        },
      });

    assert.equal(
      tentativa.ambiente,
      "QA"
    );

    assert.equal(
      tentativa.operacaoExternaExecutada,
      false
    );

    assert.equal(
      tentativa.requisicaoEnviadaEm,
      null
    );

    assert.equal(
    tentativa.postAutorizacaoConsumidaEm,
    null,
    "QA_FINALIZACAO_CONSUMIU_AUTORIZACAO_POST"
    );

    assert.equal(
      tentativa.estornoProviderRef,
      null
    );

    ok(
      "Nenhum estorno externo nem beneficio indevido"
    );

    passou = true;

    console.log(
      `\nRESULTADO: ${quantidade}/8`
    );
  } finally {
    configurarConsultorMercadoPagoQa(
      null
    );

    try {
      if (
        passou &&
        pagamentoCriado
      ) {
        await prisma.$transaction(
          async (tx) => {
            const compensacao =
              await tx.billingCompensacaoEvento.findUniqueOrThrow({
                where: {
                  pagamentoId,
                },
              });

            assert.equal(
              compensacao.status,
              "CONFIRMADA"
            );

            await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
              where: {
                compensacaoId:
                  compensacao.id,
              },
            });

            await tx.billingCompensacaoTentativa.deleteMany({
              where: {
                compensacaoId:
                  compensacao.id,
              },
            });

            await tx.billingCompensacaoEvento.delete({
              where: {
                id: compensacao.id,
              },
            });

            await tx.billingPendenciaEvento.delete({
              where: {
                pagamentoId,
              },
            });

            await tx.pagamento.delete({
              where: {
                id: pagamentoId,
              },
            });
          }
        );

        if (eventoCriado) {
          await prisma.evento.delete({
            where: {
              id: eventoId,
            },
          });
        }

        console.log(
          "[QA] Fixtures removidas."
        );
      } else {
        console.warn(
          "[QA] Fixtures preservadas para auditoria:",
          {
            pagamentoId,
            eventoId,
          }
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(
    "QA_FINALIZACAO_INTEGRAL_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
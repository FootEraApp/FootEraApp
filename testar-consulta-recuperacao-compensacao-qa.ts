
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("QA_DATABASE_URL_INVALIDA");
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }

  const { prisma } = await import("./server/prisma.js");

  const {
    configurarConsultorMercadoPagoQa,
    configurarConsultorEstornoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    consultarRecuperacaoCompensacaoQa,
  } = await import(
    "./server/services/billingCompensacaoEventoConsultaRecuperacaoQaService.js"
  );

  const {
    prepararCompensacaoEventoVerificada,
  } = await import(
    "./server/services/billingCompensacaoEventoVerificadaService.js"
  );

  const {
    iniciarTentativaCompensacaoQa,
    finalizarTentativaCompensacaoQa,
    simularResultadoDesconhecidoCompensacaoQa,
  } = await import(
    "./server/services/billingCompensacaoEventoTentativaQaService.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const mpId = `${Date.now()}85471`;

  let eventoCriado = false;
  let pagamentoCriado = false;
  let aprovados = 0;
  let falhou = false;

  async function verificar(
    descricao: string,
    executar: () => Promise<void>
  ) {
    await executar();
    aprovados++;
    console.log("✔", descricao);
  }

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Tentativa Compensacao ${eventoId}`,
        descricao: "Fixture temporaria",
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
        providerRef: mpId,
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
        providerRef: mpId,
        valor: "25.00",
        moeda: "BRL",
      },
    });

    configurarConsultorMercadoPagoQa(async (id) => {
      assert.equal(id, mpId);

      return {
        id: mpId,
        status: "approved",
        status_detail: "accredited",
        external_reference: pagamentoId,
        metadata: { pagamentoId },
        transaction_amount: 25,
        currency_id: "BRL",
      };
    });

    await verificar(
      "Compensacao preparada depois da consulta externa",
      async () => {
        const resultado =
          await prepararCompensacaoEventoVerificada(
            pagamentoId
          );

        assert.equal(resultado.criadaAgora, true);
        assert.equal(
          resultado.compensacao.status,
          "PREPARADA"
        );
      }
    );

    let vencedores = 0;

    await verificar(
      "Seis tentativas simultaneas: somente uma adquire",
      async () => {
        const resultados = await Promise.all(
          Array.from(
            { length: 6 },
            () =>
              iniciarTentativaCompensacaoQa(
                pagamentoId
              )
          )
        );

        vencedores = resultados.filter(
          (r) => r.adquirida
        ).length;

        assert.equal(vencedores, 1);
      }
    );
    
    await verificar(
      "Concorrencia cria exatamente um historico",
      async () => {
        const compensacao =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const historicos =
          await prisma.billingCompensacaoTentativa.findMany({
            where: {
              compensacaoId: compensacao.id,
            },
          });

        assert.equal(historicos.length, 1);
        assert.equal(historicos[0].numero, 1);

        assert.equal(
          historicos[0].status,
          "EM_PROCESSAMENTO"
        );

        assert.equal(historicos[0].ambiente, "QA");
        assert.equal(
          historicos[0].operacaoExternaExecutada,
          false
        );
        assert.equal(historicos[0].encerradoEm, null);
      }
    );

    await verificar(
      "Estado registra uma tentativa em processamento",
      async () => {
        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(c.status, "EM_PROCESSAMENTO");
        assert.equal(c.tentativas, 1);
        assert.equal(c.confirmadoEm, null);
      }
    );

    await verificar(
      "Nova chamada nao inicia segunda tentativa",
      async () => {
        const resultado =
          await iniciarTentativaCompensacaoQa(
            pagamentoId
          );

        assert.equal(resultado.adquirida, false);
      }
    );

    await verificar(
      "Resultado desconhecido fica aguardando confirmacao",
      async () => {
        const resultado =
          await simularResultadoDesconhecidoCompensacaoQa(
            pagamentoId
          );

        assert.equal(resultado.registrada, true);

        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(
          c.status,
          "AGUARDANDO_CONFIRMACAO"
        );
        assert.equal(c.tentativas, 1);
        assert.equal(c.confirmadoEm, null);
        assert.equal(
          c.ultimoErro,
          "QA_RESULTADO_EXTERNO_DESCONHECIDO"
        );
      }
    );
    
    await verificar(
      "Historico registra resultado desconhecido sem estorno",
      async () => {
        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const historicos =
          await prisma.billingCompensacaoTentativa.findMany({
            where: {
              compensacaoId: c.id,
            },
          });

        assert.equal(historicos.length, 1);
        assert.equal(historicos[0].numero, 1);
        assert.equal(
          historicos[0].status,
          "RESULTADO_DESCONHECIDO"
        );
        assert.equal(historicos[0].ambiente, "QA");
        assert.equal(
          historicos[0].operacaoExternaExecutada,
          false
        );
        assert.ok(historicos[0].encerradoEm);
      }
    );
    
    await verificar(
      "Resultado desconhecido bloqueia segunda tentativa",
      async () => {
        const resultado =
          await iniciarTentativaCompensacaoQa(
            pagamentoId
          );

        assert.equal(resultado.adquirida, false);

        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(
          c.status,
          "AGUARDANDO_CONFIRMACAO"
        );
        assert.equal(c.tentativas, 1);
      }
    );

    await verificar(
      "Resultado desconhecido nao pode ser finalizado como falha QA",
      async () => {
        const resultado =
          await finalizarTentativaCompensacaoQa(
            pagamentoId
          );

        assert.equal(resultado.finalizada, false);

        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(
          c.status,
          "AGUARDANDO_CONFIRMACAO"
        );
      }
    );
    
    await verificar(
      "Estorno confirmado pelo simulador exige revisao",
      async () => {
        configurarConsultorEstornoQa(async (id) => {
          assert.equal(id, mpId);

          return {
            tipo: "ENCONTRADO",
            pagamentoProviderRef: mpId,
            estornoId: "refund-qa-001",
            status: "approved",
            valor: "25.00",
            moeda: "BRL",
          };
        });

        const resultado =
          await consultarRecuperacaoCompensacaoQa(
            pagamentoId
          );

        assert.equal(
          resultado.avaliacao.decisao,
          "ESTORNO_CONFIRMADO_PARA_REVISAO"
        );

        assert.equal(
          resultado.avaliacao.executarNovoEstorno,
          false
        );

        assert.equal(
          resultado.avaliacao.atualizarPagamento,
          false
        );
      }
    );

    await verificar(
      "Estorno pendente continua aguardando",
      async () => {
        configurarConsultorEstornoQa(
          async () => ({
            tipo: "ENCONTRADO",
            pagamentoProviderRef: mpId,
            estornoId: "refund-qa-001",
            status: "pending",
            valor: "25.00",
            moeda: "BRL",
          })
        );

        const resultado =
          await consultarRecuperacaoCompensacaoQa(
            pagamentoId
          );

        assert.equal(
          resultado.avaliacao.decisao,
          "AGUARDAR_PROVEDOR"
        );
      }
    );

    await verificar(
      "Estorno nao encontrado exige revisao",
      async () => {
        configurarConsultorEstornoQa(
          async () => ({
            tipo: "NAO_ENCONTRADO",
          })
        );

        const resultado =
          await consultarRecuperacaoCompensacaoQa(
            pagamentoId
          );

        assert.equal(
          resultado.avaliacao.decisao,
          "REVISAO_MANUAL"
        );

        assert.equal(
          resultado.avaliacao.executarNovoEstorno,
          false
        );
      }
    );

    await verificar(
      "Falha de consulta nao permite novo estorno",
      async () => {
        configurarConsultorEstornoQa(
          async () => {
            throw new Error("QA_FALHA_REDE");
          }
        );

        const resultado =
          await consultarRecuperacaoCompensacaoQa(
            pagamentoId
          );

        assert.equal(
          resultado.evidencia.tipo,
          "CONSULTA_FALHOU"
        );

        assert.equal(
          resultado.avaliacao.decisao,
          "REVISAO_MANUAL"
        );

        assert.equal(
          resultado.avaliacao.executarNovoEstorno,
          false
        );
      }
    );
    
    await verificar(
      "Historico de consultas nao altera o financeiro",
      async () => {
        const compensacao =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        const tentativas =
          await prisma.billingCompensacaoTentativa.findMany({
            where: {
              compensacaoId: compensacao.id,
            },
          });

        assert.equal(
          compensacao.status,
          "AGUARDANDO_CONFIRMACAO"
        );

        assert.equal(compensacao.tentativas, 1);
        assert.equal(compensacao.confirmadoEm, null);

        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.reembolsadoEm, null);

        assert.equal(tentativas.length, 1);
        assert.equal(
          tentativas[0].status,
          "RESULTADO_DESCONHECIDO"
        );
        assert.equal(
          tentativas[0].operacaoExternaExecutada,
          false
        );
      }
    );

    await verificar(
      "Quatro consultas ficam registradas no historico",
      async () => {
        const compensacao =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const consultas =
          await prisma.billingCompensacaoConsultaRecuperacao.findMany({
            where: {
              compensacaoId: compensacao.id,
            },
            orderBy: {
              consultadoEm: "asc",
            },
          });

        assert.equal(consultas.length, 4);

        assert.ok(
          consultas.every(
            (consulta) =>
              consulta.ambiente === "QA" &&
              consulta.simulada === true
          )
        );

        assert.deepEqual(
          consultas.map((consulta) => consulta.decisao).sort(),
          [
            "ESTORNO_CONFIRMADO_PARA_REVISAO",
            "AGUARDAR_PROVEDOR",
            "REVISAO_MANUAL",
            "REVISAO_MANUAL",
          ].sort()
        );

        assert.ok(
          consultas.every(
            (consulta) =>
              consulta.providerRef === mpId
          )
        );
      }
    );
    
    await verificar(
      "Banco rejeita consulta com tentativa inexistente",
      async () => {
        const compensacao =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const antes =
          await prisma.billingCompensacaoConsultaRecuperacao.count({
            where: {
              compensacaoId: compensacao.id,
            },
          });

        assert.equal(antes, 4);

        // Esse UUID não corresponde a nenhuma
        // tentativa existente.
        const tentativaInexistente = randomUUID();

        await assert.rejects(
          () =>
            prisma.billingCompensacaoConsultaRecuperacao.create({
              data: {
                compensacaoId: compensacao.id,
                tentativaId: tentativaInexistente,
                ambiente: "QA",
                simulada: true,
                tipoEvidencia: "NAO_ENCONTRADO",
                decisao: "REVISAO_MANUAL",
                motivo: "QA_TENTATIVA_INEXISTENTE",
                identidadeConfirmada: false,
                providerRef: mpId,
              },
            })
        );

        const depois =
          await prisma.billingCompensacaoConsultaRecuperacao.count({
            where: {
              compensacaoId: compensacao.id,
            },
          });

        // O banco não pode ter gravado a consulta inválida.
        assert.equal(depois, 4);
      }
    );

    await verificar(
      "Sem reembolso, beneficio ou inscricao indevida",
      async () => {
        const [pg, p, beneficios, inscricoes] =
          await Promise.all([
            prisma.pagamento.findUniqueOrThrow({
              where: { id: pagamentoId },
            }),
            prisma.billingPendenciaEvento.findUniqueOrThrow({
              where: { pagamentoId },
            }),
            prisma.pagamentoBeneficio.count({
              where: { pagamentoId },
            }),
            prisma.inscricaoEvento.count({
              where: { eventoId },
            }),
          ]);

        assert.equal(pg.status, "PENDENTE");
        assert.equal(pg.reembolsadoEm, null);
        assert.equal(p.status, "PENDENTE_ANALISE");
        assert.equal(beneficios, 0);
        assert.equal(inscricoes, 0);
      }
    );
  } catch (erro) {
    falhou = true;
    throw erro;
  } finally {
    try {
      configurarConsultorMercadoPagoQa(null);
      configurarConsultorEstornoQa(null);

      if (pagamentoCriado && !falhou) {
        await prisma.$transaction(async (tx) => {
          const pg = await tx.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

          const c =
            await tx.billingCompensacaoEvento.findUniqueOrThrow({
              where: { pagamentoId },
            });

          const beneficios = await tx.pagamentoBeneficio.count({
            where: { pagamentoId },
          });

          const inscricoes = await tx.inscricaoEvento.count({
            where: { eventoId },
          });

          if (
            pg.status !== "PENDENTE" ||
            pg.reembolsadoEm !== null ||
            pg.plano !== `EVENTO:${eventoId}` ||
            c.status !== "AGUARDANDO_CONFIRMACAO" ||
            c.tentativas !== 1 ||
            c.confirmadoEm !== null ||
            beneficios !== 0 ||
            inscricoes !== 0
          ) {
            throw new Error(
              "QA_LIMPEZA_BLOQUEADA_ESTADO_INESPERADO"
            );
          }
          
          const compensacaoParaLimpar =
            await tx.billingCompensacaoEvento.findUnique({
              where: { pagamentoId },
            });

          if (compensacaoParaLimpar) {
            const historicos =
              await tx.billingCompensacaoTentativa.findMany({
                where: {
                  compensacaoId: compensacaoParaLimpar.id,
                },
              });

            if (
              historicos.length !== 1 ||
              historicos[0].numero !== 1 ||
              historicos[0].status !== "RESULTADO_DESCONHECIDO" ||
              historicos[0].ambiente !== "QA" ||
              historicos[0].operacaoExternaExecutada !== false ||
              historicos[0].encerradoEm === null
            ) {
              throw new Error(
                "QA_LIMPEZA_HISTORICO_INESPERADO"
              );
            }
          }

          const consultasParaLimpar =
            await tx.billingCompensacaoConsultaRecuperacao.findMany({
              where: {
                compensacaoId: c.id,
              },
            });

          if (
            consultasParaLimpar.length !== 4 ||
            consultasParaLimpar.some(
              (item) =>
                item.ambiente !== "QA" ||
                item.simulada !== true
            )
          ) {
            throw new Error(
              "QA_LIMPEZA_CONSULTAS_INESPERADAS"
            );
          }

          await tx.billingCompensacaoConsultaRecuperacao.deleteMany({
            where: {
              compensacaoId: c.id,
            },
          });

          await tx.billingCompensacaoTentativa.deleteMany({
            where: {
              compensacaoId: c.id,
            },
          });

          await tx.billingCompensacaoEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.billingPendenciaEvento.deleteMany({
            where: { pagamentoId },
          });

          await tx.pagamento.delete({
            where: { id: pagamentoId },
          });
        });
      }

      if (eventoCriado && !falhou) {
        const pagamentos = await prisma.pagamento.count({
          where: { plano: `EVENTO:${eventoId}` },
        });

        const inscricoes = await prisma.inscricaoEvento.count({
          where: { eventoId },
        });

        if (pagamentos === 0 && inscricoes === 0) {
          await prisma.evento.delete({
            where: { id: eventoId },
          });
        }
      }

      if (falhou) {
        console.warn(
          "[QA] Dados preservados para auditoria:",
          { eventoId, pagamentoId }
        );
      } else {
        console.log(
          "[QA] Fixtures da compensacao removidas."
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\nRESULTADO: ${aprovados}/17`);
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
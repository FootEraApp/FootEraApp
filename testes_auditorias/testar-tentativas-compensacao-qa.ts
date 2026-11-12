
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
    process.env.NODE_ENV === "production" ||
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
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const {
    prepararCompensacaoEventoVerificada,
  } = await import(
    "./server/services/billingCompensacaoEventoVerificadaService.js"
  );

  const {
    iniciarTentativaCompensacaoQa,
    finalizarTentativaCompensacaoQa,
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
      "Finalizacao QA nao registra estorno confirmado",
      async () => {
        const resultado =
          await finalizarTentativaCompensacaoQa(
            pagamentoId
          );

        assert.equal(resultado.finalizada, true);

        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        assert.equal(c.status, "FALHA_REVISAR");
        assert.equal(c.tentativas, 1);
        assert.equal(c.confirmadoEm, null);
        assert.match(
          c.ultimoErro ?? "",
          /QA_SIMULACAO_ENCERRADA/
        );
      }
    );
        
    await verificar(
      "Historico registra encerramento sem estorno",
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
          "SIMULACAO_ENCERRADA"
        );

        assert.ok(historicos[0].encerradoEm);

        assert.equal(
          historicos[0].operacaoExternaExecutada,
          false
        );

        const pagamento =
          await prisma.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId },
          });

        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.reembolsadoEm, null);
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
            c.status !== "FALHA_REVISAR" ||
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
              historicos[0].status !== "SIMULACAO_ENCERRADA" ||
              historicos[0].ambiente !== "QA" ||
              historicos[0].operacaoExternaExecutada !== false ||
              historicos[0].encerradoEm === null
            ) {
              throw new Error(
                "QA_LIMPEZA_HISTORICO_INESPERADO"
              );
            }

            await tx.billingCompensacaoTentativa.deleteMany({
              where: {
                compensacaoId: compensacaoParaLimpar.id,
              },
            });
          }

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

  console.log(`\nRESULTADO: ${aprovados}/8`);
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
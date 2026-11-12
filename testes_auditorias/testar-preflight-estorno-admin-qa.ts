
/**
 * testar-preflight-estorno-admin-qa.ts
 *
 * ETAPA 4 - QA da pre-validacao administrativa.
 *
 * Nao executa estorno real.
 * Nao importa o gateway Mercado Pago.
 * Nao chama HTTP.
 *
 * Banco permitido:
 * 127.0.0.1:5433/footera_billing_qa
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Request } from "express";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigirAmbienteQa(): void {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !==
      "false" ||
    process.env.BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED !==
      "false" ||
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_PREFLIGHT_AMBIENTE_INSEGURO");
  }
}

async function exigirBloqueio(
  executar: () => Promise<unknown>,
  descricao: string
): Promise<void> {
  let bloqueou = false;

  try {
    await executar();
  } catch {
    bloqueou = true;
  }

  assert.ok(
    bloqueou,
    `DEVERIA_BLOQUEAR: ${descricao}`
  );
}

type Fixture = {
  eventoId: string;
  pagamentoId: string;
  providerRef: string;
};

async function main(): Promise<void> {
  exigirAmbienteQa();

  // Importar somente depois da checagem do QA.
  const { prisma } =
    await import("./server/prisma.js");

  const {
    solicitarAutorizacaoEstorno,
    aprovarAutorizacaoEstorno,
    revogarAutorizacaoEstorno,
    validarAutorizacaoEstornoAntesDoPreparo,
  } = await import(
    "./server/services/billingEstornoAdministrativoService.js"
  );

  const {
    consultarPreviaEstornoOperacional,
    executarEstornoOperacionalHttp,
  } = await import(
    "./server/services/billingEstornoOperacionalService.js"
  );

  const variaveis = [
    "BILLING_REFUND_REQUESTER_IDS",
    "BILLING_REFUND_APPROVER_IDS",
    "BILLING_REFUND_EXECUTOR_IDS",
    "BILLING_REFUND_MAX_CENTAVOS",
  ] as const;

  const anteriores = new Map<
    string,
    string | undefined
  >(
    variaveis.map((nome) => [
      nome,
      process.env[nome],
    ])
  );

  const rodada = randomUUID();
  const fixtures: Fixture[] = [];

  let passou = false;
  let verificacoes = 0;

  const ok = (descricao: string): void => {
    verificacoes++;
    console.log(`✔ ${descricao}`);
  };

  try {
    const banco =
      await prisma.$queryRaw<
        Array<{ nome: string }>
      >`
        SELECT current_database() AS nome
      `;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    ok("Conexao exclusiva com banco QA");

    const admins =
      await prisma.administrador.findMany({
        where: {
          usuario: { deletedAt: null },
        },
        select: { usuarioId: true },
        orderBy: { usuarioId: "asc" },
        take: 10,
      });

    if (admins.length < 2) {
      throw new Error(
        "QA_REQUER_DOIS_ADMINS_EXISTENTES"
      );
    }

    const solicitanteId = admins[0].usuarioId;
    const aprovadorId = admins[1].usuarioId;

    assert.ok(
      UUID.test(solicitanteId) &&
      UUID.test(aprovadorId)
    );

    assert.notEqual(
      solicitanteId,
      aprovadorId
    );

    process.env.BILLING_REFUND_REQUESTER_IDS =
      solicitanteId;

    process.env.BILLING_REFUND_APPROVER_IDS =
      aprovadorId;

    process.env.BILLING_REFUND_EXECUTOR_IDS =
      aprovadorId;

    process.env.BILLING_REFUND_MAX_CENTAVOS =
      "2500";

    const atleta =
      await prisma.atleta.findFirst({
        select: { usuarioId: true },
      });

    if (!atleta) {
      throw new Error(
        "QA_SEM_ATLETA_PARA_REFERENCIA"
      );
    }

    const atletaUsuarioId: string =
      atleta.usuarioId;

    async function criarFixture(
      indice: number
    ): Promise<Fixture> {
      const eventoId = randomUUID();
      const pagamentoId = randomUUID();

      const providerRef =
        `${Date.now()}${indice}998877`;

      const fixture = {
        eventoId,
        pagamentoId,
        providerRef,
      };

      // Registrar antes de criar para auxiliar
      // eventual investigacao de falha.
      fixtures.push(fixture);

      await prisma.evento.create({
        data: {
          id: eventoId,
          titulo:
            `QA Preflight Estorno ${rodada} ${indice}`,
          descricao:
            "Evento ficticio de QA, sem estorno externo",
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
          usuarioId: atletaUsuarioId,
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
            qaPreflightEstornoAdmin: rodada,
          },
        },
      });

      const pendencia =
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

      await prisma.billingCompensacaoEvento.create({
        data: {
          pagamentoId,
          pendenciaId: pendencia.id,
          chaveIdempotencia:
            `footera-evento-refund-${pagamentoId}`,
          status: "PREPARADA",
          valor: "25.00",
          moeda: "BRL",
          providerRef,
          tentativas: 0,
        },
      });

      return fixture;
    }

    const semAutorizacao =
      await criarFixture(1);

    const pendente =
      await criarFixture(2);

    const aprovada =
      await criarFixture(3);

    const expirada =
      await criarFixture(4);

    const revogada =
      await criarFixture(5);

    const divergente =
      await criarFixture(6);

    ok(
      "Seis compensacoes ficticias criadas sem HTTP"
    );

    // 1. Ausencia de autorizacao.
    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          semAutorizacao.pagamentoId,
          aprovadorId
        ),
      "autorizacao ausente"
    );

    ok("Autorizacao ausente bloqueada");

    // 2. Solicitacao ainda pendente.
    await solicitarAutorizacaoEstorno(
      pendente.pagamentoId,
      solicitanteId,
      "Solicitacao ficticia para testar preflight pendente"
    );

    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          pendente.pagamentoId,
          aprovadorId
        ),
      "autorizacao pendente"
    );

    ok("Autorizacao pendente bloqueada");

    // 3. Aprovacao valida.
    await solicitarAutorizacaoEstorno(
      aprovada.pagamentoId,
      solicitanteId,
      "Solicitacao ficticia para testar aprovacao valida"
    );

    await aprovarAutorizacaoEstorno(
      aprovada.pagamentoId,
      aprovadorId
    );

    await validarAutorizacaoEstornoAntesDoPreparo(
      aprovada.pagamentoId,
      aprovadorId
    );

    const previa =
      await consultarPreviaEstornoOperacional(
        aprovada.pagamentoId,
        aprovadorId
      );

    assert.equal(
      previa.preflightAprovado,
      true
    );

    assert.equal(
      previa.somenteConsulta,
      true
    );

    assert.equal(
      previa.estornoExecutado,
      false
    );

    assert.equal(
      previa.execucaoRealHabilitada,
      false
    );

    ok(
      "Aprovacao valida permite preflight e previa somente leitura"
    );

    // 4. Executor nao autorizado.
    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          aprovada.pagamentoId,
          solicitanteId
        ),
      "executor sem permissao"
    );

    ok("Executor nao autorizado bloqueado");

    // 5. Execucao operacional real
    // obrigatoriamente bloqueada no QA.
    await exigirBloqueio(
      () =>
        executarEstornoOperacionalHttp(
          {} as Request,
          aprovada.pagamentoId,
          `ESTORNAR:${aprovada.pagamentoId}`
        ),
      "execucao real desabilitada no QA"
    );

    ok("Execucao operacional real bloqueada no QA");

    // 6. Aprovacao expirada.
    await solicitarAutorizacaoEstorno(
      expirada.pagamentoId,
      solicitanteId,
      "Solicitacao ficticia para testar prazo de validade"
    );

    await aprovarAutorizacaoEstorno(
      expirada.pagamentoId,
      aprovadorId
    );

    // Mudar apenas a fixture desta rodada.
    await prisma.billingAutorizacaoEstorno.update({
      where: {
        pagamentoId: expirada.pagamentoId,
      },
      data: {
        expiraEm: new Date(
          Date.now() - 60_000
        ),
      },
    });

    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          expirada.pagamentoId,
          aprovadorId
        ),
      "autorizacao expirada"
    );

    ok("Autorizacao expirada bloqueada");

    // 7. Autorizacao revogada.
    await solicitarAutorizacaoEstorno(
      revogada.pagamentoId,
      solicitanteId,
      "Solicitacao ficticia para testar revogacao"
    );

    await aprovarAutorizacaoEstorno(
      revogada.pagamentoId,
      aprovadorId
    );

    await revogarAutorizacaoEstorno(
      revogada.pagamentoId,
      aprovadorId
    );

    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          revogada.pagamentoId,
          aprovadorId
        ),
      "autorizacao revogada"
    );

    ok("Autorizacao revogada bloqueada");

    // 8. Divergencia de valor.
    await solicitarAutorizacaoEstorno(
      divergente.pagamentoId,
      solicitanteId,
      "Solicitacao ficticia para testar divergencia financeira"
    );

    await aprovarAutorizacaoEstorno(
      divergente.pagamentoId,
      aprovadorId
    );

    await prisma.billingCompensacaoEvento.update({
      where: {
        pagamentoId: divergente.pagamentoId,
      },
      data: {
        valor: "24.99",
      },
    });

    await exigirBloqueio(
      () =>
        validarAutorizacaoEstornoAntesDoPreparo(
          divergente.pagamentoId,
          aprovadorId
        ),
      "valor divergente"
    );

    ok("Divergencia financeira bloqueada");

    // 9. Conferir ausencia de efeitos financeiros.
    const pagamentoIds =
      fixtures.map((item) => item.pagamentoId);

    const pagamentos =
      await prisma.pagamento.findMany({
        where: {
          id: { in: pagamentoIds },
        },
        select: {
          status: true,
          reembolsadoEm: true,
        },
      });

    assert.equal(
      pagamentos.length,
      fixtures.length
    );

    assert.ok(
      pagamentos.every(
        (pagamento) =>
          pagamento.status === "PENDENTE" &&
          pagamento.reembolsadoEm === null
      )
    );

    const totalTentativas =
      await prisma.billingCompensacaoTentativa.count({
        where: {
          compensacao: {
            pagamentoId: {
              in: pagamentoIds,
            },
          },
        },
      });

    const totalBeneficios =
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId: {
            in: pagamentoIds,
          },
        },
      });

    assert.equal(totalTentativas, 0);
    assert.equal(totalBeneficios, 0);

    ok(
      "Nenhuma tentativa, estorno ou beneficio financeiro criado"
    );

    passou = true;

    console.log(
      `\nRESULTADO: ${verificacoes}/${verificacoes} ` +
      "(sem HTTP, sem estorno real)"
    );
  } finally {
    // Restaurar configuracoes originais.
    for (const [nome, valor] of anteriores) {
      if (valor === undefined) {
        delete process.env[nome];
      } else {
        process.env[nome] = valor;
      }
    }

    try {
      if (passou && fixtures.length > 0) {
        const pagamentoIds =
          fixtures.map((item) => item.pagamentoId);

        const autorizacoes =
          await prisma.billingAutorizacaoEstorno.findMany({
            where: {
              pagamentoId: {
                in: pagamentoIds,
              },
            },
            select: { id: true },
          });

        const autorizacaoIds =
          autorizacoes.map(
            (autorizacao) => autorizacao.id
          );

        await prisma.$transaction(
          async (tx) => {
            // Conferir propriedade das fixtures antes
            // de permitir qualquer exclusao.
            for (const fixture of fixtures) {
              const pagamento =
                await tx.pagamento.findUniqueOrThrow({
                  where: {
                    id: fixture.pagamentoId,
                  },
                  select: {
                    meta: true,
                    status: true,
                  },
                });

              const meta =
                pagamento.meta as {
                  qaPreflightEstornoAdmin?: string;
                } | null;

              assert.equal(
                meta?.qaPreflightEstornoAdmin,
                rodada
              );

              assert.equal(
                pagamento.status,
                "PENDENTE"
              );
            }

            await tx.logAuditoria.deleteMany({
              where: {
                entidade:
                  "BillingAutorizacaoEstorno",
                entidadeId: {
                  in: autorizacaoIds,
                },
                acao: {
                  in: [
                    "BILLING_ESTORNO_SOLICITADO",
                    "BILLING_ESTORNO_APROVADO",
                    "BILLING_ESTORNO_REVOGADO",
                  ],
                },
              },
            });

            await tx.billingAutorizacaoEstorno.deleteMany({
              where: {
                pagamentoId: {
                  in: pagamentoIds,
                },
              },
            });

            await tx.billingCompensacaoEvento.deleteMany({
              where: {
                pagamentoId: {
                  in: pagamentoIds,
                },
              },
            });

            await tx.billingPendenciaEvento.deleteMany({
              where: {
                pagamentoId: {
                  in: pagamentoIds,
                },
              },
            });

            await tx.pagamento.deleteMany({
              where: {
                id: {
                  in: pagamentoIds,
                },
              },
            });

            await tx.evento.deleteMany({
              where: {
                id: {
                  in: fixtures.map(
                    (fixture) => fixture.eventoId
                  ),
                },
              },
            });
          },
          {
            timeout: 20_000,
          }
        );

        console.log(
          "[QA] Fixtures e logs desta rodada removidos"
        );
      } else if (fixtures.length > 0) {
        console.warn(
          "[QA] Falha detectada. Fixtures preservadas para analise:",
          fixtures
        );
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(
    "QA_PREFLIGHT_ESTORNO_ADMIN_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
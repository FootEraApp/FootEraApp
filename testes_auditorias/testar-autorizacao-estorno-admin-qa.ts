// testar-autorizacao-estorno-admin-qa.ts
// QA isolado da autorizacao administrativa. NAO chama Mercado Pago.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function exigirAmbienteQa(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_ACCOUNT_PURGE !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_AMBIENTE_INSEGURO");
  }
}

async function esperarErro(
  executar: () => Promise<unknown>,
  descricao: string
): Promise<void> {
  let falhou = false;
  try {
    await executar();
  } catch {
    falhou = true;
  }
  assert.ok(falhou, `DEVERIA_BLOQUEAR: ${descricao}`);
}

async function main(): Promise<void> {
  exigirAmbienteQa();

  // Importar somente depois da verificacao do ambiente.
  const { prisma } = await import("./server/prisma.js");
  const { Prisma } = await import("@prisma/client");
  const {
    solicitarAutorizacaoEstorno,
    aprovarAutorizacaoEstorno,
    revogarAutorizacaoEstorno,
    consultarAutorizacaoEstorno,
    consumirAutorizacaoEstornoNaAquisicao,
    validarExecutorEstorno,
  } = await import(
    "./server/services/billingEstornoAdministrativoService.js"
  );

  const variaveis = [
    "BILLING_REFUND_REQUESTER_IDS",
    "BILLING_REFUND_APPROVER_IDS",
    "BILLING_REFUND_EXECUTOR_IDS",
    "BILLING_REFUND_MAX_CENTAVOS",
  ] as const;
  const anteriores = new Map<string, string | undefined>(
    variaveis.map((nome) => [nome, process.env[nome]])
  );

  const rodada = randomUUID();
  const fixtures: Array<{
    eventoId: string;
    pagamentoId: string;
    providerRef: string;
  }> = [];
  let passou = false;
  let verificacoes = 0;

  const ok = (mensagem: string) => {
    verificacoes += 1;
    console.log(`✔ ${mensagem}`);
  };

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`
      SELECT current_database() AS nome
    `;
    assert.equal(banco[0]?.nome, "footera_billing_qa");
    ok("Conexao exclusiva com o banco QA");

    const admins = await prisma.administrador.findMany({
      where: { usuario: { deletedAt: null } },
      select: { usuarioId: true },
      take: 10,
      orderBy: { usuarioId: "asc" },
    });
    // Usar somente administradores que ja existem, sem modificar suas contas.
    if (admins.length < 2) {
      throw new Error(
        "QA_REQUER_DOIS_ADMINISTRADORES_EXISTENTES: nao criar admins em contas reais"
      );
    }
    const solicitanteId = admins[0].usuarioId;
    const aprovadorId = admins[1].usuarioId;
    assert.ok(UUID.test(solicitanteId) && UUID.test(aprovadorId));
    assert.notEqual(solicitanteId, aprovadorId);

    process.env.BILLING_REFUND_REQUESTER_IDS = solicitanteId;
    process.env.BILLING_REFUND_APPROVER_IDS = `${solicitanteId},${aprovadorId}`;
    process.env.BILLING_REFUND_EXECUTOR_IDS = aprovadorId;
    process.env.BILLING_REFUND_MAX_CENTAVOS = "2500";

    const atleta = await prisma.atleta.findFirst({
    select: { usuarioId: true },
    });

    if (!atleta) {
    throw new Error("QA_SEM_ATLETA_PARA_REFERENCIA");
    }

    const atletaUsuarioId: string = atleta.usuarioId;

    async function criarFixture(indice: number) {
      const eventoId = randomUUID();
      const pagamentoId = randomUUID();
      const providerRef = `${Date.now()}${indice}998877`;
      const item = { eventoId, pagamentoId, providerRef };
      // Guardar IDs antes de criar para permitir inspecao em caso de falha.
      fixtures.push(item);

      await prisma.evento.create({
        data: {
          id: eventoId,
          titulo: `QA Autorizacao Estorno ${rodada} ${indice}`,
          descricao: "QA isolado, sem transferencia financeira",
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
          meta: { qaAutorizacaoEstornoAdmin: rodada },
        },
      });
      const pendencia = await prisma.billingPendenciaEvento.create({
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
      await prisma.billingCompensacaoEvento.create({
        data: {
          pagamentoId,
          pendenciaId: pendencia.id,
          chaveIdempotencia: `footera-evento-refund-${pagamentoId}`,
          status: "PREPARADA",
          valor: "25.00",
          moeda: "BRL",
          providerRef,
          tentativas: 0,
        },
      });
      return item;
    }

    const primeira = await criarFixture(1);
    const segunda = await criarFixture(2);
    const terceira = await criarFixture(3);
    ok("Tres compensacoes ficticias elegiveis preparadas sem HTTP");

    await esperarErro(
      () => solicitarAutorizacaoEstorno(primeira.pagamentoId, aprovadorId, "Justificativa de QA isolado com mais de vinte caracteres"),
      "solicitante fora da lista"
    );
    await esperarErro(
      () => solicitarAutorizacaoEstorno(primeira.pagamentoId, solicitanteId, "curto"),
      "motivo insuficiente"
    );
    ok("Solicitante nao autorizado e motivo invalido bloqueados");

    const pedido = await solicitarAutorizacaoEstorno(
      primeira.pagamentoId,
      solicitanteId,
      "Pagamento aprovado sem vaga: solicitar estorno integral em QA"
    );
    assert.equal(pedido.status, "PENDENTE");
    assert.equal(pedido.solicitanteId, solicitanteId);
    assert.equal(pedido.providerRef, primeira.providerRef);
    await esperarErro(
      () => solicitarAutorizacaoEstorno(primeira.pagamentoId, solicitanteId, "Tentativa duplicada de solicitacao administrativa QA"),
      "solicitacao duplicada"
    );
    ok("Solicitacao persistida e segunda solicitacao bloqueada");

    await esperarErro(
      () => aprovarAutorizacaoEstorno(primeira.pagamentoId, solicitanteId),
      "autoaprovacao"
    );
    ok("Autoaprovacao rejeitada");

    const aprovacao = await aprovarAutorizacaoEstorno(
      primeira.pagamentoId,
      aprovadorId
    );
    assert.equal(aprovacao.pagamentoId, primeira.pagamentoId);
    assert.ok(aprovacao.expiraEm.getTime() > Date.now());
    const consulta = await consultarAutorizacaoEstorno(
      primeira.pagamentoId,
      solicitanteId
    );
    assert.equal(consulta?.status, "APROVADA");
    assert.equal(consulta?.aprovadorId, aprovadorId);
    await esperarErro(
      () => aprovarAutorizacaoEstorno(primeira.pagamentoId, aprovadorId),
      "segunda aprovacao"
    );
    ok("Aprovacao por segundo admin e reentrada bloqueada");

    await esperarErro(
      () => prisma.$transaction(async (tx) => {
        await consumirAutorizacaoEstornoNaAquisicao(
          tx, primeira.pagamentoId, new Prisma.Decimal("24.99"),
          primeira.providerRef, aprovadorId
        );
      }),
      "valor divergente"
    );
    await esperarErro(
      () => prisma.$transaction(async (tx) => {
        await consumirAutorizacaoEstornoNaAquisicao(
          tx, primeira.pagamentoId, new Prisma.Decimal("25.00"),
          "999999999", aprovadorId
        );
      }),
      "providerRef divergente"
    );
    assert.equal(
      (await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
        where: { pagamentoId: primeira.pagamentoId },
      })).status,
      "APROVADA"
    );
    ok("Valor e referencia externa divergentes bloqueados");

    await esperarErro(
      () => prisma.$transaction(async (tx) => {
        await consumirAutorizacaoEstornoNaAquisicao(
          tx, primeira.pagamentoId, new Prisma.Decimal("25.00"),
          primeira.providerRef, aprovadorId
        );
        throw new Error("QA_ROLLBACK_OBRIGATORIO");
      }),
      "rollback forcado"
    );
    assert.equal(
      (await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
        where: { pagamentoId: primeira.pagamentoId },
      })).status,
      "APROVADA"
    );
    ok("Rollback desfaz consumo e respectiva auditoria");

    await validarExecutorEstorno(aprovadorId);
    await esperarErro(
      () => validarExecutorEstorno(solicitanteId),
      "executor nao autorizado"
    );
    ok("Executor financeiro permitido e identidade nao autorizada bloqueada");

    const concorrentes = await Promise.allSettled([
      prisma.$transaction((tx) =>
        consumirAutorizacaoEstornoNaAquisicao(
          tx, primeira.pagamentoId, new Prisma.Decimal("25.00"),
          primeira.providerRef, aprovadorId
        ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      ),
      prisma.$transaction((tx) =>
        consumirAutorizacaoEstornoNaAquisicao(
          tx, primeira.pagamentoId, new Prisma.Decimal("25.00"),
          primeira.providerRef, aprovadorId
        ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      ),
    ]);
    assert.equal(concorrentes.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(concorrentes.filter((r) => r.status === "rejected").length, 1);
    const consumida = await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
      where: { pagamentoId: primeira.pagamentoId },
    });
    assert.equal(consumida.status, "CONSUMIDA");
    assert.ok(consumida.consumidoEm);
    await esperarErro(
      () => revogarAutorizacaoEstorno(primeira.pagamentoId, aprovadorId),
      "revogar autorizacao ja consumida"
    );
    ok("Concorrencia consome uma vez e nao permite revogacao posterior");

    await solicitarAutorizacaoEstorno(
      segunda.pagamentoId, solicitanteId,
      "Solicitacao ficticia para verificar prazo de expiracao"
    );
    await aprovarAutorizacaoEstorno(segunda.pagamentoId, aprovadorId);
    // Apenas a fixture QA: simular passagem do tempo.
    await prisma.billingAutorizacaoEstorno.update({
      where: { pagamentoId: segunda.pagamentoId },
      data: { expiraEm: new Date(Date.now() - 60_000) },
    });
    await esperarErro(
      () => prisma.$transaction((tx) =>
        consumirAutorizacaoEstornoNaAquisicao(
          tx, segunda.pagamentoId, new Prisma.Decimal("25.00"),
          segunda.providerRef, aprovadorId
        )
      ),
      "autorizacao expirada"
    );
    assert.equal(
      (await prisma.billingAutorizacaoEstorno.findUniqueOrThrow({
        where: { pagamentoId: segunda.pagamentoId },
      })).status,
      "APROVADA"
    );
    ok("Aprovacao com prazo vencido nao pode ser consumida");

    await solicitarAutorizacaoEstorno(
      terceira.pagamentoId, solicitanteId,
      "Solicitacao ficticia para verificar revogacao administrativa"
    );
    await aprovarAutorizacaoEstorno(terceira.pagamentoId, aprovadorId);
    const revogada = await revogarAutorizacaoEstorno(
      terceira.pagamentoId, aprovadorId
    );
    assert.equal(revogada.revogada, true);
    await esperarErro(
      () => prisma.$transaction((tx) =>
        consumirAutorizacaoEstornoNaAquisicao(
          tx, terceira.pagamentoId, new Prisma.Decimal("25.00"),
          terceira.providerRef, aprovadorId
        )
      ),
      "autorizacao revogada"
    );
    ok("Revogacao impede consumo posterior");

    const ids = fixtures.map((f) => f.pagamentoId);
    const autorizacoes = await prisma.billingAutorizacaoEstorno.findMany({
      where: { pagamentoId: { in: ids } },
      select: { id: true },
    });
    const logs = await prisma.logAuditoria.findMany({
      where: {
        entidade: "BillingAutorizacaoEstorno",
        entidadeId: { in: autorizacoes.map((a) => a.id) },
      },
    });
    const acoes = logs.map((l) => l.acao);
    assert.equal(
      acoes.filter((a) => a === "BILLING_ESTORNO_AUTORIZACAO_CONSUMIDA").length,
      1
    );
    assert.ok(acoes.includes("BILLING_ESTORNO_SOLICITADO"));
    assert.ok(acoes.includes("BILLING_ESTORNO_APROVADO"));
    assert.ok(acoes.includes("BILLING_ESTORNO_REVOGADO"));
    assert.equal(
      await prisma.pagamentoBeneficio.count({ where: { pagamentoId: { in: ids } } }),
      0
    );
    const pagamentos = await prisma.pagamento.findMany({
      where: { id: { in: ids } },
      select: { status: true, reembolsadoEm: true },
    });
    assert.equal(pagamentos.length, 3);
    assert.ok(pagamentos.every((p) => p.status === "PENDENTE" && p.reembolsadoEm === null));
    assert.equal(
      await prisma.billingCompensacaoTentativa.count({
        where: { compensacao: { pagamentoId: { in: ids } } },
      }),
      0
    );
    ok("Auditoria consistente, nenhum pagamento ou tentativa financeira alterado");

    passou = true;
    console.log(`\nRESULTADO: ${verificacoes}/${verificacoes} (sem HTTP, sem estorno real)`);
  } finally {
    for (const [nome, valor] of anteriores) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }

    try {
      if (passou && fixtures.length > 0) {
        const pagamentoIds = fixtures.map((f) => f.pagamentoId);
        const autorizacoes = await prisma.billingAutorizacaoEstorno.findMany({
          where: { pagamentoId: { in: pagamentoIds } },
          select: { id: true },
        });
        const autorizacaoIds = autorizacoes.map((a) => a.id);
        await prisma.$transaction(async (tx) => {
          for (const f of fixtures) {
            const pagamento = await tx.pagamento.findUniqueOrThrow({
              where: { id: f.pagamentoId },
              select: { meta: true, status: true },
            });
            assert.equal(
              (pagamento.meta as { qaAutorizacaoEstornoAdmin?: string } | null)
                ?.qaAutorizacaoEstornoAdmin,
              rodada
            );
            assert.equal(pagamento.status, "PENDENTE");
          }
          await tx.logAuditoria.deleteMany({
            where: {
              entidade: "BillingAutorizacaoEstorno",
              entidadeId: { in: autorizacaoIds },
              acao: { in: [
                "BILLING_ESTORNO_SOLICITADO",
                "BILLING_ESTORNO_APROVADO",
                "BILLING_ESTORNO_REVOGADO",
                "BILLING_ESTORNO_AUTORIZACAO_CONSUMIDA",
              ] },
            },
          });
          await tx.billingAutorizacaoEstorno.deleteMany({
            where: { pagamentoId: { in: pagamentoIds } },
          });
          await tx.billingCompensacaoEvento.deleteMany({
            where: { pagamentoId: { in: pagamentoIds } },
          });
          await tx.billingPendenciaEvento.deleteMany({
            where: { pagamentoId: { in: pagamentoIds } },
          });
          await tx.pagamento.deleteMany({
            where: { id: { in: pagamentoIds } },
          });
          await tx.evento.deleteMany({
            where: { id: { in: fixtures.map((f) => f.eventoId) } },
          });
        }, { timeout: 20_000 });
        console.log("[QA] Fixtures e logs desta rodada removidos");
      } else if (fixtures.length) {
        console.warn("[QA] Falha detectada; confira fixtures antes de limpar:", fixtures);
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error("QA_AUTORIZACAO_ESTORNO_ADMIN_FALHOU:", error);
  process.exitCode = 1;
});
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

async function main() {
  let db: URL;
  try { db = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new Error("QA_DATABASE_URL_INVALIDA"); }
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
  ) throw new Error("QA_AMBIENTE_INSEGURO");

  const { prisma } = await import("./server/prisma.js");
  const { configurarConsultorMercadoPagoQa } = await import("./server/services/billingMercadoPagoGateway.js");
  const { prepararCompensacaoEventoVerificada } = await import("./server/services/billingCompensacaoEventoVerificadaService.js");
  const {
    iniciarTentativaCompensacaoQa,
    reservarChaveOperacaoCompensacaoQa,
    registrarIntencaoEnvioEstornoQa,
    avaliarRetomadaCompensacaoQa,
  } = await import("./server/services/billingCompensacaoEventoTentativaQaService.js");

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const mpId = `${Date.now()}78641`;
  const titulo = `QA_INTENCAO_${eventoId}`;
  let eventoCriado = false;
  let pagamentoCriado = false;
  let sucesso = false;
  let aprovados = 0;
  const verificar = async (nome: string, fn: () => Promise<void>) => {
    await fn(); aprovados++; console.log("✔", nome);
  };

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, "footera_billing_qa");
    const atleta = await prisma.atleta.findFirst({ select: { usuarioId: true } });
    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({ data: {
      id: eventoId, titulo, descricao: "Fixture exclusiva QA", status: "ABERTO",
      dataEvento: new Date(Date.now() + 10 * 86400000),
      inscricaoInicio: new Date(Date.now() - 86400000),
      inscricaoFim: new Date(Date.now() + 9 * 86400000),
      vagas: 1, valorInscricao: "25.00", requisitos: [], linkInscricao: null,
    }});
    eventoCriado = true;
    await prisma.pagamento.create({ data: {
      id: pagamentoId, usuarioId: atleta.usuarioId,
      plano: `EVENTO:${eventoId}`, periodicidade: "Mensal", metodo: "PIX",
      status: "PENDENTE", valor: "25.00", moeda: "BRL",
      provider: "MERCADOPAGO", providerRef: mpId,
      contextoKind: "PERSONAL", contextoTipo: "Atleta",
    }});
    pagamentoCriado = true;
    await prisma.billingPendenciaEvento.create({ data: {
      pagamentoId, eventoId, motivo: "BILLING_EVENT_CAPACITY_EXCEEDED",
      status: "PENDENTE_ANALISE", providerRef: mpId, valor: "25.00", moeda: "BRL",
    }});
    configurarConsultorMercadoPagoQa(async (id) => {
      assert.equal(id, mpId);
      return { id: mpId, status: "approved", status_detail: "accredited",
        external_reference: pagamentoId, metadata: { pagamentoId },
        transaction_amount: 25, currency_id: "BRL" };
    });

    await verificar("Compensacao preparada com consulta simulada", async () => {
      const r = await prepararCompensacaoEventoVerificada(pagamentoId);
      assert.equal(r.criadaAgora, true);
      assert.equal(r.compensacao.status, "PREPARADA");
    });
    await verificar("Uma tentativa adquirida e chave reservada", async () => {
      const a = await iniciarTentativaCompensacaoQa(pagamentoId);
      assert.equal(a.adquirida, true);
      const chave = await reservarChaveOperacaoCompensacaoQa(pagamentoId);
      assert.equal(chave.reservada, true);
    });
    
    await verificar(
      "Somente uma intencao concorrente e registrada",
      async () => {
        const resultados = await Promise.all([
          registrarIntencaoEnvioEstornoQa(pagamentoId),
          registrarIntencaoEnvioEstornoQa(pagamentoId),
        ]);

        assert.equal(
          resultados.filter((r) => r.registrada === true)
            .length,
          1,
          "QA_INTENCAO_DUPLICADA"
        );

        const c =
          await prisma.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId },
            include: { historicoTentativas: true },
          });

        assert.equal(
          c.status,
          "AGUARDANDO_CONFIRMACAO"
        );
        assert.equal(c.tentativas, 1);
        assert.equal(c.confirmadoEm, null);
        assert.equal(c.historicoTentativas.length, 1);

        const tentativa = c.historicoTentativas[0];

        assert.equal(
          tentativa.status,
          "CONFIRMACAO_EXTERNA_PENDENTE"
        );
        assert.equal(
          tentativa.chaveIdempotenciaOperacao,
          `footera-evento-refund-${pagamentoId}`
        );
        assert.equal(
          tentativa.operacaoExternaExecutada,
          false
        );
        assert.equal(tentativa.requisicaoEnviadaEm, null);
        assert.equal(tentativa.estornoProviderRef, null);

        assert.equal(
          await prisma.billingCompensacaoTentativa.count({
            where: { compensacaoId: c.id },
          }),
          1
        );
      }
    );
    await verificar("Intencao repetida nao registra outra operacao", async () => {
      const r = await registrarIntencaoEnvioEstornoQa(pagamentoId);
      assert.equal(r.registrada, false);
    });
    await verificar("Retomada local bloqueia envio e confirmacao", async () => {
      const r = await avaliarRetomadaCompensacaoQa(pagamentoId);
      assert.equal(r.motivo, "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO");
      assert.equal(r.podeEnviarEstorno, false);
      assert.equal(r.podeRepetirEstorno, false);
      assert.equal(r.podeConfirmarCompensacao, false);
      assert.equal(r.atualizarPagamento, false);
    });
    await verificar("Processo Node independente recupera intencao", async () => {
      const saida = execFileSync(process.execPath, [
        "--import", "tsx", "./testar-retomada-compensacao-processo-filho-qa.ts",
        pagamentoId, "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO",
      ], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 30000 });
      assert.match(saida, /Processo independente confirmou/);
    });
    await verificar("Sem pagamento aprovado, beneficio ou inscricao", async () => {
      const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
      assert.equal(pg.status, "PENDENTE");
      assert.equal(pg.reembolsadoEm, null);
      assert.equal(await prisma.pagamentoBeneficio.count({ where: { pagamentoId } }), 0);
      assert.equal(await prisma.inscricaoEvento.count({ where: { eventoId } }), 0);
      const c = await prisma.billingCompensacaoEvento.findUniqueOrThrow({
        where: { pagamentoId },
      });
      assert.equal(await prisma.billingCompensacaoConsultaRecuperacao.count({
        where: { compensacaoId: c.id },
      }), 0);
    });
    sucesso = true;
  } finally {
    try {
      configurarConsultorMercadoPagoQa(null);
      if (sucesso && pagamentoCriado && eventoCriado) {
        await prisma.$transaction(async (tx) => {
          const pg = await tx.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
          const ev = await tx.evento.findUniqueOrThrow({ where: { id: eventoId } });
          const c = await tx.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId }, include: { historicoTentativas: true },
          });
          if (pg.plano !== `EVENTO:${eventoId}` || pg.status !== "PENDENTE" ||
              pg.provider !== "MERCADOPAGO" || pg.reembolsadoEm !== null ||
              ev.titulo !== titulo || c.status !== "AGUARDANDO_CONFIRMACAO" ||
              c.historicoTentativas.length !== 1 ||
              c.historicoTentativas[0].status !== "CONFIRMACAO_EXTERNA_PENDENTE" ||
              c.historicoTentativas[0].operacaoExternaExecutada !== false ||
              c.historicoTentativas[0].estornoProviderRef !== null) {
            throw new Error("QA_LIMPEZA_ESTADO_INESPERADO");
          }
          if (await tx.pagamentoBeneficio.count({ where: { pagamentoId } }) !== 0 ||
              await tx.inscricaoEvento.count({ where: { eventoId } }) !== 0 ||
              await tx.billingCompensacaoConsultaRecuperacao.count({ where: { compensacaoId: c.id } }) !== 0 ||
              await tx.pagamento.count({ where: { plano: `EVENTO:${eventoId}` } }) !== 1) {
            throw new Error("QA_LIMPEZA_DEPENDENCIAS_INESPERADAS");
          }
          await tx.billingCompensacaoTentativa.deleteMany({ where: { compensacaoId: c.id } });
          await tx.billingCompensacaoEvento.delete({ where: { id: c.id } });
          await tx.billingPendenciaEvento.delete({ where: { pagamentoId } });
          await tx.pagamento.delete({ where: { id: pagamentoId } });
          await tx.evento.delete({ where: { id: eventoId } });
        });
        console.log("[QA] Fixtures temporarias removidas.");
      } else {
        console.warn("[QA] Fixtures preservadas para auditoria:", {
          eventoId: eventoCriado ? eventoId : null,
          pagamentoId: pagamentoCriado ? pagamentoId : null,
        });
      }
    } finally { await prisma.$disconnect(); }
  }
  console.log(`\nRESULTADO: ${aprovados}/7`);
}
main().catch((erro) => { console.error("TESTE INTERROMPIDO:", erro); process.exitCode = 1; });
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
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) throw new Error("ORQUESTRACAO_QA_AMBIENTE_INSEGURO");

  const { prisma } = await import("./server/prisma.js");
  const { configurarConsultorMercadoPagoQa } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );
  const {
    prepararIntencaoEnvioEstornoQa,
    consultarRetomadaEnvioEstornoQa,
  } = await import("./server/services/billingCompensacaoEventoEnvioService.js");

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  const providerRef = `${Date.now()}97531`;
  let eventoCriado = false;
  let pagamentoCriado = false;
  let aprovado = false;
  let total = 0;
  function ok(nome: string) { total++; console.log("✔", nome); }

  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`
      SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });
    assert.ok(atleta, "QA_SEM_ATLETA");

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA Orquestracao ${eventoId}`,
        descricao: "Fixture QA sem estorno externo",
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
        pagamentoId, eventoId,
        motivo: "BILLING_EVENT_CAPACITY_EXCEEDED",
        status: "PENDENTE_ANALISE",
        providerRef, valor: "25.00", moeda: "BRL",
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

    const primeira = await prepararIntencaoEnvioEstornoQa(pagamentoId);
    assert.equal(primeira.intencaoRegistrada, true);
    assert.equal(primeira.executouEstorno, false);
    assert.equal(primeira.requerConciliacao, true);
    assert.equal(primeira.chaveIdempotencia,
      `footera-evento-refund-${pagamentoId}`);
    ok("Preparação, aquisição, chave e intenção persistidas");

    const compensacao = await prisma.billingCompensacaoEvento.findUniqueOrThrow({
      where: { pagamentoId }, include: { historicoTentativas: true },
    });
    assert.equal(compensacao.status, "AGUARDANDO_CONFIRMACAO");
    assert.equal(compensacao.tentativas, 1);
    assert.equal(compensacao.historicoTentativas.length, 1);
    const tentativa = compensacao.historicoTentativas[0];
    assert.equal(tentativa.ambiente, "QA");
    assert.equal(tentativa.operacaoExternaExecutada, false);
    assert.equal(tentativa.requisicaoEnviadaEm, null);
    assert.equal(tentativa.estornoProviderRef, null);
    ok("Tentativa registra ausência de estorno externo");

    const segunda = await prepararIntencaoEnvioEstornoQa(pagamentoId).catch(
      (erro: unknown) => ({ erro: erro instanceof Error ? erro.message : String(erro) })
    );
    // A verificação inicial pode recusar reentrada por elegibilidade.
    // Isso também é seguro: nunca pode iniciar novo envio.
    assert.equal("executouEstorno" in segunda ? segunda.executouEstorno : false, false);
    const registros = await prisma.billingCompensacaoTentativa.count({
      where: { compensacaoId: compensacao.id },
    });
    assert.equal(registros, 1);
    ok("Reentrada não cria nova tentativa");

    const retomada = await consultarRetomadaEnvioEstornoQa(pagamentoId);
    assert.equal(retomada.motivo, "INTENCAO_PERSISTIDA_SEM_CONFIRMACAO");
    assert.equal(retomada.executarNovoEstorno, false);
    assert.equal(retomada.atualizarPagamento, false);
    assert.equal(retomada.confirmarCompensacao, false);
    ok("Retomada é somente leitura e bloqueia reenvio");

    const pg = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });
    assert.equal(pg.status, "PENDENTE");
    assert.equal(pg.reembolsadoEm, null);
    assert.equal(await prisma.pagamentoBeneficio.count({
      where: { pagamentoId },
    }), 0);
    assert.equal(await prisma.inscricaoEvento.count({
      where: { eventoId, usuarioId: atleta.usuarioId, status: { not: "CANCELADA" } },
    }), 0);
    ok("Nenhum benefício, inscrição ou reembolso indevido");

    aprovado = true;
    console.log(`\\nRESULTADO: ${total}/5`);
  } finally {
    configurarConsultorMercadoPagoQa(null);
    try {
      if (aprovado && pagamentoCriado) {
        await prisma.$transaction(async (tx) => {
          const c = await tx.billingCompensacaoEvento.findUniqueOrThrow({
            where: { pagamentoId }, include: { historicoTentativas: true },
          });
          const pg = await tx.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
          assert.equal(pg.status, "PENDENTE");
          assert.equal(pg.reembolsadoEm, null);
          assert.equal(c.status, "AGUARDANDO_CONFIRMACAO");
          assert.equal(c.historicoTentativas.length, 1);
          assert.equal(c.historicoTentativas[0].operacaoExternaExecutada, false);
          assert.equal(c.historicoTentativas[0].estornoProviderRef, null);
          assert.equal(await tx.pagamentoBeneficio.count({ where: { pagamentoId } }), 0);
          await tx.billingCompensacaoTentativa.deleteMany({ where: { compensacaoId: c.id } });
          await tx.billingCompensacaoEvento.delete({ where: { id: c.id } });
          await tx.billingPendenciaEvento.deleteMany({ where: { pagamentoId } });
          await tx.pagamento.delete({ where: { id: pagamentoId } });
        });
        if (eventoCriado) await prisma.evento.delete({ where: { id: eventoId } });
        console.log("[QA] Fixtures removidas.");
      } else {
        console.warn("[QA] Dados preservados para auditoria:", { eventoId, pagamentoId });
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("QA_ORQUESTRACAO_FALHOU:", erro);
  process.exitCode = 1;
});
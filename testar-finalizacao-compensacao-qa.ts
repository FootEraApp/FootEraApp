import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.NODE_ENV !== "test" || Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" || db.pathname !== "/footera_billing_qa"
  ) throw new Error("QA_FINALIZACAO_AMBIENTE_INSEGURO");

  const { prisma } = await import("./server/prisma.js");
  const { finalizarCompensacaoEventoVerificada } = await import(
    "./server/services/billingCompensacaoEventoFinalizacaoService.js"
  );
  const { solicitarEstornoMercadoPago } = await import(
    "./server/services/billingEstornoMercadoPagoGateway.js"
  );
  let total = 0;
  const ok = (nome: string) => { total++; console.log("✔", nome); };
  let pagamentoId: string | null = null;
  let sucesso = false;
  try {
    const banco = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(banco[0]?.nome, "footera_billing_qa");
    ok("Banco real conectado é exclusivamente QA");

    await assert.rejects(
      finalizarCompensacaoEventoVerificada(randomUUID()),
      /BILLING_COMPENSACAO_FINALIZACAO_REAL_INDISPONIVEL/
    );
    ok("Finalização real é bloqueada em QA");
    await assert.rejects(solicitarEstornoMercadoPago(), /BILLING_ESTORNO_ENVIO_REAL_DESABILITADO/);
    ok("Gateway real permanece desabilitado");

    const atleta = await prisma.atleta.findFirst({ select: { usuarioId: true } });
    assert.ok(atleta, "QA_SEM_ATLETA");
    pagamentoId = randomUUID();
    const id = pagamentoId;
    await prisma.pagamento.create({ data: {
      id, usuarioId: atleta.usuarioId, plano: "ATLETA_PRO", periodicidade: "Mensal",
      metodo: "PIX", status: "PENDENTE", valor: "19.90", moeda: "BRL",
      pagadorNome: `QA_FINALIZACAO_${id}`,
    } });
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        const bloqueio = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Pagamento" WHERE "id" = ${id} FOR UPDATE`;
        assert.equal(bloqueio.length, 1);
        await tx.pagamento.update({ where: { id }, data: { status: "REEMBOLSADO", reembolsadoEm: new Date() } });
        throw new Error("QA_FORCAR_ROLLBACK");
      }), /QA_FORCAR_ROLLBACK/
    );
    const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id } });
    assert.equal(pg.status, "PENDENTE");
    assert.equal(pg.reembolsadoEm, null);
    ok("Rollback PostgreSQL desfaz transição sintética de pagamento");

    assert.equal(await prisma.pagamentoBeneficio.count({ where: { pagamentoId: id } }), 0);
    assert.equal(await prisma.billingCompensacaoEvento.count({ where: { pagamentoId: id } }), 0);
    ok("Teste não fabrica evidência nem concede benefícios");
    sucesso = true;
    console.log(`\nRESULTADO: ${total}/5`);
  } finally {
    try {
      if (pagamentoId && sucesso) {
        const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
        assert.equal(pg.status, "PENDENTE");
        assert.equal(pg.reembolsadoEm, null);
        await prisma.pagamento.delete({ where: { id: pagamentoId } });
        console.log("[QA] Pagamento sintético removido.");
      } else if (pagamentoId) {
        console.warn("[QA] Pagamento preservado para auditoria:", pagamentoId);
      }
    } finally { await prisma.$disconnect(); }
  }
}

main().catch(erro => { console.error("QA_FINALIZACAO_FALHOU:", erro); process.exitCode = 1; });

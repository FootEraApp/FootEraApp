
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  if (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    url.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    url.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_ABORTADO");
  }

  const { prisma } = await import("./server/prisma.js");
  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );
  const {
    verificarPendenciaEventoNoMpAdmin,
  } = await import(
    "./server/controllers/adminBillingPendenciasController.js"
  );

  const pagamentoId = randomUUID();
  const eventoId = randomUUID();
  const mpId = `${Date.now()}87654`;

  let eventoCriado = false;
  let pagamentoCriado = false;

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(banco[0]?.nome, "footera_billing_qa");

    const atleta = await prisma.atleta.findFirst({
      select: { usuarioId: true },
    });

    assert.ok(atleta);

    await prisma.evento.create({
      data: {
        id: eventoId,
        titulo: `QA consulta MP ${eventoId}`,
        descricao: "Teste de consulta financeira",
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

    let status = 0;
    let corpo: any = null;

    const req: any = {
      params: { pagamentoId },
    };
    const res: any = {
      status(n: number) {
        status = n;
        return this;
      },
      json(dados: unknown) {
        corpo = dados;
        return this;
      },
    };

    await verificarPendenciaEventoNoMpAdmin(req, res);

    assert.equal(status, 200);
    assert.equal(corpo.ok, true);
    assert.equal(corpo.mercadoPago.status, "approved");
    assert.equal(corpo.classificacao.motivo, "MP_APROVADO");
    assert.equal(corpo.podeAprovarAutomaticamente, false);
    assert.equal(corpo.estornoExecutado, false);

    const pg = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
    });
    const pendencia =
      await prisma.billingPendenciaEvento.findUniqueOrThrow({
        where: { pagamentoId },
      });

    assert.equal(pg.status, "PENDENTE");
    assert.equal(pendencia.status, "PENDENTE_ANALISE");

    console.log("✔ Consulta externa simulada funciona");
    console.log("✔ Identidade e valor conferidos");
    console.log("✔ Nenhum acesso ou estorno foi executado");
    console.log("RESULTADO: 3/3");
  } finally {
    try {
      configurarConsultorMercadoPagoQa(null);

      if (pagamentoCriado) {
        const pg = await prisma.pagamento.findUnique({
          where: { id: pagamentoId },
        });
        if (
          pg?.status === "PENDENTE" &&
          pg.plano === `EVENTO:${eventoId}` &&
          (await prisma.pagamentoBeneficio.count({
            where: { pagamentoId },
          })) === 0
        ) {
          await prisma.billingPendenciaEvento.deleteMany({
            where: { pagamentoId },
          });
          await prisma.pagamento.delete({
            where: { id: pagamentoId },
          });
        }
      }

      if (eventoCriado) {
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
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
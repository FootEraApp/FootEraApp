
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

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
    throw new Error("QA_ABORTADO: ambiente inseguro");
  }

  const { prisma } = await import("./server/prisma.js");
  const { listarPendenciasEventoAdmin } = await import(
    "./server/controllers/adminBillingPendenciasController.js"
  );

  const eventoId = randomUUID();
  const pagamentoId = randomUUID();
  let eventoCriado = false;
  let pagamentoCriado = false;
  let passou = 0;

  async function chamar(query: Record<string, string> = {}) {
    let status = 0;
    let corpo: any = null;

    const req: any = { query };
    const res: any = {
      status(codigo: number) {
        status = codigo;
        return this;
      },
      json(dados: unknown) {
        corpo = dados;
        return this;
      },
    };

    await listarPendenciasEventoAdmin(req, res);
    return { status, corpo };
  }

  async function verificar(
    nome: string,
    fn: () => Promise<void>
  ) {
    await fn();
    passou++;
    console.log("✔", nome);
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
        titulo: `QA Admin Pendencias ${eventoId}`,
        descricao: "Fixture temporaria",
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

    const providerRef =
      `${Date.now()}${Math.floor(Math.random() * 100000)}`;

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

    await verificar(
      "Admin lista a pendencia com dados financeiros",
      async () => {
        const r = await chamar({ pagamentoId });

        assert.equal(r.status, 200);
        assert.equal(r.corpo.ok, true);
        assert.equal(r.corpo.total, 1);
        assert.equal(r.corpo.items.length, 1);

        const item = r.corpo.items[0];
        assert.equal(item.pagamentoId, pagamentoId);
        assert.equal(item.eventoId, eventoId);
        assert.equal(item.status, "PENDENTE_ANALISE");
        assert.equal(item.valor, "25.00");
        assert.equal(item.pagamento.status, "PENDENTE");
      }
    );

    await verificar(
      "Filtro por status funciona",
      async () => {
        const r = await chamar({
          status: "PENDENTE_ANALISE",
          pagamentoId,
        });

        assert.equal(r.status, 200);
        assert.equal(r.corpo.total, 1);
      }
    );

    await verificar(
      "Status desconhecido e bloqueado",
      async () => {
        const r = await chamar({
          status: "ESTORNAR_AGORA",
        });

        assert.equal(r.status, 400);
        assert.equal(r.corpo.code, "STATUS_INVALIDO");
      }
    );

    await verificar(
      "Listagem nao modifica pendencia ou pagamento",
      async () => {
        const pg = await prisma.pagamento.findUniqueOrThrow({
          where: { id: pagamentoId },
        });

        const p =
          await prisma.billingPendenciaEvento.findUniqueOrThrow({
            where: { pagamentoId },
          });

        const inscricoes = await prisma.inscricaoEvento.count({
          where: { eventoId },
        });

        const beneficios = await prisma.pagamentoBeneficio.count({
          where: { pagamentoId },
        });

        assert.equal(pg.status, "PENDENTE");
        assert.equal(p.status, "PENDENTE_ANALISE");
        assert.equal(inscricoes, 0);
        assert.equal(beneficios, 0);
      }
    );
  } finally {
    try {
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
          await prisma.$transaction(async (tx) => {
            await tx.billingPendenciaEvento.deleteMany({
              where: { pagamentoId },
            });

            await tx.pagamento.delete({
              where: { id: pagamentoId },
            });
          });
        } else {
          console.warn(
            "[QA] Pagamento preservado para auditoria:",
            pagamentoId
          );
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
          console.log("[QA] Fixtures removidas.");
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(`\nRESULTADO: ${passou}/4`);
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
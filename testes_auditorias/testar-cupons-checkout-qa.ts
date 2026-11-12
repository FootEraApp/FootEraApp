import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
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
  ) throw new Error("QA_ABORTADO: use apenas o banco local footera_billing_qa sem Mercado Pago");

  const { prisma } = await import("./server/prisma.js");
  const pagamentosCriados: string[] = [];
  const cuponsCriados: string[] = [];
  let passou = 0;
  let falhou = 0;
  let seguroParaLimpeza = false;

  async function verificar(nome: string, fn: () => Promise<void>) {
    try { await fn(); passou++; console.log("✔", nome); }
    catch (error) { falhou++; console.error("✖", nome, error); }
  }

  try {
    const db = await prisma.$queryRaw<Array<{ nome: string }>>`SELECT current_database() AS nome`;
    assert.equal(db[0]?.nome, "footera_billing_qa");
    const atletas = await prisma.atleta.findMany({ select: { usuarioId: true }, take: 150 });
    let usuarioId: string | null = null;
    for (const atleta of atletas) {
      const trial = await prisma.assinatura.count({
        where: { usuarioId: atleta.usuarioId, status: "TRIAL", ativo: true,
          trialEndsAt: { gt: new Date(Date.now() + 7 * 86400000) } },
      });
      if (trial === 0) { usuarioId = atleta.usuarioId; break; }
    }
    assert.ok(usuarioId, "QA_SEM_ATLETA: nenhum atleta sem trial longo encontrado");
    console.log("[QA] Usuario:", usuarioId);

    const { startCheckout, startCheckoutBundle } = await import("./server/controllers/billingController.js");
    const pagador = { nome: "Comprador QA FootEra", email: "comprador-qa@example.com" };
    const contexto = { kind: "PERSONAL", tipoUsuario: "Atleta", role: "Atleta", profileId: null, tipoUsuarioId: null };

    async function chamar(fn: typeof startCheckout, body: Record<string, unknown>) {
      let status = 200;
      let corpo: any;
      const req: any = { userId: usuarioId, authUser: { id: usuarioId, activeContext: contexto }, body };
      const res: any = {
        status(code: number) { status = code; return this; },
        json(value: unknown) { corpo = value; return this; },
        send(value: unknown) { corpo = value; return this; },
      };
      await fn(req, res);
      if (typeof corpo?.pagamento?.id === "string") pagamentosCriados.push(corpo.pagamento.id);
      return { status, corpo };
    }
    async function criarCupom(data: {
      tipo: "PERCENTUAL" | "VALOR";
      descontoPerc?: number;
      descontoFixo?: string;
      expiraEm?: Date;
      usosMax?: number;
      usosAtuais?: number;
    }) {
      const cupom = await prisma.cupom.create({
        data: { codigo: `QA-CHECKOUT-${randomUUID()}`, ativo: true, ...data },
      });
      cuponsCriados.push(cupom.id);
      return cupom;
    }
    function assertPagamento(pg: any, centavos: number, itens: number, cupomId: string) {
      assert.equal(pg.status, "PENDENTE");
      assert.equal(pg.provider, "INTERNAL_FAKE");
      assert.equal(pg.cupomId, cupomId);
      assert.equal(pg.valor.mul(100).toNumber(), centavos);
      const meta = pg.meta as any;
      assert.equal(meta?.financeiroV1?.versao, 1);
      assert.equal(meta.financeiroV1.totalCentavos, centavos);
      assert.equal(meta.financeiroV1.items.length, itens);
      assert.equal(meta.financeiroV1.items.reduce((s: number, x: any) => s + x.valorFinalCentavos, 0), centavos);
    }
    async function assertReserva(pgId: string, cupomId: string) {
      const reserva = await prisma.cupomReserva.findUnique({ where: { pagamentoId: pgId } });
      assert.ok(reserva, "Reserva nao foi criada");
      assert.equal(reserva.cupomId, cupomId);
      assert.equal(reserva.usuarioId, usuarioId);
      assert.equal(reserva.status, "RESERVADA");
      const cupom = await prisma.cupom.findUniqueOrThrow({ where: { id: cupomId } });
      assert.equal(cupom.usosAtuais, 0, "Checkout pendente nao pode consumir o cupom");
    }
    const checkout = (cupom: string) => ({ planoId: "ATLETA_PRO", periodicidade: "Mensal", metodo: "PIX", pagador, cupom, valor: 0.01 });
    const bundle = (cupom: string) => ({ items: [
      { planoId: "ATLETA_PRO", periodicidade: "Mensal" },
      { planoId: "ATLETA_LEARNING_1", periodicidade: "Mensal" },
    ], metodo: "PIX", pagador, cupom, valor: 0.01 });

    const percentual = await criarCupom({ tipo: "PERCENTUAL", descontoPerc: 10, usosMax: 3 });
    await verificar("Cupom percentual 10%: 1990 vira 1791 centavos e reserva", async () => {
      const r = await chamar(startCheckout, checkout(percentual.codigo));
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: r.corpo.pagamento.id } });
      assertPagamento(pg, 1791, 1, percentual.id);
      assert.deepEqual((pg.meta as any).financeiroV1.items.map((i: any) => i.valorFinalCentavos), [1791]);
      await assertReserva(pg.id, percentual.id);
    });

    const fixo = await criarCupom({ tipo: "VALOR", descontoFixo: "5.00", usosMax: 2 });
    await verificar("Cupom fixo R$ 5: 1990 vira 1490 centavos e reserva", async () => {
      const r = await chamar(startCheckout, checkout(fixo.codigo));
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: r.corpo.pagamento.id } });
      assertPagamento(pg, 1490, 1, fixo.id);
      await assertReserva(pg.id, fixo.id);
    });

    const percentualBundle = await criarCupom({ tipo: "PERCENTUAL", descontoPerc: 10, usosMax: 2 });
    await verificar("Bundle 10%: 6480 vira 5832 e rateia 1791 + 4041", async () => {
      const r = await chamar(startCheckoutBundle, bundle(percentualBundle.codigo));
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      const pg = await prisma.pagamento.findUniqueOrThrow({ where: { id: r.corpo.pagamento.id } });
      assertPagamento(pg, 5832, 2, percentualBundle.id);
      assert.deepEqual((pg.meta as any).financeiroV1.items.map((i: any) => i.valorFinalCentavos), [1791, 4041]);
      await assertReserva(pg.id, percentualBundle.id);
    });

    await verificar("Cupom inexistente nao cria pagamento", async () => {
      const antes = await prisma.pagamento.count({ where: { usuarioId: usuarioId! } });
      const r = await chamar(startCheckout, checkout(`QA-INVALIDO-${randomUUID()}`));
      assert.notEqual(r.status, 200);
      assert.equal(await prisma.pagamento.count({ where: { usuarioId: usuarioId! } }), antes);
    });

    const expirado = await criarCupom({ tipo: "PERCENTUAL", descontoPerc: 10, expiraEm: new Date(Date.now() - 86400000) });
    await verificar("Cupom expirado nao cria pagamento", async () => {
      const antes = await prisma.pagamento.count({ where: { usuarioId: usuarioId! } });
      const r = await chamar(startCheckout, checkout(expirado.codigo));
      assert.notEqual(r.status, 200);
      assert.equal(await prisma.pagamento.count({ where: { usuarioId: usuarioId! } }), antes);
    });

    const esgotado = await criarCupom({ tipo: "PERCENTUAL", descontoPerc: 10, usosMax: 1, usosAtuais: 1 });
    await verificar("Cupom esgotado nao cria pagamento", async () => {
      const antes = await prisma.pagamento.count({ where: { usuarioId: usuarioId! } });
      const r = await chamar(startCheckoutBundle, bundle(esgotado.codigo));
      assert.notEqual(r.status, 200);
      assert.equal(await prisma.pagamento.count({ where: { usuarioId: usuarioId! } }), antes);
    });

    const total = await criarCupom({ tipo: "VALOR", descontoFixo: "50.00" });
    await verificar("Desconto integral individual e bloqueado com flag QA", async () => {
      const antes = await prisma.pagamento.count({ where: { usuarioId: usuarioId! } });
      const r = await chamar(startCheckout, checkout(total.codigo));
      assert.equal(r.status, 409, JSON.stringify(r.corpo));
      assert.equal(r.corpo?.code, "BILLING_FREE_COUPON_QA_NOT_READY");
      assert.equal(await prisma.pagamento.count({ where: { usuarioId: usuarioId! } }), antes);
    });

    await verificar("Reserva do mesmo usuario/cupom impede segundo checkout", async () => {
      const antes = await prisma.pagamento.count({ where: { usuarioId: usuarioId! } });
      const r = await chamar(startCheckout, checkout(percentual.codigo));
      assert.notEqual(r.status, 200, "Segunda reserva do mesmo cupom nao pode ser aceita");
      assert.equal(await prisma.pagamento.count({ where: { usuarioId: usuarioId! } }), antes);
    });
    seguroParaLimpeza = falhou === 0;
  } finally {
    try {
      if (!seguroParaLimpeza) {
        console.warn("[QA] Houve falha. Preservando fixtures para auditoria:", { pagamentosCriados, cuponsCriados });
      } else {
        await prisma.$transaction(async (tx) => {
          for (const id of pagamentosCriados) {
            const pg = await tx.pagamento.findUnique({ where: { id }, include: { beneficios: true } });
            if (!pg || pg.status !== "PENDENTE" || pg.provider !== "INTERNAL_FAKE" ||
                !pg.cupomId || pg.beneficios.length !== 0 ||
                await tx.creatorVenda.count({ where: { pagamentoId: id } }) ||
                await tx.cupomResgate.count({ where: { pagamentoId: id } })) {
              throw new Error(`QA_CLEANUP_ABORTADO: pagamento inesperado ${id}`);
            }
            const reserva = await tx.cupomReserva.findUnique({ where: { pagamentoId: id } });
            if (!reserva || reserva.status !== "RESERVADA" || reserva.cupomId !== pg.cupomId ||
                !cuponsCriados.includes(reserva.cupomId)) {
              throw new Error(`QA_CLEANUP_ABORTADO: reserva inesperada ${id}`);
            }
            await tx.cupomReserva.delete({ where: { pagamentoId: id } });
            await tx.pagamento.delete({ where: { id } });
          }
          for (const id of cuponsCriados) {
            const cupom = await tx.cupom.findUniqueOrThrow({ where: { id } });
            if (!cupom.codigo.startsWith("QA-CHECKOUT-") ||
                await tx.pagamento.count({ where: { cupomId: id } }) ||
                await tx.cupomReserva.count({ where: { cupomId: id } }) ||
                await tx.cupomResgate.count({ where: { cupomId: id } })) {
              throw new Error(`QA_CLEANUP_ABORTADO: cupom inesperado ${id}`);
            }
            await tx.cupom.delete({ where: { id } });
          }
        });
        console.log("[QA] Pagamentos, reservas e cupons de teste removidos.");
      }
    } finally { await prisma.$disconnect(); }
  }
  console.log(`\nRESULTADO: ${passou}/${passou + falhou}`);
  if (falhou) process.exitCode = 1;
}
main().catch((erro) => { console.error("TESTE INTERROMPIDO:", erro); process.exitCode = 1; });
// Raiz do projeto: testar-checkout-resposta-perdida-qa.ts
// Executa somente no banco QA local. Nunca chama o Mercado Pago.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "./server/prisma.js";
import {
  adquirirEnvioCheckout,
  consultarCheckoutDoUsuario,
  confirmarCheckoutExterno,
  fingerprintCheckout,
  marcarCheckoutInconclusivo,
  prepararCheckoutAtomico,
} from "./server/services/billingCheckoutOperacaoService.js";

function validarAmbiente(): void {
  const db = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(Boolean(process.env.MP_ACCESS_TOKEN), false);
  assert.equal(process.env.BILLING_CUPOM_RESERVA_QA, "true");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, "false");
  assert.equal(db.protocol, "postgresql:");
  assert.ok(["localhost", "127.0.0.1"].includes(db.hostname));
  assert.equal(db.port, "5433");
  assert.equal(db.pathname, "/footera_billing_qa");
}

async function main(): Promise<void> {
  validarAmbiente();
  const nome = await prisma.$queryRaw<Array<{ nome: string }>>`
    SELECT current_database() AS nome
  `;
  assert.equal(nome[0]?.nome, "footera_billing_qa");
  const atleta = await prisma.atleta.findFirst({ select: { usuarioId: true } });
  assert.ok(atleta, "QA_SEM_ATLETA");

  const marca = `QA_RESPOSTA_PERDIDA_${randomUUID()}`;
  const chaveCliente = randomUUID();
  const fp = fingerprintCheckout({ usuarioId: atleta.usuarioId, plano: "ATLETA_PRO", metodo: "PIX", marca });
  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;
  let passou = false;
  let contagem = 0;
  const ok = (mensagem: string) => { contagem++; console.log("✔", mensagem); };

  // Simula o provedor ter criado o pagamento antes de a resposta se perder.
  // Este mapa existe APENAS na memória do teste. Não faz nenhuma chamada HTTP.
  const cobrancasSimuladas = new Map<string, string>();
  const providerIdFicticio = `${Date.now()}97531`;

  try {
    const prep = await prepararCheckoutAtomico({
      usuarioId: atleta.usuarioId,
      chaveCliente,
      modalidade: "PIX_INDIVIDUAL",
      fingerprintRequisicao: fp,
      criarPagamento: (tx) => tx.pagamento.create({
        data: {
          usuarioId: atleta.usuarioId,
          plano: "ATLETA_PRO",
          periodicidade: "Mensal",
          metodo: "PIX",
          status: "PENDENTE",
          valor: "19.90",
          moeda: "BRL",
          pagadorNome: marca,
        },
      }),
    });
    pagamentoId = prep.pagamento.id;
    operacaoId = prep.operacao.id;
    assert.equal(prep.operacao.status, "PREPARADA");
    ok("Checkout e pagamento locais preparados");

    assert.equal(await adquirirEnvioCheckout(operacaoId), true);
    assert.equal(await adquirirEnvioCheckout(operacaoId), false);
    ok("Somente uma aquisição de envio é permitida");

    // O provedor hipoteticamente criou a cobrança, mas a resposta não chegou.
    cobrancasSimuladas.set(pagamentoId, providerIdFicticio);
    assert.equal(cobrancasSimuladas.size, 1);
    const erroRede = new Error("QA_TIMEOUT_DEPOIS_DE_CRIAR_COBRANCA");
    assert.equal(await marcarCheckoutInconclusivo(operacaoId, erroRede), true);
    ok("Timeout após possível criação deixa checkout INCONCLUSIVA");

    const inconclusiva = await prisma.billingCheckoutOperacao.findUniqueOrThrow({
      where: { id: operacaoId },
    });
    const pgAntes = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
    assert.equal(inconclusiva.status, "INCONCLUSIVA");
    assert.equal(inconclusiva.providerRef, null);
    assert.equal(pgAntes.providerRef, null);
    assert.equal(pgAntes.status, "PENDENTE");
    ok("Resultado desconhecido não inventa confirmação local");

    assert.equal(await adquirirEnvioCheckout(operacaoId), false);
    const reuso = await prepararCheckoutAtomico({
      usuarioId: atleta.usuarioId,
      chaveCliente,
      modalidade: "PIX_INDIVIDUAL",
      fingerprintRequisicao: fp,
      criarPagamento: async () => { throw new Error("NAO_PODE_CRIAR_SEGUNDO_PAGAMENTO"); },
    });
    assert.equal(reuso.reutilizada, true);
    assert.equal(reuso.pagamento.id, pagamentoId);
    assert.equal(cobrancasSimuladas.size, 1);
    assert.equal(await prisma.pagamento.count({ where: { pagadorNome: marca } }), 1);
    ok("Repetição da mesma chave não duplica cobrança nem pagamento local");

    const leitura = await consultarCheckoutDoUsuario(atleta.usuarioId, chaveCliente);
    assert.equal(leitura?.status, "INCONCLUSIVA");
    assert.equal(leitura?.pagamentoId, pagamentoId);
    ok("Consulta de recuperação preserva resultado desconhecido");

    // A confirmação abaixo SIMULA uma investigação externa bem-sucedida.
    // Na aplicação real ela só deve ser executada após conferir identidade,
    // valor, moeda, status e origem do pagamento diretamente no provedor.
    const referenciaConfirmada = cobrancasSimuladas.get(pagamentoId);
    assert.equal(referenciaConfirmada, providerIdFicticio);
    await confirmarCheckoutExterno({
      operacaoId,
      providerRef: referenciaConfirmada!,
      pixCopiaECola: "PIX_FICTICIO_NAO_PAGAVEL_QA",
    });
    const confirmada = await prisma.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: operacaoId } });
    const pagamentoConfirmado = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamentoId } });
    assert.equal(confirmada.status, "CONFIRMADA");
    assert.equal(confirmada.providerRef, providerIdFicticio);
    assert.equal(pagamentoConfirmado.providerRef, providerIdFicticio);
    ok("Após evidência simulada, confirmação vincula a mesma cobrança");

    await confirmarCheckoutExterno({
      operacaoId,
      providerRef: providerIdFicticio,
      pixCopiaECola: "PIX_FICTICIO_NAO_PAGAVEL_QA",
    });
    assert.equal(await adquirirEnvioCheckout(operacaoId), false);
    ok("Confirmação repetida é idempotente e não reenvia cobrança");

    await assert.rejects(
        () =>
            confirmarCheckoutExterno({
            operacaoId: operacaoId!,
            providerRef: `${providerIdFicticio}999`,
            }),
        /BILLING_CHECKOUT_PROVIDER_REF_CONFLICT/,
        );
    ok("Referência externa divergente é recusada");

    assert.equal(await prisma.pagamentoBeneficio.count({ where: { pagamentoId } }), 0);
    assert.equal(await prisma.cupomReserva.count({ where: { pagamentoId } }), 0);
    ok("Nenhum benefício ou reserva de cupom foi criado indevidamente");

    passou = true;
    console.log(`\nRESULTADO: ${contagem}/10`);
  } finally {
    if (!passou) {
      console.warn("[QA] Falha: dados preservados para auditoria", { pagamentoId, operacaoId, chaveCliente });
    } else if (pagamentoId && operacaoId) {
      await prisma.$transaction(async (tx) => {
        const op = await tx.billingCheckoutOperacao.findUniqueOrThrow({ where: { id: operacaoId! } });
        const pg = await tx.pagamento.findUniqueOrThrow({ where: { id: pagamentoId! } });
        assert.equal(op.status, "CONFIRMADA");
        assert.equal(pg.status, "PENDENTE");
        assert.equal(pg.pagadorNome, marca);
        assert.equal(op.pagamentoId, pg.id);
        assert.equal(op.providerRef, providerIdFicticio);
        assert.equal(pg.providerRef, providerIdFicticio);
        assert.equal(await tx.pagamentoBeneficio.count({ where: { pagamentoId: pg.id } }), 0);
        assert.equal(await tx.cupomReserva.count({ where: { pagamentoId: pg.id } }), 0);
        await tx.billingCheckoutOperacao.delete({ where: { id: op.id } });
        await tx.pagamento.delete({ where: { id: pg.id } });
      });
      console.log("[QA] Pagamento e operação sintéticos removidos.");
    }
    await prisma.$disconnect();
  }
}

main().catch((erro) => { console.error("QA_RESPOSTA_PERDIDA_FALHOU:", erro); process.exitCode = 1; });
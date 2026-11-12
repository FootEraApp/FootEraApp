
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { prisma } from "./server/prisma.js";
import {
  adquirirEnvioCheckout,
  consultarCheckoutDoUsuario,
  fingerprintCheckout,
  marcarCheckoutInconclusivo,
  prepararCheckoutAtomico,
} from "./server/services/billingCheckoutOperacaoService.js";

function conferirAmbiente() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(Boolean(process.env.MP_ACCESS_TOKEN), false);
  assert.equal(process.env.BILLING_CUPOM_RESERVA_QA, "true");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,
    "false"
  );

  assert.equal(db.protocol, "postgresql:");
  assert.ok(
    ["127.0.0.1", "localhost"].includes(db.hostname)
  );
  assert.equal(db.port, "5433");
  assert.equal(db.pathname, "/footera_billing_qa");
}

function executarFilho(
  modo: string,
  operacaoId: string
): string {
  const script = fileURLToPath(import.meta.url);

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", script, "filho", modo, operacaoId],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      timeout: 20000,
    }
  );

  if (result.error || result.status !== 0) {
    throw new Error(
      `FILHO_${modo}_FALHOU: ${
        result.error?.message ??
        result.stderr ??
        result.stdout
      }`
    );
  }

  return result.stdout.trim();
}

async function filho() {
  conferirAmbiente();

  const modo = process.argv[3];
  const id = process.argv[4];

  assert.ok(id);

  if (modo === "adquirir-e-cair") {
    assert.equal(
      await adquirirEnvioCheckout(id),
      true
    );

    console.log("FILHO_CAIU_APOS_AQUISICAO");

    // Simula encerramento abrupto sem
    // confirmar o checkout.
    process.exit(0);
  }

  if (modo === "tentar-reenviar") {
    assert.equal(
      await adquirirEnvioCheckout(id),
      false
    );

    console.log("REENVIO_BLOQUEADO");
    process.exit(0);
  }

  throw new Error("MODO_FILHO_INVALIDO");
}

async function principal() {
  conferirAmbiente();

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  assert.equal(banco[0]?.nome, "footera_billing_qa");

  const usuario = await prisma.atleta.findFirst({
    select: { usuarioId: true },
  });

  assert.ok(usuario, "QA_SEM_ATLETA");

  const chaveCliente = randomUUID();
  const marca = `QA_RETOMADA_${randomUUID()}`;

  const fingerprint = fingerprintCheckout({
    usuarioId: usuario.usuarioId,
    plano: "ATLETA_PRO",
    metodo: "PIX",
    marca,
  });

  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;
  let passou = false;
  let aprovados = 0;

  const ok = (nome: string) => {
    aprovados++;
    console.log("✔", nome);
  };

  try {
    const preparado = await prepararCheckoutAtomico({
      usuarioId: usuario.usuarioId,
      chaveCliente,
      modalidade: "PIX_INDIVIDUAL",
      fingerprintRequisicao: fingerprint,

      criarPagamento: (tx) =>
        tx.pagamento.create({
          data: {
            usuarioId: usuario.usuarioId,
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

    pagamentoId = preparado.pagamento.id;
    operacaoId = preparado.operacao.id;

    assert.equal(
      preparado.operacao.status,
      "PREPARADA"
    );

    ok("Checkout preparado com um único pagamento");

    assert.match(
      executarFilho("adquirir-e-cair", operacaoId),
      /FILHO_CAIU_APOS_AQUISICAO/
    );

    const depoisDaQueda =
      await prisma.billingCheckoutOperacao.findUniqueOrThrow({
        where: { id: operacaoId },
      });

    assert.equal(
      depoisDaQueda.status,
      "ENVIO_POSSIVEL"
    );

    assert.equal(depoisDaQueda.providerRef, null);

    ok("Processo adquiriu envio e caiu sem confirmar");

    assert.match(
      executarFilho("tentar-reenviar", operacaoId),
      /REENVIO_BLOQUEADO/
    );

    ok("Outro processo não consegue reenviar");

    const recuperado = await consultarCheckoutDoUsuario(
      usuario.usuarioId,
      chaveCliente
    );

    assert.equal(
      recuperado?.pagamentoId,
      pagamentoId
    );

    assert.equal(
      recuperado?.status,
      "ENVIO_POSSIVEL"
    );

    ok("Retomada preserva o pagamento original");

    assert.equal(
      await marcarCheckoutInconclusivo(
        operacaoId,
        "QA_PROCESSO_INTERROMPIDO"
      ),
      true
    );

    assert.match(
      executarFilho("tentar-reenviar", operacaoId),
      /REENVIO_BLOQUEADO/
    );

    ok("Estado INCONCLUSIVA impede reenvio");

    const novamente = await prepararCheckoutAtomico({
      usuarioId: usuario.usuarioId,
      chaveCliente,
      modalidade: "PIX_INDIVIDUAL",
      fingerprintRequisicao: fingerprint,

      criarPagamento: async () => {
        throw new Error(
          "PAGAMENTO_DUPLICADO_NAO_PERMITIDO"
        );
      },
    });

    assert.equal(novamente.reutilizada, true);
    assert.equal(novamente.pagamento.id, pagamentoId);

    const existentes = await prisma.pagamento.count({
      where: { pagadorNome: marca },
    });

    assert.equal(existentes, 1);

    ok("Mesma chave não duplica pagamento");

    passou = true;

    console.log(`\nRESULTADO: ${aprovados}/6`);
  } finally {
    if (!passou) {
      console.warn(
        "[QA] Dados preservados para auditoria:",
        {
          pagamentoId,
          operacaoId,
          chaveCliente,
        }
      );
    } else if (pagamentoId && operacaoId) {
      await prisma.$transaction(async (tx) => {
        const operacao =
          await tx.billingCheckoutOperacao.findUniqueOrThrow({
            where: { id: operacaoId! },
          });

        const pagamento =
          await tx.pagamento.findUniqueOrThrow({
            where: { id: pagamentoId! },
          });

        assert.equal(
          operacao.pagamentoId,
          pagamento.id
        );

        assert.equal(operacao.status, "INCONCLUSIVA");
        assert.equal(operacao.providerRef, null);
        assert.equal(pagamento.pagadorNome, marca);
        assert.equal(pagamento.status, "PENDENTE");
        assert.equal(pagamento.providerRef, null);

        assert.equal(
          await tx.pagamentoBeneficio.count({
            where: { pagamentoId: pagamento.id },
          }),
          0
        );

        assert.equal(
          await tx.cupomReserva.count({
            where: { pagamentoId: pagamento.id },
          }),
          0
        );

        await tx.billingCheckoutOperacao.delete({
          where: { id: operacao.id },
        });

        await tx.pagamento.delete({
          where: { id: pagamento.id },
        });
      });

      console.log(
        "[QA] Operação e pagamento sintéticos removidos."
      );
    }

    await prisma.$disconnect();
  }
}

(async () => {
  if (process.argv[2] === "filho") {
    await filho();
  } else {
    await principal();
  }
})().catch((erro) => {
  console.error(
    "QA_RETOMADA_CHECKOUT_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
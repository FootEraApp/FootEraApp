
import assert from "node:assert/strict";

async function main() {
  const url = new URL(
    process.env.DATABASE_URL ?? "http://invalid"
  );

  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.BILLING_TEST_MODE, "true");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(process.env.ENABLE_MP_CONCILIACAO_SCHEDULER, "false");
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, "false");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(process.env.SMTP_HOST ?? "", "");

  assert.ok(
    ["127.0.0.1", "localhost"].includes(url.hostname)
  );
  assert.equal(url.port, "5433");
  assert.equal(
    url.pathname,
    "/footera_billing_scheduler_qa_20261103"
  );

  const { prisma } = await import("./server/prisma.js");

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`SELECT current_database() AS nome`;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_scheduler_qa_20261103"
    );

    const assinaturas =
      await prisma.assinatura.findMany({
        where: {
          contextoKey: {
            startsWith: "qa-etapa6-final-",
          },
        },
        select: {
          id: true,
          usuarioId: true,
          contextoKey: true,
          status: true,
          ativo: true,
        },
        orderBy: {
          contextoKey: "asc",
        },
      });

    const usuariosQa = new Set([
      "1cd77a66-270e-4ce6-832d-08a563d7a86d",
      "eeecc139-3f8e-46fd-a2c9-2eae36db96aa",
    ]);

    console.log(
      "ASSINATURAS_QA_ENCONTRADAS:",
      assinaturas.length
    );

    for (const assinatura of assinaturas) {
      assert.ok(
        usuariosQa.has(assinatura.usuarioId),
        `USUARIO_NAO_ESPERADO: ${assinatura.id}`
      );

      const comunicacoes =
        await prisma.billingComunicacao.findMany({
          where: {
            assinaturaId: assinatura.id,
          },
          select: {
            id: true,
            canal: true,
            evento: true,
            status: true,
            tentativas: true,
          },
        });

      console.log({
        assinatura,
        comunicacoes,
      });
    }

    console.log("AUDITORIA_SCHEDULER_CONCLUIDA");
    console.log("NENHUM_REGISTRO_ALTERADO");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("AUDITORIA_SCHEDULER_FALHOU:", erro);
  process.exitCode = 1;
});
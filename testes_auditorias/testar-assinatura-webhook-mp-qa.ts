
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import express from "express";

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    db.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("QA_WEBHOOK_AMBIENTE_INSEGURO");
  }

  const segredo = process.env.MP_WEBHOOK_SECRET;

  if (!segredo) {
    throw new Error("QA_MP_WEBHOOK_SECRET_AUSENTE");
  }

  const { validarWebhookMercadoPago } = await import(
    "./server/middlewares/validarWebhookMercadoPago.js"
  );

  const app = express();

  app.use(express.json());

  app.post(
    "/webhook",
    validarWebhookMercadoPago,
    (_req, res) => {
      res.status(200).json({ ok: true });
    }
  );

  const server = app.listen(0, "127.0.0.1");

  try {
    if (!server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });
    }

    const endereco = server.address();

    assert.ok(
      endereco && typeof endereco !== "string"
    );

    const base =
      `http://127.0.0.1:${endereco.port}/webhook`;

    const idPagamento = "990000123456";
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1000));

    const manifesto =
      `id:${idPagamento};` +
      `request-id:${requestId};` +
      `ts:${ts};`;

    const assinatura = createHmac("sha256", segredo)
      .update(manifesto)
      .digest("hex");

    const enviar = async (
      assinaturaHeader: string,
      idCorpo = idPagamento,
      timestamp = ts
    ) => {
      return fetch(
        `${base}?data.id=${idPagamento}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
            "x-signature":
              `ts=${timestamp},v1=${assinaturaHeader}`,
          },
          body: JSON.stringify({
            type: "payment",
            data: { id: idCorpo },
          }),
        }
      );
    };

    const valido = await enviar(assinatura);
    assert.equal(valido.status, 200);
    console.log("✔ Assinatura válida aceita");

    const repetido = await enviar(assinatura);
    assert.equal(repetido.status, 200);
    console.log("✔ Repetição válida aceita pelo middleware");

    const invalido = await enviar("0".repeat(64));
    assert.equal(invalido.status, 401);
    console.log("✔ Assinatura inválida rejeitada");

    const divergente = await enviar(
      assinatura,
      "990000654321"
    );
    assert.equal(divergente.status, 401);
    console.log("✔ Identidade divergente rejeitada");

    const antigo = await enviar(
      assinatura,
      idPagamento,
      String(Math.floor(Date.now() / 1000) - 3600)
    );
    assert.equal(antigo.status, 401);
    console.log("✔ Timestamp antigo rejeitado");

    console.log("\nRESULTADO: 5/5");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((erro) =>
        erro ? reject(erro) : resolve()
      );
    });
  }
}

main().catch((erro) => {
  console.error("QA_WEBHOOK_FALHOU:", erro);
  process.exitCode = 1;
});
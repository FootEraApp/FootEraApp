
import express from "express";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";

import {
  validarWebhookMercadoPago,
} from "./server/middlewares/validarWebhookMercadoPago.js";

// Teste HTTP local, sem banco ou Mercado Pago.
// Reproduz a cadeia middleware -> handler,
// mas usa um handler simulado.

const segredoAnterior = process.env.MP_WEBHOOK_SECRET;
const segredo = "SEGREDO_EXCLUSIVO_HTTP_QA";

process.env.MP_WEBHOOK_SECRET = segredo;

const app = express();
app.use(express.json());

let chamadasController = 0;

app.post(
  "/api/billing/mercadopago/webhook",
  validarWebhookMercadoPago,
  (_req, res) => {
    chamadasController++;

    return res.status(200).json({
      ok: true,
      handlerExecutado: true,
    });
  }
);

function assinar(
  id: string,
  requestId: string,
  ts: string
) {
  const manifesto =
    `id:${id.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${ts};`;

  return createHmac("sha256", segredo)
    .update(manifesto)
    .digest("hex");
}

async function main() {
  const server = app.listen(0, "127.0.0.1");

  let passou = 0;
  let falhou = 0;

  const verificar = (
    condicao: boolean,
    descricao: string
  ) => {
    if (condicao) {
      passou++;
      console.log("✔", descricao);
    } else {
      falhou++;
      console.error("✖", descricao);
    }
  };

  try {
    await new Promise<void>((resolve) => {
      if (server.listening) return resolve();
      server.once("listening", resolve);
    });

    const porta = (server.address() as AddressInfo).port;
    const url =
      `http://127.0.0.1:${porta}` +
      "/api/billing/mercadopago/webhook";

    const id = "123456789";
    const requestId = "qa-http-123";
    const ts = String(Math.floor(Date.now() / 1000));

    const assinaturaCorreta =
      `ts=${ts},v1=${assinar(id, requestId, ts)}`;

    async function enviar(
      queryId: string | null,
      bodyId: string | null,
      assinatura: string,
      request = requestId
    ) {
      const destino = queryId
        ? `${url}?data.id=${encodeURIComponent(queryId)}`
        : url;

      return fetch(destino, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature": assinatura,
          "x-request-id": request,
        },
        body: JSON.stringify(
          bodyId ? { data: { id: bodyId } } : {}
        ),
        signal: AbortSignal.timeout(5000),
      });
    }

    // 1. Requisição legítima.
    const valida = await enviar(
      id,
      id,
      assinaturaCorreta
    );

    verificar(
      valida.status === 200 &&
        chamadasController === 1,
      "Assinatura válida chegou ao handler"
    );

    // 2. Assinatura incorreta.
    const invalida = await enviar(
      id,
      id,
      `ts=${ts},v1=${"a".repeat(64)}`
    );

    verificar(
      invalida.status === 401 &&
        chamadasController === 1,
      "Assinatura inválida não chegou ao handler"
    );

    // 3. Corpo com identificador diferente.
    const divergente = await enviar(
      id,
      "999999999",
      assinaturaCorreta
    );

    verificar(
      divergente.status === 401 &&
        chamadasController === 1,
      "Identificador divergente foi bloqueado"
    );

    // 4. ID ausente na query.
    const semId = await enviar(
      null,
      id,
      assinaturaCorreta
    );

    verificar(
      semId.status === 401 &&
        chamadasController === 1,
      "ID ausente foi bloqueado"
    );

    // 5. Request ID alterado.
    const outroRequest = await enviar(
      id,
      id,
      assinaturaCorreta,
      "request-adulterado"
    );

    verificar(
      outroRequest.status === 401 &&
        chamadasController === 1,
      "Request ID adulterado foi bloqueado"
    );

    // 6. Duas entregas autenticadas.
    // Aqui apenas comprovamos a passagem pelo
    // middleware; NÃO testamos idempotência financeira.
    const repetida1 = await enviar(
      id,
      id,
      assinaturaCorreta
    );

    const repetida2 = await enviar(
      id,
      id,
      assinaturaCorreta
    );

    verificar(
      repetida1.status === 200 &&
        repetida2.status === 200 &&
        chamadasController === 3,
      "Entregas repetidas autenticadas chegam ao handler"
    );

    
    // 7. Timestamp antigo com HMAC valido.
    const tsAntigo = String(
      Math.floor(Date.now() / 1000) - 3600
    );

    const assinaturaAntiga =
      `ts=${tsAntigo},v1=${assinar(
        id,
        requestId,
        tsAntigo
      )}`;

    const respostaAntiga = await enviar(
      id,
      id,
      assinaturaAntiga
    );

    const corpoAntigo = await respostaAntiga.json();

    verificar(
      respostaAntiga.status === 401 &&
        (corpoAntigo as any)?.code ===
          "MP_WEBHOOK_TIMESTAMP_INVALID" &&
        chamadasController === 3,
      "Timestamp antigo com HMAC valido foi bloqueado"
    );

    // 8. Timestamp futuro com HMAC valido.
    const tsFuturo = String(
      Math.floor(Date.now() / 1000) + 3600
    );

    const assinaturaFutura =
      `ts=${tsFuturo},v1=${assinar(
        id,
        requestId,
        tsFuturo
      )}`;

    const respostaFutura = await enviar(
      id,
      id,
      assinaturaFutura
    );

    const corpoFuturo = await respostaFutura.json();

    verificar(
      respostaFutura.status === 401 &&
        (corpoFuturo as any)?.code ===
          "MP_WEBHOOK_TIMESTAMP_INVALID" &&
        chamadasController === 3,
      "Timestamp futuro com HMAC valido foi bloqueado"
    );

    console.log(
      `\nRESULTADO: ${passou}/${passou + falhou}`
    );

    if (falhou) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((erro) => {
        if (erro) reject(erro);
        else resolve();
      });
    });

    if (segredoAnterior === undefined) {
      delete process.env.MP_WEBHOOK_SECRET;
    } else {
      process.env.MP_WEBHOOK_SECRET =
        segredoAnterior;
    }
  }
}

main().catch((erro) => {
  console.error("TESTE INTERROMPIDO:", erro);
  process.exitCode = 1;
});
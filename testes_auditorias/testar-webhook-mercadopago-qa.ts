
import assert from "node:assert/strict";
import {
  createHmac,
} from "node:crypto";

import {
  validarWebhookMercadoPago,
} from "./server/middlewares/validarWebhookMercadoPago.js";

const segredo = "SEGREDO_EXCLUSIVO_TESTE_LOCAL";
const segredoAnterior = process.env.MP_WEBHOOK_SECRET;

process.env.MP_WEBHOOK_SECRET = segredo;

let passou = 0;
let falhou = 0;

function assinar(
  id: string,
  requestId: string,
  ts: string
) {
  const manifesto =
    `id:${id.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${ts};`;

  const assinatura = createHmac(
    "sha256",
    segredo
  )
    .update(manifesto)
    .digest("hex");

  return `ts=${ts},v1=${assinatura}`;
}

function executar(
  queryId: string | undefined,
  bodyId: string | undefined,
  assinatura: string,
  requestId = "qa-request-123"
) {
  let status = 0;
  let corpo: unknown = null;
  let proximo = false;

  const req = {
    query: queryId
      ? { "data.id": queryId }
      : {},
    body: bodyId
      ? { data: { id: bodyId } }
      : {},
    header(nome: string) {
      const headers: Record<string, string> = {
        "x-signature": assinatura,
        "x-request-id": requestId,
      };
      return headers[nome];
    },
  };

  const res = {
    status(codigo: number) {
      status = codigo;
      return this;
    },
    json(valor: unknown) {
      corpo = valor;
      return this;
    },
  };

  validarWebhookMercadoPago(
    req as any,
    res as any,
    (() => {
      proximo = true;
    }) as any
  );

  return { status, corpo, proximo };
}

function testar(
  descricao: string,
  fn: () => void
) {
  try {
    fn();
    passou++;
    console.log("✔", descricao);
  } catch (erro) {
    falhou++;
    console.error("✖", descricao, erro);
  }
}

try {
  const id = "123456789";
  const requestId = "qa-request-123";
  const ts = String(Math.floor(Date.now() / 1000));
  const assinatura = assinar(id, requestId, ts);

  testar("Assinatura valida aceita", () => {
    const r = executar(
      id,
      id,
      assinatura,
      requestId
    );
    assert.equal(r.proximo, true);
  });

  testar("Assinatura incorreta recusada", () => {
    const r = executar(
      id,
      id,
      `ts=${ts},v1=${"a".repeat(64)}`,
      requestId
    );
    assert.equal(r.status, 401);
    assert.equal(r.proximo, false);
  });

  testar("ID divergente no corpo recusado", () => {
    const r = executar(
      id,
      "987654321",
      assinatura,
      requestId
    );
    assert.equal(r.status, 401);
  });

  testar("ID sem assinatura recusado", () => {
    const r = executar(id, id, "", requestId);
    assert.equal(r.status, 401);
  });

  testar("ID da query ausente recusado", () => {
    const r = executar(
      undefined,
      id,
      assinatura,
      requestId
    );
    assert.equal(r.status, 401);
  });

  testar("Request ID divergente recusado", () => {
    const r = executar(
      id,
      id,
      assinatura,
      "outro-request"
    );
    assert.equal(r.status, 401);
  });
} finally {
  if (segredoAnterior === undefined) {
    delete process.env.MP_WEBHOOK_SECRET;
  } else {
    process.env.MP_WEBHOOK_SECRET =
      segredoAnterior;
  }
}

console.log(
  `\nRESULTADO: ${passou}/${passou + falhou}`
);

if (falhou > 0) process.exitCode = 1;
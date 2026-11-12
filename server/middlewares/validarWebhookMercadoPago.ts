
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function validarWebhookMercadoPago(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const segredo = process.env.MP_WEBHOOK_SECRET;

  if (!segredo) {
    return res.status(503).json({
      ok: false,
      code: "MP_WEBHOOK_SECRET_NOT_CONFIGURED",
    });
  }

  const assinatura = req.header("x-signature") ?? "";
  const requestId = req.header("x-request-id") ?? "";

  const partes: Record<string, string> = {};

for (const parte of assinatura.split(",")) {
  const indice = parte.indexOf("=");

  if (indice <= 0) {
    continue;
  }

  const chave = parte.slice(0, indice).trim();
  const valor = parte.slice(indice + 1).trim();

  if (
    chave !== "ts" &&
    chave !== "v1"
  ) {
    continue;
  }

  if (partes[chave] !== undefined) {
    return res.status(401).json({
      ok: false,
      code: "MP_WEBHOOK_DUPLICATE_SIGNATURE_FIELD",
    });
  }

  partes[chave] = valor;
}

  const ts = partes.ts;
  const v1 = partes.v1;

  const dataId =
    typeof req.query["data.id"] === "string"
        ? req.query["data.id"]
        : "";

    const bodyId =
    req.body?.data?.id == null
        ? null
        : String(req.body.data.id);

    if (
    bodyId !== null &&
    bodyId !== dataId
    ) {
    return res.status(401).json({
        ok: false,
        code: "MP_WEBHOOK_ID_MISMATCH",
    });
    }

  if (
    !ts ||
    !v1 ||
    !requestId ||
    !dataId ||
    !/^[a-f0-9]{64}$/i.test(v1) ||
    !/^\d+$/.test(ts)
  ) {
    return res.status(401).json({
      ok: false,
      code: "MP_WEBHOOK_INVALID_SIGNATURE",
    });
  }

  // Aceitar timestamp Unix em segundos ou milissegundos.
    // A tolerância de 5 minutos limita a reutilização
    // de assinaturas antigas.
    const tsNumero = Number(ts);

    const tsMillis =
    ts.length === 10
        ? tsNumero * 1000
        : ts.length === 13
        ? tsNumero
        : NaN;

    const janelaPermitidaMs = 5 * 60 * 1000;

    if (
    !Number.isSafeInteger(tsNumero) ||
    !Number.isFinite(tsMillis) ||
    Math.abs(Date.now() - tsMillis) > janelaPermitidaMs
    ) {
    return res.status(401).json({
        ok: false,
        code: "MP_WEBHOOK_TIMESTAMP_INVALID",
    });
    }

  const manifesto =
    `id:${dataId.toLowerCase()};` +
    `request-id:${requestId};` +
    `ts:${ts};`;

  const esperado = createHmac("sha256", segredo)
    .update(manifesto)
    .digest("hex");

  const recebidoBuffer = Buffer.from(v1, "hex");
  const esperadoBuffer = Buffer.from(esperado, "hex");

  if (
    recebidoBuffer.length !== esperadoBuffer.length ||
    !timingSafeEqual(recebidoBuffer, esperadoBuffer)
  ) {
    return res.status(401).json({
      ok: false,
      code: "MP_WEBHOOK_INVALID_SIGNATURE",
    });
  }

  next();
}

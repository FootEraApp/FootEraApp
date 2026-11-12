
import type { Request, Response } from "express";

import {
  CorrecaoNascimentoError,
  listarCorrecoesNascimentoAdmin,
  decidirCorrecaoNascimento,
} from "../services/correcaoNascimentoService.js";

function tratarErro(res: Response, erro: unknown) {
  if (erro instanceof CorrecaoNascimentoError) {
    return res.status(erro.statusCode).json({
      code: erro.code,
      message: erro.message,
    });
  }

  console.error("[admin-correcao-nascimento]", erro);

  return res.status(500).json({
    code: "BIRTH_DATE_REVIEW_FAILED",
    message: "Não foi possível concluir a operação.",
  });
}

export async function listarCorrecoesNascimento(
  req: Request,
  res: Response
) {
  try {
    const status =
      typeof req.query.status === "string"
        ? req.query.status
        : undefined;

    const pagina = Number(req.query.pagina ?? 1);

    const solicitacoes =
      await listarCorrecoesNascimentoAdmin(
        status,
        pagina
      );

    return res.json({ solicitacoes });
  } catch (erro) {
    return tratarErro(res, erro);
  }
}

export async function aprovarCorrecaoNascimento(
  req: Request,
  res: Response
) {
  try {
    const resultado = await decidirCorrecaoNascimento({
      solicitacaoId: String(req.params.id ?? ""),
      administradorId: String(req.userId ?? ""),
      decisao: "APROVAR",
      motivoDecisao: String(req.body?.motivoDecisao ?? ""),
      verificacaoRef: String(req.body?.verificacaoRef ?? ""),
      confirmacaoDocumental:
        req.body?.confirmacaoDocumental === true,
      ip: req.ip,
      userAgent: req.get("user-agent") ?? "",
    });

    return res.json(resultado);
  } catch (erro) {
    return tratarErro(res, erro);
  }
}

export async function recusarCorrecaoNascimento(
  req: Request,
  res: Response
) {
  try {
    const resultado = await decidirCorrecaoNascimento({
      solicitacaoId: String(req.params.id ?? ""),
      administradorId: String(req.userId ?? ""),
      decisao: "REJEITAR",
      motivoDecisao: String(req.body?.motivoDecisao ?? ""),
      ip: req.ip,
      userAgent: req.get("user-agent") ?? "",
    });

    return res.json(resultado);
  } catch (erro) {
    return tratarErro(res, erro);
  }
}
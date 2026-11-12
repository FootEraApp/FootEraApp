import {
  documentosNascimentoDisponiveis,
} from "../services/documentosNascimentoStorage.js";
import type {
  Request,
  Response,
} from "express";
import {
  CorrecaoNascimentoError,
  consultarMinhasCorrecoesNascimento,
  solicitarCorrecaoNascimento,
} from "../services/correcaoNascimentoService.js";

function usuarioAutenticado(
  req: Request
): string | null {
  const autenticada = req as Request & {
    userId?: string;
    user?: {
      id?: string;
    };
  };

  return (
    autenticada.userId ??
    autenticada.user?.id ??
    null
  );
}

export function consultarDisponibilidadeDocumentoNascimento(
  _req: Request,
  res: Response
) {
  return res.json({
    uploadDisponivel: documentosNascimentoDisponiveis(),
  });
}

function responderErro(
  res: Response,
  erro: unknown
) {
  if (erro instanceof CorrecaoNascimentoError) {
    return res.status(erro.statusCode).json({
      code: erro.code,
      message: erro.message,
    });
  }

  console.error(
    "[correcao-nascimento] Falha:",
    erro
  );

  return res.status(500).json({
    code: "BIRTH_DATE_REQUEST_FAILED",
    message:
      "Não foi possível processar a solicitação.",
  });
}

export async function criarMinhaSolicitacaoCorrecaoNascimento(
  req: Request,
  res: Response
) {
  const usuarioId = usuarioAutenticado(req);

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
  }

  if (!documentosNascimentoDisponiveis()) {
    return res.status(503).json({
      code: "BIRTH_DOCUMENT_UPLOAD_UNAVAILABLE",
      message:
        "A solicitação de correção está temporariamente indisponível.",
    });
  }

  try {
    const solicitacao =
      await solicitarCorrecaoNascimento({
        usuarioId,
        dataSolicitada:
          req.body?.dataSolicitada,
        motivo:
          req.body?.motivo,
      });

    return res.status(201).json({
      solicitacao,
      message:
        "Solicitação registrada. A alteração depende de verificação de identidade e análise autorizada.",
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

export async function listarMinhasSolicitacoesCorrecaoNascimento(
  req: Request,
  res: Response
) {
  const usuarioId = usuarioAutenticado(req);

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
  }

  try {
    const solicitacoes =
      await consultarMinhasCorrecoesNascimento(
        usuarioId
      );

    return res.json({
      solicitacoes,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}
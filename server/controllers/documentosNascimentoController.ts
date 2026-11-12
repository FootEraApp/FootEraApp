import { createHash } from "node:crypto";
import type {
  Request,
  Response,
  NextFunction,
} from "express";
import multer from "multer";
import { prisma } from "../prisma.js";
import {
  registrarExclusaoDocumentoPendente,
} from "../services/documentosNascimentoRecuperacaoService.js";
import {
  DOCUMENTO_MAX_BYTES,
  documentosNascimentoDisponiveis,
  gravarDocumentoNascimento,
  lerDocumentoNascimento,
  removerDocumentoNascimento,
  validarDocumentoNascimento,
} from "../services/documentosNascimentoStorage.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: DOCUMENTO_MAX_BYTES,
    files: 1,
    fields: 0,
  },
});

export function exigirUploadNascimentoAtivo(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (!documentosNascimentoDisponiveis()) {
    return res.status(503).json({
      code: "BIRTH_DOCUMENT_UPLOAD_UNAVAILABLE",
      message:
        "O envio de documentos está temporariamente indisponível.",
    });
  }

  next();
}

export function receberDocumentoNascimento(
  req: Request,
  res: Response,
  next: NextFunction
) {
  upload.single("documento")(
    req,
    res,
    (erro: unknown) => {
      if (erro) {
        console.error(
            "[documentos-nascimento] Multer rejeitou upload:",
            erro instanceof Error ? erro.message : erro,
            erro instanceof multer.MulterError ? erro.code : ""
        );

        return res.status(400).json({
            code: "BIRTH_DOCUMENT_UPLOAD_INVALID",
            message:
            "Envie um PDF, JPG ou PNG de até 5 MB.",
        });
        }

      next();
    }
  );
}

function responderErroDocumento(
  res: Response,
  erro: unknown
) {
  const codigo =
    erro instanceof Error ? erro.message : "";

  const errosInfraestrutura = [
    "BIRTH_PRIVATE_BUCKET_NOT_CONFIGURED",
    "BIRTH_PRIVATE_BUCKET_MUST_BE_SEPARATE",
    "BIRTH_PRIVATE_BUCKET_QA_NOT_CONFIRMED",
    "BIRTH_PRIVATE_BUCKET_INVALID",
    ];

    if (codigo === "BIRTH_DOCUMENT_KEY_INVALID") {
    console.error(
        "[documentos-nascimento] Chave de armazenamento inválida."
    );

    return res.status(409).json({
        code: "BIRTH_DOCUMENT_STORAGE_INCONSISTENT",
        message:
        "O registro do documento apresenta inconsistência.",
    });
    }

    if (errosInfraestrutura.includes(codigo)) {
    return res.status(503).json({
        code: "BIRTH_DOCUMENT_STORAGE_UNAVAILABLE",
        message:
        "O armazenamento privado de documentos não está disponível.",
    });
    }

    if (
    erro instanceof Error &&
    erro.name === "NoSuchBucket"
    ) {
    return res.status(503).json({
        code: "BIRTH_DOCUMENT_STORAGE_UNAVAILABLE",
        message:
        "O armazenamento privado de documentos não está disponível.",
    });
    }

  if (
    codigo === "BIRTH_DOCUMENT_INVALID_TYPE" ||
    codigo === "BIRTH_DOCUMENT_INVALID_SIZE"
  ) {
    return res.status(422).json({
      code: codigo,
      message:
        "Documento inválido. Envie PDF, JPG ou PNG de até 5 MB.",
    });
  }

  console.error(
    "[documentos-nascimento] Falha:",
    erro
  );

  return res.status(500).json({
    code: "BIRTH_DOCUMENT_OPERATION_FAILED",
    message:
      "Não foi possível processar o documento.",
  });
}

export async function enviarDocumentoNascimento(
  req: Request,
  res: Response
) {
  const usuarioId = String(
    req.userId ?? ""
  ).trim();

  const solicitacaoId = String(
    req.params.id ?? ""
  ).trim();

  if (!usuarioId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
    });
  }

  if (!documentosNascimentoDisponiveis()) {
    return res.status(503).json({
        code: "BIRTH_DOCUMENT_UPLOAD_UNAVAILABLE",
        message:
        "O envio de documentos está temporariamente indisponível.",
    });
    }

  if (!req.file) {
    return res.status(400).json({
      code: "BIRTH_DOCUMENT_REQUIRED",
      message: "Selecione um documento.",
    });
  }

  let arquivoSalvo:
    | Awaited<
        ReturnType<typeof gravarDocumentoNascimento>
      >
    | null = null;

  try {
    validarDocumentoNascimento(req.file);

    const solicitacao =
      await prisma.solicitacaoCorrecaoNascimento.findFirst({
        where: {
          id: solicitacaoId,
          usuarioId,
          status: {
            in: [
              "PENDENTE_VERIFICACAO",
              "EM_ANALISE",
            ],
          },
        },

        select: {
          id: true,
          documento: {
            select: {
              id: true,
            },
          },
        },
      });

    if (!solicitacao) {
      return res.status(404).json({
        code: "BIRTH_REQUEST_NOT_FOUND_OR_CLOSED",
        message:
          "Solicitação não encontrada ou encerrada.",
      });
    }

    if (solicitacao.documento) {
      return res.status(409).json({
        code: "BIRTH_DOCUMENT_ALREADY_SENT",
        message:
          "Esta solicitação já possui documento.",
      });
    }

    arquivoSalvo =
      await gravarDocumentoNascimento(
        solicitacaoId,
        req.file
      );

    const registro = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Usuario"
          WHERE "id" = ${usuarioId}
          FOR UPDATE
        `;

        await tx.$queryRaw`
          SELECT "id"
          FROM "SolicitacaoCorrecaoNascimento"
          WHERE "id" = ${solicitacaoId}
          FOR UPDATE
        `;

        const atual =
          await tx.solicitacaoCorrecaoNascimento.findFirst({
            where: {
              id: solicitacaoId,
              usuarioId,
              status: {
                in: [
                  "PENDENTE_VERIFICACAO",
                  "EM_ANALISE",
                ],
              },
            },

            select: {
              id: true,
              documento: {
                select: {
                  id: true,
                },
              },
            },
          });

        if (!atual || atual.documento) {
          throw new Error("BIRTH_REQUEST_CHANGED");
        }

        const criado =
          await tx.documentoCorrecaoNascimento.create({
            data: {
              solicitacaoId,
              ...arquivoSalvo!,
            },

            select: {
              id: true,
              mimeType: true,
              tamanhoBytes: true,
              criadoEm: true,
            },
          });

        await tx.logAuditoria.create({
          data: {
            usuarioId,
            acao: "DOCUMENTO_NASCIMENTO_ENVIADO",
            entidade:
              "SolicitacaoCorrecaoNascimento",
            entidadeId: solicitacaoId,

            meta: {
              documentoId: criado.id,
              mimeType: criado.mimeType,
              tamanhoBytes: criado.tamanhoBytes,
            },
          },
        });

        return criado;
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );

    return res.status(201).json({
      ok: true,
      documento: registro,
    });
  } catch (erro) {
    if (arquivoSalvo) {
    // Registra primeiro a pendência para recuperar
    // a exclusão caso a tentativa imediata falhe.
    let pendenciaRegistrada = false;

    try {
        await registrarExclusaoDocumentoPendente(
        arquivoSalvo.s3Key,
        "FALHA_TRANSACAO_DOCUMENTO_NASCIMENTO"
        );

        pendenciaRegistrada = true;
    } catch (erroRegistro) {
        console.error(
        "[documentos-nascimento] Falha ao registrar pendência:",
        erroRegistro
        );
    }

    try {
        await removerDocumentoNascimento(
        arquivoSalvo.s3Key
        );

        if (pendenciaRegistrada) {
        await prisma.exclusaoDocumentoNascimentoPendente.deleteMany({
            where: {
            s3Key: arquivoSalvo.s3Key,
            },
        });
        }
    } catch (erroLimpeza) {
        console.error(
        "[documentos-nascimento] ARQUIVO_ORFAO_REVER",
        {
            solicitacaoId,
            pendenciaRegistrada,
            erro:
            erroLimpeza instanceof Error
                ? erroLimpeza.message
                : "ERRO_DESCONHECIDO",
        }
        );
    }
    }

    if (
      erro instanceof Error &&
      erro.message === "BIRTH_REQUEST_CHANGED"
    ) {
      return res.status(409).json({
        code: "BIRTH_REQUEST_CHANGED",
        message:
          "Esta solicitação mudou durante o envio.",
      });
    }

    return responderErroDocumento(res, erro);
  }
}

export async function baixarDocumentoNascimentoAdmin(
  req: Request,
  res: Response
) {
  const administradorId = String(
    req.userId ?? ""
  ).trim();

  const solicitacaoId = String(
    req.params.id ?? ""
  ).trim();

  if (!administradorId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
    });
  }

  try {
    const documento =
      await prisma.documentoCorrecaoNascimento.findUnique({
        where: {
          solicitacaoId,
        },

        select: {
          id: true,
          s3Key: true,
          mimeType: true,
          tamanhoBytes: true,
          sha256: true,
          statusSeguranca: true,
          analisadoEm: true,
          scannerRef: true,
        },
      });

    if (!documento) {
      return res.status(404).json({
        code: "BIRTH_DOCUMENT_NOT_FOUND",
        message: "Documento não encontrado.",
      });
    }

    if (
    documento.statusSeguranca !== "SEGURO" ||
    !documento.analisadoEm ||
    String(documento.scannerRef ?? "").trim().length === 0
    ) {
    return res.status(423).json({
        code: "BIRTH_DOCUMENT_QUARANTINED",
        message:
        "O documento ainda não foi liberado pela análise de segurança.",
    });
    }

    const bytes =
      await lerDocumentoNascimento(
        documento.s3Key
      );

    if (bytes.length !== documento.tamanhoBytes) {
        console.error(
            "[documentos-nascimento] Tamanho divergente",
            {
            documentoId: documento.id,
            solicitacaoId,
            }
        );

        return res.status(409).json({
            code: "BIRTH_DOCUMENT_SIZE_MISMATCH",
            message:
            "O documento armazenado não corresponde ao registro original.",
        });
        }

    const hashAtual = createHash("sha256")
    .update(bytes)
    .digest("hex");

    if (hashAtual !== documento.sha256) {
    console.error(
        "[documentos-nascimento] Integridade inválida",
        {
        documentoId: documento.id,
        solicitacaoId,
        }
    );

    return res.status(409).json({
        code: "BIRTH_DOCUMENT_INTEGRITY_FAILED",
        message:
        "O documento não passou na verificação de integridade.",
    });
    }

    const extensao =
      documento.mimeType === "application/pdf"
        ? "pdf"
        : documento.mimeType === "image/jpeg"
          ? "jpg"
          : "png";

    // Auditoria obrigatória antes da entrega.
    await prisma.logAuditoria.create({
      data: {
        usuarioId: administradorId,
        acao: "DOCUMENTO_NASCIMENTO_ACESSADO",
        entidade: "SolicitacaoCorrecaoNascimento",
        entidadeId: solicitacaoId,

        ip: req.ip,
        userAgent: req.get("user-agent") ?? null,

        meta: {
          documentoId: documento.id,
        },
      },
    });

    res.setHeader(
      "Cache-Control",
      "no-store, private"
    );

    res.setHeader("Pragma", "no-cache");

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff"
    );

    res.setHeader(
      "Content-Type",
      documento.mimeType
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="comprovante-nascimento.${extensao}"`
    );

    return res.status(200).send(bytes);
  } catch (erro) {
    return responderErroDocumento(res, erro);
  }
}
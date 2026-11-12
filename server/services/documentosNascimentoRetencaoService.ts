import { prisma } from "../prisma.js";
import {
  listarObjetosNascimentoS3,
} from "./documentosNascimentoStorage.js";

function ambienteQa(): boolean {
  try {
    const db = new URL(
      process.env.DATABASE_URL ?? ""
    );

    return (
      process.env.NODE_ENV === "test" &&
      db.hostname === "127.0.0.1" &&
      db.port === "5433" &&
      db.pathname === "/footera_billing_qa" &&
      (process.env.MP_ACCESS_TOKEN ?? "") === "" &&
      process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD === "false" &&
      process.env.ENABLE_BIRTH_DOCUMENT_WORKER === "false"
    );
  } catch {
    return false;
  }
}

export async function prepararRetencaoDocumentoNascimento(
  documentoId: string,
  somenteQa = false
): Promise<"AGENDADA" | "NAO_ELEGIVEL"> {
  if (!documentoId?.trim()) {
    throw new Error(
      "BIRTH_DOCUMENT_ID_REQUIRED"
    );
  }

  if (somenteQa) {
    if (!ambienteQa()) {
      throw new Error(
        "BIRTH_RETENTION_QA_ENV_INVALID"
      );
    }
  } else if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_BIRTH_DOCUMENT_RETENTION !== "true"
  ) {
    throw new Error(
      "BIRTH_RETENTION_DISABLED"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const previa =
        await tx.documentoCorrecaoNascimento.findUnique({
          where: { id: documentoId },
          select: {
            solicitacaoId: true,
            solicitacao: {
              select: {
                usuarioId: true,
              },
            },
          },
        });

      if (!previa) {
        return "NAO_ELEGIVEL";
      }

      // Preserva a ordem de locks do fluxo administrativo.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Usuario"
        WHERE "id" = ${previa.solicitacao.usuarioId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "SolicitacaoCorrecaoNascimento"
        WHERE "id" = ${previa.solicitacaoId}
        FOR UPDATE
      `;

      const atual =
        await tx.documentoCorrecaoNascimento.findUnique({
          where: { id: documentoId },
          select: {
            id: true,
            s3Key: true,
            expiraEm: true,
            solicitacaoId: true,
            solicitacao: {
              select: {
                usuarioId: true,
                status: true,
              },
            },
          },
        });

      if (
        !atual ||
        !atual.expiraEm ||
        atual.expiraEm > new Date() ||
        !["APROVADA", "REJEITADA"].includes(
          atual.solicitacao.status
        )
      ) {
        return "NAO_ELEGIVEL";
      }

      // Pendência e auditoria são gravadas
      // antes de excluir o metadado, na mesma transação.
      await tx.exclusaoDocumentoNascimentoPendente.upsert({
        where: {
          s3Key: atual.s3Key,
        },
        create: {
          s3Key: atual.s3Key,
          motivo: "RETENCAO_DOCUMENTAL_EXPIRADA",
          proximaTentativaEm: new Date(),
        },
        update: {
          motivo: "RETENCAO_DOCUMENTAL_EXPIRADA",
        },
      });

      await tx.logAuditoria.create({
        data: {
          usuarioId: atual.solicitacao.usuarioId,
          acao:
            "DOCUMENTO_NASCIMENTO_RETENCAO_AGENDADA",
          entidade:
            "SolicitacaoCorrecaoNascimento",
          entidadeId: atual.solicitacaoId,
          meta: {
            documentoId: atual.id,
            prazo: atual.expiraEm.toISOString(),
          },
        },
      });

      await tx.documentoCorrecaoNascimento.delete({
        where: {
          id: atual.id,
        },
      });

      return "AGENDADA";
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

// Auditoria de objetos possivelmente órfãos.
// Não exclui nem agenda arquivos automaticamente.
export async function auditarObjetosOrfaosNascimento(
  continuationToken?: string
): Promise<{
  candidatos: string[];
  nextToken?: string;
  analisados: number;
}> {
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_BIRTH_DOCUMENT_RECONCILIATION !== "true"
  ) {
    throw new Error(
      "BIRTH_RECONCILIATION_DISABLED"
    );
  }

  const pagina =
    await listarObjetosNascimentoS3(
      continuationToken
    );

  // Ignorar uploads recentes ou ainda em andamento.
  const limiteAntiguidade =
    Date.now() - 48 * 60 * 60 * 1000;

  const candidatos: string[] = [];

  for (const objeto of pagina.objetos) {
    if (
      !objeto.ultimaModificacao ||
      objeto.ultimaModificacao.getTime() >
        limiteAntiguidade
    ) {
      continue;
    }

    const [documento, pendencia] =
      await Promise.all([
        prisma.documentoCorrecaoNascimento.findUnique({
          where: {
            s3Key: objeto.s3Key,
          },
          select: {
            id: true,
          },
        }),

        prisma.exclusaoDocumentoNascimentoPendente.findUnique({
          where: {
            s3Key: objeto.s3Key,
          },
          select: {
            id: true,
          },
        }),
      ]);

    if (!documento && !pendencia) {
      candidatos.push(objeto.s3Key);
    }
  }

  return {
    candidatos,
    nextToken: pagina.nextToken,
    analisados: pagina.objetos.length,
  };
}
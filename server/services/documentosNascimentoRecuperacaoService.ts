import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import {
  removerDocumentoNascimento,
} from "./documentosNascimentoStorage.js";

const TEMPO_RESERVA_MS = 10 * 60_000;

const PADRAO_CHAVE =
  /^documentos-nascimento\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/i;

function validarChave(s3Key: string): void {
  if (!PADRAO_CHAVE.test(s3Key)) {
    throw new Error(
      "BIRTH_DOCUMENT_CLEANUP_INVALID_KEY"
    );
  }
}

export async function registrarExclusaoDocumentoPendente(
  s3Key: string,
  motivo: string
): Promise<void> {
  validarChave(s3Key);

  if (!motivo?.trim()) {
    throw new Error(
      "BIRTH_DOCUMENT_CLEANUP_INVALID_REASON"
    );
  }

  await prisma.exclusaoDocumentoNascimentoPendente.upsert({
    where: {
      s3Key,
    },
    create: {
      s3Key,
      motivo: motivo.trim(),
    },
    update: {
      motivo: motivo.trim(),
    },
  });
}

export async function processarExclusoesDocumentosPendentes(
  limite = 20,
  somenteChave?: string
): Promise<{
  processadas: number;
  removidas: number;
  falhas: number;
  vinculadas: number;
}> {
  const quantidade = Number.isFinite(limite)
    ? Math.max(
        1,
        Math.min(Math.trunc(limite), 20)
      )
    : 1;

  if (somenteChave !== undefined) {
    validarChave(somenteChave);
  }

  const agora = new Date();

  const elegibilidade = {
    proximaTentativaEm: {
      lte: agora,
    },
    OR: [
      {
        reservadoAte: null,
      },
      {
        reservadoAte: {
          lte: agora,
        },
      },
    ],
  };

  const candidatos =
    await prisma.exclusaoDocumentoNascimentoPendente.findMany({
      where: {
        ...elegibilidade,
        ...(somenteChave
          ? { s3Key: somenteChave }
          : {}),
      },
      orderBy: {
        criadoEm: "asc",
      },
      take: quantidade,
      select: {
        id: true,
        s3Key: true,
      },
    });

  let processadas = 0;
  let removidas = 0;
  let falhas = 0;
  let vinculadas = 0;

  for (const candidato of candidatos) {
    const reservadoPor = randomUUID();
    const inicio = new Date();

    const aquisicao =
      await prisma.exclusaoDocumentoNascimentoPendente.updateMany({
        where: {
          id: candidato.id,
          proximaTentativaEm: {
            lte: inicio,
          },
          OR: [
            {
              reservadoAte: null,
            },
            {
              reservadoAte: {
                lte: inicio,
              },
            },
          ],
        },
        data: {
          reservadoPor,
          reservadoAte: new Date(
            inicio.getTime() + TEMPO_RESERVA_MS
          ),
        },
      });

    if (aquisicao.count !== 1) {
      continue;
    }

    processadas++;

    try {
      const vinculado =
        await prisma.documentoCorrecaoNascimento.findUnique({
          where: {
            s3Key: candidato.s3Key,
          },
          select: {
            id: true,
          },
        });

      if (vinculado) {
        await prisma.exclusaoDocumentoNascimentoPendente.deleteMany({
          where: {
            id: candidato.id,
            reservadoPor,
          },
        });

        vinculadas++;
        continue;
      }

      await removerDocumentoNascimento(
        candidato.s3Key
      );

      await prisma.exclusaoDocumentoNascimentoPendente.deleteMany({
        where: {
          id: candidato.id,
          reservadoPor,
        },
      });

      removidas++;
    } catch (erro) {
      falhas++;

      const atual =
        await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
          where: {
            id: candidato.id,
          },
          select: {
            reservadoPor: true,
            tentativas: true,
          },
        });

      if (atual?.reservadoPor !== reservadoPor) {
        continue;
      }

      const proximaTentativa =
        atual.tentativas + 1;

      const minutos = Math.min(
        60,
        2 ** Math.min(proximaTentativa, 6)
      );

      await prisma.exclusaoDocumentoNascimentoPendente.updateMany({
        where: {
          id: candidato.id,
          reservadoPor,
        },
        data: {
          tentativas: {
            increment: 1,
          },
          ultimoErro:
            erro instanceof Error
              ? erro.message.slice(0, 500)
              : "ERRO_DESCONHECIDO",
          proximaTentativaEm: new Date(
            Date.now() + minutos * 60_000
          ),
          reservadoPor: null,
          reservadoAte: null,
        },
      });

      console.error(
        "[documentos-nascimento] Falha na recuperação:",
        {
          pendenciaId: candidato.id,
          tentativas: proximaTentativa,
        }
      );
    }
  }

  return {
    processadas,
    removidas,
    falhas,
    vinculadas,
  };
}
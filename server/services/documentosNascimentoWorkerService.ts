
import { prisma } from "../prisma.js";

import {
  analisarDocumentoNascimentoPendente,
} from "./analiseDocumentoNascimentoService.js";

import {
  processarExclusoesDocumentosPendentes,
} from "./documentosNascimentoRecuperacaoService.js";

const INTERVALO_MS = 5 * 60_000;

let timer:
  | ReturnType<typeof setInterval>
  | null = null;

let executando = false;

function workerHabilitado(): boolean {
  return (
    process.env.NODE_ENV ===
      "production" &&
    process.env.ENABLE_BIRTH_DOCUMENT_WORKER ===
      "true" &&
    process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD ===
      "true" &&
    Boolean(
      process.env.AWS_S3_PRIVATE_BUCKET
        ?.trim()
    ) &&
    Boolean(
      process.env.CLAMAV_SOCKET_PATH
        ?.trim()
    )
  );
}

function workerQaPermitido(
  ids: string[]
): boolean {
  try {
    const db = new URL(
      process.env.DATABASE_URL ?? ""
    );

    return (
      ids.length > 0 &&
      ids.length <= 10 &&
      ids.every((id) =>
        /^[0-9a-f-]{36}$/i.test(id)
      ) &&
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

export async function executarWorkerNascimentoUmaVez(
  somenteDocumentoIdsQa?: string[]
): Promise<void> {
  const executandoQa =
    somenteDocumentoIdsQa !== undefined;

  if (
    executandoQa &&
    !workerQaPermitido(somenteDocumentoIdsQa)
  ) {
    throw new Error(
      "BIRTH_DOCUMENT_WORKER_QA_INVALID"
    );
  }

  if (!executandoQa && !workerHabilitado()) {
    return;
  }

  if (executando) {
    return;
  }

  executando = true;

  try {
    const agora = new Date();

    const documentos =
      await prisma.documentoCorrecaoNascimento.findMany({
        where: {
            ...(executandoQa
                ? {
                    id: {
                    in: somenteDocumentoIdsQa,
                    },
                }
                : {}),
          OR: [
            {
              statusSeguranca: "PENDENTE",
            },
            {
              statusSeguranca: "EM_ANALISE",
              scannerReservadoAte: {
                lt: agora,
              },
            },
          ],
        },
        select: {
          id: true,
        },
        orderBy: {
          criadoEm: "asc",
        },
        take: 10,
      });

    for (const documento of documentos) {
      try {
        const resultado =
          await analisarDocumentoNascimentoPendente(
            documento.id
          );

        if (
          resultado ===
          "AMEACA_DETECTADA"
        ) {
          console.warn(
            "[nascimento-worker] Ameaça detectada:",
            {
              documentoId: documento.id,
            }
          );
        }
      } catch (erro) {
        console.error(
          "[nascimento-worker] Falha na análise:",
          {
            documentoId: documento.id,
            erro,
          }
        );
      }
    }

    const recuperacao = executandoQa
        ? {
            processadas: 0,
            removidas: 0,
            falhas: 0,
            vinculadas: 0,
            }
        : await processarExclusoesDocumentosPendentes(10);

    if (
      documentos.length > 0 ||
      recuperacao.processadas > 0
    ) {
      console.log(
        "[nascimento-worker] Ciclo:",
        {
          documentos: documentos.length,
          recuperacao,
        }
      );
    }
  } catch (erro) {
    console.error(
      "[nascimento-worker] Erro geral:",
      erro
    );
  } finally {
    executando = false;
  }
}

export function iniciarWorkerDocumentosNascimento(): void {
  if (!workerHabilitado()) {
    console.log(
      "[nascimento-worker] Desativado."
    );
    return;
  }

  if (timer) {
    return;
  }

  console.log(
    "[nascimento-worker] Ativado."
  );

  timer = setInterval(() => {
    void executarWorkerNascimentoUmaVez();
  }, INTERVALO_MS);

  // Primeiro ciclo após a inicialização.
  void executarWorkerNascimentoUmaVez();
}

export function pararWorkerDocumentosNascimento(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
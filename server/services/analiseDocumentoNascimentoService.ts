
import {
  createHash,
  randomUUID,
} from "node:crypto";
import { createConnection } from "node:net";

import { prisma } from "../prisma.js";
import {
  DOCUMENTO_MAX_BYTES,
  lerDocumentoNascimento,
} from "./documentosNascimentoStorage.js";

function scannerQaLocal(): boolean {
  try {
    const url = new URL(
      process.env.DATABASE_URL ?? ""
    );

    return (
      process.env.NODE_ENV === "test" &&
      url.hostname === "127.0.0.1" &&
      url.port === "5433" &&
      url.pathname === "/footera_billing_qa" &&
      (process.env.MP_ACCESS_TOKEN ?? "") === "" &&
      process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD === "false" &&
      process.env.ENABLE_BIRTH_DOCUMENT_WORKER === "false"
    );
  } catch {
    return false;
  }
}

type ResultadoScanner =
  | "SEGURO"
  | "AMEACA_DETECTADA";

export type ResultadoAnaliseNascimento =
  | ResultadoScanner
  | "FALHA_ANALISE"
  | "IGNORADO";

const TEMPO_RESERVA_MS = 2 * 60_000;

export function verificarComClamAV(
  bytes: Buffer
): Promise<ResultadoScanner> {
  const socketPath =
    process.env.CLAMAV_SOCKET_PATH?.trim();

  const pipeWindowsQa =
    scannerQaLocal() &&
    process.platform === "win32" &&
    socketPath?.startsWith(
      "\\\\.\\pipe\\footera-clamav-qa-"
    );

  if (
    !socketPath ||
    (
      !socketPath.startsWith("/") &&
      !pipeWindowsQa
    )
  ) {
    throw new Error(
      "BIRTH_SCANNER_NOT_CONFIGURED"
    );
  }

  if (
    bytes.length === 0 ||
    bytes.length > DOCUMENTO_MAX_BYTES
  ) {
    throw new Error(
      "BIRTH_DOCUMENT_INVALID_SIZE"
    );
  }

  return new Promise((resolve, reject) => {
    const socket = createConnection({
      path: socketPath,
    });

    let resposta = "";
    let concluido = false;

    function finalizar(
      erro?: Error,
      resultado?: ResultadoScanner
    ): void {
      if (concluido) {
        return;
      }

      concluido = true;
      socket.destroy();

      if (erro) {
        reject(erro);
      } else if (resultado) {
        resolve(resultado);
      } else {
        reject(
          new Error(
            "BIRTH_SCANNER_EMPTY_RESPONSE"
          )
        );
      }
    }

    const timeoutMs = scannerQaLocal()
      ? Math.max(
          100,
          Math.min(
            Number(
              process.env.CLAMAV_QA_TIMEOUT_MS ?? 30000
            ) || 30000,
            30000
          )
        )
      : 30000;

    socket.setTimeout(timeoutMs, () =>
      finalizar(
        new Error("BIRTH_SCANNER_TIMEOUT")
      )
    );

    socket.on("error", (erro) => {
      finalizar(erro);
    });

    socket.on("data", (parte: Buffer) => {
      resposta += parte.toString("utf8");

      if (resposta.length > 4096) {
        finalizar(
          new Error(
            "BIRTH_SCANNER_RESPONSE_TOO_LARGE"
          )
        );
        return;
      }

      const fim = resposta.indexOf("\0");

      if (fim < 0) {
        return;
      }

      const linha = resposta
        .slice(0, fim)
        .trim();

      if (linha === "stream: OK") {
        finalizar(undefined, "SEGURO");
      } else if (
        /^stream: .+ FOUND$/.test(linha)
      ) {
        finalizar(
          undefined,
          "AMEACA_DETECTADA"
        );
      } else {
        finalizar(
          new Error(
            "BIRTH_SCANNER_BAD_RESPONSE"
          )
        );
      }
    });

    socket.on("end", () => {
      if (!concluido) {
        finalizar(
          new Error(
            "BIRTH_SCANNER_CONNECTION_CLOSED"
          )
        );
      }
    });

    socket.on("connect", () => {
      // Protocolo ClamAV INSTREAM.
      socket.write(
        Buffer.from(
          "zINSTREAM\0",
          "ascii"
        )
      );

      for (
        let pos = 0;
        pos < bytes.length;
        pos += 64 * 1024
      ) {
        const parte = bytes.subarray(
          pos,
          pos + 64 * 1024
        );

        const tamanho =
          Buffer.allocUnsafe(4);

        tamanho.writeUInt32BE(
          parte.length,
          0
        );

        socket.write(tamanho);
        socket.write(parte);
      }

      socket.write(Buffer.alloc(4));
    });
  });
}

export async function analisarDocumentoNascimentoPendente(
  documentoId: string
): Promise<ResultadoAnaliseNascimento> {
  if (
    typeof documentoId !== "string" ||
    !documentoId.trim()
  ) {
    throw new Error(
      "BIRTH_DOCUMENT_ID_REQUIRED"
    );
  }

  const identificador = randomUUID();
  const inicio = new Date();

  // Reserva atômica:
  // aceita documento PENDENTE ou
  // análise cuja reserva já expirou.
  const aquisicao =
    await prisma.documentoCorrecaoNascimento.updateMany({
      where: {
        id: documentoId,
        OR: [
          {
            statusSeguranca: "PENDENTE",
          },
          {
            statusSeguranca: "EM_ANALISE",
            scannerReservadoAte: {
              lt: inicio,
            },
          },
        ],
      },
      data: {
        statusSeguranca: "EM_ANALISE",
        analisadoEm: null,
        scannerRef: null,
        scannerReservadoPor: identificador,
        scannerReservadoAte: new Date(
          inicio.getTime() +
            TEMPO_RESERVA_MS
        ),
      },
    });

  if (aquisicao.count !== 1) {
    return "IGNORADO";
  }

  try {
    const documento =
      await prisma.documentoCorrecaoNascimento.findUniqueOrThrow({
        where: {
          id: documentoId,
        },
        select: {
          s3Key: true,
          tamanhoBytes: true,
          sha256: true,
        },
      });

    const bytes =
      await lerDocumentoNascimento(
        documento.s3Key
      );

    if (
      bytes.length !== documento.tamanhoBytes
    ) {
      throw new Error(
        "BIRTH_DOCUMENT_SIZE_MISMATCH"
      );
    }

    const sha256Atual = createHash(
      "sha256"
    )
      .update(bytes)
      .digest("hex");

    if (
      sha256Atual !== documento.sha256
    ) {
      throw new Error(
        "BIRTH_DOCUMENT_HASH_MISMATCH"
      );
    }

    const resultado =
      await verificarComClamAV(bytes);

    const atualizado =
      await prisma.documentoCorrecaoNascimento.updateMany({
        where: {
          id: documentoId,
          statusSeguranca: "EM_ANALISE",
          scannerReservadoPor: identificador,
          scannerReservadoAte: {
            gt: new Date(),
          },
        },
        data: {
          statusSeguranca: resultado,
          analisadoEm: new Date(),
          scannerRef:
            `CLAMAV_INSTREAM_${identificador}`,
          scannerReservadoPor: null,
          scannerReservadoAte: null,
        },
      });

    return atualizado.count === 1
      ? resultado
      : "IGNORADO";
  } catch (erro) {
    console.error(
      "[nascimento-scanner] Falha na análise documental",
      {
        documentoId,
        erro:
          erro instanceof Error
            ? erro.message
            : String(erro),
      }
    );

    const falha =
      await prisma.documentoCorrecaoNascimento.updateMany({
        where: {
          id: documentoId,
          statusSeguranca: "EM_ANALISE",
          scannerReservadoPor: identificador,
          scannerReservadoAte: {
            gt: new Date(),
          },
        },
        data: {
          statusSeguranca:
            "FALHA_ANALISE",
          analisadoEm: null,
          scannerRef: null,
          scannerReservadoPor: null,
          scannerReservadoAte: null,
        },
      });

    return falha.count === 1
      ? "FALHA_ANALISE"
      : "IGNORADO";
  }
}
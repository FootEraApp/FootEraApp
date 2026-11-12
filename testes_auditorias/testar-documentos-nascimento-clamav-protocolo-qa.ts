
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { unlink } from "node:fs/promises";

const db = new URL(process.env.DATABASE_URL ?? "");

assert.equal(process.env.NODE_ENV, "test");
assert.equal(db.hostname, "127.0.0.1");
assert.equal(db.port, "5433");
assert.equal(db.pathname, "/footera_billing_qa");
assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
assert.equal(process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD, "false");
assert.equal(process.env.ENABLE_BIRTH_DOCUMENT_WORKER, "false");
assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
assert.equal(
  process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,
  "false"
);

const { verificarComClamAV } = await import(
  "./server/services/analiseDocumentoNascimentoService.js"
);

const bytes = Buffer.from(
  "%PDF-1.4\nQA ficticio\n%%EOF\n"
);

let total = 0;

async function testar(
  modo: "OK" | "FOUND" | "ERROR" | "TIMEOUT"
): Promise<void> {
  const id = randomUUID();

  const endereco = process.platform === "win32"
    ? `\\\\.\\pipe\\footera-clamav-qa-${id}`
    : `/tmp/footera-clamav-qa-${id}.sock`;

  const servidor = createServer((socket) => {
    let recebido = Buffer.alloc(0);
    let respondido = false;

    socket.on("data", (parte) => {
      if (respondido) return;

      recebido = Buffer.concat([
        recebido,
        Buffer.isBuffer(parte)
            ? parte
            : Buffer.from(parte, "utf8"),
        ]);

      const cabecalho = Buffer.from(
        "zINSTREAM\0",
        "ascii"
      );

      if (recebido.length < cabecalho.length) return;

      assert.ok(
        recebido.subarray(
          0,
          cabecalho.length
        ).equals(cabecalho)
      );

      let pos = cabecalho.length;
      const partes: Buffer[] = [];

      while (pos + 4 <= recebido.length) {
        const tamanho = recebido.readUInt32BE(pos);

        if (tamanho === 0) {
          respondido = true;

          assert.ok(
            Buffer.concat(partes).equals(bytes),
            "Bytes transmitidos pelo scanner"
          );

          if (modo !== "TIMEOUT") {
            const resposta =
              modo === "OK"
                ? "stream: OK\0"
                : modo === "FOUND"
                  ? "stream: QA-Test-Signature FOUND\0"
                  : "stream: QA scanner ERROR\0";

            socket.end(resposta);
          }

          return;
        }

        if (pos + 4 + tamanho > recebido.length) return;

        partes.push(
          recebido.subarray(
            pos + 4,
            pos + 4 + tamanho
          )
        );

        pos += 4 + tamanho;
      }
    });
  });

  try {
    await new Promise<void>((resolve, reject) => {
      servidor.once("error", reject);
      servidor.listen(endereco, resolve);
    });

    process.env.CLAMAV_SOCKET_PATH = endereco;
    process.env.CLAMAV_QA_TIMEOUT_MS = "300";

    if (modo === "OK") {
      assert.equal(
        await verificarComClamAV(bytes),
        "SEGURO"
      );
    } else if (modo === "FOUND") {
      assert.equal(
        await verificarComClamAV(bytes),
        "AMEACA_DETECTADA"
      );
    } else {
      await assert.rejects(
        verificarComClamAV(bytes),
        /BIRTH_SCANNER_/
      );
    }

    console.log(
      `APROVADO ${++total} — ClamAV ${modo}`
    );
  } finally {
    delete process.env.CLAMAV_SOCKET_PATH;
    delete process.env.CLAMAV_QA_TIMEOUT_MS;

    await new Promise<void>((resolve, reject) =>
      servidor.close((erro) =>
        erro ? reject(erro) : resolve()
      )
    );

    if (process.platform !== "win32") {
      await unlink(endereco).catch(() => {});
    }
  }
}

for (const modo of [
  "OK",
  "FOUND",
  "ERROR",
  "TIMEOUT",
] as const) {
  await testar(modo);
}

console.log(
  `RESULTADO: ${total}/4. Sem AWS, sem documentos reais.`
);
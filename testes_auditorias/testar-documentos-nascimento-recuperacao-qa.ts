
// testar-documentos-nascimento-recuperacao-qa.ts

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

function exigirQa(): void {
  const url = new URL(
    process.env.DATABASE_URL ?? ""
  );

  assert.equal(
    process.env.NODE_ENV,
    "test"
  );

  assert.equal(
    url.hostname,
    "127.0.0.1"
  );

  assert.equal(
    url.port,
    "5433"
  );

  assert.equal(
    url.pathname,
    "/footera_billing_qa"
  );

  assert.equal(
    process.env.MP_ACCESS_TOKEN ?? "",
    ""
  );

  for (const nome of [
    "ENABLE_ACCOUNT_PURGE",
    "ENABLE_BILLING_SCHEDULER",
    "ENABLE_MP_CONCILIACAO_SCHEDULER",
    "ENABLE_BIRTH_DOCUMENT_UPLOAD",
  ]) {
    assert.equal(
      process.env[nome],
      "false",
      nome
    );
  }

  assert.equal(
    process.env.AWS_S3_PRIVATE_BUCKET ?? "",
    ""
  );
}

exigirQa();

async function main(): Promise<void> {
  const { prisma } = await import(
    "./server/prisma.js"
  );

  const {
    configurarArmazenamentoNascimentoQa,
  } = await import(
    "./server/services/documentosNascimentoStorage.js"
  );

  const {
    registrarExclusaoDocumentoPendente,
    processarExclusoesDocumentosPendentes,
  } = await import(
    "./server/services/documentosNascimentoRecuperacaoService.js"
  );

  // Verifica o banco real conectado.
  const confirmado = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  assert.equal(
    confirmado[0]?.nome,
    "footera_billing_qa"
  );

  // Duas chaves fictícias exclusivas desta execução.
  const chave =
    `documentos-nascimento/${randomUUID()}/` +
    `${randomUUID()}.pdf`;

  const chaveConcorrente =
    `documentos-nascimento/${randomUUID()}/` +
    `${randomUUID()}.pdf`;

  const chaves = [
    chave,
    chaveConcorrente,
  ];

  const objetos = new Map<string, Buffer>();

  let falharExclusao = true;
  let remocoesConcorrentes = 0;
  let contagem = 0;

  function ok(
    condicao: unknown,
    descricao: string
  ): void {
    assert.ok(
      condicao,
      descricao
    );

    console.log(
      `APROVADO ${++contagem} — ${descricao}`
    );
  }

  try {
    // Objetos fictícios armazenados em memória.
    objetos.set(
      chave,
      Buffer.from("%PDF-1.4\nQA\n%%EOF")
    );

    objetos.set(
      chaveConcorrente,
      Buffer.from(
        "%PDF-1.4\nCONCORRENCIA\n%%EOF"
      )
    );

    // Nenhuma operação alcança a AWS.
    configurarArmazenamentoNascimentoQa({
      gravar: async (key, bytes) => {
        objetos.set(
          key,
          Buffer.from(bytes)
        );
      },

      ler: async (key) => {
        const bytes = objetos.get(key);

        if (!bytes) {
          throw new Error(
            "BIRTH_DOCUMENT_NOT_FOUND_IN_S3"
          );
        }

        return Buffer.from(bytes);
      },

      remover: async (key) => {
        if (key === chaveConcorrente) {
          remocoesConcorrentes++;

          // Mantém a exclusão em andamento
          // enquanto o outro worker disputa.
          await new Promise<void>((resolve) =>
            setTimeout(resolve, 100)
          );
        } else if (falharExclusao) {
          throw new Error(
            "QA_STORAGE_DELETE_FAILED"
          );
        }

        objetos.delete(key);
      },
    });

    // =====================================
    // TESTE 1 — REGISTRO DE PENDÊNCIA
    // =====================================

    await registrarExclusaoDocumentoPendente(
      chave,
      "TESTE_QA_RECUPERACAO"
    );

    const registrada =
      await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
        where: {
          s3Key: chave,
        },
      });

    ok(
      !!registrada,
      "Pendência persistida no QA"
    );

    // =====================================
    // TESTE 2 — FALHA DE EXCLUSÃO
    // =====================================

    const primeira =
      await processarExclusoesDocumentosPendentes(
        1,
        chave
      );

    ok(
      primeira.falhas === 1 &&
        objetos.has(chave),
      "Falha preserva objeto e pendência"
    );

    // =====================================
    // TESTE 3 — CONTADOR DE TENTATIVAS
    // =====================================

    const pendente =
      await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
        where: {
          s3Key: chave,
        },
      });

    ok(
      pendente?.tentativas === 1,
      "Falha aumenta tentativas"
    );

    // =====================================
    // TESTE 4 — LIBERAÇÃO DA RESERVA
    // =====================================

    ok(
      pendente?.reservadoPor === null &&
        pendente.reservadoAte === null,
      "Reserva é liberada após falha"
    );

    // =====================================
    // TESTE 5 — RECUPERAÇÃO
    // =====================================

    falharExclusao = false;

    // Antecipação exclusiva do QA.
    await prisma.exclusaoDocumentoNascimentoPendente.update({
      where: {
        s3Key: chave,
      },
      data: {
        proximaTentativaEm: new Date(),
      },
    });

    const segunda =
      await processarExclusoesDocumentosPendentes(
        1,
        chave
      );

    ok(
      segunda.removidas === 1 &&
        !objetos.has(chave),
      "Recuperação remove objeto após normalização"
    );

    // =====================================
    // TESTE 6 — PENDÊNCIA CONCLUÍDA
    // =====================================

    const restante =
      await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
        where: {
          s3Key: chave,
        },
      });

    ok(
      restante === null,
      "Pendência removida após sucesso"
    );

    // =====================================
    // TESTES 7 A 9 — CONCORRÊNCIA
    // =====================================

    await registrarExclusaoDocumentoPendente(
      chaveConcorrente,
      "TESTE_QA_CONCORRENCIA"
    );

    // Duas execuções simultâneas disputam
    // a mesma pendência.
    const [workerA, workerB] = await Promise.all([
      processarExclusoesDocumentosPendentes(
        1,
        chaveConcorrente
      ),
      processarExclusoesDocumentosPendentes(
        1,
        chaveConcorrente
      ),
    ]);

    ok(
      workerA.processadas +
        workerB.processadas ===
        1,
      "Dois workers reservam apenas uma pendência"
    );

    ok(
      remocoesConcorrentes === 1 &&
        !objetos.has(chaveConcorrente),
      "Exclusão concorrente executa uma única remoção"
    );

    const restoConcorrente =
      await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
        where: {
          s3Key: chaveConcorrente,
        },
      });

    ok(
      restoConcorrente === null,
      "Pendência concorrente foi concluída"
    );

    console.log(
      `\nRESULTADO: ${contagem}/${contagem} verificações aprovadas.`
    );

    console.log(
      "AWS NÃO ACESSADA. Apenas objetos fictícios em memória."
    );
  } finally {
    // Limpeza restrita às duas chaves
    // geradas nesta execução.
    try {
      await prisma.exclusaoDocumentoNascimentoPendente.deleteMany({
        where: {
          s3Key: {
            in: chaves,
          },
        },
      });
    } finally {
      objetos.clear();

      configurarArmazenamentoNascimentoQa(null);

      await prisma.$disconnect();
    }
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
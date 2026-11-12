
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

function exigirQa(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.ok(["postgresql:", "postgres:"].includes(url.protocol), "QA_PROTOCOLO");
  assert.equal(process.env.NODE_ENV, "test", "QA_NODE_ENV");
  assert.equal(url.hostname, "127.0.0.1", "QA_HOST");
  assert.equal(url.port, "5433", "QA_PORTA");
  assert.equal(url.pathname, "/footera_billing_qa", "QA_BANCO");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "", "QA_MP_TOKEN");
  for (const nome of [
    "ENABLE_ACCOUNT_PURGE",
    "ENABLE_BILLING_SCHEDULER",
    "ENABLE_MP_CONCILIACAO_SCHEDULER",
  ]) {
    assert.equal(process.env[nome], "false", `QA_${nome}`);
  }
  assert.equal(process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD, "false", "QA_UPLOAD_FLAG");
  assert.equal(process.env.AWS_S3_PRIVATE_BUCKET ?? "", "", "QA_BUCKET_AUSENTE");
}

exigirQa();
// Definir antes de importar rotas/middlewares de autenticação.
process.env.JWT_SECRET = randomBytes(48).toString("hex");

type RespostaHttp = {
  status: number;
  json: any;
  raw: Buffer;
  headers: Headers;
};

async function main(): Promise<void> {
  const { prisma } = await import("./server/prisma.js");
  const { default: express } = await import("express");
  const { default: jwt } = await import("jsonwebtoken");
  const { default: rotasUsuario } = await import("./server/routes/correcaoNascimento.js");
  const { default: rotasAdmin } = await import("./server/routes/adminCorrecaoNascimento.js");
  const { solicitarCorrecaoNascimento } = await import("./server/services/correcaoNascimentoService.js");
  const { configurarArmazenamentoNascimentoQa } = await import("./server/services/documentosNascimentoStorage.js");
  const {
    analisarDocumentoNascimentoPendente,
  } = await import(
    "./server/services/analiseDocumentoNascimentoService.js"
  );

  const {
    prepararRetencaoDocumentoNascimento,
  } = await import(
    "./server/services/documentosNascimentoRetencaoService.js"
  );

  const {
    processarExclusoesDocumentosPendentes,
  } = await import(
    "./server/services/documentosNascimentoRecuperacaoService.js"
  );

  const {
    executarWorkerNascimentoUmaVez,
  } = await import(
    "./server/services/documentosNascimentoWorkerService.js"
  );

  const banco = await prisma.$queryRaw<Array<{ nome: string }>>`
    SELECT current_database() AS nome
  `;
  assert.equal(banco[0]?.nome, "footera_billing_qa", "QA_BANCO_CONECTADO");

  const objetos = new Map<string, Buffer>();
  const usuarios: string[] = [];
  const prefixo = `qa_documento_http_${randomUUID().replaceAll("-", "")}`;
  let servidor:
    | ReturnType<ReturnType<typeof express>["listen"]>
    | null = null;
  let total = 0;
  let concluiu = false;
  let falharGravacao = false;

  function ok(condicao: unknown, descricao: string, resposta?: RespostaHttp): void {
    assert.ok(
      condicao,
      `${descricao}${resposta ? ` | HTTP ${resposta.status} | resposta=${JSON.stringify(resposta.json)}` : ""}`
    );
    console.log(`APROVADO ${String(++total).padStart(2, "0")} — ${descricao}`);
  }

  async function criarUsuario(sufixo: string, administrador = false) {
    const criado = await prisma.usuario.create({
      data: {
        nome: `QA documento ${sufixo}`,
        nomeDeUsuario: `${prefixo}_${sufixo}`.slice(0, 64),
        email: `${prefixo}_${sufixo}@example.invalid`,
        senhaHash: `NAO_LOGIN_${prefixo}`,
        tipo: "Atleta",
        verified: true,
        dataNascimento: new Date("1990-05-17T00:00:00.000Z"),
        aniversarioElegivelApartirDe: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    usuarios.push(criado.id);

    await prisma.atleta.create({
      data: {
        usuarioId: criado.id,
        idade: 36,
        categoria: ["Livre"],
        dataNascimento: criado.dataNascimento,
      },
    });
    await prisma.usuarioPapel.create({
      data: {
        usuarioId: criado.id,
        papel: "Atleta",
        status: "ATIVO",
        ativadoEm: new Date(),
      },
    });
    if (administrador) {
      await prisma.administrador.create({
        data: {
          usuarioId: criado.id,
          cargo: "QA",
          nivel: "Performance",
        },
      });
    }
    const token = jwt.sign(
      { id: criado.id, tokenVersion: criado.tokenVersion },
      process.env.JWT_SECRET!,
      { algorithm: "HS256", expiresIn: "10m" }
    );
    return { id: criado.id, token };
  }

  function criarFormulario(bytes: Buffer, mimeType: string): FormData {
    const formulario = new FormData();
    formulario.append(
      "documento",
      new Blob([new Uint8Array(bytes)], { type: mimeType }),
      "comprovante.pdf"
    );
    return formulario;
  }

  async function requisitar(
    base: string,
    caminho: string,
    token: string | null,
    metodo: "GET" | "POST" = "GET",
    corpo?: FormData
  ): Promise<RespostaHttp> {
    const resposta = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: corpo,
      signal: AbortSignal.timeout(20_000),
    });
    const raw = Buffer.from(await resposta.arrayBuffer());
    let json: any = null;
    try {
      json = JSON.parse(raw.toString("utf8"));
    } catch {
      // Download binário: não é JSON.
    }
    return { status: resposta.status, json, raw, headers: resposta.headers };
  }

  try {
    configurarArmazenamentoNascimentoQa({
      gravar: async (key, bytes) => {
        if (falharGravacao) {
          throw new Error("QA_STORAGE_PUT_FAILED");
        }

        objetos.set(key, Buffer.from(bytes));
      },
      ler: async (key) => {
        const buffer = objetos.get(key);
        if (!buffer) throw new Error("BIRTH_DOCUMENT_NOT_FOUND_IN_S3");
        return Buffer.from(buffer);
      },
      remover: async (key) => { objetos.delete(key); },
    });

    const dono = await criarUsuario("dono");
    const intruso = await criarUsuario("intruso");
    const admin = await criarUsuario("admin", true);

    const pedidoDono = await solicitarCorrecaoNascimento({
      usuarioId: dono.id,
      dataSolicitada: "1991-05-17",
      motivo: "Correção fictícia documental para testar API local.",
    });
    const pedidoIntruso = await solicitarCorrecaoNascimento({
      usuarioId: intruso.id,
      dataSolicitada: "1992-05-17",
      motivo: "Correção fictícia de outro usuário para testar autorização.",
    });

    const app = express();
    app.use(express.json());
    app.use("/api/correcao-nascimento", rotasUsuario);
    app.use("/api/admin/correcoes-nascimento", rotasAdmin);

    servidor = await new Promise<ReturnType<typeof app.listen>>(
      (resolve, reject) => {
        const s = app.listen(0, "127.0.0.1");

        s.once("error", reject);

        s.once("listening", () => {
          resolve(s);
        });
      }
    );
    const endereco = servidor.address();
    assert.ok(endereco && typeof endereco !== "string");
    const base = `http://127.0.0.1:${(endereco as AddressInfo).port}`;

    const pdf = Buffer.from("%PDF-1.4\n% Documento QA ficticio\n1 0 obj <<>> endobj\n%%EOF\n");
    const upload = `/api/correcao-nascimento/${pedidoDono.id}/documento`;
    const download = `/api/admin/correcoes-nascimento/${pedidoDono.id}/documento`;

    let r = await requisitar(base, upload, null, "POST", criarFormulario(pdf, "application/pdf"));
    ok(r.status === 401, "Upload sem JWT retorna 401", r);

    r = await requisitar(base, upload, intruso.token, "POST", criarFormulario(pdf, "application/pdf"));
    ok(r.status === 404 && r.json?.code === "BIRTH_REQUEST_NOT_FOUND_OR_CLOSED",
      "Outro usuário não consegue anexar ao pedido alheio", r);

    r = await requisitar(base, upload, dono.token, "POST", criarFormulario(pdf, "application/pdf"));
    ok(r.status === 201 && !!r.json?.documento?.id, "Dono envia PDF e recebe documento", r);

    const documento = await prisma.documentoCorrecaoNascimento.findUniqueOrThrow({
      where: { solicitacaoId: pedidoDono.id },
    });
    ok(
      documento.statusSeguranca === "PENDENTE" &&
        documento.analisadoEm === null &&
        documento.scannerRef === null,
      "Documento novo entra em quarentena"
    );

    // QA: verificar comportamento sem scanner instalado.
    delete process.env.CLAMAV_SOCKET_PATH;

    const resultadoScanner =
      await analisarDocumentoNascimentoPendente(
        documento.id
      );

    ok(
      resultadoScanner === "FALHA_ANALISE",
      "Scanner indisponível não libera documento"
    );

    const documentoDepoisScanner =
      await prisma.documentoCorrecaoNascimento.findUniqueOrThrow({
        where: {
          id: documento.id,
        },
      });

    ok(
      documentoDepoisScanner.statusSeguranca === "FALHA_ANALISE" &&
        documentoDepoisScanner.analisadoEm === null &&
        documentoDepoisScanner.scannerRef === null,
      "Falha do scanner fica registrada sem autorização"
    );

    // Somente QA: restaurar o estado para continuar
    // os demais testes de quarentena e download.
    await prisma.documentoCorrecaoNascimento.update({
      where: {
        id: documento.id,
      },
      data: {
        statusSeguranca: "PENDENTE",
        analisadoEm: null,
        scannerRef: null,
      },
    });

    // Worker QA: deve selecionar o documento pendente.
    await executarWorkerNascimentoUmaVez([
      documento.id,
    ]);

    let estadoWorker =
      await prisma.documentoCorrecaoNascimento.findUniqueOrThrow({
        where: { id: documento.id },
      });

    ok(
      estadoWorker.statusSeguranca === "FALHA_ANALISE" &&
        estadoWorker.scannerReservadoPor === null &&
        estadoWorker.scannerReservadoAte === null,
      "Worker processa pendente e falha sem liberar documento"
    );

    // Simula um processo interrompido, com reserva vencida.
    await prisma.documentoCorrecaoNascimento.update({
      where: { id: documento.id },
      data: {
        statusSeguranca: "EM_ANALISE",
        analisadoEm: null,
        scannerRef: null,
        scannerReservadoPor: randomUUID(),
        scannerReservadoAte: new Date(
          Date.now() - 60_000
        ),
      },
    });

    await executarWorkerNascimentoUmaVez([
      documento.id,
    ]);

    estadoWorker =
      await prisma.documentoCorrecaoNascimento.findUniqueOrThrow({
        where: { id: documento.id },
      });

    ok(
      estadoWorker.statusSeguranca === "FALHA_ANALISE" &&
        estadoWorker.scannerReservadoPor === null &&
        estadoWorker.scannerReservadoAte === null,
      "Worker recupera análise com reserva expirada"
    );

    // Restaura a fixture para os testes HTTP restantes.
    await prisma.documentoCorrecaoNascimento.update({
      where: { id: documento.id },
      data: {
        statusSeguranca: "PENDENTE",
        analisadoEm: null,
        scannerRef: null,
        scannerReservadoPor: null,
        scannerReservadoAte: null,
      },
    });

    ok(objetos.has(documento.s3Key) && documento.tamanhoBytes === pdf.length,
      "Objeto mock e tamanho persistidos");

    r = await requisitar(base, upload, dono.token, "POST", criarFormulario(pdf, "application/pdf"));
    ok(r.status === 409 && r.json?.code === "BIRTH_DOCUMENT_ALREADY_SENT",
      "Segundo upload bloqueado", r);

    r = await requisitar(base, download, dono.token);
    ok(r.status === 403, "Usuário comum não pode baixar", r);

    // Documento ainda não analisado não pode ser baixado.
    r = await requisitar(base, download, admin.token);

    ok(
      r.status === 423 &&
        r.json?.code === "BIRTH_DOCUMENT_QUARANTINED",
      "Documento em quarentena não pode ser baixado",
      r
    );

    // Apenas no QA: simula o resultado de um scanner
    // para continuar testando o download autorizado.
    await prisma.documentoCorrecaoNascimento.update({
      where: {
        id: documento.id,
      },
      data: {
        statusSeguranca: "SEGURO",
        analisadoEm: new Date(),
        scannerRef: `QA_MOCK_${randomUUID()}`,
      },
    });

    r = await requisitar(base, download, admin.token);
    ok(r.status === 200 && r.raw.equals(pdf) && r.headers.get("cache-control")?.includes("no-store"),
      "Superadmin recebe documento íntegro sem cache", r);

    const log = await prisma.logAuditoria.findFirst({
      where: {
        acao: "DOCUMENTO_NASCIMENTO_ACESSADO",
        usuarioId: admin.id,
        entidadeId: pedidoDono.id,
      },
    });
    ok(!!log, "Download cria auditoria do administrador");

    objetos.set(documento.s3Key, Buffer.from("%PDF-1.4\nADULTERADO, TAMANHO DIFERENTE\n"));
    r = await requisitar(base, download, admin.token);
    ok(r.status === 409 && r.json?.code === "BIRTH_DOCUMENT_SIZE_MISMATCH",
      "Documento com tamanho adulterado não é entregue", r);

    const adulterado = Buffer.from(pdf);
    adulterado[7] = adulterado[7] === 0x41 ? 0x42 : 0x41;
    objetos.set(documento.s3Key, adulterado);
    r = await requisitar(base, download, admin.token);
    ok(r.status === 409 && r.json?.code === "BIRTH_DOCUMENT_INTEGRITY_FAILED",
      "Documento com SHA divergente não é entregue", r);

    r = await requisitar(
      base,
      `/api/correcao-nascimento/${pedidoIntruso.id}/documento`,
      dono.token,
      "POST",
      criarFormulario(pdf, "application/pdf")
    );
    ok(r.status === 404 && r.json?.code === "BIRTH_REQUEST_NOT_FOUND_OR_CLOSED",
      "Dono não consegue anexar em pedido do intruso", r);

    // ===============================================
    // QA — DOIS UPLOADS SIMULTÂNEOS
    // ===============================================

    const usuarioConcorrente = await criarUsuario("concorrente");

    const pedidoConcorrente = await solicitarCorrecaoNascimento({
      usuarioId: usuarioConcorrente.id,
      dataSolicitada: "1993-05-17",
      motivo:
        "Solicitação fictícia destinada ao teste de uploads simultâneos.",
    });

    const rotaConcorrente =
      `/api/correcao-nascimento/${pedidoConcorrente.id}/documento`;

    const [respostaA, respostaB] = await Promise.all([
      requisitar(
        base,
        rotaConcorrente,
        usuarioConcorrente.token,
        "POST",
        criarFormulario(pdf, "application/pdf")
      ),
      requisitar(
        base,
        rotaConcorrente,
        usuarioConcorrente.token,
        "POST",
        criarFormulario(pdf, "application/pdf")
      ),
    ]);

    console.log("[QA] Uploads concorrentes:", {
      primeiro: {
        status: respostaA.status,
        body: respostaA.json,
      },
      segundo: {
        status: respostaB.status,
        body: respostaB.json,
      },
    });

    const statusConcorrentes = [
      respostaA.status,
      respostaB.status,
    ].sort((a, b) => a - b);

    ok(
      statusConcorrentes[0] === 201 &&
        statusConcorrentes[1] === 409,
      "Dois uploads simultâneos permitem uma única gravação"
    );

    const documentosConcorrentes =
      await prisma.documentoCorrecaoNascimento.findMany({
        where: {
          solicitacaoId: pedidoConcorrente.id,
        },
      });

    ok(
      documentosConcorrentes.length === 1,
      "Concorrência não cria dois documentos no banco"
    );

    const chavesConcorrentes = [
      ...objetos.keys(),
    ].filter((chave) =>
      chave.startsWith(
        `documentos-nascimento/${pedidoConcorrente.id}/`
      )
    );

    ok(
      chavesConcorrentes.length === 1 &&
        chavesConcorrentes[0] ===
          documentosConcorrentes[0]?.s3Key,
      "Concorrência remove o arquivo excedente do armazenamento"
    );

    // ===============================================
    // QA — FALHA NA GRAVAÇÃO DO ARQUIVO
    // ===============================================

    const usuarioFalha = await criarUsuario("falha-storage");

    const pedidoFalha = await solicitarCorrecaoNascimento({
      usuarioId: usuarioFalha.id,
      dataSolicitada: "1994-05-17",
      motivo:
        "Solicitação fictícia destinada ao teste de falha no armazenamento.",
    });

    const rotaFalha =
      `/api/correcao-nascimento/${pedidoFalha.id}/documento`;

    const objetosAntes = objetos.size;

    let respostaFalha: RespostaHttp;

    falharGravacao = true;

    try {
      respostaFalha = await requisitar(
        base,
        rotaFalha,
        usuarioFalha.token,
        "POST",
        criarFormulario(pdf, "application/pdf")
      );
    } finally {
      falharGravacao = false;
    }

    ok(
      respostaFalha.status === 500 &&
        respostaFalha.json?.code ===
          "BIRTH_DOCUMENT_OPERATION_FAILED",
      "Falha de armazenamento retorna erro sem confirmar upload",
      respostaFalha
    );

    const documentoFalha =
      await prisma.documentoCorrecaoNascimento.findUnique({
        where: {
          solicitacaoId: pedidoFalha.id,
        },
      });

    ok(
      documentoFalha === null &&
        objetos.size === objetosAntes,
      "Falha de armazenamento não grava metadados nem objeto"
    );

    // ===========================================
    // QA — RETENÇÃO DOCUMENTAL
    // ===========================================

    // Documento ainda sem prazo não pode ser excluído.
    const naoElegivel =
      await prepararRetencaoDocumentoNascimento(
        documento.id,
        true
      );

    ok(
      naoElegivel === "NAO_ELEGIVEL",
      "Retenção preserva documento sem prazo"
    );

    // Simula solicitação encerrada e prazo vencido.
    // Somente nos registros criados por este teste.
    await prisma.solicitacaoCorrecaoNascimento.update({
      where: {
        id: pedidoDono.id,
      },
      data: {
        status: "REJEITADA",
      },
    });

    await prisma.documentoCorrecaoNascimento.update({
      where: {
        id: documento.id,
      },
      data: {
        expiraEm: new Date(
          Date.now() - 60_000
        ),
      },
    });

    const retencao =
      await prepararRetencaoDocumentoNascimento(
        documento.id,
        true
      );

    const pendenciaRetencao =
      await prisma.exclusaoDocumentoNascimentoPendente.findUnique({
        where: {
          s3Key: documento.s3Key,
        },
      });

    ok(
      retencao === "AGENDADA" &&
        pendenciaRetencao !== null,
      "Retenção registra pendência recuperável"
    );

    const registroRetido =
      await prisma.documentoCorrecaoNascimento.findUnique({
        where: {
          id: documento.id,
        },
      });

    ok(
      registroRetido === null &&
        objetos.has(documento.s3Key),
      "Metadado removido antes da exclusão do objeto"
    );

    const auditoriaRetencao =
      await prisma.logAuditoria.findFirst({
        where: {
          usuarioId: dono.id,
          entidadeId: pedidoDono.id,
          acao:
            "DOCUMENTO_NASCIMENTO_RETENCAO_AGENDADA",
        },
      });

    ok(
      auditoriaRetencao !== null,
      "Retenção registra auditoria"
    );

    // O worker de recuperação usa o mock,
    // portanto não acessa a AWS.
    const recuperacaoRetencao =
      await processarExclusoesDocumentosPendentes(
        1,
        documento.s3Key
      );

    ok(
      recuperacaoRetencao.removidas === 1 &&
        !objetos.has(documento.s3Key),
      "Recuperação remove o objeto retido"
    );

    concluiu = true;
    console.log(`\nRESULTADO: ${total}/${total} verificações HTTP com mock aprovadas.`);
    console.log("AWS NÃO ACESSADA. Documentos fictícios armazenados somente em memória.");
  } finally {
    if (servidor) {
      servidor.closeIdleConnections?.();
      await new Promise<void>((resolve, reject) => {
        servidor!.close((erro) => erro ? reject(erro) : resolve());
      });
    }
    try {
      if (usuarios.length) {
        await prisma.logAuditoria.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.documentoCorrecaoNascimento.deleteMany({
          where: { solicitacao: { usuarioId: { in: usuarios } } },
        });
        await prisma.solicitacaoCorrecaoNascimento.deleteMany({
          where: { usuarioId: { in: usuarios } },
        });
        await prisma.administrador.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.atleta.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.usuarioPapel.deleteMany({ where: { usuarioId: { in: usuarios } } });
        await prisma.usuario.deleteMany({ where: { id: { in: usuarios } } });
      }
      console.log("LIMPEZA_QA: somente fixtures desta execução removidas.");
    } finally {
      objetos.clear();
      configurarArmazenamentoNascimentoQa(null);
      await prisma.$disconnect();
      if (!concluiu) console.error("QA_HTTP_MOCK_INCOMPLETO: confira a resposta HTTP exibida na falha.");
    }
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
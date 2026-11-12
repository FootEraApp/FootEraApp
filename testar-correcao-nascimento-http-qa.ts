import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prepararEvidenciaNascimentoQA } from "./testar-correcao-nascimento-evidencia-fixture-qa.js";

function exigirAmbienteQA(): void {
  assert.equal(process.env.NODE_ENV, "test");

  const url = new URL(process.env.DATABASE_URL ?? "");

  assert.ok(
    ["postgres:", "postgresql:"].includes(url.protocol)
  );
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "5433");
  assert.equal(url.pathname, "/footera_billing_qa");

  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(process.env.ENABLE_BILLING_SCHEDULER, "false");
  assert.equal(
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,
    "false"
  );
  assert.equal(process.env.ENABLE_ACCOUNT_PURGE, "false");
}

exigirAmbienteQA();

// Segredo exclusivo do teste, definido antes
// de importar o middleware de autenticação.
process.env.JWT_SECRET =
  `QA_HTTP_NASCIMENTO_${randomUUID()}_${randomUUID()}`;

async function main(): Promise<void> {
  const { default: express } = await import("express");
  const { default: jwt } = await import("jsonwebtoken");

  const { prisma } = await import("./server/prisma.js");

  const { default: rotas } = await import(
    "./server/routes/adminCorrecaoNascimento.js"
  );

  const { default: rotasUsuario } = await import(
    "./server/routes/correcaoNascimento.js"
    );

  const { solicitarCorrecaoNascimento } = await import(
    "./server/services/correcaoNascimentoService.js"
  );

  const ids: string[] = [];

  const app = express();

  const marcador =
    `qa_http_nasc_${randomUUID().replace(/-/g, "")}`;

  const nascimento = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`);

  let servidor: ReturnType<typeof app.listen> | undefined;
  let baseURL = "";
  let aprovados = 0;
  let concluiu = false;

  function ok(condicao: unknown, mensagem: string): void {
    assert.ok(condicao, mensagem);

    console.log(
      `APROVADO ${String(++aprovados).padStart(2, "0")} — ${mensagem}`
    );
  }

  async function criarUsuario(rotulo: string) {
    const usuario = await prisma.usuario.create({
      data: {
        id: randomUUID(),
        nome: `QA HTTP Nascimento ${rotulo}`,
        nomeDeUsuario:
          `${marcador}_${rotulo}`.slice(0, 64),
        email:
          `${marcador}_${rotulo}@example.invalid`,
        senhaHash: `SOMENTE_QA_${marcador}`,
        tipo: "Atleta",
        verified: true,
        dataNascimento: nascimento("1990-05-17"),
        aniversarioElegivelApartirDe:
          new Date(Date.now() - 60 * 86_400_000),
      },
    });

    ids.push(usuario.id);

    // Contexto necessário para resolveUserContext.
    await prisma.atleta.create({
      data: {
        usuarioId: usuario.id,
        idade: 36,
        categoria: ["Livre"],
        dataNascimento: nascimento("1990-05-17"),
      },
    });

    return usuario;
  }

  function token(
    usuario: { id: string; tokenVersion: number },
    versao?: number
  ) {
    return jwt.sign(
      {
        id: usuario.id,
        tokenVersion: versao ?? usuario.tokenVersion,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "10m" }
    );
  }

  async function requisitar(
    metodo: "GET" | "POST",
    caminho: string,
    jwtToken?: string,
    body?: Record<string, unknown>
  ): Promise<{ status: number; body: any }> {
    const resposta = await fetch(
      `${baseURL}${caminho}`,
      {
        method: metodo,
        headers: {
          ...(jwtToken
            ? { Authorization: `Bearer ${jwtToken}` }
            : {}),
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        ...(body
          ? { body: JSON.stringify(body) }
          : {}),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const texto = await resposta.text();
    let conteudo: any = null;

    try {
      conteudo = texto ? JSON.parse(texto) : null;
    } catch {
      conteudo = { texto };
    }

    return {
      status: resposta.status,
      body: conteudo,
    };
  }

  const caminho =
    "/api/admin/correcoes-nascimento";

  const aprovacao = {
    motivoDecisao:
      "Documento conferido manualmente no teste QA HTTP.",
    verificacaoRef:
      "QA-HTTP-DOCUMENTO-FICTICIO-001",
    confirmacaoDocumental: true,
  };

  try {
    const db = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(
      db[0]?.nome,
      "footera_billing_qa",
      "BANCO_REAL_DIFERENTE_DO_QA"
    );

    console.log(
      "[QA] Banco confirmado:",
      db[0]?.nome
    );

    // Usuários exclusivamente fictícios.
    const comum =
      await criarUsuario("comum");

    const adminBase =
      await criarUsuario("base");

    const adminAvancado =
      await criarUsuario("avancado");

    const adminPerformance =
      await criarUsuario("performance");

    const contaBloqueada =
      await criarUsuario("bloqueado");

    const alvoAprovacao =
      await criarUsuario("aprovacao");

    const alvoRecusa =
      await criarUsuario("recusa");

    await prisma.administrador.createMany({
      data: [
        {
          usuarioId: adminBase.id,
          cargo: "QA",
          nivel: "Base",
        },
        {
          usuarioId: adminAvancado.id,
          cargo: "QA",
          nivel: "Avancado",
        },
        {
          usuarioId: adminPerformance.id,
          cargo: "QA",
          nivel: "Performance",
        },
      ],
    });

    await prisma.usuario.update({
      where: {
        id: contaBloqueada.id,
      },
      data: {
        blockedAt: new Date(),
        blockedReason:
          "Bloqueio somente QA",
      },
    });

    // Solicitação que será aprovada.
    const solicitacaoA =
      await solicitarCorrecaoNascimento({
        usuarioId: alvoAprovacao.id,
        dataSolicitada: "1991-05-17",
        motivo:
          "Correção fictícia para o teste de autorização HTTP.",
      });

    // Solicitação que será recusada.
    const solicitacaoR =
      await solicitarCorrecaoNascimento({
        usuarioId: alvoRecusa.id,
        dataSolicitada: "1992-05-17",
        motivo:
          "Correção fictícia para testar recusa por HTTP.",
      });

    app.use(
      express.json({ limit: "32kb" })
    );

    app.use(caminho, rotas);

    app.use(
    "/api/correcao-nascimento",
    rotasUsuario
    );

    app.use((_req, res) => {
      res.status(404).json({
        code: "NOT_FOUND",
      });
    });

    servidor = await new Promise<
        ReturnType<typeof app.listen>
        >((resolve, reject) => {
        const s = app.listen(0, "127.0.0.1");

        s.once("error", reject);

        s.once("listening", () => {
            resolve(s);
        });
        });

    const endereco = servidor.address();

    assert.ok(
      endereco &&
      typeof endereco !== "string"
    );

    baseURL =
      `http://127.0.0.1:${endereco.port}`;

    const tComum = token(comum);
    const tBase = token(adminBase);
    const tAvancado = token(adminAvancado);
    const tPerformance = token(adminPerformance);
    const tBloqueado = token(contaBloqueada);

    // A infraestrutura documental deve continuar
    // desativada durante este teste offline.
    assert.equal(
    process.env.ENABLE_BIRTH_DOCUMENT_UPLOAD,
    "false"
    );

    const rotaUsuario = "/api/correcao-nascimento";

    // Teste 1 — Disponibilidade exige autenticação.
    let testeDoc = await requisitar(
    "GET",
    `${rotaUsuario}/disponibilidade-documento`
    );

    ok(
    testeDoc.status === 401,
    "Disponibilidade documental exige autenticação"
    );

    // Teste 2 — Upload aparece indisponível.
    testeDoc = await requisitar(
    "GET",
    `${rotaUsuario}/disponibilidade-documento`,
    tComum
    );

    ok(
    testeDoc.status === 200 &&
        testeDoc.body?.uploadDisponivel === false,
    "API informa upload documental desativado"
    );

    // Teste 3 — Não cria nova solicitação.
    const quantidadeAntes =
    await prisma.solicitacaoCorrecaoNascimento.count({
        where: {
        usuarioId: comum.id,
        },
    });

    testeDoc = await requisitar(
    "POST",
    `${rotaUsuario}/solicitar`,
    tComum,
    {
        dataSolicitada: "1991-05-17",
        motivo:
        "Teste fictício de solicitação bloqueada porque o upload está desativado.",
    }
    );

    ok(
    testeDoc.status === 503 &&
        testeDoc.body?.code ===
        "BIRTH_DOCUMENT_UPLOAD_UNAVAILABLE",
    "Criação de solicitação bloqueada sem armazenamento"
    );

    // Teste 4 — Nenhum registro foi criado.
    const quantidadeDepois =
    await prisma.solicitacaoCorrecaoNascimento.count({
        where: {
        usuarioId: comum.id,
        },
    });

    ok(
    quantidadeDepois === quantidadeAntes,
    "Solicitação bloqueada não grava registros"
    );

    const tAntigo = token(
      comum,
      comum.tokenVersion + 1
    );

    let r = await requisitar(
      "GET",
      caminho
    );

    ok(
      r.status === 401,
      "GET sem token retorna 401"
    );

    r = await requisitar(
      "GET",
      caminho,
      "jwt.invalido.qa"
    );

    ok(
      r.status === 401,
      "GET com JWT inválido retorna 401"
    );

    r = await requisitar(
      "GET",
      caminho,
      tComum
    );

    ok(
      r.status === 403,
      "GET com usuário comum retorna 403"
    );

    r = await requisitar(
      "GET",
      caminho,
      tBase
    );

    ok(
      r.status === 200 &&
      Array.isArray(r.body?.solicitacoes),
      "Administrador Base consegue listar solicitações"
    );

    r = await requisitar(
      "GET",
      caminho,
      tAvancado
    );

    ok(
      r.status === 200,
      "Administrador Avançado consegue listar solicitações"
    );

    r = await requisitar(
      "GET",
      caminho,
      tPerformance
    );

    ok(
      r.status === 200,
      "Administrador Performance consegue listar solicitações"
    );

    r = await requisitar(
      "GET",
      caminho,
      tAntigo
    );

    ok(
      r.status === 401 &&
      r.body?.code === "TOKEN_VERSION_MISMATCH",
      "JWT com versão incorreta é rejeitado"
    );

    r = await requisitar(
      "GET",
      caminho,
      tBloqueado
    );

    ok(
      r.status === 403 &&
      r.body?.code === "ACCOUNT_BLOCKED",
      "Conta bloqueada não acessa a rota"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tComum,
      aprovacao
    );

    ok(
      r.status === 403,
      "Usuário comum não pode aprovar"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tBase,
      aprovacao
    );

    ok(
      r.status === 403,
      "Administrador Base não pode aprovar"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tAvancado,
      aprovacao
    );

    ok(
      r.status === 403,
      "Administrador Avançado não pode aprovar"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tPerformance,
      {
        motivoDecisao:
          aprovacao.motivoDecisao,
      }
    );

    ok(
      r.status === 422 &&
      r.body?.code ===
        "DOCUMENT_VERIFICATION_REQUIRED",
      "Performance precisa confirmar a verificação documental"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tPerformance,
      aprovacao
    );
    ok(
      r.status === 422 && r.body?.code === "BIRTH_DOCUMENT_REQUIRED",
      "Checkbox e referência não substituem um documento"
    );

    const evidenciaQa = await prepararEvidenciaNascimentoQA(
    prisma,
    solicitacaoA.id,
    adminPerformance.id
    );

    // Simula documento ainda não liberado.
    await prisma.documentoCorrecaoNascimento.update({
    where: { id: evidenciaQa.id },
    data: {
        statusSeguranca: "PENDENTE",
        analisadoEm: null,
        scannerRef: null,
    },
    });

    r = await requisitar(
    "POST",
    `${caminho}/${solicitacaoA.id}/aprovar`,
    tPerformance,
    aprovacao
    );

    ok(
    r.status === 422 &&
        r.body?.code === "BIRTH_DOCUMENT_SECURITY_NOT_CLEARED",
    "Documento em quarentena não permite aprovação"
    );

    // Somente QA: restaura a evidência fictícia liberada.
    await prisma.documentoCorrecaoNascimento.update({
    where: { id: evidenciaQa.id },
    data: {
        statusSeguranca: "SEGURO",
        analisadoEm: new Date(),
        scannerRef: `QA_FIXTURE_${randomUUID()}`,
    },
    });

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tPerformance,
      aprovacao
    );

    ok(
      r.status === 200 &&
      r.body?.status === "APROVADA",
      "Superadministrador aprova pela API HTTP"
    );

    const [
      aprovado,
      pedidoA,
      logsA,
    ] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({
        where: { id: alvoAprovacao.id },
      }),

      prisma.solicitacaoCorrecaoNascimento
        .findUniqueOrThrow({
          where: { id: solicitacaoA.id },
        }),

      prisma.logAuditoria.findMany({
        where: {
          usuarioId: adminPerformance.id,
          entidadeId: solicitacaoA.id,
          acao: "CORRECAO_NASCIMENTO_APROVADA",
        },
      }),
    ]);

    ok(
      aprovado.dataNascimento
        ?.toISOString()
        .slice(0, 10) === "1991-05-17",
      "Nascimento atualizado após aprovação HTTP"
    );

    ok(
      pedidoA.status === "APROVADA" &&
      pedidoA.revisadoPorId ===
        adminPerformance.id,
      "Solicitação registra aprovação e revisor"
    );

    ok(
      logsA.length === 1 &&
      logsA[0]?.acao ===
        "CORRECAO_NASCIMENTO_APROVADA",
      "Aprovação gerou exatamente uma auditoria"
    );

    ok(
      !!aprovado.aniversarioElegivelApartirDe &&
      aprovado.aniversarioElegivelApartirDe.getTime() >=
        Date.now() + 29 * 86_400_000,
      "Carência de aniversário aplicada"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoA.id}/aprovar`,
      tPerformance,
      aprovacao
    );

    ok(
      r.status === 409 &&
      r.body?.code ===
        "REQUEST_ALREADY_DECIDED",
      "Segunda aprovação por HTTP retorna 409"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoR.id}/recusar`,
      tBase,
      {
        motivoDecisao:
          "Documento fictício insuficiente para aprovação.",
      }
    );

    ok(
      r.status === 403,
      "Administrador Base não pode recusar"
    );

    r = await requisitar(
      "POST",
      `${caminho}/${solicitacaoR.id}/recusar`,
      tPerformance,
      {
        motivoDecisao:
          "Documento fictício insuficiente para aprovação.",
      }
    );

    ok(
      r.status === 200 &&
      r.body?.status === "REJEITADA",
      "Superadministrador recusa pela API HTTP"
    );

    const [
      recusado,
      pedidoR,
      logsR,
    ] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({
        where: { id: alvoRecusa.id },
      }),

      prisma.solicitacaoCorrecaoNascimento
        .findUniqueOrThrow({
          where: { id: solicitacaoR.id },
        }),

      prisma.logAuditoria.count({
        where: {
          usuarioId: adminPerformance.id,
          entidadeId: solicitacaoR.id,
          acao: "CORRECAO_NASCIMENTO_REJEITADA",
        },
      }),
    ]);

    ok(
      recusado.dataNascimento
        ?.toISOString()
        .slice(0, 10) === "1990-05-17" &&
      pedidoR.status === "REJEITADA" &&
      logsR === 1,
      "Recusa preserva nascimento e registra auditoria"
    );

    concluiu = true;

    console.log(
      `\nRESULTADO: ${aprovados}/${aprovados} verificações HTTP aprovadas.`
    );

    console.log(
      "NÃO COBERTO: documentação real, interface, menores e múltiplas instâncias."
    );
  } finally {
    if (servidor) {
      servidor.closeIdleConnections?.();

      await new Promise<void>(
        (resolve, reject) => {
          servidor!.close((erro) =>
            erro ? reject(erro) : resolve()
          );
        }
      );
    }

    try {
      // Limpeza restrita a IDs desta execução.
      if (ids.length) {
        await prisma.logAuditoria.deleteMany({
          where: {
            usuarioId: { in: ids },
          },
        });

        await prisma
          .solicitacaoCorrecaoNascimento
          .deleteMany({
            where: {
              usuarioId: { in: ids },
            },
          });

        await prisma.atleta.deleteMany({
          where: {
            usuarioId: { in: ids },
          },
        });

        await prisma.administrador.deleteMany({
          where: {
            usuarioId: { in: ids },
          },
        });

        await prisma.usuarioPapel.deleteMany({
          where: {
            usuarioId: { in: ids },
          },
        });

        await prisma.usuario.deleteMany({
          where: {
            id: { in: ids },
          },
        });
      }

      console.log(
        "LIMPEZA_QA: apenas fixtures desta execução removidas."
      );
    } finally {
      await prisma.$disconnect();
    }

    if (!concluiu) {
      console.error(
        "QA_HTTP_INCOMPLETO: verificar erro anterior."
      );
    }
  }
}

main().catch((erro) => {
  console.error(
    "CORRECAO_NASCIMENTO_HTTP_QA_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
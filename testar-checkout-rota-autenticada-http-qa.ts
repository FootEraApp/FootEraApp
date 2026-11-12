
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";

async function main() {
  const db = new URL(
    process.env.DATABASE_URL ?? ""
  );

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_REAL !== "false" ||
    process.env.ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(db.hostname) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa" ||
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "QA_AMBIENTE_INSEGURO_OU_JWT_SECRET_AUSENTE"
    );
  }

  const { prisma } = await import(
    "./server/prisma.js"
  );

  const { resolveUserContext } = await import(
    "./server/services/planResolver.js"
  );

  const { default: billingRoutes } = await import(
    "./server/routes/billing.js"
  );

  const {
    prepararCheckoutAtomico,
    fingerprintCheckout,
  } = await import(
    "./server/services/billingCheckoutOperacaoService.js"
  );

  type ServidorExpress =
    ReturnType<ReturnType<typeof express>["listen"]>;

  type ContextoAtivo =
    NonNullable<
      Awaited<
        ReturnType<typeof resolveUserContext>
      >["activeContext"]
    >;

  let server: ServidorExpress | null = null;
  let pagamentoId: string | null = null;
  let operacaoId: string | null = null;
  let sucesso = false;

  try {
    const banco = await prisma.$queryRaw<
      Array<{ nome: string }>
    >`
      SELECT current_database() AS nome
    `;

    assert.equal(
      banco[0]?.nome,
      "footera_billing_qa"
    );

    const usuarios = await prisma.usuario.findMany({
      where: {
        verified: true,
        deletedAt: null,
        blockedAt: null,
        status: "ATIVO",
      },
      select: {
        id: true,
        tokenVersion: true,
      },
      take: 100,
    });

    let escolhido: {
      id: string;
      tokenVersion: number;
      contexto: ContextoAtivo;
    } | null = null;

    for (const usuario of usuarios) {
      try {
        const ctx = await resolveUserContext(
          usuario.id
        );

        if (
          ctx.activeContext?.kind === "PERSONAL" &&
          String(
            ctx.activeContext.tipoUsuario ?? ""
          ).toLowerCase() === "atleta"
        ) {
          escolhido = {
            id: usuario.id,
            tokenVersion: usuario.tokenVersion,
            contexto: ctx.activeContext,
          };

          break;
        }
      } catch {
        // Ignora contas sem contexto ativo válido.
      }
    }

    if (!escolhido) {
      throw new Error(
        "QA_SEM_ATLETA_VERIFICADO_COM_CONTEXTO_ATIVO"
      );
    }

    const dono = escolhido;

    const chaveCliente = randomUUID();

    const { pagamento, operacao } =
      await prepararCheckoutAtomico({
        usuarioId: dono.id,
        chaveCliente,
        modalidade: "PIX_INDIVIDUAL",

        fingerprintRequisicao:
          fingerprintCheckout({
            teste: "HTTP_AUTH_QA",
            chaveCliente,
          }),

        criarPagamento: (tx) =>
          tx.pagamento.create({
            data: {
              usuarioId: dono.id,
              plano: "ATLETA_PRO",
              periodicidade: "Mensal",
              metodo: "PIX",
              status: "PENDENTE",
              provider: "INTERNAL_FAKE",
              valor: "19.90",
              moeda: "BRL",
              contextoKind: "PERSONAL",
              contextoTipo: String(
                dono.contexto.tipoUsuario
              ),
              contextoPerfilId:
                dono.contexto.profileId ??
                dono.contexto.tipoUsuarioId ??
                null,
              meta: {
                qaHttpAuth: true,
              },
            },
          }),
      });

    pagamentoId = pagamento.id;
    operacaoId = operacao.id;

    // Servidor temporário, somente para a rota de billing.
    // Não inicia os jobs do server/index.ts.
    const app = express();

    app.use(express.json());

    app.use(
      "/api/billing",
      billingRoutes
    );

    const iniciado = app.listen(
      0,
      "127.0.0.1"
    );

    server = iniciado;

    await new Promise<void>(
      (resolve, reject) => {
        if (iniciado.listening) {
          resolve();
          return;
        }

        iniciado.once("listening", resolve);
        iniciado.once("error", reject);
      }
    );

    const endereco = iniciado.address();

    assert.ok(
      endereco &&
      typeof endereco !== "string",
      "QA_SERVIDOR_SEM_PORTA"
    );

    const baseUrl =
      `http://127.0.0.1:${endereco.port}`;

    const endpoint =
      `${baseUrl}/api/billing/checkout-operacao/${chaveCliente}`;

    // TESTE 1 - Sem autenticação.
    const semToken = await fetch(endpoint);

    assert.equal(
      semToken.status,
      401
    );

    console.log(
      "✔ Sem JWT: 401"
    );

    // TESTE 2 - JWT inválido.
    const tokenInvalido = await fetch(
      endpoint,
      {
        headers: {
          Authorization: "Bearer invalido",
        },
      }
    );

    assert.equal(
      tokenInvalido.status,
      401
    );

    console.log(
      "✔ JWT inválido: 401"
    );

    // JWT válido somente para esta execução QA.
    const jwtValido = jwt.sign(
      {
        id: dono.id,
        tokenVersion: dono.tokenVersion,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "5m",
      }
    );

    // TESTE 3 - Operação do próprio usuário.
    const respostaDono = await fetch(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${jwtValido}`,
        },
      }
    );

    const corpo = await respostaDono.json() as {
      operacao?: {
        pagamentoId?: string;
        status?: string;
        podeIniciarNovaCobranca?: boolean;
      };
      code?: string;
    };

    assert.equal(
      respostaDono.status,
      200,
      JSON.stringify(corpo)
    );

    assert.equal(
      corpo.operacao?.pagamentoId,
      pagamentoId
    );

    assert.equal(
      corpo.operacao?.status,
      "PREPARADA"
    );

    assert.equal(
      corpo.operacao?.podeIniciarNovaCobranca,
      false
    );

    console.log(
      "✔ JWT válido e contexto ativo: 200"
    );

    // TESTE 4 - Chave inexistente.
    const respostaInexistente = await fetch(
      `${baseUrl}/api/billing/checkout-operacao/${randomUUID()}`,
      {
        headers: {
          Authorization: `Bearer ${jwtValido}`,
        },
      }
    );

    assert.equal(
      respostaInexistente.status,
      404
    );

    console.log(
      "✔ Operação inexistente: 404"
    );

    // TESTE 5: chave inválida
    const respostaChaveInvalida = await fetch(
    `${baseUrl}/api/billing/checkout-operacao/abc`,
    {
        headers: {
        Authorization: `Bearer ${jwtValido}`,
        },
    }
    );

    assert.equal(
    respostaChaveInvalida.status,
    400
    );

    console.log("✔ Chave inválida: 400");

    // TESTE 6: versão do token desatualizada
    const jwtDesatualizado = jwt.sign(
    {
        id: dono.id,
        tokenVersion: dono.tokenVersion + 1,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "5m" }
    );

    const respostaTokenDesatualizado = await fetch(
    endpoint,
    {
        headers: {
        Authorization: `Bearer ${jwtDesatualizado}`,
        },
    }
    );

    assert.equal(
    respostaTokenDesatualizado.status,
    401
    );

    console.log("✔ Sessão desatualizada: 401");

    // TESTE 7 — Outro usuário verificado não podef
    // consultar a operação do dono.

    const outroUsuario = await prisma.usuario.findFirst({
    where: {
        id: { not: dono.id },
        verified: true,
        deletedAt: null,
        blockedAt: null,
        status: "ATIVO",
    },
    select: {
        id: true,
        tokenVersion: true,
    },
    });

    if (!outroUsuario) {
    throw new Error(
        "QA_SEM_SEGUNDO_USUARIO_VERIFICADO"
    );
    }

    const jwtOutroUsuario = jwt.sign(
    {
        id: outroUsuario.id,
        tokenVersion: outroUsuario.tokenVersion,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "5m" }
    );

    const respostaOutroUsuario = await fetch(
    endpoint,
    {
        headers: {
        Authorization: `Bearer ${jwtOutroUsuario}`,
        },
    }
    );

    // O middleware pode negar o contexto ausente
    // antes de chegar ao controller.
    assert.ok(
    [403, 404].includes(respostaOutroUsuario.status),
    `Acesso indevido: ${respostaOutroUsuario.status}`
    );

    console.log(
    "✔ Outro usuário não acessa o checkout"
    );
    
    // TESTE 8 - Checkout inconclusivo com provedor
    // local incompatível não consulta o Mercado Pago.
    await prisma.billingCheckoutOperacao.update({
      where: { id: operacaoId! },
      data: {
        status: "INCONCLUSIVA",
        providerRef: null,
        ultimoErro: "Resposta externa perdida - QA",
      },
    });

    const consultarOperacaoQa = async () => {
      const resposta = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwtValido}`,
        },
      });

      const dados = await resposta.json() as {
        operacao?: {
          status?: string;
          podeIniciarNovaCobranca?: boolean;
          conciliacaoExterna?: {
            consultada?: boolean;
            acao?: string;
            motivo?: string;
          } | null;
        };
      };

      assert.equal(resposta.status, 200);
      assert.equal(dados.operacao?.status, "INCONCLUSIVA");
      assert.equal(
        dados.operacao?.podeIniciarNovaCobranca,
        false
      );

      return dados.operacao!;
    };

    const estadoIncompativel =
      await consultarOperacaoQa();

    assert.equal(
      estadoIncompativel.conciliacaoExterna?.motivo,
      "ESTADO_FINANCEIRO_INCOMPATIVEL"
    );

    assert.equal(
      estadoIncompativel.conciliacaoExterna?.consultada,
      false
    );

    console.log(
      "✔ Checkout inconclusivo com provedor incompatível"
    );

    // TESTE 9 - Mesmo checkout, agora atribuído
    // ao Mercado Pago, mas sem referência externa.
    // Com a busca desabilitada, exige revisão.
    await prisma.pagamento.update({
      where: { id: pagamentoId! },
      data: {
        provider: "MERCADOPAGO",
        providerRef: null,
      },
    });

    const semReferencia =
      await consultarOperacaoQa();

    assert.equal(
      semReferencia.conciliacaoExterna?.motivo,
      "IDENTIDADE_EXTERNA_INSUFICIENTE"
    );

    assert.equal(
      semReferencia.conciliacaoExterna?.consultada,
      false
    );

    console.log(
      "✔ Checkout sem referência externa mantém bloqueio"
    );

    // TESTE 10 - Referências externas divergentes
    // nunca podem ser reconciliadas automaticamente.
    await prisma.billingCheckoutOperacao.update({
      where: { id: operacaoId! },
      data: {
        providerRef: "123456789",
      },
    });

    await prisma.pagamento.update({
      where: { id: pagamentoId! },
      data: {
        providerRef: "987654321",
      },
    });

    const divergente =
      await consultarOperacaoQa();

    assert.equal(
      divergente.conciliacaoExterna?.motivo,
      "REFERENCIAS_EXTERNAS_DIVERGENTES"
    );

    assert.equal(
      divergente.conciliacaoExterna?.consultada,
      false
    );

    console.log(
      "✔ Referências divergentes exigem revisão"
    );

    // Nenhuma consulta deve confirmar a operação.
    const operacaoAposConsultas =
      await prisma.billingCheckoutOperacao.findUniqueOrThrow({
        where: { id: operacaoId! },
      });

    assert.equal(
      operacaoAposConsultas.status,
      "INCONCLUSIVA"
    );

    const pagamentoAposConsultas =
      await prisma.pagamento.findUniqueOrThrow({
        where: { id: pagamentoId! },
      });

    assert.equal(
      pagamentoAposConsultas.status,
      "PENDENTE"
    );

    // Verifica que não houve concessão de benefícios.
    assert.equal(
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId,
        },
      }),
      0
    );

    sucesso = true;

    console.log(
      "\nRESULTADO: 10/10"
    );
  } finally {
    if (server) {
      const servidorParaFechar = server;

      await new Promise<void>(
        (resolve, reject) => {
          servidorParaFechar.close((erro) => {
            if (erro) {
              reject(erro);
              return;
            }

            resolve();
          });
        }
      );
    }

    if (
      sucesso &&
      operacaoId &&
      pagamentoId
    ) {
      await prisma.billingCheckoutOperacao.delete({
        where: {
          id: operacaoId,
        },
      });

      await prisma.pagamento.delete({
        where: {
          id: pagamentoId,
        },
      });

      console.log(
        "[QA] Fixtures HTTP removidas"
      );
    } else if (pagamentoId) {
      console.warn(
        "[QA] Fixture preservada para auditoria:",
        {
          pagamentoId,
          operacaoId,
        }
      );
    }

    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(
    "QA_HTTP_AUTH_FALHOU:",
    erro
  );

  process.exitCode = 1;
});
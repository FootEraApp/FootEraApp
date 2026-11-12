
/**
 * FOOTERA — QA CUPOM 20PARABENS
 * Confirmação e cancelamento via webhook HTTP.
 *
 * Banco permitido:
 * 127.0.0.1:5433/footera_billing_qa
 *
 * Não chama Mercado Pago real.
 * Não executa estornos.
 *
 * Verifica:
 * - Checkout fake com desconto;
 * - HMAC inválido;
 * - Aprovação consultando mock MP;
 * - Consumo da reserva;
 * - Resgate único;
 * - Provisionamento do evento;
 * - Webhook repetido;
 * - Cancelamento e liberação da reserva.
 *
 * Limitação: simula a mudança da data de nascimento,
 * mas não avança o relógio até o dia seguinte.
 */

import assert from "node:assert/strict";
import {
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

// ======================================================
// 1. PROTEÇÃO DO AMBIENTE
// ======================================================

function exigirAmbienteQa(): void {
  const db = new URL(process.env.DATABASE_URL ?? "");

  assert.equal(process.env.NODE_ENV, "test");

  assert.ok(
    ["postgresql:", "postgres:"].includes(db.protocol),
    "QA_PROTOCOLO_INVALIDO"
  );

  assert.ok(
    ["127.0.0.1", "localhost"].includes(db.hostname),
    "QA_HOST_INVALIDO"
  );

  assert.equal(db.port, "5433");
  assert.equal(db.pathname, "/footera_billing_qa");

  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");

  assert.equal(
    process.env.BILLING_CUPOM_RESERVA_QA,
    "true"
  );

  assert.equal(
    process.env.ENABLE_BILLING_SCHEDULER,
    "false"
  );

  assert.equal(
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER,
    "false"
  );

  for (const chave of [
    "ENABLE_ACCOUNT_PURGE",
    "ENABLE_EVENT_REFUNDS_REAL",
    "ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED",
    "BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED",
  ]) {
    assert.equal(
      process.env[chave],
      "false",
      `QA_VARIAVEL_INSEGURA_${chave}`
    );
  }
}

exigirAmbienteQa();

// Credenciais exclusivas deste processo de teste.
// Devem ser definidas ANTES de importar as rotas.

process.env.JWT_SECRET =
  randomBytes(48).toString("hex");

process.env.MP_WEBHOOK_SECRET =
  randomBytes(48).toString("hex");

// ======================================================
// 2. IDENTIFICAÇÃO DAS FIXTURES
// ======================================================

const marcador =
  `qa_birth_wh_${randomUUID().replace(/-/g, "")}`;

const usuariosCriados: string[] = [];
const pagamentosCriados: string[] = [];
const eventosCriados: string[] = [];

let servidor: ReturnType<Express["listen"]> | null =
  null;

let totalAprovados = 0;
let testesConcluidos = false;

function aprovado(
  condicao: unknown,
  descricao: string
): void {
  assert.ok(condicao, descricao);

  totalAprovados++;

  console.log(
    `APROVADO ${String(totalAprovados).padStart(2, "0")} — ${descricao}`
  );
}

// ======================================================
// 3. DATA CIVIL EM BRASÍLIA
// ======================================================

function hojeBrasil() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const numero = (campo: string) =>
    Number(
      partes.find((p) => p.type === campo)?.value
    );

  return {
    ano: numero("year"),
    mes: numero("month"),
    dia: numero("day"),
  };
}

const hoje = hojeBrasil();

function nascimentoQa(deslocamentoDias = 0): Date {
  return new Date(
    Date.UTC(
      2000,
      hoje.mes - 1,
      hoje.dia + deslocamentoDias
    )
  );
}

// ======================================================
// 4. EXECUÇÃO PRINCIPAL
// ======================================================

async function main(): Promise<void> {
  const { prisma } =
    await import("./server/prisma.js");

  const express =
    (await import("express")).default;

  const jwt =
    (await import("jsonwebtoken")).default;

  const billingRoutes =
    (await import("./server/routes/billing.js")).default;

  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  type UsuarioQa = {
    id: string;
    token: string;
  };

  type CompraQa = {
    pagamentoId: string;
    cupomId: string;
    valor: number;
  };

  type RespostaHttp = {
    status: number;
    data: any;
  };

  const respostasMercadoPago =
    new Map<string, Record<string, unknown>>();

  let mockConfigurado = false;

  // ====================================================
  // 5. VALIDAR BANCO DE VERDADE
  // ====================================================

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  assert.equal(
    banco[0]?.nome,
    "footera_billing_qa"
  );

  // ====================================================
  // 6. CRIAÇÃO DE USUÁRIO QA
  // ====================================================

  async function criarUsuarioQa(
    sufixo: string
  ): Promise<UsuarioQa> {
    const usuario = await prisma.usuario.create({
      data: {
        nome: `QA Aniversario ${sufixo}`,

        nomeDeUsuario:
          `${marcador}_${sufixo}`.slice(0, 64),

        email:
          `${marcador}_${sufixo}@example.invalid`,

        senhaHash: `QA_${marcador}`,

        tipo: "Atleta",

        verified: true,

        dataNascimento: nascimentoQa(),

        aniversarioElegivelApartirDe: new Date(
          Date.now() - 45 * 86400000
        ),
      },
    });

    usuariosCriados.push(usuario.id);

    await prisma.usuarioPapel.create({
      data: {
        usuarioId: usuario.id,
        papel: "Atleta",
        status: "ATIVO",
      },
    });

    await prisma.atleta.create({
      data: {
        usuarioId: usuario.id,
        idade: 26,
        categoria: [],
        dataNascimento: usuario.dataNascimento,
      },
    });

    const token = jwt.sign(
      {
        id: usuario.id,
        tokenVersion: usuario.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET!,
      {
        algorithm: "HS256",
        expiresIn: "10m",
      }
    );

    return {
      id: usuario.id,
      token,
    };
  }

  // ====================================================
  // 7. SERVIDOR HTTP TEMPORÁRIO
  // ====================================================

  let baseUrl = "";

  async function iniciarServidor(): Promise<void> {
    const app = express();

    app.use(express.json());

    app.use(
      "/api/billing",
      billingRoutes
    );

    servidor = app.listen(0, "127.0.0.1");

    const ativo = servidor;

    await new Promise<void>((resolve, reject) => {
      if (ativo.listening) {
        resolve();
        return;
      }

      ativo.once("listening", resolve);
      ativo.once("error", reject);
    });

    const endereco =
      ativo.address() as AddressInfo;

    baseUrl =
      `http://127.0.0.1:${endereco.port}`;
  }

  // ====================================================
  // 8. REQUISIÇÕES HTTP
  // ====================================================

  async function postCheckout(
    token: string,
    body: Record<string, unknown>
  ): Promise<RespostaHttp> {
    const resposta = await fetch(
      `${baseUrl}/api/billing/checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    return {
      status: resposta.status,
      data: await resposta.json(),
    };
  }

  function gerarAssinatura(
    pagamentoExternoId: string,
    requestId: string,
    assinaturaValida: boolean
  ) {
    const ts =
      String(Math.floor(Date.now() / 1000));

    const manifesto =
      `id:${pagamentoExternoId.toLowerCase()};` +
      `request-id:${requestId};` +
      `ts:${ts};`;

    const segredo = assinaturaValida
      ? process.env.MP_WEBHOOK_SECRET!
      : "segredo-incorreto-qa";

    const v1 = createHmac("sha256", segredo)
      .update(manifesto)
      .digest("hex");

    return {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${v1}`,
    };
  }

  async function enviarWebhook(
    pagamentoExternoId: string,
    assinaturaValida = true
  ): Promise<RespostaHttp> {
    const requestId = randomUUID();

    const resposta = await fetch(
      `${baseUrl}/api/billing/mercadopago/webhook` +
      `?data.id=${encodeURIComponent(pagamentoExternoId)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...gerarAssinatura(
            pagamentoExternoId,
            requestId,
            assinaturaValida
          ),
        },
        body: JSON.stringify({
          type: "payment",
          data: {
            id: pagamentoExternoId,
          },
        }),
      }
    );

    return {
      status: resposta.status,
      data: await resposta.json(),
    };
  }

  // ====================================================
  // 9. CRIAR PAGAMENTO FAKE E PREPARAR MOCK MP
  // ====================================================

  async function criarCompraQa(
    usuario: UsuarioQa,
    eventoId: string,
    referenciaExterna: string,
    statusMercadoPago:
      | "approved"
      | "cancelled"
  ): Promise<CompraQa> {
    const resposta = await postCheckout(
      usuario.token,
      {
        planoId: `EVENTO:${eventoId}`,
        periodicidade: "Mensal",
        metodo: "PIX",
        cupom: "20PARABENS",
        chaveCliente: randomUUID(),

        pagador: {
          nome: "Comprador QA",
          email: `${marcador}@example.invalid`,
        },
      }
    );

    assert.equal(
      resposta.status,
      200,
      `CHECKOUT_FALHOU: ${JSON.stringify(resposta.data)}`
    );

    const pagamentoId = String(
      resposta.data.pagamento?.id ?? ""
    );

    assert.ok(
      pagamentoId,
      "CHECKOUT_SEM_PAGAMENTO_ID"
    );

    pagamentosCriados.push(pagamentoId);

    const pagamentoFake =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: pagamentoId,
        },
      });

    assert.equal(
      pagamentoFake.provider,
      "INTERNAL_FAKE"
    );

    assert.equal(
      pagamentoFake.status,
      "PENDENTE"
    );

    assert.ok(
      pagamentoFake.providerRef?.startsWith("FAKE-"),
      "REFERENCIA_FAKE_INVALIDA"
    );

    const reserva =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: {
          pagamentoId,
        },
      });

    assert.equal(
      reserva.status,
      "RESERVADA"
    );

    assert.equal(
      reserva.usuarioId,
      usuario.id
    );

    assert.equal(
      reserva.cupomId,
      pagamentoFake.cupomId
    );

    // O checkout fake não cria BillingCheckoutOperacao.
    //
    // Exclusivamente no banco QA, simulamos a associação
    // da cobrança já existente a uma referência numérica
    // do Mercado Pago.
    //
    // Isto NÃO cria cobrança externa e NÃO comprova
    // o funcionamento do envio real ao provedor.

    const alteracao =
      await prisma.pagamento.updateMany({
        where: {
          id: pagamentoId,
          usuarioId: usuario.id,
          provider: "INTERNAL_FAKE",
          providerRef: pagamentoFake.providerRef,
          status: "PENDENTE",
        },
        data: {
          provider: "MERCADOPAGO",
          providerRef: referenciaExterna,
          pixCopiaECola: "PIX-QA-SIMULADO",
        },
      });

    assert.equal(
      alteracao.count,
      1,
      "QA_ASSOCIACAO_PROVIDER_FALHOU"
    );

    const pagamento =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: pagamentoId,
        },
      });

    assert.equal(
      pagamento.provider,
      "MERCADOPAGO"
    );

    assert.equal(
      pagamento.providerRef,
      referenciaExterna
    );

    assert.ok(
      pagamento.cupomId,
      "PAGAMENTO_SEM_CUPOM"
    );

    // O mock retorna exatamente a identidade e o
    // valor persistidos na cobrança local.

    respostasMercadoPago.set(
      referenciaExterna,
      {
        id: referenciaExterna,
        status: statusMercadoPago,
        status_detail:
          statusMercadoPago === "approved"
            ? "accredited"
            : "by_collector",

        external_reference: pagamentoId,

        metadata: {
          pagamentoId,
        },

        transaction_amount:
          pagamento.valor.toNumber(),

        currency_id: "BRL",
      }
    );

    return {
      pagamentoId,
      cupomId: pagamento.cupomId!,
      valor: pagamento.valor.toNumber(),
    };
  }

  // ====================================================
  // 10. EXECUÇÃO DOS CENÁRIOS
  // ====================================================

  try {
    configurarConsultorMercadoPagoQa(async (id) => {
      const resposta =
        respostasMercadoPago.get(id);

      assert.ok(
        resposta,
        `MOCK_MP_SEM_RESPOSTA_${id}`
      );

      return resposta as any;
    });

    mockConfigurado = true;

    // ----------------------------------------------
    // Fixture: evento de R$ 50,00
    // ----------------------------------------------

    const eventoId = randomUUID();

    await prisma.evento.create({
      data: {
        id: eventoId,

        titulo:
          `QA Aniversario Webhook ${marcador}`,

        descricao:
          "Evento fictício para testar cupom.",

        status: "ABERTO",

        dataEvento: new Date(
          Date.now() + 10 * 86400000
        ),

        inscricaoInicio: new Date(
          Date.now() - 86400000
        ),

        inscricaoFim: new Date(
          Date.now() + 9 * 86400000
        ),

        vagas: 10,
        valorInscricao: "50.00",
        requisitos: [],
        linkInscricao: null,
      },
    });

    eventosCriados.push(eventoId);

    const usuarioAprovado =
      await criarUsuarioQa("aprovado");

    const usuarioCancelado =
      await criarUsuarioQa("cancelado");

    await iniciarServidor();

    // ----------------------------------------------
    // CENÁRIO A — APROVAÇÃO
    // ----------------------------------------------

    const referenciaAprovada =
      `${Date.now()}${randomBytes(4).readUInt32BE(0)}`;

    const compra = await criarCompraQa(
      usuarioAprovado,
      eventoId,
      referenciaAprovada,
      "approved"
    );

    aprovado(
      compra.valor === 40,
      "Evento de R$ 50,00 gera pagamento de R$ 40,00"
    );

    const webhookInvalido =
      await enviarWebhook(
        referenciaAprovada,
        false
      );

    aprovado(
      webhookInvalido.status === 401,
      "Assinatura HMAC inválida é rejeitada"
    );

    const pagamentoAntes =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: compra.pagamentoId,
        },
      });

    aprovado(
      pagamentoAntes.status === "PENDENTE",
      "Webhook inválido não altera pagamento"
    );

    // Simula uma alteração posterior ao checkout,
    // apenas no usuário QA.
    // A confirmação deve usar a reserva original.

    await prisma.usuario.update({
      where: {
        id: usuarioAprovado.id,
      },
      data: {
        dataNascimento: nascimentoQa(1),
      },
    });

    const confirmacao =
      await enviarWebhook(referenciaAprovada);

    assert.equal(
      confirmacao.status,
      200,
      `APROVACAO_WEBHOOK_FALHOU: ${
        JSON.stringify(confirmacao.data)
      }`
    );

    const pagamentoAprovado =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: compra.pagamentoId,
        },
      });

    aprovado(
      pagamentoAprovado.status === "APROVADO",
      "Pagamento aprovado pelo webhook"
    );

    const reservaConsumida =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: {
          pagamentoId: compra.pagamentoId,
        },
      });

    aprovado(
      reservaConsumida.status === "CONSUMIDA",
      "Reserva passa para CONSUMIDA"
    );

    const resgates =
      await prisma.cupomResgate.count({
        where: {
          pagamentoId: compra.pagamentoId,
        },
      });

    aprovado(
      resgates === 1,
      "Exatamente um CupomResgate criado"
    );

    const cupom =
      await prisma.cupom.findUniqueOrThrow({
        where: {
          id: compra.cupomId,
        },
      });

    aprovado(
      cupom.usosAtuais === 1,
      "Cupom incrementado exatamente uma vez"
    );

    const inscricoes =
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,
          usuarioId: usuarioAprovado.id,
          status: "CONFIRMADA",
        },
      });

    aprovado(
      inscricoes === 1,
      "Inscrição no evento confirmada"
    );

    const beneficios =
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId: compra.pagamentoId,
        },
      });

    aprovado(
      beneficios === 1,
      "Evento provisionado uma única vez"
    );

    // ----------------------------------------------
    // CENÁRIO B — WEBHOOK REPETIDO
    // ----------------------------------------------

    const webhookRepetido =
      await enviarWebhook(referenciaAprovada);

    assert.equal(
      webhookRepetido.status,
      200,
      `WEBHOOK_REPETIDO_FALHOU: ${
        JSON.stringify(webhookRepetido.data)
      }`
    );

    const resgatesDepois =
      await prisma.cupomResgate.count({
        where: {
          pagamentoId: compra.pagamentoId,
        },
      });

    const beneficiosDepois =
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId: compra.pagamentoId,
        },
      });

    aprovado(
      resgatesDepois === 1 &&
      beneficiosDepois === 1,
      "Webhook repetido não duplica resgate nem benefício"
    );

    const cupomDepois =
      await prisma.cupom.findUniqueOrThrow({
        where: {
          id: compra.cupomId,
        },
      });

    aprovado(
      cupomDepois.usosAtuais === 1,
      "Webhook repetido não incrementa o cupom novamente"
    );

    // ----------------------------------------------
    // CENÁRIO C — CANCELAMENTO
    // ----------------------------------------------

    const referenciaCancelada =
      `${Date.now()}${randomBytes(4).readUInt32BE(0)}`;

    const compraCancelada =
      await criarCompraQa(
        usuarioCancelado,
        eventoId,
        referenciaCancelada,
        "cancelled"
      );

    aprovado(
      compraCancelada.valor === 40,
      "Pagamento cancelável também tem valor de R$ 40,00"
    );

    const cancelamento =
      await enviarWebhook(referenciaCancelada);

    assert.equal(
      cancelamento.status,
      200,
      `CANCELAMENTO_WEBHOOK_FALHOU: ${
        JSON.stringify(cancelamento.data)
      }`
    );

    const pagamentoCancelado =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: compraCancelada.pagamentoId,
        },
      });

    aprovado(
      pagamentoCancelado.status === "CANCELADO",
      "Pagamento cancelado após consulta ao mock"
    );

    const reservaLiberada =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: {
          pagamentoId: compraCancelada.pagamentoId,
        },
      });

    aprovado(
      reservaLiberada.status === "LIBERADA",
      "Cancelamento libera a reserva"
    );

    const resgatesCancelados =
      await prisma.cupomResgate.count({
        where: {
          pagamentoId: compraCancelada.pagamentoId,
        },
      });

    aprovado(
      resgatesCancelados === 0,
      "Cancelamento não consome o cupom"
    );

    const beneficiosCancelados =
      await prisma.pagamentoBeneficio.count({
        where: {
          pagamentoId: compraCancelada.pagamentoId,
        },
      });

    aprovado(
      beneficiosCancelados === 0,
      "Cancelamento não provisiona benefício"
    );

    testesConcluidos = true;

    console.log(
      `\nRESULTADO: ${totalAprovados} verificações aprovadas.`
    );

    console.log(
      "NÃO COBERTO: relógio após meia-noite, gateway real, " +
      "cartão, chargeback, confirmação de outras categorias."
    );

  } finally {

    // ==================================================
    // 11. LIMPEZA EXCLUSIVA DAS FIXTURES QA
    // ==================================================

    if (mockConfigurado) {
      configurarConsultorMercadoPagoQa(null);
    }

    if (servidor) {
      const ativo = servidor;

      await new Promise<void>((resolve) => {
        ativo.close(() => resolve());
      });

      servidor = null;
    }

    try {
      // Inscrições antes do evento/usuários.
      if (
        usuariosCriados.length > 0 &&
        eventosCriados.length > 0
      ) {
        await prisma.inscricaoEvento.deleteMany({
          where: {
            usuarioId: {
              in: usuariosCriados,
            },
            eventoId: {
              in: eventosCriados,
            },
          },
        });
      }

      if (pagamentosCriados.length > 0) {
        // Benefícios referenciam pagamentos.
        await prisma.pagamentoBeneficio.deleteMany({
          where: {
            pagamentoId: {
              in: pagamentosCriados,
            },
          },
        });

        // Reserva e resgate também dependem
        // dos pagamentos e dos cupons.
        await prisma.cupomReserva.deleteMany({
          where: {
            pagamentoId: {
              in: pagamentosCriados,
            },
          },
        });

        await prisma.cupomResgate.deleteMany({
          where: {
            pagamentoId: {
              in: pagamentosCriados,
            },
          },
        });

        await prisma.billingCheckoutOperacao.deleteMany({
          where: {
            pagamentoId: {
              in: pagamentosCriados,
            },
          },
        });

        await prisma.pagamento.deleteMany({
          where: {
            id: {
              in: pagamentosCriados,
            },
          },
        });
      }

      // Os cupons devem ser apagados depois
      // dos resgates e pagamentos.
      if (usuariosCriados.length > 0) {
        await prisma.cupom.deleteMany({
          where: {
            concedidoParaUsuarioId: {
              in: usuariosCriados,
            },
            codigo: {
              startsWith: "ANIVERSARIO_",
            },
          },
        });

        await prisma.atleta.deleteMany({
          where: {
            usuarioId: {
              in: usuariosCriados,
            },
          },
        });

        await prisma.usuarioPapel.deleteMany({
          where: {
            usuarioId: {
              in: usuariosCriados,
            },
          },
        });
      }

      if (eventosCriados.length > 0) {
        await prisma.evento.deleteMany({
          where: {
            id: {
              in: eventosCriados,
            },
          },
        });
      }

      if (usuariosCriados.length > 0) {
        await prisma.usuario.deleteMany({
          where: {
            id: {
              in: usuariosCriados,
            },
          },
        });
      }

      console.log(
        "LIMPEZA_QA: registros desta execução removidos."
      );

    } catch (erro) {
      console.error(
        "LIMPEZA_QA_FALHOU:",
        {
          usuariosCriados,
          pagamentosCriados,
          eventosCriados,
        }
      );

      console.error(erro);

      throw erro;

    } finally {
      await prisma.$disconnect();
    }
  }
}

main()
  .then(() => {
    if (!testesConcluidos) {
      process.exitCode = 1;
    }
  })
  .catch((erro) => {
    console.error(
      "ANIVERSARIO_CONFIRMACAO_WEBHOOK_QA_FALHOU:",
      erro
    );

    process.exitCode = 1;
  });
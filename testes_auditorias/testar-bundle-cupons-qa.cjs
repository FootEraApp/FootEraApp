
/**
 * FootEra — Testes de cupons, bundles e reservas.
 *
 * Executar APENAS no banco descartável footera_billing_qa.
 *
 * Cenários:
 * - Prévia percentual e fixa
 * - Checkout e snapshot financeiro
 * - Aprovação pelo webhook simulado
 * - Resgate e idempotência
 * - Cupons inválidos
 * - Reserva da última utilização
 * - Concorrência entre dois compradores
 */

"use strict";

const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

dotenv.config({
  path: path.join(
    process.cwd(),
    "server",
    ".env.development"
  ),
  quiet: true,
});

// ============================================================
// 1. PROTEÇÕES DE SEGURANÇA
// ============================================================

const db = new URL(
  process.env.DATABASE_URL || "http://invalid"
);

if (
  !["localhost", "127.0.0.1"].includes(db.hostname) ||
  db.port !== "5433" ||
  db.pathname !== "/footera_billing_qa"
) {
  throw new Error(
    "SEGURANÇA: use localhost:5433/footera_billing_qa"
  );
}

if (process.env.MP_ACCESS_TOKEN) {
  throw new Error(
    "SEGURANÇA: desative MP_ACCESS_TOKEN."
  );
}

if (
  !process.env.JWT_SECRET ||
  !process.env.BILLING_WEBHOOK_SECRET
) {
  throw new Error(
    "JWT_SECRET e BILLING_WEBHOOK_SECRET obrigatórios."
  );
}

const api =
  process.env.FOOTERA_QA_API ||
  "http://127.0.0.1:3001";

if (
  ![
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ].includes(api)
) {
  throw new Error(
    "SEGURANÇA: API deve ser localhost:3001."
  );
}

const prisma = new PrismaClient();

const run =
  `qa-bundle-cupom-${Date.now()}-` +
  crypto.randomBytes(3).toString("hex");

let ok = 0;
let fail = 0;

// ============================================================
// 2. FUNÇÕES AUXILIARES
// ============================================================

function check(condition, label, detail = "") {
  console.log(
    `${condition ? "✔" : "✖"} ${label}` +
    (detail ? ` — ${detail}` : "")
  );

  if (condition) {
    ok++;
  } else {
    fail++;
  }
}

const cents = (value) =>
  Math.round(Number(value) * 100);

async function request(endpoint, data, headers = {}) {
  const response = await fetch(
    `${api}/api/billing/${endpoint}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(25000),
    }
  );

  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
}

// ============================================================
// 3. FUNÇÃO PRINCIPAL
// ============================================================

async function main() {
  console.log(
    `Banco QA: ${db.host}${db.pathname} | Execução: ${run}`
  );

  // ----------------------------------------------------------
  // 3.1. COMPRADOR PRINCIPAL
  // ----------------------------------------------------------

  const buyer = await prisma.usuario.findFirst({
    where: {
      nomeDeUsuario: {
        startsWith: "qa_rec_atleta_",
      },
      verified: true,
      deletedAt: null,
      atleta: {
        isNot: null,
      },
    },
    orderBy: {
      dataCriacao: "desc",
    },
  });

  if (!buyer) {
    throw new Error(
      "Comprador QA Atleta verificado não encontrado."
    );
  }

  const token = jwt.sign(
    {
      id: buyer.id,
      tokenVersion: buyer.tokenVersion,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );

  const auth = {
    authorization: `Bearer ${token}`,
  };

  // ----------------------------------------------------------
  // 3.2. SEGUNDO COMPRADOR PARA CONCORRÊNCIA
  // ----------------------------------------------------------

  const segundoBuyer =
    await prisma.usuario.findFirst({
      where: {
        id: {
          not: buyer.id,
        },
        nomeDeUsuario: {
          startsWith: "qa_rec_atleta_",
        },
        verified: true,
        deletedAt: null,
        atleta: {
          isNot: null,
        },
      },
      orderBy: {
        dataCriacao: "desc",
      },
    });

  // Mantemos os testes principais funcionando mesmo
  // quando não existe um segundo comprador QA.
  // A concorrência será marcada como pendente nesse caso.

  let segundoAuth = null;

  if (segundoBuyer) {
    const segundoToken = jwt.sign(
      {
        id: segundoBuyer.id,
        tokenVersion: segundoBuyer.tokenVersion,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      }
    );

    segundoAuth = {
      authorization: `Bearer ${segundoToken}`,
    };
  }

  // ----------------------------------------------------------
  // 3.3. CREATOR QA
  // ----------------------------------------------------------

  const owner = await prisma.usuario.create({
    data: {
      nomeDeUsuario: `${run}_owner`,
      senhaHash: "QA_NO_LOGIN",
      nome: "Creator cupom QA",
      email: `${run}@qa.invalid`,
      tipo: "Creator",
    },
  });

  const creator = await prisma.creator.create({
    data: {
      usuarioId: owner.id,
      tipo: "PESSOA_FISICA",
      ativo: true,
      comissaoFootera: "0.1500",
    },
  });

  // ----------------------------------------------------------
  // 3.4. METODOLOGIAS QA
  // ----------------------------------------------------------

  async function makeCourse(suffix, amount) {
    return prisma.metodologiaAvulsa.create({
      data: {
        titulo: `QA cupom ${suffix} ${run}`,
        criadorUsuarioId: owner.id,
        tipo: "CURSO_FORMACAO",
        estruturaTipo: "MODULO",
        ativo: true,
        precoAssinaturaMensal: amount,
      },
    });
  }

  const courses = [
    await makeCourse("A", "67.00"),
    await makeCourse("B", "30.00"),
  ];

  const items = courses.map((course) => ({
    planoId: `METODOLOGIA_AVULSA:${course.id}`,
    periodicidade: "Mensal",
  }));

  const payer = {
    nome: "Comprador QA",
    email: `comprador-${run}@qa.invalid`,
  };

  // ----------------------------------------------------------
  // 3.5. FUNÇÕES DE CUPOM E PAGAMENTO
  // ----------------------------------------------------------

  async function coupon(suffix, data) {
    return prisma.cupom.create({
      data: {
        codigo: `${run}-${suffix}`,
        tipo: data.tipo,
        descontoPerc: data.descontoPerc ?? null,
        descontoFixo: data.descontoFixo ?? null,
        ativo: data.ativo ?? true,
        usosMax: data.usosMax ?? null,
        usosAtuais: data.usosAtuais ?? 0,
        expiraEm: data.expiraEm ?? null,
      },
    });
  }

  async function checkout(c) {
    return request(
      "checkout-bundle",
      {
        items,
        metodo: "PIX",
        cupom: c.codigo,
        pagador: payer,
      },
      auth
    );
  }

  async function preview(c) {
    return request(
      "coupon/apply",
      {
        codigo: c.codigo,
        items,
      },
      auth
    );
  }

  async function approve(payment, suffix) {
    return request(
      "webhook/provider",
      {
        provider: "INTERNAL_FAKE",
        providerEventId: `${run}:${suffix}`,
        tipo: "payment_approved",
        data: {
          pagamentoId: payment.id,
        },
      },
      {
        "x-webhook-secret":
          process.env.BILLING_WEBHOOK_SECRET,
      }
    );
  }

  // ==========================================================
  // 4. TESTE COMPLETO DE CUPOM
  // ==========================================================

  async function happy(
    suffix,
    couponData,
    expectedTotal,
    expectedLines
  ) {
    const c = await coupon(suffix, couponData);

    // --------------------------------------------------------
    // 4.1. PRÉVIA
    // --------------------------------------------------------

    const previa = await preview(c);

    check(
      previa.status === 200,
      `Prévia HTTP ${suffix}`,
      `HTTP ${previa.status}`
    );

    check(
      previa.status === 200 &&
        cents(previa.body.total) === expectedTotal &&
        cents(previa.body.desconto) ===
          9700 - expectedTotal,
      `Prévia calcula total correto ${suffix}`,
      `R$ ${previa.body.total ?? "ausente"}`
    );

    check(
      previa.status === 200 &&
        previa.body.financeiroV1?.items?.length === 2 &&
        previa.body.financeiroV1.items.every(
          (item, index) =>
            item.valorFinalCentavos ===
            expectedLines[index]
        ),
      `Prévia rateia corretamente ${suffix}`
    );

    // --------------------------------------------------------
    // 4.2. CHECKOUT
    // --------------------------------------------------------

    const response = await checkout(c);

    check(
      response.status === 200 &&
        response.body?.status === "PENDENTE",
      `Checkout ${suffix}`,
      `HTTP ${response.status}`
    );

    if (
      response.status !== 200 ||
      !response.body?.pagamento?.id
    ) {
      throw new Error(
        `Checkout ${suffix} interrompido: ` +
        JSON.stringify(response.body)
      );
    }

    const pg = await prisma.pagamento.findUnique({
      where: {
        id: response.body.pagamento.id,
      },
    });

    if (
      !pg ||
      pg.provider !== "INTERNAL_FAKE"
    ) {
      throw new Error(
        "Backend em banco diferente ou provider real: ABORTADO"
      );
    }

    const f = pg.meta?.financeiroV1;

    // --------------------------------------------------------
    // 4.3. SNAPSHOT FINANCEIRO
    // --------------------------------------------------------

    check(
      JSON.stringify(
        previa.body.financeiroV1?.items
      ) === JSON.stringify(f?.items),
      `Prévia e checkout apresentam o mesmo rateio ${suffix}`
    );

    check(
      pg.cupomId === c.id,
      `Cupom vinculado ao pagamento ${suffix}`
    );

    check(
      cents(pg.valor) === expectedTotal &&
        f?.totalCentavos === expectedTotal &&
        f.items?.reduce(
          (sum, item) =>
            sum + item.valorFinalCentavos,
          0
        ) === expectedTotal,
      `Total exato ${suffix}`,
      `R$ ${pg.valor}`
    );

    check(
      f?.items?.length === 2 &&
        f.items.every(
          (item, index) =>
            item.valorFinalCentavos ===
            expectedLines[index]
        ),
      `Rateio exato ${suffix}`,
      JSON.stringify(
        f?.items?.map(
          (item) => item.valorFinalCentavos
        )
      )
    );

    // --------------------------------------------------------
    // 4.4. CUPOM NÃO CONSUMIDO NO CHECKOUT
    // --------------------------------------------------------

    const cupomAntes =
      await prisma.cupom.findUnique({
        where: {
          id: c.id,
        },
      });

    const resgatesAntes =
      await prisma.cupomResgate.count({
        where: {
          cupomId: c.id,
          usuarioId: buyer.id,
        },
      });

    check(
      cupomAntes?.usosAtuais === 0 &&
        resgatesAntes === 0,
      `Cupom não consumido no checkout ${suffix}`
    );

    // --------------------------------------------------------
    // 4.5. APROVAÇÃO
    // --------------------------------------------------------

    const approved = await approve(pg, suffix);

    check(
      approved.status === 200,
      `Aprovação ${suffix}`,
      `HTTP ${approved.status}`
    );

    if (approved.status !== 200) {
      throw new Error(
        `Aprovação ${suffix} interrompida: ` +
        JSON.stringify(approved.body)
      );
    }

    const resgate =
      await prisma.cupomResgate.findUnique({
        where: {
          cupomId_usuarioId: {
            cupomId: c.id,
            usuarioId: buyer.id,
          },
        },
      });

    const updated =
      await prisma.cupom.findUnique({
        where: {
          id: c.id,
        },
      });

    check(
      resgate?.pagamentoId === pg.id &&
        updated?.usosAtuais === 1,
      `Resgate persistido uma vez ${suffix}`
    );

    const reservaConsumida =
        await prisma.cupomReserva.findUnique({
            where: {
            pagamentoId: pg.id,
            },
        });

        check(
        reservaConsumida?.status === "CONSUMIDA" &&
            reservaConsumida.consumidaEm !== null &&
            reservaConsumida.cupomId === c.id &&
            reservaConsumida.usuarioId === buyer.id,
        `Reserva consumida corretamente ${suffix}`,
        `status=${reservaConsumida?.status ?? "AUSENTE"}`
        );
    // --------------------------------------------------------
    // 4.6. CREATOR VENDAS
    // --------------------------------------------------------

    const sales = await prisma.creatorVenda.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

    check(
      sales.length === 2 &&
        sales.every(
          (sale) => sale.creatorId === creator.id
        ) &&
        sales.reduce(
          (sum, sale) =>
            sum + cents(sale.valorBruto),
          0
        ) === expectedTotal,
      `Vendas líquidas fecham ${suffix}`,
      `vendas=${sales.length}`
    );

    // --------------------------------------------------------
    // 4.7. WEBHOOK REPETIDO
    // --------------------------------------------------------

    const again = await approve(pg, suffix);

    const cupomAposRepeticao =
      await prisma.cupom.findUnique({
        where: {
          id: c.id,
        },
      });

    const vendasAposRepeticao =
      await prisma.creatorVenda.count({
        where: {
          pagamentoId: pg.id,
        },
      });

    check(
      again.status === 200 &&
        cupomAposRepeticao?.usosAtuais === 1 &&
        vendasAposRepeticao === 2,
      `Webhook repetido sem duplicar ${suffix}`,
      `HTTP ${again.status}`
    );

    // --------------------------------------------------------
    // 4.8. CUPOM JÁ UTILIZADO
    // --------------------------------------------------------

    const reused = await checkout(c);

    check(
      [400, 409].includes(reused.status),
      `Segundo checkout com cupom já usado é rejeitado ${suffix}`,
      `HTTP ${reused.status}`
    );
  }

  // ==========================================================
  // 5. CUPOM PERCENTUAL
  // ==========================================================

  await happy(
    "percentual",
    {
      tipo: "PERCENTUAL",
      descontoPerc: 10,
    },
    8730,
    [6030, 2700]
  );

  // ==========================================================
  // 6. CUPOM FIXO
  // ==========================================================

  await happy(
    "fixo",
    {
      tipo: "VALOR",
      descontoFixo: "10.01",
    },
    8699,
    [6009, 2690]
  );

  // ==========================================================
  // 7. CUPOM EXPIRADO
  // ==========================================================

  const expired = await coupon("expirado", {
    tipo: "PERCENTUAL",
    descontoPerc: 10,
    expiraEm: new Date(
      Date.now() - 86400000
    ),
  });

  const r1 = await checkout(expired);

  check(
    [400, 409].includes(r1.status),
    "Cupom expirado rejeitado",
    `HTTP ${r1.status}`
  );

  // ==========================================================
  // 8. CUPOM ESGOTADO
  // ==========================================================

  const exhausted = await coupon("esgotado", {
    tipo: "PERCENTUAL",
    descontoPerc: 10,
    usosMax: 1,
    usosAtuais: 1,
  });

  const r2 = await checkout(exhausted);

  check(
    [400, 409].includes(r2.status),
    "Cupom esgotado rejeitado",
    `HTTP ${r2.status}`
  );

  // ==========================================================
  // 9. CUPOM LIMITADO A UM PLANO
  // ==========================================================

  const restricted = await prisma.cupom.create({
    data: {
      codigo: `${run}-restrito`,
      tipo: "PERCENTUAL",
      descontoPerc: 10,
      ativo: true,
      plano: items[0].planoId,
    },
  });

  const r3 = await checkout(restricted);

  check(
    [400, 409].includes(r3.status),
    "Cupom limitado a plano rejeitado no bundle",
    `HTTP ${r3.status}`
  );

  // ==========================================================
  // 10. RESERVA DO ÚLTIMO CUPOM
  // ==========================================================

  const ultimoCupom = await coupon(
    "ultima-vaga",
    {
      tipo: "PERCENTUAL",
      descontoPerc: 10,
      usosMax: 1,
    }
  );

  const primeiroCheckout =
    await checkout(ultimoCupom);

  const segundoCheckout =
    await checkout(ultimoCupom);

  console.log(
    "\nDIAGNÓSTICO DE RESERVA DE CUPOM"
  );

  console.log({
    primeiroCheckoutHTTP:
      primeiroCheckout.status,
    segundoCheckoutHTTP:
      segundoCheckout.status,
    primeiroPagamentoId:
      primeiroCheckout.body?.pagamento?.id ?? null,
    segundoPagamentoId:
      segundoCheckout.body?.pagamento?.id ?? null,
  });

  const totalPendentes =
    await prisma.pagamento.count({
      where: {
        cupomId: ultimoCupom.id,
        status: "PENDENTE",
      },
    });

  const estadoCupom =
    await prisma.cupom.findUnique({
      where: {
        id: ultimoCupom.id,
      },
    });

  const reservaUltimoCupom =
    await prisma.cupomReserva.findMany({
      where: {
        cupomId: ultimoCupom.id,
        status: "RESERVADA",
      },
    });

  console.log({
    pagamentosPendentes: totalPendentes,
    reservasAtivas: reservaUltimoCupom.length,
    usosAtuais: estadoCupom?.usosAtuais,
    usosMax: estadoCupom?.usosMax,
  });

  check(
    primeiroCheckout.status === 200 &&
      segundoCheckout.status === 409 &&
      totalPendentes === 1 &&
      reservaUltimoCupom.length === 1,
    "Último cupom reservado sem duplicar pagamentos",
    `HTTP ${primeiroCheckout.status}/${segundoCheckout.status}`
  );

  // ==========================================================
  // 11. CONCORRÊNCIA — DOIS COMPRADORES DIFERENTES
  // ==========================================================

  console.log(
    "\nDIAGNÓSTICO DE CONCORRÊNCIA"
  );

  if (!segundoAuth) {
    console.log(
      "⚠ Segundo Atleta QA não encontrado. " +
      "Teste de concorrência não executado."
    );
  } else {
    const cupomConcorrente = await coupon(
      "concorrencia",
      {
        tipo: "PERCENTUAL",
        descontoPerc: 10,
        usosMax: 1,
      }
    );

    const payloadConcorrente = {
      items,
      metodo: "PIX",
      cupom: cupomConcorrente.codigo,
      pagador: payer,
    };

    // Requisições simultâneas.
    const resultados = await Promise.all([
      request(
        "checkout-bundle",
        payloadConcorrente,
        auth
      ),
      request(
        "checkout-bundle",
        payloadConcorrente,
        segundoAuth
      ),
    ]);

    const codigos = resultados
      .map((result) => result.status)
      .sort((a, b) => a - b);

    const reservas =
      await prisma.cupomReserva.findMany({
        where: {
          cupomId: cupomConcorrente.id,
          status: "RESERVADA",
        },
      });

    const pagamentos =
      await prisma.pagamento.count({
        where: {
          cupomId: cupomConcorrente.id,
          status: "PENDENTE",
        },
      });

    console.log({
      codigosHTTP: codigos,
      respostasErro: resultados
        .filter((result) => result.status !== 200)
        .map((result) => result.body),
      reservasAtivas: reservas.length,
      pagamentosPendentes: pagamentos,
    });

    check(
      JSON.stringify(codigos) ===
        JSON.stringify([200, 409]) &&
        reservas.length === 1 &&
        pagamentos === 1,
      "Concorrência entre dois compradores",
      `HTTP ${codigos.join("/")} — reservas=${reservas.length}`
    );
  }

  // ==========================================================
  // 12. CONCORRÊNCIA MISTA — INDIVIDUAL x BUNDLE
  // ==========================================================

  if (!segundoAuth) {
    console.log('⚠ Concorrência mista não executada: segundo comprador QA ausente.');
  } else {
    const misto = await coupon('misto-individual-bundle', {
      tipo:'PERCENTUAL', descontoPerc:10, usosMax:1,
    });
    const resultadosMistos = await Promise.all([
      request('checkout', {
        ...items[0], metodo:'PIX', cupom:misto.codigo, pagador:payer,
      }, auth),
      request('checkout-bundle', {
        items, metodo:'PIX', cupom:misto.codigo, pagador:payer,
      }, segundoAuth),
    ]);
    const codigosMistos = resultadosMistos.map(r=>r.status).sort((a,b)=>a-b);
    const reservasMistas = await prisma.cupomReserva.findMany({where:{cupomId:misto.id,status:'RESERVADA'}});
    const pagamentosMistos = await prisma.pagamento.findMany({where:{cupomId:misto.id}});
    const vencedores = resultadosMistos.filter(r=>r.status===200);
    check(JSON.stringify(codigosMistos)===JSON.stringify([200,409]) && vencedores.length===1,
      'Concorrência individual x bundle — apenas um checkout aceito',`HTTP ${codigosMistos.join('/')}`);
    check(reservasMistas.length===1 && pagamentosMistos.length===1 &&
      reservasMistas[0]?.pagamentoId===pagamentosMistos[0]?.id &&
      vencedores[0]?.body?.pagamento?.id===pagamentosMistos[0]?.id,
      'Concorrência mista — exatamente uma reserva e um pagamento');
    const estadoMisto = await prisma.cupom.findUnique({where:{id:misto.id}});
    check(estadoMisto?.usosAtuais===0 && pagamentosMistos[0]?.status==='PENDENTE' &&
      pagamentosMistos[0]?.provider==='INTERNAL_FAKE',
      'Concorrência mista — cupom não consumido antes da aprovação');
  }

  // ==========================================================
  // 13. RESULTADO FINAL
  // ==========================================================

  console.log(
    `\nRESULTADO: ${ok}/${ok + fail} verificações aprovadas.`
  );

  console.log(
    "Dados exclusivamente no banco QA."
  );

  if (fail > 0) {
    process.exitCode = 1;
  }

} // FIM DA FUNÇÃO main()

// ============================================================
// 13. EXECUÇÃO
// ============================================================

main()
  .catch((error) => {
    console.error(
      "\nTESTE INTERROMPIDO:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
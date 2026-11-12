
/**
 * Teste de reembolso TOTAL de bundle
 * contendo somente metodologias avulsas.
 * Executar SOMENTE contra footera_billing_qa.
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

const db = new URL(
  process.env.DATABASE_URL || "http://invalid"
);

if (
  !["localhost", "127.0.0.1"].includes(db.hostname) ||
  db.port !== "5433" ||
  db.pathname !== "/footera_billing_qa" ||
  process.env.NODE_ENV === "production" ||
  process.env.MP_ACCESS_TOKEN ||
  process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
  process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS !==
    "true"
) {
  throw Error(
    "SEGURANÇA: somente localhost:5433/footera_billing_qa, " +
    "fake, flags QA ativas"
  );
}

const api =
  process.env.FOOTERA_QA_API ||
  "http://127.0.0.1:3001";

if (
  ![
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ].includes(api) ||
  !process.env.JWT_SECRET ||
  !process.env.BILLING_WEBHOOK_SECRET
) {
  throw Error(
    "API local e segredos de QA obrigatórios"
  );
}

const prisma = new PrismaClient();

const run =
  `qa-refund-bundle-${Date.now()}-` +
  crypto.randomBytes(3).toString("hex");

let pass = 0;
let fail = 0;

function check(condition, desc, detail = "") {
  console.log(
    `${condition ? "✔" : "✖"} ${desc}` +
      (detail ? ` — ${detail}` : "")
  );

  if (condition) pass++;
  else fail++;
}

function must(condition, desc) {
  if (!condition) {
    throw Error(`TESTE INTERROMPIDO: ${desc}`);
  }
}

const cents = (x) =>
  Math.round(Number(x) * 100);

async function post(endpoint, body, headers = {}) {
  const response = await fetch(
    `${api}/api/billing/${endpoint}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }
  );

  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
  };
}

async function main() {
  console.log(
    "Banco QA:",
    db.host + db.pathname,
    "|",
    run
  );

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

  must(buyer, "comprador QA verificado ausente");

  const token = jwt.sign(
    {
      id: buyer.id,
      tokenVersion: buyer.tokenVersion,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const auth = {
    authorization: `Bearer ${token}`,
  };

  const payer = {
    nome: "Comprador QA",
    email: `buyer-${run}@qa.invalid`,
  };

  async function webhook(tipo, pagamento, id) {
    return post(
      "webhook/provider",
      {
        provider: "INTERNAL_FAKE",
        providerEventId: `${run}:${id}`,
        tipo,
        data: {
          pagamentoId: pagamento.id,
        },
      },
      {
        "x-webhook-secret":
          process.env.BILLING_WEBHOOK_SECRET,
      }
    );
  }

  // Criar um Creator exclusivo deste teste.
  const owner = await prisma.usuario.create({
    data: {
      nomeDeUsuario: `${run}_owner`,
      senhaHash: "QA_NO_LOGIN",
      nome: "Creator Bundle QA",
      email: `${run}@qa.invalid`,
      tipo: "Creator",
    },
  });

  await prisma.creator.create({
    data: {
      usuarioId: owner.id,
      tipo: "PESSOA_FISICA",
      ativo: true,
      comissaoFootera: "0.1500",
    },
  });

  function makeCourse(suffix, price) {
    return prisma.metodologiaAvulsa.create({
      data: {
        titulo: `QA bundle refund ${suffix} ${run}`,
        criadorUsuarioId: owner.id,
        tipo: "CURSO_FORMACAO",
        estruturaTipo: "MODULO",
        ativo: true,
        precoAssinaturaMensal: price,
      },
    });
  }

  const [a, b] = await Promise.all([
    makeCourse("A", "23.00"),
    makeCourse("B", "37.00"),
  ]);

  const item = (course) => ({
    planoId: `METODOLOGIA_AVULSA:${course.id}`,
    periodicidade: "Mensal",
  });

  // Compra individual A, que permanecerá válida.
  const single = await post(
    "checkout",
    {
      ...item(a),
      metodo: "PIX",
      pagador: payer,
    },
    auth
  );

  must(
    single.status === 200 &&
      single.body?.pagamento?.id,
    "checkout individual válido de A"
  );

  const pgSingle = await prisma.pagamento.findUnique({
    where: {
      id: single.body.pagamento.id,
    },
  });

  must(
    pgSingle?.provider === "INTERNAL_FAKE" &&
      (
        await webhook(
          "payment_approved",
          pgSingle,
          "approve-single"
        )
      ).status === 200,
    "pagamento único A aprovado em fake QA"
  );

  // Bundle com cupom percentual de 10%.
  const cupom = await prisma.cupom.create({
    data: {
      codigo: `${run}-cupom`,
      tipo: "PERCENTUAL",
      descontoPerc: 10,
      ativo: true,
      usosMax: 1,
      usosAtuais: 0,
    },
  });

  const checkout = await post(
    "checkout-bundle",
    {
      items: [
        item(a),
        item(b),
      ],
      metodo: "PIX",
      cupom: cupom.codigo,
      pagador: payer,
    },
    auth
  );

  must(
    checkout.status === 200 &&
      checkout.body?.pagamento?.id,
    `checkout bundle HTTP ${checkout.status}: ` +
      JSON.stringify(checkout.body).slice(0, 400)
  );

  const pg = await prisma.pagamento.findUnique({
    where: {
      id: checkout.body.pagamento.id,
    },
  });

  must(
    pg?.provider === "INTERNAL_FAKE" &&
      pg.status === "PENDENTE",
    "backend está no mesmo banco QA fake"
  );

  const snapshot = pg.meta?.financeiroV1;

  must(
    snapshot?.versao === 1 &&
      snapshot.items?.length === 2,
    "snapshot financeiro bundle ausente"
  );

  check(
    snapshot.totalCentavos === 5400 &&
      snapshot.items.reduce(
        (sum, i) => sum + i.valorFinalCentavos,
        0
      ) === 5400,
    "Bundle com desconto rateado e congelado"
  );

  const approved = await webhook(
    "payment_approved",
    pg,
    "approve-bundle"
  );

  must(
    approved.status === 200,
    `aprovação bundle falhou HTTP ${approved.status}: ` +
      JSON.stringify(approved.body)
  );

  const preBen =
    await prisma.pagamentoBeneficio.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

  const preVendas =
    await prisma.creatorVenda.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

  must(
    preBen.length === 2 &&
      preVendas.length === 2,
    "aprovação não provisionou as duas linhas"
  );

  check(
    preVendas.reduce(
      (sum, v) => sum + cents(v.valorBruto),
      0
    ) === 5400,
    "Vendas totalizam o snapshot líquido do bundle"
  );

  // Solicitar reembolso total do bundle.
  const refund = await webhook(
    "payment_refunded",
    pg,
    "refund-bundle"
  );

  const afterPg = await prisma.pagamento.findUnique({
    where: { id: pg.id },
  });

  const afterBen =
    await prisma.pagamentoBeneficio.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

  const afterSales =
    await prisma.creatorVenda.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

  const accessA =
    await prisma.metodologiaAssinante.findUnique({
      where: {
        metodologiaAvulsaId_usuarioId: {
          metodologiaAvulsaId: a.id,
          usuarioId: buyer.id,
        },
      },
    });

  const accessB =
    await prisma.metodologiaAssinante.findUnique({
      where: {
        metodologiaAvulsaId_usuarioId: {
          metodologiaAvulsaId: b.id,
          usuarioId: buyer.id,
        },
      },
    });

  check(
    refund.status === 200 &&
      afterPg?.status === "REEMBOLSADO",
    "Bundle reembolsado integralmente",
    `HTTP ${refund.status} ` +
      JSON.stringify(refund.body).slice(0, 150)
  );

  check(
    afterBen.length === 2 &&
      afterBen.every((b) => b.revogadoEm),
    "Ambos benefícios do bundle revogados"
  );

  check(
    afterSales.length === 2 &&
      afterSales.every(
        (v) => v.status === "REEMBOLSADA"
      ),
    "Ambas vendas Creator reembolsadas"
  );

  check(
    accessA?.status === "ATIVA",
    "Compra individual anterior sustenta acesso A"
  );

  check(
    accessB?.status === "CANCELADA",
    "Acesso exclusivo B foi cancelado"
  );

  // Reembolso não deve reutilizar cupom já consumido.
  const cupomDepois = await prisma.cupom.findUnique({
    where: { id: cupom.id },
  });

  const resgate =
    await prisma.cupomResgate.findUnique({
      where: {
        cupomId_usuarioId: {
          cupomId: cupom.id,
          usuarioId: buyer.id,
        },
      },
    });

  check(
    cupomDepois?.usosAtuais === 1 &&
      Boolean(resgate),
    "Cupom mantém uso histórico após reembolso"
  );

  // Reentrega com ID diferente continua idempotente.
  const again = await webhook(
    "payment_refunded",
    pg,
    "refund-bundle-another-event"
  );

  const againBen =
    await prisma.pagamentoBeneficio.findMany({
      where: {
        pagamentoId: pg.id,
      },
    });

  check(
    again.status === 200 &&
      againBen.every(
        (b) =>
          afterBen
            .find((x) => x.id === b.id)
            ?.revogadoEm?.getTime() ===
          b.revogadoEm?.getTime()
      ),
    "Reembolso repetido não modifica datas de revogação"
  );

  const remaining =
    await prisma.creatorVenda.findMany({
      where: {
        pagamentoId: pgSingle.id,
      },
    });

  check(
    remaining.length === 1 &&
      remaining[0].status === "CONFIRMADA",
    "Venda da compra independente continua confirmada"
  );

  console.log(
    `\nRESULTADO: ${pass}/${pass + fail} ` +
      "verificações aprovadas. " +
      "Banco footera_billing_qa."
  );

  if (fail) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("TESTE INTERROMPIDO:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

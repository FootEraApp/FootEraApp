
/**
 * FootEra — QA de provisionamento 20PARABENS.
 * HTTP + HMAC + consulta MP simulada.
 * NUNCA cobra ou estorna.
 * Apenas 127.0.0.1:5433/footera_billing_qa.
 */
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

function protegerQa() {
  const db = new URL(process.env.DATABASE_URL ?? "");

  assert.equal(process.env.NODE_ENV, "test");
  assert.ok(["postgresql:", "postgres:"].includes(db.protocol));
  assert.ok(["localhost", "127.0.0.1"].includes(db.hostname));
  assert.equal(db.port, "5433");
  assert.equal(db.pathname, "/footera_billing_qa");
  assert.equal(process.env.MP_ACCESS_TOKEN ?? "", "");
  assert.equal(process.env.BILLING_CUPOM_RESERVA_QA, "true");

  for (const nome of [
    "ENABLE_BILLING_SCHEDULER",
    "ENABLE_MP_CONCILIACAO_SCHEDULER",
    "ENABLE_ACCOUNT_PURGE",
    "ENABLE_EVENT_REFUNDS_REAL",
    "ENABLE_EVENT_REFUNDS_LIVE_HOMOLOGATED",
    "BILLING_REFUND_OPERATIONAL_EXECUTION_ENABLED",
  ]) {
    assert.equal(
      process.env[nome],
      "false",
      `AMBIENTE_QA_INSEGURO_${nome}`
    );
  }
}

protegerQa();

process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.MP_WEBHOOK_SECRET = randomBytes(48).toString("hex");
process.env.BILLING_SHOW_LEARNING_PLANS = "true";
process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS = "true";

const marcador =
  `qa_aniversario_prov_${randomUUID().replaceAll("-", "")}`;

const ids = {
  usuarios: [] as string[],
  pagamentos: [] as string[],
  aulas: [] as string[],
  metodologias: [] as string[],
  creators: [] as string[],
};

let servidor: ReturnType<Express["listen"]> | null = null;
let verificacoes = 0;

function ok(condicao: unknown, descricao: string) {
  assert.ok(condicao, descricao);
  console.log(
    `APROVADO ${String(++verificacoes).padStart(2, "0")} — ${descricao}`
  );
}

function hojeBr() {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const n = (t: string) =>
    Number(partes.find((p) => p.type === t)?.value);

  return {
    mes: n("month"),
    dia: n("day"),
  };
}

async function main() {
  const { prisma } = await import("./server/prisma.js");
  const express = (await import("express")).default;
  const jwt = (await import("jsonwebtoken")).default;
  const rotas = (await import("./server/routes/billing.js")).default;

  const {
    configurarConsultorMercadoPagoQa,
  } = await import(
    "./server/services/billingMercadoPagoGateway.js"
  );

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`SELECT current_database() AS nome`;

  assert.equal(banco[0]?.nome, "footera_billing_qa");

  const nascimento = (() => {
    const h = hojeBr();
    return new Date(Date.UTC(2000, h.mes - 1, h.dia));
  })();

  const respostasMp = new Map<string, any>();
  let base = "";
  let mockLigado = false;

  async function usuario(
    sufixo: string,
    comAniversario = true
  ) {
    const u = await prisma.usuario.create({
      data: {
        nome: `QA ${sufixo}`,
        nomeDeUsuario: `${marcador}_${sufixo}`.slice(0, 64),
        email: `${marcador}_${sufixo}@example.invalid`,
        senhaHash: `NAO_USAR_${marcador}`,
        tipo: "Atleta",
        verified: true,
        dataNascimento: comAniversario ? nascimento : null,
        aniversarioElegivelApartirDe: new Date(
          Date.now() - 45 * 86400000
        ),
      },
    });

    ids.usuarios.push(u.id);

    await prisma.usuarioPapel.create({
      data: {
        usuarioId: u.id,
        papel: "Atleta",
        status: "ATIVO",
      },
    });

    await prisma.atleta.create({
      data: {
        usuarioId: u.id,
        idade: 26,
        categoria: [],
        dataNascimento: u.dataNascimento,
      },
    });

    const token = jwt.sign(
      {
        id: u.id,
        tokenVersion: u.tokenVersion ?? 0,
      },
      process.env.JWT_SECRET!,
      {
        algorithm: "HS256",
        expiresIn: "10m",
      }
    );

    return { id: u.id, token };
  }

  async function requisitar(
    token: string,
    rota: string,
    body: unknown
  ) {
    const res = await fetch(`${base}/api/billing${rota}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const txt = await res.text();
    let data: any;

    try {
      data = JSON.parse(txt);
    } catch {
      data = { texto: txt.slice(0, 600) };
    }

    return { status: res.status, data };
  }

  async function webhook(ref: string) {
    const requestId = randomUUID();
    const ts = String(Math.floor(Date.now() / 1000));

    const manifesto =
      `id:${ref.toLowerCase()};` +
      `request-id:${requestId};ts:${ts};`;

    const assinatura = createHmac(
      "sha256",
      process.env.MP_WEBHOOK_SECRET!
    )
      .update(manifesto)
      .digest("hex");

    const res = await fetch(
      `${base}/api/billing/mercadopago/webhook?data.id=${ref}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": requestId,
          "x-signature": `ts=${ts},v1=${assinatura}`,
        },
        body: JSON.stringify({
          type: "payment",
          data: { id: ref },
        }),
      }
    );

    const txt = await res.text();
    let data: any;

    try {
      data = JSON.parse(txt);
    } catch {
      data = { texto: txt.slice(0, 600) };
    }

    return { status: res.status, data };
  }

  async function comprar(
    usuarioQa: { id: string; token: string },
    itens: string[],
    simularCupomExpirado = false
    ) {
    const bundle = itens.length > 1;

    const body = {
      ...(bundle
        ? {
            items: itens.map((planoId) => ({
              planoId,
              periodicidade: "Mensal",
            })),
          }
        : {
            planoId: itens[0],
            periodicidade: "Mensal",
          }),
      metodo: "PIX",
      cupom: "20PARABENS",
      chaveCliente: randomUUID(),
      pagador: {
        nome: "Comprador QA",
        email: `${marcador}@example.invalid`,
      },
    };

    const r = await requisitar(
      usuarioQa.token,
      bundle ? "/checkout-bundle" : "/checkout",
      body
    );

    assert.equal(
      r.status,
      200,
      `CHECKOUT_${itens.join("+")}: ${JSON.stringify(r.data)}`
    );

    const id = String(r.data.pagamento?.id ?? "");
    assert.ok(id, "CHECKOUT_SEM_ID");
    ids.pagamentos.push(id);

    const pg = await prisma.pagamento.findUniqueOrThrow({
      where: { id },
    });
        
    console.log("[QA] Checkout criado:", {
    modalidade: bundle ? "BUNDLE" : "INDIVIDUAL",
    plano: pg.plano,
    pagamentoId: pg.id,
    status: pg.status,
    provider: pg.provider,
    providerRef: pg.providerRef,
    valor: pg.valor.toString(),
    });

    assert.equal(
    pg.status,
    "PENDENTE",
    "O pagamento deve estar pendente"
    );

    assert.equal(
    pg.provider,
    "INTERNAL_FAKE",
    "O teste deve utilizar pagamento simulado"
    );

    // O checkout individual gera uma referência FAKE-.
    // O checkout bundle mantém providerRef null.
    //
    // Ambos são comportamentos esperados no QA.

    if (bundle) {
    assert.equal(
        pg.providerRef,
        null,
        "O bundle fake deve iniciar sem referência externa"
    );
    } else {
    assert.ok(
        pg.providerRef?.startsWith("FAKE-"),
        "O checkout individual deve possuir referência FAKE-"
    );
    }

    const reserva =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: { pagamentoId: id },
      });

    assert.equal(reserva.status, "RESERVADA");
    assert.equal(reserva.usuarioId, usuarioQa.id);
    assert.equal(reserva.cupomId, pg.cupomId);

    const financeiro = (pg.meta as any)?.financeiroV1;

    assert.ok(
      financeiro &&
      financeiro.items?.length === itens.length
    );

    assert.equal(
      financeiro.totalCentavos,
      pg.valor.mul(100).toNumber()
    );

    const baseCentavos = financeiro.items.reduce(
      (s: number, it: any) => s + it.valorBaseCentavos,
      0
    );

    assert.equal(
      financeiro.totalCentavos,
      baseCentavos - Math.round(baseCentavos * 0.2)
    );

    // Somente QA: converte a identidade fake para
    // uma referência numérica simulada do provedor.
    const ref =
      `${Date.now()}${randomBytes(4).readUInt32BE(0)}`;

    const atualizados = await prisma.pagamento.updateMany({
      where: {
        id,
        usuarioId: usuarioQa.id,
        status: "PENDENTE",
        provider: "INTERNAL_FAKE",
        providerRef: pg.providerRef,
      },
      data: {
        provider: "MERCADOPAGO",
        providerRef: ref,
        pixCopiaECola: "PIX-QA-SEM-COBRANCA",
      },
    });

    assert.equal(atualizados.count, 1);

    respostasMp.set(ref, {
      id: ref,
      status: "approved",
      status_detail: "accredited",
      external_reference: id,
      metadata: { pagamentoId: id },
      transaction_amount: pg.valor.toNumber(),
      currency_id: "BRL",
    });

    
    if (simularCupomExpirado) {
      assert.ok(
        pg.cupomId,
        "QA_CUPOM_AUSENTE"
      );

      // A reserva já existe e a cobrança está pendente.
      // Simula a expiração do cupom após o checkout,
      // sem avançar o relógio do sistema.

      await prisma.cupom.update({
        where: {
          id: pg.cupomId,
        },
        data: {
          expiraEm: new Date(
            Date.now() - 60_000
          ),
        },
      });

      const reservaAntes =
        await prisma.cupomReserva.findUniqueOrThrow({
          where: {
            pagamentoId: id,
          },
        });

      assert.equal(
        reservaAntes.status,
        "RESERVADA"
      );

      assert.ok(
        reservaAntes.expiraEm > new Date(),
        "QA_RESERVA_TAMBEM_EXPIROU"
      );

      console.log(
        "QA: cupom expirado; reserva original ainda válida."
      );
    }

    const conf = await webhook(ref);

    assert.equal(
      conf.status,
      200,
      `WEBHOOK_${itens.join("+")}: ${JSON.stringify(conf.data)}`
    );

    const depois = await prisma.pagamento.findUniqueOrThrow({
      where: { id },
    });

    assert.equal(depois.status, "APROVADO");

    assert.equal(
      (
        await prisma.cupomReserva.findUniqueOrThrow({
          where: { pagamentoId: id },
        })
      ).status,
      "CONSUMIDA"
    );

    assert.equal(
      await prisma.cupomResgate.count({
        where: { pagamentoId: id },
      }),
      1
    );

    assert.equal(
      (
        await prisma.cupom.findUniqueOrThrow({
          where: { id: pg.cupomId! },
        })
      ).usosAtuais,
      1
    );

    const beneficios = await prisma.pagamentoBeneficio.findMany({
      where: { pagamentoId: id },
    });

    assert.equal(beneficios.length, itens.length);

    const primeira = beneficios
      .map((b) => `${b.tipo}:${b.recursoId}`)
      .sort();

    const repetido = await webhook(ref);

    assert.equal(
      repetido.status,
      200,
      `WEBHOOK_REPETIDO: ${JSON.stringify(repetido.data)}`
    );

    assert.equal(
      await prisma.cupomResgate.count({
        where: { pagamentoId: id },
      }),
      1
    );

    assert.equal(
      (
        await prisma.cupom.findUniqueOrThrow({
          where: { id: pg.cupomId! },
        })
      ).usosAtuais,
      1
    );

    const depoisRepetido =
      await prisma.pagamentoBeneficio.findMany({
        where: { pagamentoId: id },
      });

    assert.deepEqual(
      depoisRepetido
        .map((b) => `${b.tipo}:${b.recursoId}`)
        .sort(),
      primeira
    );

    ok(
      true,
      `${itens.join(" + ")}: desconto, confirmação, resgate e webhook repetido`
    );

    return { id, beneficios, financeiro };
  }

  try {
    configurarConsultorMercadoPagoQa(async (ref) => {
      const resposta = respostasMp.get(ref);
      assert.ok(resposta, `MOCK_MP_SEM_REFERENCIA_${ref}`);
      return resposta;
    });

    mockLigado = true;

    // Creator QA para a venda da metodologia.
    const criador = await usuario("criador", false);

    const creator = await prisma.creator.create({
      data: {
        usuarioId: criador.id,
        tipo: "PESSOA_FISICA",
        ativo: true,
        nomePublico: "Creator QA",
      },
    });

    ids.creators.push(creator.id);

    // Metodologia avulsa QA.
    const metodologiaId = randomUUID();

    await prisma.metodologiaAvulsa.create({
      data: {
        id: metodologiaId,
        titulo: `Metodologia QA ${marcador}`,
        descricao: "Fixture temporária",
        ativo: true,
        tipo: "TRILHAS_TREINO",
        estruturaTipo: "TRILHA",
        publicoAlvo: "AMBOS",
        precoAssinaturaMensal: "50.00",
        criadorUsuarioId: criador.id,
      },
    });

    ids.metodologias.push(metodologiaId);

    // Aula paga QA.
    const aulaId = randomUUID();

    await prisma.aulaAoVivo.create({
      data: {
        id: aulaId,
        titulo: `Aula QA ${marcador}`,
        status: "AGENDADA",
        dataInicio: new Date(Date.now() + 7 * 86400000),
        dataFim: new Date(
          Date.now() + 7 * 86400000 + 3600000
        ),
        inscricaoInicio: new Date(Date.now() - 86400000),
        inscricaoFim: new Date(
          Date.now() + 6 * 86400000
        ),
        acessoPago: true,
        precoAcesso: "75.00",
      },
    });

    ids.aulas.push(aulaId);

    const app = express();
    app.use(express.json());
    app.use("/api/billing", rotas);

    servidor = app.listen(0, "127.0.0.1");
    const ativo = servidor;

    await new Promise<void>((resolve, reject) => {
      if (ativo.listening) return resolve();
      ativo.once("listening", resolve);
      ativo.once("error", reject);
    });

    base =
      `http://127.0.0.1:${(ativo.address() as AddressInfo).port}`;

    // ================================================
    // CENÁRIO 1 — ASSINATURA INDIVIDUAL
    // ================================================

    const assinaturaUser = await usuario("assinatura");

    const assinatura = await comprar(
      assinaturaUser,
      ["ATLETA_PRO"]
    );

    ok(
      (await prisma.assinatura.count({
        where: {
          usuarioId: assinaturaUser.id,
          plano: "ATLETA_PRO",
          status: "ATIVA",
          ativo: true,
        },
      })) === 1,
      "Assinatura PRO ativada uma vez"
    );

    ok(
      assinatura.beneficios.length === 1 &&
      assinatura.beneficios[0].tipo === "ASSINATURA",
      "Benefício de assinatura registrado"
    );

    // ================================================
    // CENÁRIO 2 — PACOTE
    // ================================================

    const bundleUser = await usuario("bundle");

    const bundle = await comprar(bundleUser, [
      "ATLETA_PRO",
      "ATLETA_LEARNING_1",
    ]);

    ok(
      (await prisma.assinatura.count({
        where: {
          usuarioId: bundleUser.id,
          plano: {
            in: ["ATLETA_PRO", "ATLETA_LEARNING_1"],
          },
          status: "ATIVA",
          ativo: true,
        },
      })) === 2,
      "Pacote ativa as duas assinaturas"
    );

    ok(
      bundle.beneficios.length === 2 &&
      bundle.beneficios.every(
        (b) => b.tipo === "ASSINATURA"
      ),
      "Pacote registra dois benefícios distintos"
    );

    // ================================================
    // CENÁRIO 3 — AULA PAGA
    // ================================================

    const aulaUser = await usuario("aula");

    const aula = await comprar(
      aulaUser,
      [`AULA_AO_VIVO:${aulaId}`]
    );

    const acessoAula =
      await prisma.aulaAoVivoAcesso.findUniqueOrThrow({
        where: {
          aulaAoVivoId_usuarioId: {
            aulaAoVivoId: aulaId,
            usuarioId: aulaUser.id,
          },
        },
      });

    ok(
      acessoAula.status === "ATIVO" &&
      acessoAula.origem === "PAGAMENTO" &&
      acessoAula.valorPago?.mul(100).toNumber() ===
        aula.financeiro.totalCentavos,
      "Aula liberada com valor realmente pago"
    );

    ok(
      aula.beneficios.length === 1 &&
      aula.beneficios[0].tipo === "AULA_AO_VIVO",
      "Benefício de aula registrado"
    );

    // ================================================
    // CENÁRIO 4 — METODOLOGIA AVULSA
    // ================================================

    const metodologiaUser = await usuario("metodologia");

    const metodologia = await comprar(
      metodologiaUser,
      [`METODOLOGIA_AVULSA:${metodologiaId}`]
    );

    const acesso =
      await prisma.metodologiaAssinante.findUniqueOrThrow({
        where: {
          metodologiaAvulsaId_usuarioId: {
            metodologiaAvulsaId: metodologiaId,
            usuarioId: metodologiaUser.id,
          },
        },
      });

    ok(
      acesso.status === "ATIVA" &&
      acesso.origem === "AVULSA",
      "Metodologia avulsa liberada"
    );

    const vendas = await prisma.creatorVenda.findMany({
      where: { pagamentoId: metodologia.id },
    });

    ok(
      vendas.length === 1 &&
      vendas[0].creatorId === creator.id &&
      vendas[0].status === "CONFIRMADA" &&
      vendas[0].valorBruto.mul(100).toNumber() ===
        metodologia.financeiro.totalCentavos,
      "Venda do Creator registrada uma vez com o valor descontado"
    );

    ok(
      metodologia.beneficios.length === 1 &&
      metodologia.beneficios[0].tipo ===
        "METODOLOGIA_AVULSA",
      "Benefício de metodologia registrado"
    );

    
    // ================================================
    // CENÁRIO 5 — CONFIRMAÇÃO APÓS EXPIRAÇÃO
    // ================================================

    const usuarioExpiracao =
      await usuario("expiracao");

    const compraExpirada =
      await comprar(
        usuarioExpiracao,
        ["ATLETA_PRO"],
        true
      );

    const pagamentoExpirado =
      await prisma.pagamento.findUniqueOrThrow({
        where: {
          id: compraExpirada.id,
        },
      });

    ok(
      pagamentoExpirado.status === "APROVADO",
      "Pagamento iniciado antes da expiração foi aprovado"
    );

    const reservaExpirada =
      await prisma.cupomReserva.findUniqueOrThrow({
        where: {
          pagamentoId: compraExpirada.id,
        },
      });

    ok(
      reservaExpirada.status === "CONSUMIDA",
      "Reserva original foi consumida após expiração do cupom"
    );

    const resgateExpirado =
      await prisma.cupomResgate.count({
        where: {
          pagamentoId: compraExpirada.id,
        },
      });

    ok(
      resgateExpirado === 1,
      "Cupom expirado não gerou resgate duplicado"
    );

    console.log(
      `\nRESULTADO: ${verificacoes}/${verificacoes} verificações aprovadas.`
    );

    console.log(
      "NÃO COBERTO: MP real, virada real de data, " +
      "concorrência de webhooks, reembolso/chargeback e documentos."
    );
  } finally {
    if (mockLigado) {
      configurarConsultorMercadoPagoQa(null);
    }

    if (servidor) {
      const ativo = servidor;

      await new Promise<void>((resolve) =>
        ativo.close(() => resolve())
      );
    }

    try {
      // Apagar somente as relações das fixtures.
      if (ids.pagamentos.length) {
        await prisma.creatorVenda.deleteMany({
          where: {
            pagamentoId: { in: ids.pagamentos },
          },
        });

        await prisma.pagamentoBeneficio.deleteMany({
          where: {
            pagamentoId: { in: ids.pagamentos },
          },
        });

        await prisma.cupomReserva.deleteMany({
          where: {
            pagamentoId: { in: ids.pagamentos },
          },
        });

        await prisma.cupomResgate.deleteMany({
          where: {
            pagamentoId: { in: ids.pagamentos },
          },
        });

        await prisma.billingCheckoutOperacao.deleteMany({
          where: {
            pagamentoId: { in: ids.pagamentos },
          },
        });

        await prisma.pagamento.deleteMany({
          where: {
            id: { in: ids.pagamentos },
          },
        });
      }

      if (ids.usuarios.length) {
        await prisma.aulaAoVivoAcesso.deleteMany({
          where: {
            usuarioId: { in: ids.usuarios },
            aulaAoVivoId: { in: ids.aulas },
          },
        });

        await prisma.metodologiaAssinante.deleteMany({
          where: {
            usuarioId: { in: ids.usuarios },
            metodologiaAvulsaId: {
              in: ids.metodologias,
            },
          },
        });

        await prisma.assinatura.deleteMany({
          where: {
            usuarioId: { in: ids.usuarios },
            plano: {
              in: ["ATLETA_PRO", "ATLETA_LEARNING_1"],
            },
          },
        });

        await prisma.cupom.deleteMany({
          where: {
            concedidoParaUsuarioId: {
              in: ids.usuarios,
            },
            codigo: {
              startsWith: "ANIVERSARIO_",
            },
          },
        });
      }

      if (ids.aulas.length) {
        await prisma.aulaAoVivo.deleteMany({
          where: { id: { in: ids.aulas } },
        });
      }

      if (ids.metodologias.length) {
        await prisma.metodologiaAvulsa.deleteMany({
          where: {
            id: { in: ids.metodologias },
          },
        });
      }

      if (ids.creators.length) {
        await prisma.creator.deleteMany({
          where: { id: { in: ids.creators } },
        });
      }

      if (ids.usuarios.length) {
        await prisma.atleta.deleteMany({
          where: {
            usuarioId: { in: ids.usuarios },
          },
        });

        await prisma.usuarioPapel.deleteMany({
          where: {
            usuarioId: { in: ids.usuarios },
          },
        });

        await prisma.usuario.deleteMany({
          where: {
            id: { in: ids.usuarios },
          },
        });
      }

      console.log(
        "LIMPEZA_QA: registros da execução removidos."
      );
    } catch (erro) {
      console.error(
        "LIMPEZA_QA_FALHOU; IDs para auditoria:",
        ids
      );
      throw erro;
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((e) => {
  console.error(
    "ANIVERSARIO_PROVISIONAMENTO_QA_FALHOU:",
    e
  );
  process.exitCode = 1;
});
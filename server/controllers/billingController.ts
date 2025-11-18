import { Request, Response } from "express";
import {
  PrismaClient,
  Prisma,
  MetodoPagamento,
  Periodicidade,
  PagamentoStatus
} from "@prisma/client";
import QRCode from "qrcode";
import type { AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();

type Pagador = {
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
};

type Cartao = {
  numero: string;
  nomeImpresso: string;
  validade: string;
  cvv: string;
};

type StartCheckoutBody = {
  planoId: string;
  periodicidade: Periodicidade;
  metodo: MetodoPagamento;
  cupom?: string | null;
  pagador?: Pagador;
  cartao?: Cartao;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}
function luhnOk(num: string) {
  let sum = 0,
    alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num.charAt(i), 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PLANS = [
  {
    id: "ATLETA_PRO",
    title: "Atleta Pro",
    monthly: 19.9,
    annual: 199.0,
    benefits: [
      "Sem anúncios no app",
      "Registros de treino ilimitados (fair-use)",
      "Desafios ilimitados",
      "Biblioteca de treinos pessoal ilimitada (fair-use)",
      "Agendamento pessoal de treinos",
      "Analytics pessoal com retenção de 12 meses",
      "Social aberto: posts/DMs ilimitados • vídeos ≤ 60s",
    ],
  },
  {
    id: "OLHEIRO_PRO",
    title: "Olheiro Pro",
    monthly: 39.9,
    annual: 399.0,
    benefits: [
      "Sem anúncios",
      "Filtros avançados e ver até 200 perfis/dia",
      "Listas ilimitadas e notas privadas",
      "Contato mediado com prioridade",
    ],
  },
  {
    id: "PROFESSOR_PRO",
    title: "Professor Pro",
    monthly: 39.9,
    annual: 399.0,
    benefits: [
      "Sem anúncios",
      "Workspace pessoal (fora da organização)",
      "Planos/rotinas ativas até 1.000",
      "Templates salvos até 500",
      "Agendamentos em lote (séries/semestres)",
    ],
  },
  {
    id: "ESCOLINHA_PRO",
    title: "Escolinha (organização)",
    monthly: 199.0,
    annual: 0,
    benefits: [
      "Sem anúncios no contexto da organização",
      "Painel por times/turmas; importação de atletas",
      "Comunicação (chat em massa) e presença",
      "Biblioteca de treinos da organização",
      "Agendamento por turma/time e por atleta",
      "Relatórios/analytics com retenção de 12 meses",
      "Capacidades de referência: 600 atletas, 30 coaches, 30 turmas",
      "Página pública e vitrine da escolinha",
    ],
  },
] as const;

function getUserId(req: Request) {
  const r = req as AuthenticatedRequest as any;
  return r.userId ?? r.authUser?.id ?? r.user?.id;
}
// ---- Helpers para sincronizar Pagamento <-> Assinatura ----

async function approvePaymentAndProvisionSubscription(pagamentoId: string) {
  const pagamento = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
  });
  if (!pagamento) {
    throw new Error("Pagamento não encontrado");
  }

  if (pagamento.status === "APROVADO") {
    return pagamento;
  }

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const pg = await tx.pagamento.update({
      where: { id: pagamentoId },
      data: {
        status: "APROVADO",
        pagoEm: now,
      },
    });

    await tx.assinatura.upsert({
      where: { usuarioId: pg.usuarioId },
      update: {
        plano: pg.plano,
        ativo: true,
        startsAt: now,
        canceledAt: null,
      },
      create: {
        usuarioId: pg.usuarioId,
        plano: pg.plano,
        ativo: true,
        startsAt: now,
      },
    });

    return pg;
  });

  return updated;
}

async function deactivateSubscriptionForPayment(pagamentoId: string) {
  const pagamento = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
  });
  if (!pagamento) {
    return null;
  }

  const now = new Date();

  await prisma.assinatura.updateMany({
    where: { usuarioId: pagamento.usuarioId, ativo: true },
    data: { ativo: false, canceledAt: now },
  });

  return pagamento;
}

export async function getPlans(req: Request, res: Response) {
  res.json({ plans: PLANS });
}

export async function getMyBilling(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);

    const assinatura = await prisma.assinatura.findUnique({
      where: { usuarioId },
    });

    const pagamentos = await prisma.pagamento.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });

    const cupons = await prisma.cupomResgate.findMany({
      where: { usuarioId },
      include: { cupom: true },
      orderBy: { resgatadoEm: "desc" },
    });

    res.json({ assinatura, pagamentos, cupons });
  } catch (err) {
    res.status(500).json({ message: "Erro ao carregar billing", err });
  }
}

function findPlan(planoId: string) {
  return PLANS.find((p) => p.id === planoId);
}

function priceFor(planoId: string, period: Periodicidade): number {
  const p = findPlan(planoId);
  if (!p) throw new Error("Plano inválido");

  if (planoId === "ESCOLINHA_PRO" && period === "Anual") {
    throw new Error("ESCOLINHA_PRO é apenas mensal");
  }

  return period === "Mensal" ? p.monthly : p.annual!;
}

async function computeCouponDiscount(
  codigo: string,
  usuarioId: string,
  planoId: string,
  periodicidade: Periodicidade
) {
  const cupom = await prisma.cupom.findUnique({ where: { codigo } });
  if (!cupom || !cupom.ativo) return { ok: false, reason: "Cupom inválido" };

  if (cupom.expiraEm && cupom.expiraEm < new Date()) {
    return { ok: false, reason: "Cupom expirado" };
  }
  if (cupom.usosMax != null && cupom.usosAtuais >= cupom.usosMax) {
    return { ok: false, reason: "Cupom esgotado" };
  }

  if (cupom.plano && cupom.plano !== planoId) {
    return { ok: false, reason: "Cupom não válido para este plano" };
  }
  if (cupom.periodicidade && cupom.periodicidade !== periodicidade) {
    return { ok: false, reason: "Cupom não válido para esta periodicidade" };
  }

  if (
    cupom.tipo === "PRESENTE" &&
    cupom.concedidoParaUsuarioId &&
    cupom.concedidoParaUsuarioId !== usuarioId
  ) {
    return { ok: false, reason: "Este presente não é para este usuário" };
  }

  return { ok: true, cupom };
}

export async function applyCoupon(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { codigo, planoId, periodicidade } = req.body as {
      codigo: string;
      planoId: string;
      periodicidade: Periodicidade;
    };

    const pl = findPlan(planoId);
    if (!pl) return res.status(400).json({ message: "Plano inválido" });

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    if (planoId === "ESCOLINHA_PRO" && periodicidade === "Anual") {
      return res
        .status(400)
        .json({ message: "ESCOLINHA_PRO é apenas mensal" });
    }

    const base = priceFor(planoId, periodicidade);

    const check = await computeCouponDiscount(
      codigo,
      usuarioId,
      planoId,
      periodicidade
    );
    if (!check.ok || !check.cupom) {
      return res
        .status(400)
        .json({ message: check.reason || "Cupom inválido" });
    }

    const c = check.cupom;
    let desconto = 0;
    if (c.tipo === "PERCENTUAL" && typeof c.descontoPerc === "number") {
      desconto =
        (Math.max(0, Math.min(100, c.descontoPerc)) * base) / 100;
    } else if (c.tipo === "VALOR" && c.descontoFixo != null) {
      desconto = Number(c.descontoFixo);
    } else if (c.tipo === "PRESENTE") {
      desconto = base;
    }

    const total = Math.max(0, base - desconto);

    return res.json({
      planoId,
      periodicidade,
      base,
      desconto: Number(desconto.toFixed(2)),
      total: Number(total.toFixed(2)),
      cupom: { codigo: c.codigo, tipo: c.tipo },
    });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao validar cupom", err });
  }
}

export async function startCheckout(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { planoId, periodicidade, metodo, cupom, pagador, cartao } =
      req.body as StartCheckoutBody;

    const METODOS_VALIDOS: MetodoPagamento[] = [
      "PIX",
      "CREDITO",
      "DEBITO",
      "BOLETO",
    ];
    if (!METODOS_VALIDOS.includes(metodo)) {
      return res.status(400).json({ message: "Método de pagamento inválido" });
    }
    if (planoId === "ESCOLINHA_PRO" && periodicidade === "Anual") {
      return res
        .status(400)
        .json({ message: "ESCOLINHA_PRO é apenas mensal" });
    }

    if (!["Mensal", "Anual"].includes(periodicidade)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const plan = findPlan(planoId);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    if (metodo === "PIX") {
      if (!pagador?.nome || !pagador?.email) {
        return res
          .status(400)
          .json({ message: "Informe nome e e-mail para PIX" });
      }
    }
    if (metodo === "BOLETO") {
      if (!pagador?.nome || !pagador?.email || !pagador?.cpf) {
        return res.status(400).json({
          message: "Informe nome, e-mail e CPF para boleto",
        });
      }
    }
    if (metodo === "CREDITO" || metodo === "DEBITO") {
      const num = onlyDigits(cartao?.numero || "");
      const cvv = onlyDigits(cartao?.cvv || "");
      const validadeOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(
        cartao?.validade || ""
      );
      if (
        !cartao?.nomeImpresso ||
        num.length < 13 ||
        !luhnOk(num) ||
        !validadeOk ||
        !(cvv.length === 3 || cvv.length === 4)
      ) {
        return res
          .status(400)
          .json({ message: "Dados de cartão inválidos" });
      }
      if (!pagador?.nome || !pagador?.email) {
        return res.status(400).json({
          message: "Informe nome e e-mail do titular",
        });
      }
    }

    let base = priceFor(planoId, periodicidade);
    let desconto = 0;
    let cupomRow: any = null;

    if (cupom) {
      const check = await computeCouponDiscount(
        cupom,
        usuarioId,
        planoId,
        periodicidade
      );
      if (!check.ok || !check.cupom)
        return res
          .status(400)
          .json({ message: check.reason || "Cupom inválido" });
      cupomRow = check.cupom;
      if (cupomRow.tipo === "PERCENTUAL" && typeof cupomRow.descontoPerc === "number") {
        desconto =
          (Math.max(0, Math.min(100, cupomRow.descontoPerc)) * base) / 100;
      } else if (cupomRow.tipo === "VALOR" && cupomRow.descontoFixo != null) {
        desconto = Number(cupomRow.descontoFixo);
      } else if (cupomRow.tipo === "PRESENTE") {
        desconto = base;
      }
    }

    const total = Math.max(0, base - desconto);

    const provider = "INTERNAL_FAKE";
    const providerRef = `FAKE-${Date.now()}`;
    const totalDecimal = new Prisma.Decimal(total.toFixed(2));

    const data: Prisma.PagamentoUncheckedCreateInput = {
      usuarioId,
      plano: planoId,
      periodicidade,
      metodo,
      status: total === 0 ? "APROVADO" : "PENDENTE",
      valor: totalDecimal,
      moeda: "BRL",
      provider,
      providerRef,
      cupomId: cupomRow?.id ?? null,
      pagoEm: total === 0 ? new Date() : null,
    };

    const pagamento = await prisma.pagamento.upsert({
      where: { provider_providerRef: { provider, providerRef } },
      update: {
        valor: totalDecimal,
        status: total === 0 ? "APROVADO" : "PENDENTE",
        pagoEm: total === 0 ? new Date() : null,
        cupomId: cupomRow?.id ?? null,
      } as Prisma.PagamentoUncheckedUpdateInput,
      create: data,
    });

    if (total === 0) {
      await upsertSubscription(usuarioId, planoId);
      if (cupomRow) await resgatarCupom(cupomRow.id, usuarioId, pagamento.id);
      return res.json({
        status: "APROVADO",
        pagamento,
        message: "Assinatura ativada pelo cupom",
      });
    }

    if (metodo === "PIX") {
      const payload = `pix:plano=${planoId};user=${usuarioId};pg=${pagamento.id};valor=${total.toFixed(
        2
      )}`;
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { pixCopiaECola: payload },
      });
      const qrCodeUrl = await QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
      });
      return res.json({
        status: "PENDENTE",
        pagamento,
        pix: {
          copiaECola: payload,
          qrCodeUrl,
        },
      });
    }

    if (metodo === "BOLETO") {
      const linhaDigitavel =
        "23790.00000 00000.000000 00000.000000 0 00000000000000";
      return res.json({
        status: "PENDENTE",
        pagamento,
        boleto: { linhaDigitavel, pdfUrl: null },
      });
    }

    if (metodo === "CREDITO" || metodo === "DEBITO") {
      const checkoutUrl = `https://pagador.fake/checkout/${pagamento.id}`;
      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl,
        message: "Pagamento iniciado (simulado)",
      });
    }

    return res.json({
      status: "PENDENTE",
      pagamento,
      message: "Pagamento iniciado (simulado)",
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao iniciar checkout", err });
  }
}

async function resgatarCupom(
  cupomId: string,
  usuarioId: string,
  pagamentoId?: string
) {
  await prisma.$transaction([
    prisma.cupomResgate.create({
      data: { cupomId, usuarioId, pagamentoId: pagamentoId || null },
    }),
    prisma.cupom.update({
      where: { id: cupomId },
      data: { usosAtuais: { increment: 1 } },
    }),
  ]);
}

export async function providerWebhook(req: Request, res: Response) {
  try {
    const { provider, providerEventId, tipo, data } = req.body as {
      provider: string;
      providerEventId: string;
      tipo: "payment_approved" | "payment_canceled" | "payment_refunded";
      data: {
        pagamentoId?: string;
        providerRef?: string;
      };
    };

    // 1) Idempotência: se já vimos esse evento, só retorna 200
    const already = await prisma.eventoPagamento.findUnique({
      where: { providerEventId },
    });
    if (already) {
      return res.status(200).json({ ok: true, idempotent: true });
    }

    await prisma.eventoPagamento.create({
      data: { providerEventId, tipo },
    });

    // 2) Localizar o pagamento
    let pagamento = null as any;

    if (data?.pagamentoId) {
      pagamento = await prisma.pagamento.findUnique({
        where: { id: data.pagamentoId },
      });
    } else if (data?.providerRef) {
      pagamento = await prisma.pagamento.findUnique({
        where: {
          provider_providerRef: {
            provider,
            providerRef: data.providerRef,
          },
        },
      });
    }

    if (!pagamento) {
      return res.status(404).json({ message: "Pagamento não encontrado" });
    }

    const now = new Date();

    // 3) Aplicar efeito no Pagamento + Assinatura
    if (tipo === "payment_approved") {
      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: PagamentoStatus.APROVADO,
          pagoEm: pagamento.pagoEm ?? now,
        },
      });

      // provisionar / atualizar assinatura
      await upsertSubscription(pagamento.usuarioId, pagamento.plano);
    } else if (tipo === "payment_canceled") {
      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: PagamentoStatus.CANCELADO,
          canceladoEm: now,
        },
      });

      await prisma.assinatura.updateMany({
        where: {
          usuarioId: pagamento.usuarioId,
          plano: pagamento.plano,
          ativo: true,
        },
        data: {
          ativo: false,
          canceledAt: now,
        },
      });
    } else if (tipo === "payment_refunded") {
      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: PagamentoStatus.REEMBOLSADO,
          reembolsadoEm: now,
        },
      });

      await prisma.assinatura.updateMany({
        where: {
          usuarioId: pagamento.usuarioId,
          plano: pagamento.plano,
          ativo: true,
        },
        data: {
          ativo: false,
          canceledAt: now,
        },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Webhook billing error:", err);
    return res.status(500).json({ message: "Erro no webhook" });
  }
}

async function upsertSubscription(usuarioId: string, plano: string) {
  const now = new Date();
  await prisma.assinatura.upsert({
    where: { usuarioId },
    update: { plano, startsAt: now, canceledAt: null, ativo: true },
    create: { usuarioId, plano, startsAt: now, ativo: true },
  });
}

type PaymentWebhookBody = {
  event: "payment.paid" | "payment.canceled" | "payment.refunded";
  provider: string;
  providerRef: string;
};

export async function handlePaymentWebhook(req: Request, res: Response) {
  try {
    const { event, provider, providerRef } = req.body as PaymentWebhookBody;

    if (!event || !provider || !providerRef) {
      return res.status(400).json({ message: "Payload de webhook inválido" });
    }

    const pagamento = await prisma.pagamento.findUnique({
      where: {
        provider_providerRef: {
          provider,
          providerRef,
        },
      },
    });

    if (!pagamento) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    switch (event) {
      case "payment.paid": {
        const pg = await approvePaymentAndProvisionSubscription(pagamento.id);
        return res
          .status(200)
          .json({ ok: true, status: "APROVADO", pagamento: pg });
      }
      case "payment.canceled":
      case "payment.refunded": {
        const pg = await deactivateSubscriptionForPayment(pagamento.id);
        return res.status(200).json({
          ok: true,
          status: "SUBSCRIPTION_INACTIVE",
          pagamento: pg,
        });
      }
      default:
        return res.status(200).json({ ok: true, ignored: true });
    }
  } catch (err) {
    console.error("Erro no webhook de pagamento:", err);
    return res
      .status(500)
      .json({ message: "Erro ao processar webhook de pagamento" });
  }
}

export async function redeemGift(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { codigo, planoId, periodicidade } = req.body as {
      codigo: string;
      planoId: string;
      periodicidade: Periodicidade;
    };

    const cupom = await prisma.cupom.findUnique({ where: { codigo } });
    if (!cupom || !cupom.ativo || cupom.tipo !== "PRESENTE") {
      return res.status(400).json({ message: "Presente inválido" });
    }
    if (cupom.expiraEm && cupom.expiraEm < new Date())
      return res.status(400).json({ message: "Presente expirado" });
    if (cupom.usosMax != null && cupom.usosAtuais >= cupom.usosMax)
      return res.status(400).json({ message: "Presente esgotado" });
    if (cupom.plano && cupom.plano !== planoId)
      return res
        .status(400)
        .json({ message: "Presente não válido para este plano" });
    if (cupom.periodicidade && cupom.periodicidade !== periodicidade)
      return res.status(400).json({
        message: "Presente não válido para esta periodicidade",
      });
    if (
      cupom.concedidoParaUsuarioId &&
      cupom.concedidoParaUsuarioId !== usuarioId &&
      !cupom.transferivel
    ) {
      return res
        .status(400)
        .json({ message: "Este presente não é para este usuário" });
    }

    if (planoId === "ESCOLINHA_PRO" && periodicidade === "Anual") {
      return res
        .status(400)
        .json({ message: "ESCOLINHA_PRO é apenas mensal" });
    }

    const pagamento = await prisma.pagamento.create({
      data: {
        usuarioId,
        plano: planoId,
        periodicidade,
        metodo: "PIX",
        status: "APROVADO",
        valor: 0,
        moeda: "BRL",
        provider: "INTERNAL_FAKE",
        providerRef: `GIFT-${Date.now()}`,
        cupomId: cupom.id,
        pagoEm: new Date(),
      },
    });

    await upsertSubscription(usuarioId, planoId);
    await resgatarCupom(cupom.id, usuarioId, pagamento.id);

    res.json({
      status: "APROVADO",
      pagamento,
      message: "Presente resgatado e assinatura ativada.",
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao resgatar presente", err });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const now = new Date();

    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
    if (!a || !a.ativo)
      return res
        .status(400)
        .json({ message: "Você não possui assinatura ativa" });

    await prisma.assinatura.update({
      where: { usuarioId },
      data: { ativo: false, canceledAt: now },
    });

    res.json({ ok: true, message: "Assinatura cancelada" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao cancelar assinatura", err });
  }
}

export async function renewSubscription(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const now = new Date();

    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
    if (!a) return res.status(400).json({ message: "Sem assinatura para renovar" });

    await prisma.assinatura.update({
      where: { usuarioId },
      data: { ativo: true, canceledAt: null, startsAt: now },
    });

    res.json({ ok: true, message: "Assinatura reativada" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao reativar assinatura", err });
  }
}

export async function switchPlan(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { novoPlano } = req.body as { novoPlano: string };

    const plan = findPlan(novoPlano);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    await upsertSubscription(usuarioId, novoPlano);
    res.json({ ok: true, message: "Plano alterado", plano: novoPlano });
  } catch (err) {
    res.status(500).json({ message: "Erro ao alterar plano", err });
  }
}
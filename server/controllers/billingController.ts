import { Request, Response } from "express";
import {
  PrismaClient,
  Prisma,
  MetodoPagamento,
  Periodicidade,
  PagamentoStatus,
} from "@prisma/client";
import QRCode from "qrcode";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import * as mercadopagoModule from "mercadopago";
import { prisma } from "../prisma.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mercadopago: any =
  (mercadopagoModule as any).default ?? (mercadopagoModule as any);


const API_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:3001").replace(
  /\/+$/,
  ""
);
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const HAS_MERCADO_PAGO =
  !!MP_ACCESS_TOKEN &&
  mercadopago &&
  typeof mercadopago.configure === "function";

if (HAS_MERCADO_PAGO) {
  mercadopago.configure({ access_token: MP_ACCESS_TOKEN });
} else if (!MP_ACCESS_TOKEN) {
  console.warn(
    "[billing] MP_ACCESS_TOKEN não definido. PIX real ficará DESATIVADO (modo fake)."
  );
} else {
  console.warn(
    "[billing] Pacote 'mercadopago' não expõe .configure(); provavelmente é a SDK nova (v2). Rodando em modo fake."
  );
}

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

function addMonths(d: Date, months: number) {
  const dt = new Date(d.getTime());
  dt.setMonth(dt.getMonth() + months);
  return dt;
}

function diffDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function getSubscriptionReadOnly(usuarioId: string) {
  const now = new Date();
  let a = await prisma.assinatura.findUnique({ where: { usuarioId } });

  // ✅ NÃO CRIA NADA AUTOMATICAMENTE
  if (!a) return null;

  // (Opcional) Se quiser manter a regra de bloquear trial expirado automaticamente:
  if ((a as any).status === "TRIAL" && (a as any).trialEndsAt && now > (a as any).trialEndsAt) {
    a = await prisma.assinatura.update({
      where: { usuarioId },
      data: {
        status: "BLOQUEADA",
        ativo: false,
        canceledAt: now,
        bloqueadoEm: now,
      } as any,
    });
  }

  return a;
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

const roleToDefaultPlan: Record<string, string> = {
  Atleta: "ATLETA_PRO",
  Olheiro: "OLHEIRO_PRO",
  Professor: "PROFESSOR_PRO",
  Escolinha: "ESCOLINHA_PRO",
  Clube: "ESCOLINHA_PRO",
  Admin: "ATLETA_PRO",
};

function getUserId(req: Request) {
  const r = req as AuthenticatedRequest as any;
  return r.userId ?? r.authUser?.id ?? r.user?.id;
}

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

    await upsertSubscriptionTx(tx, pg.usuarioId, pg.plano, pg.periodicidade);
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
    data: {
      ativo: false,
      canceledAt: now,
      status: "BLOQUEADA",
      bloqueadoEm: now,
    } as any,
  });

  return pagamento;
}

export async function getPlans(req: Request, res: Response) {
  res.json({ plans: PLANS });
}

export async function getMyBilling(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const pagamentos = await prisma.pagamento.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });

    const cupons = await prisma.cupomResgate.findMany({
      where: { usuarioId },
      include: { cupom: true },
      orderBy: { resgatadoEm: "desc" },
    });

    const assinaturaSafe = await getSubscriptionReadOnly(usuarioId);

    const now = new Date();
    const trialEndsAt = (assinaturaSafe as any)?.trialEndsAt as Date | null;
    const status = ((assinaturaSafe as any)?.status as string) ?? "SEM_ASSINATURA";
    const trialAtivo = status === "TRIAL" && trialEndsAt && now <= trialEndsAt;
    const diasRestantes = trialEndsAt ? diffDays(trialEndsAt, now) : null;
    const precisaEscolherPagamento =
      trialAtivo && diasRestantes != null && diasRestantes <= 7;
    const bloqueado = status === "BLOQUEADA";
    const metodoPreferido = (assinaturaSafe as any)?.metodoPreferido ?? null;

    const billingState = {
      status,
      trialAtivo,
      trialEndsAt,
      diasRestantes,
      precisaEscolherPagamento,
      metodoPreferido,
      bloqueado,
    };
    res.json({ assinatura: assinaturaSafe, pagamentos, cupons, billingState });
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

export async function startTrial(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { planoId, periodicidade } = req.body as {
      planoId: string;
      periodicidade: Periodicidade;
    };

    const plan = findPlan(planoId);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }
    if (planoId === "ESCOLINHA_PRO" && periodicidade === "Anual") {
      return res.status(400).json({ message: "ESCOLINHA_PRO é apenas mensal" });
    }

    const now = new Date();

    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });

    // ✅ já está ativa ou em trial -> não cria de novo
    if (a?.status === "ATIVA") {
      return res.status(400).json({ code: "ALREADY_ACTIVE", message: "Você já possui assinatura ativa." });
    }
    if (a?.status === "TRIAL" && (a as any).trialEndsAt && now <= (a as any).trialEndsAt) {
      return res.status(400).json({ code: "TRIAL_ALREADY_ACTIVE", message: "Seu trial já está ativo." });
    }

    // ✅ se você quer impedir “2º trial” pra sempre:
    if ((a as any)?.trialStartsAt) {
      return res.status(400).json({ code: "TRIAL_ALREADY_USED", message: "Você já utilizou o mês grátis." });
    }

    const trialEndsAt = addMonths(now, 1);

    const out = await prisma.assinatura.upsert({
      where: { usuarioId },
      update: {
        plano: planoId,
        periodicidade,
        ativo: true,
        startsAt: now,
        status: "TRIAL",
        trialStartsAt: now,
        trialEndsAt,
        renovaEm: trialEndsAt,
        canceledAt: null,
        bloqueadoEm: null,
        lembreteEnviado: false,
      } as any,
      create: {
        usuarioId,
        plano: planoId,
        periodicidade,
        ativo: true,
        startsAt: now,
        status: "TRIAL",
        trialStartsAt: now,
        trialEndsAt,
        renovaEm: trialEndsAt,
        canceledAt: null,
        lembreteEnviado: false,
      } as any,
    });

    return res.json({ ok: true, assinatura: out });
  } catch (err) {
    console.error("Erro startTrial:", err);
    return res.status(500).json({ message: "Erro ao iniciar trial" });
  }
}

export async function applyCoupon(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

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
      desconto = (Math.max(0, Math.min(100, c.descontoPerc)) * base) / 100;
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

export async function startCheckout(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { planoId, periodicidade, metodo, cupom, pagador, cartao } =
      req.body as StartCheckoutBody;

    const a = await getSubscriptionReadOnly(usuarioId);
    const now = new Date();
    const status = ((a as any)?.status as string) ?? "SEM_ASSINATURA";
    const trialEndsAt = (a as any)?.trialEndsAt as Date | null;
    const trialAtivo = status === "TRIAL" && trialEndsAt && now <= trialEndsAt;
    const diasRestantes = trialEndsAt ? diffDays(trialEndsAt, now) : null;
    let metodoFinal = metodo;
    if (!metodoFinal) {
      metodoFinal = (a as any).metodoPreferido;
    }
    if (!metodoFinal) {
      return res.status(400).json({ message: "Escolha um método de pagamento" });
    }

    if (trialAtivo && (diasRestantes == null || diasRestantes > 7)) {
      return res.status(403).json({
        code: "TRIAL_ACTIVE",
        message: "Trial ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.",
        trialEndsAt,
        diasRestantes,
      });
    }

    const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
    if (!METODOS_VALIDOS.includes(metodoFinal)) {
      return res.status(400).json({ message: "Método de pagamento inválido" });
    }

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    if (planoId === "ESCOLINHA_PRO" && periodicidade === "Anual") {
      return res
        .status(400)
        .json({ message: "ESCOLINHA_PRO é apenas mensal" });
    }

    const plan = findPlan(planoId);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    if (metodoFinal === "PIX") {
      if (!pagador?.nome || !pagador?.email) {
        return res
          .status(400)
          .json({ message: "Informe nome e e-mail para PIX" });
      }
    }

    if (metodoFinal === "BOLETO") {
      if (!pagador?.nome || !pagador?.email || !pagador?.cpf) {
        return res.status(400).json({
          message: "Informe nome, e-mail e CPF para boleto",
        });
      }
    }

    if (metodoFinal === "CREDITO" || metodoFinal === "DEBITO") {
      const num = onlyDigits(cartao?.numero || "");
      const cvv = onlyDigits(cartao?.cvv || "");
      const validadeOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(cartao?.validade || "");

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
      if (
        cupomRow.tipo === "PERCENTUAL" &&
        typeof cupomRow.descontoPerc === "number"
      ) {
        desconto =
          (Math.max(0, Math.min(100, cupomRow.descontoPerc)) * base) / 100;
      } else if (cupomRow.tipo === "VALOR" && cupomRow.descontoFixo != null) {
        desconto = Number(cupomRow.descontoFixo);
      } else if (cupomRow.tipo === "PRESENTE") {
        desconto = base;
      }
    }

    const total = Math.max(0, base - desconto);

    const totalToCharge = total;

    const totalDecimal = new Prisma.Decimal(totalToCharge.toFixed(2));
    const provider = HAS_MERCADO_PAGO ? "MERCADOPAGO" : "INTERNAL_FAKE";

    let pagamento = await prisma.pagamento.create({
      data: {
        usuarioId,
        plano: planoId,
        periodicidade,
        metodo: metodoFinal,
        status:
          totalToCharge === 0
            ? PagamentoStatus.APROVADO
            : PagamentoStatus.PENDENTE,
        valor: totalDecimal,
        moeda: "BRL",
        provider,
        providerRef: `TEMP-${Date.now()}`,
        cupomId: cupomRow?.id ?? null,
        pagoEm: totalToCharge === 0 ? new Date() : null,
      },
    });

   if (totalToCharge === 0)  {
      await upsertSubscription(usuarioId, planoId, periodicidade);
      if (cupomRow) await resgatarCupom(cupomRow.id, usuarioId, pagamento.id);

      return res.json({
        status: "APROVADO",
        pagamento,
        message: "Assinatura ativada sem cobrança (cupom/presente).",
      });
    }

    if (!HAS_MERCADO_PAGO) {
     const providerRef = `FAKE-${Date.now()}`;
      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          provider: "INTERNAL_FAKE",
          providerRef,
        },
      });

      if (metodoFinal === "PIX") {
        const payload = `pix:plano=${planoId};user=${usuarioId};pg=${pagamento.id};valor=${totalToCharge.toFixed(
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

      if (metodoFinal === "BOLETO") {
        const linhaDigitavel =
          "23790.00000 00000.000000 00000.000000 0 00000000000000";
        return res.json({
          status: "PENDENTE",
          pagamento,
          boleto: { linhaDigitavel, pdfUrl: null },
        });
      }

      const checkoutUrl = `https://pagador.fake/checkout/${pagamento.id}`;
      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl,
        message: "Pagamento iniciado (simulado)",
      });
    }

    if (metodoFinal === "PIX") {
      try {
        const mpResp: any = await mercadopago.payment.create({
          transaction_amount: Number(totalToCharge.toFixed(2)),
          description: `Assinatura ${plan.title} (${periodicidade})`,
          payment_method_id: "pix",
          payer: {
            email: pagador!.email,
            first_name: pagador!.nome,
            identification: pagador!.cpf
              ? { type: "CPF", number: onlyDigits(pagador!.cpf) }
              : undefined,
          },
          notification_url: `${API_BASE_URL}/api/billing/mercadopago/webhook`,
          metadata: {
            pagamentoId: pagamento.id,
            usuarioId,
            planoId,
          },
          external_reference: pagamento.id,
        });

        const mpBody: any = mpResp?.body || mpResp;

        const qr_code =
          mpBody.point_of_interaction?.transaction_data?.qr_code ?? null;
        const qr_code_base64 =
          mpBody.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

        const qrCodeUrl =
          typeof qr_code_base64 === "string"
            ? `data:image/png;base64,${qr_code_base64}`
            : null;

        pagamento = await prisma.pagamento.update({
          where: { id: pagamento.id },
          data: {
            provider: "MERCADOPAGO",
            providerRef: String(mpBody.id),
            pixCopiaECola: qr_code,
          },
        });

        return res.json({
          status: "PENDENTE",
          pagamento,
          pix: {
            copiaECola: qr_code,
            qrCodeUrl,
          },
          message: "Pagamento PIX criado. A assinatura será liberada após confirmação do pagamento.",
        });
      } catch (err: any) {
        console.error(
          "Erro ao criar pagamento PIX Mercado Pago:",
          err?.response?.data || err
        );
        return res.status(500).json({
          message: "Falha ao criar pagamento PIX com Mercado Pago",
          detalhe: err?.response?.data || String(err),
        });
      }
    }

    try {
      const mpPrefResp: any = await mercadopago.preferences.create({
        items: [
          {
            title: plan.title,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(totalToCharge.toFixed(2)),
          },
        ],
        payer: {
          name: pagador?.nome,
          email: pagador?.email,
        },
        metadata: {
          pagamentoId: pagamento.id,
          usuarioId,
          planoId,
        },
        external_reference: pagamento.id,
        notification_url: `${API_BASE_URL}/api/billing/mercadopago/webhook`,
      });

      const prefBody: any = mpPrefResp?.body || mpPrefResp;

      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          provider: "MERCADOPAGO",
          providerRef: String(prefBody.id),
        },
      });

      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl: prefBody.init_point,
        sandboxCheckoutUrl: prefBody.sandbox_init_point,
        message: "Redirecione o usuário para o checkout do Mercado Pago.",
      });
    } catch (err: any) {
      console.error(
        "Erro ao criar preference Mercado Pago:",
        err?.response?.data || err
      );
      return res.status(500).json({
        message: "Falha ao criar checkout Mercado Pago",
        detalhe: err?.response?.data || String(err),
      });
    }
  } catch (err: any) {
    console.error("Erro em startCheckout:", err?.response?.data || err);
    return res.status(500).json({
      message: "Erro ao iniciar checkout",
      detalhe: err?.response?.data || String(err),
    });
  }
}

type PaymentWebhookBody = {
  event: "payment.paid" | "payment.canceled" | "payment.refunded";
  provider: string;
  providerRef: string;
};

export async function requireActiveSubscription(req: AuthenticatedRequest, res: Response, next: any) {
  const usuarioId = req.userId;
  if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

  const a = await getSubscriptionReadOnly(usuarioId);

  if (!a) {
    return res.status(402).json({ code: "SUBSCRIPTION_REQUIRED" });
  }

  const now = new Date();
  const status = (a as any).status as string;
  const trialEndsAt = (a as any).trialEndsAt as Date | null;
  const trialAtivo = status === "TRIAL" && trialEndsAt && now <= trialEndsAt;
  const bloqueado = status === "BLOQUEADA" || (!trialAtivo && status !== "ATIVA");
  if (bloqueado) return res.status(402).json({ code: "SUBSCRIPTION_BLOCKED" });

  next();
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

    const already = await prisma.eventoPagamento.findUnique({
      where: { providerEventId },
    });
    if (already) {
      return res.status(200).json({ ok: true, idempotent: true });
    }

    await prisma.eventoPagamento.create({
      data: { providerEventId, tipo },
    });

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

    if (tipo === "payment_approved") {
      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: {
          status: PagamentoStatus.APROVADO,
          pagoEm: pagamento.pagoEm ?? now,
        },
      });

      await upsertSubscription(
        pagamento.usuarioId,
        pagamento.plano,
        pagamento.periodicidade
      );
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

async function upsertSubscription(
  usuarioId: string,
  plano: string,
  periodicidade: Periodicidade
) {
  const now = new Date();
  const months = periodicidade === "Mensal" ? 1 : 12;
  const renovaEm = addMonths(now, months);

  await prisma.assinatura.upsert({
    where: { usuarioId },
    update: {
      plano,
      periodicidade,
      startsAt: now,
      renovaEm,
      ativo: true,
      canceledAt: null,
      status: "ATIVA",
      bloqueadoEm: null,
      trialStartsAt: null,
      trialEndsAt: null,
      lembreteEnviado: false,
    } as any,
    create: {
      usuarioId,
      plano,
      periodicidade,
      startsAt: now,
      renovaEm,
      ativo: true,

      status: "ATIVA",
      lembreteEnviado: false,
    } as any,
  });
}

async function upsertSubscriptionTx(
  tx: PrismaClient | Prisma.TransactionClient,
  usuarioId: string,
  plano: string,
  periodicidade: Periodicidade
) {
  const now = new Date();
  const months = periodicidade === "Mensal" ? 1 : 12;
  const renovaEm = addMonths(now, months);

  await tx.assinatura.upsert({
    where: { usuarioId },
    update: {
      plano,
      periodicidade,
      startsAt: now,
      renovaEm,
      ativo: true,
      canceledAt: null,
      status: "ATIVA",
      bloqueadoEm: null,
      trialStartsAt: null,
      trialEndsAt: null,
      lembreteEnviado: false,
    } as any,
    create: {
      usuarioId,
      plano,
      periodicidade,
      startsAt: now,
      renovaEm,
      ativo: true,
      status: "ATIVA",
      lembreteEnviado: false,
    } as any,
  });
}

export async function setPreferredPaymentMethod(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { metodoFinal } = req.body as { metodoFinal: MetodoPagamento };

    const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
    if (!METODOS_VALIDOS.includes(metodoFinal)) {
      return res.status(400).json({ message: "Método inválido" });
    }

    const a = await getSubscriptionReadOnly(usuarioId);
    if (!a) {
      return res.status(400).json({ message: "Você ainda não iniciou um trial nem possui assinatura." });
    }

    await prisma.assinatura.update({
      where: { usuarioId },
      data: {
        metodoPreferido: metodoFinal,
        metodoPreferidoDefinidoEm: new Date(),
      } as any,
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao salvar método preferido", err });
  }
}

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


export async function mercadoPagoWebhook(req: Request, res: Response) {
  try {
    if (!HAS_MERCADO_PAGO) {
      console.warn(
        "[billing] Webhook Mercado Pago recebido, mas MP_ACCESS_TOKEN não está configurado."
      );
    }

    const paymentIdRaw =
      (req.query["data.id"] as string) ||
      (req.query.id as string) ||
      req.body?.data?.id ||
      (req.body?.resource
        ? String(req.body.resource).split("/").pop()
        : null);

    if (!paymentIdRaw) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const mpResp: any = await mercadopago.payment.get(paymentIdRaw as string);
    const p: any = mpResp?.body || mpResp;

    const status: string = p.status;
    const mpId = String(p.id);
    const externalRef = p.external_reference as string | null;
    const meta = p.metadata || {};

    const pagamento = await prisma.pagamento.findFirst({
      where: {
        OR: [
          meta.pagamentoId ? { id: String(meta.pagamentoId) } : undefined,
          externalRef ? { id: String(externalRef) } : undefined,
          { provider: "MERCADOPAGO", providerRef: mpId },
        ].filter(Boolean) as any,
      },
    });

    if (!pagamento) {
      console.warn(
        "[billing] Pagamento não encontrado para webhook Mercado Pago",
        paymentIdRaw
      );
      return res.status(200).json({ ok: true, ignored: true });
    }

    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        provider: "MERCADOPAGO",
        providerRef: mpId,
      },
    });

    const now = new Date();

    if (status === "approved") {
      await approvePaymentAndProvisionSubscription(pagamento.id);
    } else if (status === "cancelled" || status === "rejected") {
      await prisma.$transaction([
        prisma.pagamento.update({
          where: { id: pagamento.id },
          data: {
            status: PagamentoStatus.CANCELADO,
            canceladoEm: now,
          },
        }),
        prisma.assinatura.updateMany({
          where: {
            usuarioId: pagamento.usuarioId,
            plano: pagamento.plano,
            ativo: true,
          },
          data: {
            ativo: false,
            canceledAt: now,
          },
        }),
      ]);
    } else if (status === "refunded" || status === "charged_back") {
      await prisma.$transaction([
        prisma.pagamento.update({
          where: { id: pagamento.id },
          data: {
            status: PagamentoStatus.REEMBOLSADO,
            reembolsadoEm: now,
          },
        }),
        prisma.assinatura.updateMany({
          where: {
            usuarioId: pagamento.usuarioId,
            plano: pagamento.plano,
            ativo: true,
          },
          data: {
            ativo: false,
            canceledAt: now,
          },
        }),
      ]);
    } else {
      return res.status(200).json({ ok: true, ignored: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Erro webhook Mercado Pago:", err?.response?.data || err);
    return res.status(500).json({
      message: "Erro ao processar webhook Mercado Pago",
      detalhe: err?.response?.data || String(err),
    });
  }
}

export async function redeemGift(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

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

    await upsertSubscription(usuarioId, planoId, periodicidade);
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
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

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
  return res.status(400).json({
    message:
      "Reativação manual desativada. Para reativar, finalize um pagamento (PIX/cartão/boleto) e aguarde aprovação.",
  });
}

export async function switchPlan(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const { novoPlano } = req.body as { novoPlano: string };

    const plan = findPlan(novoPlano);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    const atual = await prisma.assinatura.findUnique({
      where: { usuarioId },
    });

    const periodicidade =
      (atual?.periodicidade as Periodicidade | null) ?? Periodicidade.Mensal;

    return res.status(400).json({
      message:
        "Troca de plano exige um novo checkout e aprovação de pagamento. Inicie o checkout do novo plano.",
    });

  } catch (err) {
    res.status(500).json({ message: "Erro ao alterar plano", err });
  }
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function checkExpiringSubscriptions(req: Request, res: Response) {
  try {
    const daysBefore = Number(process.env.BILLING_DAYS_BEFORE_REMINDER || "7") || 7;
    const graceDaysPaid = Number(process.env.BILLING_GRACE_DAYS || "7") || 7;
    const now = new Date();
    const limitReminder = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const assinaturas = await prisma.assinatura.findMany({
      where: {
        OR: [
          { status: "TRIAL" as any },
          { status: "ATIVA" as any },
        ],
      },
      include: {
        usuario: {
          select: { id: true, email: true, nome: true, nomeDeUsuario: true },
        },
      },
    });

    const trialExpiring: Array<{
      usuarioId: string;
      email: string | null;
      nome: string | null;
      plano: string;
      trialEndsAt: Date;
      diasRestantes: number;
    }> = [];

    const paidExpiring: Array<{
      usuarioId: string;
      email: string | null;
      nome: string | null;
      plano: string;
      renovaEm: Date;
      diasRestantes: number;
    }> = [];

    let blockedCount = 0;
    let remindersCount = 0;

    for (const a of assinaturas as any[]) {
      const email = a.usuario?.email ?? null;
      const nome = a.usuario?.nome ?? a.usuario?.nomeDeUsuario ?? null;

      if (a.status === "TRIAL") {
        if (!a.trialEndsAt) continue;

        if (now > a.trialEndsAt) {
          await prisma.assinatura.update({
            where: { usuarioId: a.usuarioId },
            data: {
              status: "BLOQUEADA",
              ativo: false,
              canceledAt: now,
              bloqueadoEm: now,
            } as any,
          });
          blockedCount++;
          continue;
        }

        const diasRestantes = diffDays(a.trialEndsAt, now);
        if (a.trialEndsAt >= now && a.trialEndsAt <= limitReminder) {
          trialExpiring.push({
            usuarioId: a.usuarioId,
            email,
            nome,
            plano: a.plano,
            trialEndsAt: a.trialEndsAt,
            diasRestantes,
          });

          if (!a.lembreteEnviado) {
            await prisma.assinatura.update({
              where: { usuarioId: a.usuarioId },
              data: { lembreteEnviado: true } as any,
            });
            remindersCount++;
          }
        }

        continue;
      }

      if (a.status === "ATIVA") {
        const due = a.renovaEm as Date | null;
        if (!due) continue;

        const diasRestantes = diffDays(due, now);

        const limiteGrace = addDays(due, graceDaysPaid);
        if (now > limiteGrace) {
          await prisma.assinatura.updateMany({
            where: { usuarioId: a.usuarioId, status: "ATIVA" as any },
            data: {
              status: "BLOQUEADA",
              ativo: false,
              canceledAt: now,
              bloqueadoEm: now,
            } as any,
          });
          blockedCount++;
          continue;
        }

        if (due >= now && due <= limitReminder) {
          paidExpiring.push({
            usuarioId: a.usuarioId,
            email,
            nome,
            plano: a.plano,
            renovaEm: due,
            diasRestantes,
          });
        }
      }
    }

    return res.json({
      ok: true,
      daysBefore,
      graceDaysPaid,
      blockedCount,
      remindersCount,
      trialExpiringCount: trialExpiring.length,
      paidExpiringCount: paidExpiring.length,
      trialExpiring,
      paidExpiring,
    });
  } catch (err) {
    console.error("Erro ao checar assinaturas próximas do vencimento:", err);
    return res.status(500).json({ message: "Erro ao checar assinaturas" });
  }
}
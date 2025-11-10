import { Request, Response } from "express";
import { PrismaClient, Prisma, MetodoPagamento, Periodicidade, TipoCupom } from "@prisma/client";
import QRCode from "qrcode";

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

function onlyDigits(s: string) { return (s || "").replace(/\D+/g, ""); }
function luhnOk(num: string) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num.charAt(i), 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const PLANS = [
  {
    id: "ATLETA_PRO",
    title: "Atleta Pro",
    monthly: 19.90,
    annual: 199.00,
    benefits: [
      "Sem anúncios no feed",
      "Sem limite de treinos físicos",
      "Desafios premium e estatísticas detalhadas",
      "Histórico completo com exportação",
      "Badge Pro no perfil",
    ],
  },
  {
    id: "OLHEIRO_PRO",
    title: "Olheiro Pro",
    monthly: 29.90,
    annual: 299.00,
    benefits: [
      "Sem anúncios no feed",
      "Listas privadas de observação ilimitadas",
      "Filtros avançados e relatórios por atleta",
      "Favoritos ilimitados e contatos diretos",
      "Badge Pro e suporte prioritário",
    ],
  },
  {
    id: "PROFESSOR_PRO",
    title: "Professor Pro",
    monthly: 39.90,
    annual: 399.00,
    benefits: [
      "Sem anúncios no feed",
      "Sem limite de treinos pela escolinha",
      "Rotinas de treino (mensal/semana) e reuso de treinos",
      "Até 100 Treinos Salvos e analytics de turma",
      "Mensagens e convites ilimitados",
      "Exportação (CSV) e suporte prioritário",
    ],
  },
  {
    id: "ESCOLINHA_PRO",
    title: "Escolinha Pro",
    monthly: 49.90,
    annual: 499.00,
    benefits: [
      "Sem anúncios no feed",
      "Turmas, treinos e relatórios ilimitados",
      "Branding (logo) nas páginas de turmas",
      "Destaque em eventos/peneiras",
      "Exportações e integrações (CSV), suporte prioritário",
    ],
  },
] as const;

function getUserId(req: Request) {
  return (req as any).userId ?? (req as any).user?.id;
}

export async function getPlans(req: Request, res: Response) {
  res.json({ plans: PLANS });
}

export async function getMyBilling(req: Request, res: Response) {
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
  return PLANS.find(p => p.id === planoId);
}

function priceFor(planoId: string, period: Periodicidade): number {
  const p = findPlan(planoId);
  if (!p) throw new Error("Plano inválido");
  return period === "Mensal" ? p.monthly : p.annual;
}

async function computeCouponDiscount(codigo: string, usuarioId: string, planoId: string, periodicidade: Periodicidade) {
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

  if (cupom.tipo === "PRESENTE" && cupom.concedidoParaUsuarioId && cupom.concedidoParaUsuarioId !== usuarioId) {
    return { ok: false, reason: "Este presente não é para este usuário" };
  }

  return { ok: true, cupom };
}

export async function applyCoupon(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { codigo, planoId, periodicidade } = req.body as { codigo: string, planoId: string, periodicidade: Periodicidade };
    const pl = findPlan(planoId);
    if (!pl) return res.status(400).json({ message: "Plano inválido" });

    const base = priceFor(planoId, periodicidade);
    const check = await computeCouponDiscount(codigo, usuarioId, planoId, periodicidade);
    if (!check.ok || !check.cupom) {
      return res.status(400).json({ message: check.reason || "Cupom inválido" });
    }

    const c = check.cupom;
    let desconto = 0;
    if (c.tipo === "PERCENTUAL" && typeof c.descontoPerc === "number") {
      desconto = Math.max(0, Math.min(100, c.descontoPerc)) * base / 100;
    } else if (c.tipo === "VALOR" && c.descontoFixo) {
      desconto = Number(c.descontoFixo);
    } else if (c.tipo === "PRESENTE") {
      desconto = base;
    }

    const total = Math.max(0, base - desconto);

    res.json({
      planoId, periodicidade, base,
      desconto: Number(desconto.toFixed(2)),
      total: Number(total.toFixed(2)),
      cupom: { codigo: c.codigo, tipo: c.tipo }
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao validar cupom", err });
  }
}

export async function startCheckout(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { planoId, periodicidade, metodo, cupom, pagador, cartao } = req.body as StartCheckoutBody;

    const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
    if (!METODOS_VALIDOS.includes(metodo)) {
      return res.status(400).json({ message: "Método de pagamento inválido" });
    }
    if (!["Mensal", "Anual"].includes(periodicidade)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const plan = findPlan(planoId);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    if (metodo === "PIX") {
      if (!pagador?.nome || !pagador?.email) {
        return res.status(400).json({ message: "Informe nome e e-mail para PIX" });
      }
    }
    if (metodo === "BOLETO") {
      if (!pagador?.nome || !pagador?.email || !pagador?.cpf) {
        return res.status(400).json({ message: "Informe nome, e-mail e CPF para boleto" });
      }
    }
    if (metodo === "CREDITO" || metodo === "DEBITO") {
      const num = onlyDigits(cartao?.numero || "");
      const cvv = onlyDigits(cartao?.cvv || "");
      const validadeOk = /^[0-1]\d\/\d{2}$/.test(cartao?.validade || "");
      if (!cartao?.nomeImpresso || num.length < 13 || !luhnOk(num) || !validadeOk || !(cvv.length === 3 || cvv.length === 4)) {
        return res.status(400).json({ message: "Dados de cartão inválidos" });
      }
      if (!pagador?.nome || !pagador?.email) {
        return res.status(400).json({ message: "Informe nome e e-mail do titular" });
      }
    }

    let base = priceFor(planoId, periodicidade);
    let desconto = 0;
    let cupomRow: any = null;

    if (cupom) {
      const check = await computeCouponDiscount(cupom, usuarioId, planoId, periodicidade);
      if (!check.ok || !check.cupom) return res.status(400).json({ message: check.reason || "Cupom inválido" });
      cupomRow = check.cupom;
      if (cupomRow.tipo === "PERCENTUAL" && typeof cupomRow.descontoPerc === "number") {
        desconto = Math.max(0, Math.min(100, cupomRow.descontoPerc)) * base / 100;
      } else if (cupomRow.tipo === "VALOR" && cupomRow.descontoFixo) {
        desconto = Number(cupomRow.descontoFixo);
      } else if (cupomRow.tipo === "PRESENTE") {
        desconto = base;
      }
    }

    const total = Math.max(0, base - desconto);

    const provider = 'INTERNAL_FAKE';
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
      return res.json({ status: "APROVADO", pagamento, message: "Assinatura ativada pelo cupom" });
    }

    if (metodo === "PIX") {
      const payload = `pix:plano=${planoId};user=${usuarioId};pg=${pagamento.id};valor=${total.toFixed(2)}`;
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { pixCopiaECola: payload },
      });
      const qrCodeUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
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
      const linhaDigitavel = "23790.00000 00000.000000 00000.000000 0 00000000000000";
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

    return res.json({ status: "PENDENTE", pagamento, message: "Pagamento iniciado (simulado)" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao iniciar checkout", err });
  }
}

async function resgatarCupom(cupomId: string, usuarioId: string, pagamentoId?: string) {
  await prisma.$transaction([
    prisma.cupomResgate.create({
      data: { cupomId, usuarioId, pagamentoId: pagamentoId || null },
    }),
    prisma.cupom.update({
      where: { id: cupomId },
      data: { usosAtuais: { increment: 1 } },
    })
  ]);
}

async function upsertSubscription(usuarioId: string, plano: string) {
  const now = new Date();
  await prisma.assinatura.upsert({
    where: { usuarioId },
    update: { plano, startsAt: now, canceledAt: null, ativo: true },
    create: { usuarioId, plano, startsAt: now, ativo: true },
  });
}

export async function redeemGift(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const { codigo, planoId, periodicidade } = req.body as { codigo: string, planoId: string, periodicidade: Periodicidade };

    const cupom = await prisma.cupom.findUnique({ where: { codigo } });
    if (!cupom || !cupom.ativo || cupom.tipo !== "PRESENTE") {
      return res.status(400).json({ message: "Presente inválido" });
    }
    if (cupom.expiraEm && cupom.expiraEm < new Date()) return res.status(400).json({ message: "Presente expirado" });
    if (cupom.usosMax != null && cupom.usosAtuais >= cupom.usosMax) return res.status(400).json({ message: "Presente esgotado" });
    if (cupom.plano && cupom.plano !== planoId) return res.status(400).json({ message: "Presente não válido para este plano" });
    if (cupom.periodicidade && cupom.periodicidade !== periodicidade) return res.status(400).json({ message: "Presente não válido para esta periodicidade" });
    if (cupom.concedidoParaUsuarioId && cupom.concedidoParaUsuarioId !== usuarioId && !cupom.transferivel) {
      return res.status(400).json({ message: "Este presente não é para este usuário" });
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

    res.json({ status: "APROVADO", pagamento, message: "Presente resgatado e assinatura ativada." });
  } catch (err) {
    res.status(500).json({ message: "Erro ao resgatar presente", err });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const now = new Date();

    const a = await prisma.assinatura.findUnique({ where: { usuarioId } });
    if (!a || !a.ativo) return res.status(400).json({ message: "Você não possui assinatura ativa" });

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
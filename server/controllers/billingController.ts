import { Request, Response } from "express";
import {
  PrismaClient,
  Prisma,
  MetodoPagamento,
  Periodicidade,
  PagamentoStatus,
} from "@prisma/client";
import QRCode from "qrcode";
import * as mercadopagoModule from "mercadopago";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

function metodologiasIds() {
  return ["METH_POSICIONAL", "METH_FORCA", "METH_TECNICA", "METH_TATICO", "METH_MENTAL"];
}

function allowedPlanIdsByTipo(tipoRaw: string) {
  const tipo = String(tipoRaw || "").trim().toLowerCase();

  if (tipo === "olheiro") {
    return ["OLHEIRO_PRO"];
  }

  if (tipo === "professor") {
    return ["PROFESSOR_PRO", "PROFESSOR_LEARNING", "PROFESSOR_PLUS", ...metodologiasIds()];
  }

  if (tipo === "atleta") {
    return ["ATLETA_PRO", "ATLETA_LEARNING", "ATLETA_PLUS", ...metodologiasIds()];
  }

  if (tipo === "clube" || tipo === "escolinha" || tipo === "organizacoes" || tipo === "organizações") {
    return ["ORGANIZACOES_PRO", "ORGANIZACOES_LEARNING", "ORGANIZACOES_PLUS", ...metodologiasIds()];
  }

  if (tipo === "admin") {
    return [
      "ATLETA_PRO","ATLETA_LEARNING","ATLETA_PLUS",
      "OLHEIRO_PRO","OLHEIRO_LEARNING","OLHEIRO_PLUS",
      "PROFESSOR_PRO","PROFESSOR_LEARNING","PROFESSOR_PLUS",
      "ORGANIZACOES_PRO","ORGANIZACOES_LEARNING","ORGANIZACOES_PLUS",
      ...metodologiasIds()
    ];
  }

  return [];
}

function assertPlanoPermitido(tipoUsuario: string, planoId: string) {
  const allowed = allowedPlanIdsByTipo(tipoUsuario);
  if (!allowed.includes(planoId)) {
    const err: any = new Error("Plano não permitido para este tipo de usuário.");
    err.statusCode = 403;
    err.code = "PLAN_NOT_ALLOWED";
    throw err;
  }
}

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
    "[billing] MP_ACCESS_TOKEN não definido. Rodando em modo fake."
  );
} else {
  console.warn(
    "[billing] SDK do MercadoPago não expõe .configure(); rodando em modo fake."
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

type StartBundleBody = {
  items: Array<{ planoId: string; periodicidade: Periodicidade }>;
  metodo: MetodoPagamento;
  cupom?: string | null;
  pagador?: Pagador;
  cartao?: Cartao;
};

type CartItem = { planoId: string; periodicidade: Periodicidade };

function getUserId(req: Request) {
  const r = req as AuthenticatedRequest as any;
  return r.userId ?? r.authUser?.id ?? r.user?.id;
}

async function getUserTipo(usuarioId: string) {
  const u = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { tipo: true },
  });

  return (u?.tipo as string) || "Atleta";
}

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

const PLANS = [
  { id: "ATLETA_PRO", title: "Atleta Pro", monthly: 19.9, annual: 199.0, benefits: ["Sem anúncios", "Treinos e desafios ilimitados (fair-use)", "Biblioteca pessoal ilimitada (fair-use)", "Agendamento pessoal"] },
  { id: "ATLETA_LEARNING", title: "Atleta Learning", monthly: 14.9, annual: 149.0, benefits: ["Acesso ilimitado a metodologias", "Rotinas e trilhas por método", "Conteúdos e sugestões guiadas"] },
  { id: "ATLETA_PLUS", title: "Atleta Plus", monthly: 29.9, annual: 299.0, benefits: ["Tudo do Pro", "Tudo do Learning", "Pacote completo"] },
  { id: "OLHEIRO_PRO", title: "Olheiro Pro", monthly: 24.9, annual: 249.0, benefits: ["Sem anúncios", "Ferramentas Pro do olheiro", "Mais limites operacionais"] },
  { id: "PROFESSOR_PRO", title: "Professor Pro", monthly: 39.9, annual: 399.0, benefits: ["Sem anúncios", "Recursos Pro de treino", "Mais limites operacionais"] },
  { id: "PROFESSOR_LEARNING", title: "Professor Learning", monthly: 29.9, annual: 299.0, benefits: ["Metodologias ilimitadas", "Trilhas e conteúdos por método"] },
  { id: "PROFESSOR_PLUS", title: "Professor Plus", monthly: 59.9, annual: 599.0, benefits: ["Tudo do Pro", "Tudo do Learning", "Pacote completo"] },
  { id: "ORGANIZACOES_PRO", title: "Organizações Pro", monthly: 79.9, annual: 799.0, benefits: ["Sem anúncios", "Recursos Pro da organização", "Mais capacidade operacional"] },
  { id: "ORGANIZACOES_LEARNING", title: "Organizações Learning", monthly: 59.9, annual: 599.0, benefits: ["Metodologias ilimitadas", "Trilhas/rotinas por método"] },
  { id: "ORGANIZACOES_PLUS", title: "Organizações Plus", monthly: 109.9, annual: 1099.0, benefits: ["Tudo do Pro", "Tudo do Learning", "Pacote completo"] },
  { id: "METH_POSICIONAL", title: "Treino Posicional", monthly: 0, annual: 49.9, benefits: ["Acesso anual à metodologia Posicional"] },
  { id: "METH_FORCA", title: "Força & Explosão", monthly: 0, annual: 49.9, benefits: ["Acesso anual à metodologia Força & Explosão"] },
  { id: "METH_TECNICA", title: "Técnica Individual", monthly: 0, annual: 49.9, benefits: ["Acesso anual à metodologia Técnica Individual"] },
  { id: "METH_TATICO", title: "Tático", monthly: 0, annual: 49.9, benefits: ["Acesso anual à metodologia Tático"] },
  { id: "METH_MENTAL", title: "Mentalidade", monthly: 0, annual: 49.9, benefits: ["Acesso anual à metodologia Mentalidade"] },
] as const;

function normalizePlanoId(planoId: string) {
  return String(planoId || "").trim().toUpperCase();
}

function findPlan(planoId: string) {
  const id = normalizePlanoId(planoId);
  return PLANS.find((p) => p.id === id);
}

function isMetodologia(planoId: string) {
  const id = normalizePlanoId(planoId);
  return id.startsWith("METH_");
}

function priceFor(planoId: string, periodicidade: Periodicidade): number {
  const id = normalizePlanoId(planoId);
  const p = findPlan(id);
  if (!p) throw new Error("Plano inválido");

  if (isMetodologia(id) && periodicidade !== "Anual") {
    throw new Error("Metodologias são apenas ANUAL.");
  }

  if (periodicidade === "Mensal") return Number(p.monthly || 0);
  return Number(p.annual || 0);
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

  if (cupom.plano && cupom.plano !== normalizePlanoId(planoId)) {
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

async function resgatarCupom(cupomId: string, usuarioId: string, pagamentoId?: string) {
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

async function upsertSubscriptionTx(
  tx: PrismaClient | Prisma.TransactionClient,
  usuarioId: string,
  plano: string,
  periodicidade: Periodicidade
) {
  const planoNorm = normalizePlanoId(plano);
  const now = new Date();
  const months = periodicidade === "Mensal" ? 1 : 12;
  const renovaEm = addMonths(now, months);

  await (tx as any).assinatura.upsert({
    where: { usuarioId_plano: { usuarioId, plano: planoNorm } },
    update: {
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
      plano: planoNorm,
      periodicidade,
      startsAt: now,
      renovaEm,
      ativo: true,
      status: "ATIVA",
      lembreteEnviado: false,
    } as any,
  });
}

async function upsertSubscription(usuarioId: string, plano: string, periodicidade: Periodicidade) {
  return upsertSubscriptionTx(prisma as any, usuarioId, plano, periodicidade);
}

async function getAssinaturasReadOnly(usuarioId: string) {
  const now = new Date();

  const assinaturas = await (prisma as any).assinatura.findMany({
    where: { usuarioId },
    orderBy: { startsAt: "desc" },
  });

  const updates: any[] = [];

  for (const a of assinaturas as any[]) {
    if (a.status === "TRIAL" && a.trialEndsAt && now > a.trialEndsAt) {
      updates.push(
        (prisma as any).assinatura.update({
          where: { id: a.id },
          data: { status: "BLOQUEADA", ativo: false, canceledAt: now, bloqueadoEm: now } as any,
        })
      );
    }

    if (a.status === "CANCELADA" && a.renovaEm && now > a.renovaEm) {
      updates.push(
        (prisma as any).assinatura.update({
          where: { id: a.id },
          data: { ativo: false } as any,
        })
      );
    }
  }

  if (updates.length) await prisma.$transaction(updates);
  if (updates.length) {
    return (prisma as any).assinatura.findMany({
      where: { usuarioId },
      orderBy: { startsAt: "desc" },
    });
  }

  return assinaturas;

}

function isAssinaturaAtiva(a: any) {
  return a && (a.status === "ATIVA" || a.status === "TRIAL") && a.ativo === true;
}

function pickPrincipalAssinatura(assinaturas: any[]) {
  const principalAtiva = assinaturas.find(
    (a) => !isMetodologia(a.plano) && isAssinaturaAtiva(a)
  );
  return principalAtiva ?? assinaturas.find((a) => !isMetodologia(a.plano)) ?? null;
}

export async function getPlans(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const tipo = await getUserTipo(usuarioId);
    const allowed = allowedPlanIdsByTipo(tipo);

    const plans = PLANS.filter((p) => allowed.includes(p.id));

    return res.json({ plans });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao carregar planos" });
  }
}

export async function getMyBilling(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const pagamentos = await prisma.pagamento.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: "desc" },
    });

    const cupons = await prisma.cupomResgate.findMany({
      where: { usuarioId },
      include: { cupom: true },
      orderBy: { resgatadoEm: "desc" },
    });

    const assinaturas = await getAssinaturasReadOnly(usuarioId);
    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturas as any[]);

    const trialJaUsado = (assinaturas as any[]).some((a) => {
      const principal = !isMetodologia(a.plano);
      return principal && Boolean(a.trialStartsAt);
    });

    const now = new Date();
    const status = String(assinaturaPrincipal?.status || "SEM_ASSINATURA");
    const trialEndsAt = (assinaturaPrincipal?.trialEndsAt as Date | null) ?? null;

    const trialAtivo = status === "TRIAL" && trialEndsAt && now <= trialEndsAt;
    const diasRestantes = trialEndsAt ? diffDays(trialEndsAt, now) : null;

    const precisaEscolherPagamento =
      trialAtivo && diasRestantes != null && diasRestantes <= 7;

    const bloqueado = status === "BLOQUEADA";
    const cancelada = status === "CANCELADA";

    const metodoPreferido = assinaturaPrincipal?.metodoPreferido ?? null;
    const tipo = await getUserTipo(usuarioId);

    const billingState = {
      status,
      trialAtivo,
      trialJaUsado,
      trialEndsAt,
      diasRestantes,
      precisaEscolherPagamento,
      metodoPreferido,
      bloqueado,
      cancelada,
    };

    res.json({
      tipoUsuario: tipo,
      assinatura: assinaturaPrincipal || null,
      assinaturas: assinaturas || [],
      pagamentos,
      cupons,
      billingState,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao carregar billing", err });
  }
}

export async function applyCoupon(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const body = req.body as any;
    const codigo = String(body.codigo || "").trim();

    const rawItems =
      Array.isArray(body.items) && body.items.length
        ? body.items
        : body.planoId && body.periodicidade
        ? [{ planoId: body.planoId, periodicidade: body.periodicidade }]
        : [];

    if (!codigo) return res.status(400).json({ message: "Informe o código do cupom" });
    if (!rawItems.length) return res.status(400).json({ message: "Informe items do carrinho" });

    const usuarioTipo = await getUserTipo(usuarioId);

    const items: CartItem[] = rawItems.map((it: any) => ({
      planoId: normalizePlanoId(it.planoId),
      periodicidade: it.periodicidade as Periodicidade,
    }));

    let baseTotal = 0;
    for (const it of items) {
      assertPlanoPermitido(usuarioTipo, it.planoId);

      const plan = findPlan(it.planoId);
      if (!plan) return res.status(400).json({ message: `Plano inválido: ${it.planoId}` });

      if (!["Mensal", "Anual"].includes(it.periodicidade as any)) {
        return res.status(400).json({ message: `Periodicidade inválida: ${it.planoId}` });
      }

      if (isMetodologia(it.planoId) && it.periodicidade !== "Anual") {
        return res.status(400).json({ message: `Metodologia ${it.planoId} é apenas ANUAL.` });
      }

      baseTotal += priceFor(it.planoId, it.periodicidade);
    }

    const alvoParaValidacao =
    items.find((x: CartItem) => x.planoId && x.periodicidade) ?? items[0];

    const check = await computeCouponDiscount(
      codigo,
      usuarioId,
      alvoParaValidacao.planoId,
      alvoParaValidacao.periodicidade
    );

    if (!check.ok || !check.cupom) {
      return res.status(400).json({ message: check.reason || "Cupom inválido" });
    }

    const c = check.cupom as any;

    let desconto = 0;

    if (c.tipo === "PERCENTUAL" && typeof c.descontoPerc === "number") {
      desconto = (Math.max(0, Math.min(100, c.descontoPerc)) * baseTotal) / 100;
    } else if (c.tipo === "VALOR" && c.descontoFixo != null) {
      desconto = Number(c.descontoFixo);
    } else if (c.tipo === "PRESENTE") {
      if (c.plano || c.periodicidade) {
        const alvoPlano = c.plano ? normalizePlanoId(c.plano) : null;
        const alvoPer = c.periodicidade ? (c.periodicidade as Periodicidade) : null;

        let presenteBase = 0;
        for (const it of items) {
          const planoOk = !alvoPlano || it.planoId === alvoPlano;
          const perOk = !alvoPer || it.periodicidade === alvoPer;
          if (planoOk && perOk) {
            presenteBase += priceFor(it.planoId, it.periodicidade);
          }
        }

        desconto = presenteBase;
      } else {
        desconto = baseTotal;
      }
    }

    desconto = Math.max(0, Math.min(baseTotal, desconto));
    const total = Math.max(0, baseTotal - desconto);

    return res.json({
      items,
      base: Number(baseTotal.toFixed(2)),
      desconto: Number(desconto.toFixed(2)),
      total: Number(total.toFixed(2)),
      cupom: { codigo: c.codigo, tipo: c.tipo },
    });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao validar cupom", err });
  }
}

export async function startTrial(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const now = new Date();
    const { planoId, periodicidade, metodoPreferido } = req.body as {
      planoId: string;
      periodicidade: Periodicidade;
      metodoPreferido?: MetodoPagamento | null;
    };

    const planoNorm = normalizePlanoId(planoId);
    const plan = findPlan(planoNorm);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    const tipo = await getUserTipo(usuarioId);
    assertPlanoPermitido(tipo, planoId);

    if (isMetodologia(planoNorm)) {
      return res.status(400).json({ message: "Trial só pode ser usado em plano principal (Pro/Learning/Plus)." });
    }

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const existing = await (prisma as any).assinatura.findUnique({
      where: { usuarioId_plano: { usuarioId, plano: planoNorm } },
    });

    const jaUsouTrialNaConta = await (prisma as any).assinatura.findFirst({
      where: {
        usuarioId,
        trialStartsAt: { not: null },
        NOT: { plano: { startsWith: "METH_" } },
      },
      select: { id: true, plano: true, trialStartsAt: true },
    });

    if (jaUsouTrialNaConta) {
      return res.status(400).json({
        code: "TRIAL_ALREADY_USED",
        message: "Você já utilizou o mês grátis nesta conta.",
      });
    }

    if (existing?.status === "ATIVA") {
      return res.status(400).json({ code: "ALREADY_ACTIVE", message: "Você já possui assinatura ativa neste plano." });
    }

    if (existing?.status === "TRIAL" && existing.trialEndsAt && now <= existing.trialEndsAt) {
      return res.status(400).json({ code: "TRIAL_ALREADY_ACTIVE", message: "Seu trial já está ativo." });
    }

    if (existing?.trialStartsAt) {
      return res.status(400).json({ code: "TRIAL_ALREADY_USED", message: "Você já utilizou o mês grátis neste plano." });
    }

    const trialEndsAt = addMonths(now, 1);
    const metodoPreferidoFinal: MetodoPagamento | null = metodoPreferido ?? null;

    const out = await (prisma as any).assinatura.upsert({
      where: { usuarioId_plano: { usuarioId, plano: planoNorm } },
      update: {
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
        metodoPreferido: metodoPreferidoFinal,
        metodoPreferidoDefinidoEm: metodoPreferidoFinal ? now : null,
      } as any,
      create: {
        usuarioId,
        plano: planoNorm,
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
        metodoPreferido: metodoPreferidoFinal,
        metodoPreferidoDefinidoEm: metodoPreferidoFinal ? now : null,
      } as any,
    });

    return res.json({ ok: true, assinatura: out });
  } catch (err) {
    console.error("Erro startTrial:", err);
    return res.status(500).json({ message: "Erro ao iniciar trial" });
  }
}

export async function setPreferredPaymentMethod(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { metodoFinal, planoId } = req.body as {
      metodoFinal: MetodoPagamento;
      planoId?: string | null;
    };

    const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
    if (!METODOS_VALIDOS.includes(metodoFinal)) {
      return res.status(400).json({ message: "Método inválido" });
    }

    const assinaturas = await getAssinaturasReadOnly(usuarioId);
    const principal = pickPrincipalAssinatura(assinaturas as any[]);
    const alvoPlano = planoId ? normalizePlanoId(planoId) : principal?.plano;
    if (!alvoPlano) return res.status(400).json({ message: "Nenhuma assinatura encontrada para salvar método." });

    await (prisma as any).assinatura.update({
      where: { usuarioId_plano: { usuarioId, plano: alvoPlano } },
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

async function guardTrialRule(usuarioId: string) {
  const now = new Date();
  const assinaturas = await getAssinaturasReadOnly(usuarioId);

  const trialAtivoAss = (assinaturas as any[]).find((a) =>
    !isMetodologia(a.plano) &&
    a.status === "TRIAL" &&
    a.trialEndsAt &&
    now <= a.trialEndsAt
  );

  if (trialAtivoAss) {
    const diasRestantes = diffDays(trialAtivoAss.trialEndsAt, now);
    if (diasRestantes > 7) {
      const err: any = new Error("TRIAL_ACTIVE");
      err.http = 403;
      err.code = "TRIAL_ACTIVE";
      err.payload = { trialEndsAt: trialAtivoAss.trialEndsAt, diasRestantes };
      throw err;
    }
  }

  const principal = pickPrincipalAssinatura(assinaturas as any[]);
  
  const status = String(principal?.status || "SEM_ASSINATURA");
  const trialEndsAt = (principal?.trialEndsAt as Date | null) ?? null;

  const trialAtivo = status === "TRIAL" && trialEndsAt && now <= trialEndsAt;
  const diasRestantes = trialEndsAt ? Math.max(0, diffDays(trialEndsAt, now)) : null;

  if (trialAtivo && (diasRestantes == null || diasRestantes > 7)) {
    const err: any = new Error("TRIAL_ACTIVE");
    err.http = 403;
    err.code = "TRIAL_ACTIVE";
    err.payload = { trialEndsAt, diasRestantes };
    throw err;
  }

  const metodoPreferido = principal?.metodoPreferido ?? null;

  return { metodoPreferido, principal };
}

function validateMetodoAndFields(metodo: MetodoPagamento, pagador?: Pagador, cartao?: Cartao) {
  const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
  if (!METODOS_VALIDOS.includes(metodo)) throw new Error("Método de pagamento inválido");

  if (metodo === "PIX") {
    if (!pagador?.nome || !pagador?.email) throw new Error("Informe nome e e-mail para PIX");
  }
  if (metodo === "BOLETO") {
    if (!pagador?.nome || !pagador?.email || !pagador?.cpf) throw new Error("Informe nome, e-mail e CPF para boleto");
  }
  if (metodo === "CREDITO" || metodo === "DEBITO") {
    const num = onlyDigits(cartao?.numero || "");
    const cvv = onlyDigits(cartao?.cvv || "");
    const validadeOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(cartao?.validade || "");

    if (!cartao?.nomeImpresso || num.length < 13 || !luhnOk(num) || !validadeOk || !(cvv.length === 3 || cvv.length === 4)) {
      throw new Error("Dados de cartão inválidos");
    }
    if (!pagador?.nome || !pagador?.email) throw new Error("Informe nome e e-mail do titular");
  }
}

async function approvePaymentAndProvision(pagamentoId: string, items: Array<{ planoId: string; periodicidade: Periodicidade }>) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const pg = await tx.pagamento.update({
      where: { id: pagamentoId },
      data: { status: "APROVADO", pagoEm: now } as any,
    });

    for (const it of items) {
      await upsertSubscriptionTx(tx as any, pg.usuarioId, it.planoId, it.periodicidade);
    }

    return pg;
  });
}

export async function startCheckout(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { planoId, periodicidade, metodo, cupom, pagador, cartao } =
      req.body as StartCheckoutBody;

    const { metodoPreferido } = await guardTrialRule(usuarioId);

    const tipo = await getUserTipo(usuarioId);
    assertPlanoPermitido(tipo, planoId);

    const metodoFinal = (metodo || metodoPreferido) as MetodoPagamento;
    if (!metodoFinal) return res.status(400).json({ message: "Escolha um método de pagamento" });

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const plan = findPlan(planoId);
    if (!plan) return res.status(400).json({ message: "Plano inválido" });

    if (isMetodologia(planoId) && periodicidade !== "Anual") {
      return res.status(400).json({ message: "Metodologias são apenas ANUAL." });
    }

    try {
      validateMetodoAndFields(metodoFinal, pagador, cartao);
    } catch (e: any) {
      return res.status(400).json({ message: e.message || "Campos inválidos" });
    }

    let base = priceFor(planoId, periodicidade);
    let desconto = 0;
    let cupomRow: any = null;

    if (cupom) {
      const check = await computeCouponDiscount(
        cupom,
        usuarioId,
        normalizePlanoId(planoId),
        periodicidade
      );
      if (!check.ok || !check.cupom) {
        return res.status(400).json({ message: check.reason || "Cupom inválido" });
      }
      cupomRow = check.cupom;

      if (cupomRow.tipo === "PERCENTUAL" && typeof cupomRow.descontoPerc === "number") {
        desconto = (Math.max(0, Math.min(100, cupomRow.descontoPerc)) * base) / 100;
      } else if (cupomRow.tipo === "VALOR" && cupomRow.descontoFixo != null) {
        desconto = Number(cupomRow.descontoFixo);
      } else if (cupomRow.tipo === "PRESENTE") {
        desconto = base;
      }
    }

    const total = Math.max(0, base - desconto);
    const totalDecimal = new Prisma.Decimal(total.toFixed(2));
    const provider = HAS_MERCADO_PAGO ? "MERCADOPAGO" : "INTERNAL_FAKE";

    let pagamento = await prisma.pagamento.create({
      data: {
        usuarioId,
        plano: normalizePlanoId(planoId),
        periodicidade,
        metodo: metodoFinal,
        status: total === 0 ? PagamentoStatus.APROVADO : PagamentoStatus.PENDENTE,
        valor: totalDecimal,
        moeda: "BRL",
        provider,
        providerRef: `TEMP-${Date.now()}`,
        cupomId: cupomRow?.id ?? null,
        pagoEm: total === 0 ? new Date() : null,
      },
    });

    if (total === 0) {
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
        data: { provider: "INTERNAL_FAKE", providerRef },
      });

      if (metodoFinal === "PIX") {
        const payload = `pix:plano=${normalizePlanoId(planoId)};user=${usuarioId};pg=${pagamento.id};valor=${total.toFixed(2)}`;
        await prisma.pagamento.update({
          where: { id: pagamento.id },
          data: { pixCopiaECola: payload },
        });
        const qrCodeUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });

        return res.json({
          status: "PENDENTE",
          pagamento,
          pix: { copiaECola: payload, qrCodeUrl },
        });
      }

      if (metodoFinal === "BOLETO") {
        const linhaDigitavel = "23790.00000 00000.000000 00000.000000 0 00000000000000";
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
          transaction_amount: Number(total.toFixed(2)),
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
          metadata: { pagamentoId: pagamento.id, usuarioId, planoId: normalizePlanoId(planoId) },
          external_reference: pagamento.id,
        });

        const mpBody: any = mpResp?.body || mpResp;

        const qr_code = mpBody.point_of_interaction?.transaction_data?.qr_code ?? null;
        const qr_code_base64 = mpBody.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

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
          pix: { copiaECola: qr_code, qrCodeUrl },
          message: "Pagamento PIX criado. A assinatura será liberada após confirmação do pagamento.",
        });
      } catch (err: any) {
        console.error("Erro PIX Mercado Pago:", err?.response?.data || err);
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
            unit_price: Number(total.toFixed(2)),
          },
        ],
        payer: { name: pagador?.nome, email: pagador?.email },
        metadata: { pagamentoId: pagamento.id, usuarioId, planoId: normalizePlanoId(planoId) },
        external_reference: pagamento.id,
        notification_url: `${API_BASE_URL}/api/billing/mercadopago/webhook`,
      });

      const prefBody: any = mpPrefResp?.body || mpPrefResp;

      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { provider: "MERCADOPAGO", providerRef: String(prefBody.id) },
      });

      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl: prefBody.init_point,
        sandboxCheckoutUrl: prefBody.sandbox_init_point,
        message: "Redirecione o usuário para o checkout do Mercado Pago.",
      });
    } catch (err: any) {
      console.error("Erro preference Mercado Pago:", err?.response?.data || err);
      return res.status(500).json({
        message: "Falha ao criar checkout Mercado Pago",
        detalhe: err?.response?.data || String(err),
      });
    }
  } catch (err: any) {
    if (err?.code === "TRIAL_ACTIVE") {
      return res.status(403).json({
        code: "TRIAL_ACTIVE",
        message: "Trial ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.",
        ...(err.payload || {}),
      });
    }

    console.error("Erro em startCheckout:", err?.response?.data || err);
    return res.status(500).json({
      message: "Erro ao iniciar checkout",
      detalhe: err?.response?.data || String(err),
    });
  }
}

export async function startCheckoutBundle(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const tipo = await getUserTipo(usuarioId);

    const { items, metodo, cupom, pagador, cartao } = req.body as StartBundleBody;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Informe items do carrinho." });
    }

    const { metodoPreferido } = await guardTrialRule(usuarioId);

    const metodoFinal = (metodo || metodoPreferido) as MetodoPagamento;
    if (!metodoFinal) return res.status(400).json({ message: "Escolha um método de pagamento" });

    try {
      validateMetodoAndFields(metodoFinal, pagador, cartao);
    } catch (e: any) {
      return res.status(400).json({ message: e.message || "Campos inválidos" });
    }

    let totalBase = 0;
    const normalizedItems = items.map((it) => ({
      planoId: normalizePlanoId(it.planoId),
      periodicidade: it.periodicidade,
    }));

    for (const it of normalizedItems) {
      assertPlanoPermitido(tipo, it.planoId);

      const plan = findPlan(it.planoId);
      if (!plan) return res.status(400).json({ message: `Plano inválido: ${it.planoId}` });

      if (!["Mensal", "Anual"].includes(it.periodicidade as any)) {
        return res.status(400).json({ message: `Periodicidade inválida: ${it.planoId}` });
      }

      if (isMetodologia(it.planoId) && it.periodicidade !== "Anual") {
        return res.status(400).json({ message: `Metodologia ${it.planoId} é apenas ANUAL.` });
      }

      totalBase += priceFor(it.planoId, it.periodicidade);
    }

    let desconto = 0;
    let cupomRow: any = null;

    if (cupom) {
      const it0 = normalizedItems[0];

      const check = await computeCouponDiscount(cupom, usuarioId, it0.planoId, it0.periodicidade);
      if (!check.ok || !check.cupom) {
        return res.status(400).json({ message: check.reason || "Cupom inválido" });
      }
      cupomRow = check.cupom;

      if (cupomRow.tipo === "PERCENTUAL" && typeof cupomRow.descontoPerc === "number") {
        desconto = (Math.max(0, Math.min(100, cupomRow.descontoPerc)) * totalBase) / 100;
      } else if (cupomRow.tipo === "VALOR" && cupomRow.descontoFixo != null) {
        desconto = Number(cupomRow.descontoFixo);
      } else if (cupomRow.tipo === "PRESENTE") {
        if (cupomRow.plano || cupomRow.periodicidade) {
          const alvoPlano = cupomRow.plano ? normalizePlanoId(cupomRow.plano) : null;
          const alvoPer = cupomRow.periodicidade ? (cupomRow.periodicidade as Periodicidade) : null;

          let presenteBase = 0;
          for (const it of normalizedItems) {
            const planoOk = !alvoPlano || it.planoId === alvoPlano;
            const perOk = !alvoPer || it.periodicidade === alvoPer;
            if (planoOk && perOk) {
              presenteBase += priceFor(it.planoId, it.periodicidade);
            }
          }
          desconto = presenteBase;
        } else {
          desconto = totalBase;
        }
      }

      desconto = Math.max(0, Math.min(totalBase, desconto));
    }

    const total = Math.max(0, totalBase - desconto);
    const totalDecimal = new Prisma.Decimal(total.toFixed(2));
    const provider = HAS_MERCADO_PAGO ? "MERCADOPAGO" : "INTERNAL_FAKE";

    let pagamento = await prisma.pagamento.create({
      data: {
        usuarioId,
        plano: "BUNDLE",
        periodicidade: "Mensal",
        metodo: metodoFinal,
        status: total === 0 ? PagamentoStatus.APROVADO : PagamentoStatus.PENDENTE,
        valor: totalDecimal,
        moeda: "BRL",
        provider,
        providerRef: `BUNDLE-${Date.now()}`,
        cupomId: cupomRow?.id ?? null,
        pagoEm: total === 0 ? new Date() : null,
      },
    });

    if (total === 0) {
      await approvePaymentAndProvision(pagamento.id, normalizedItems);
      if (cupomRow) await resgatarCupom(cupomRow.id, usuarioId, pagamento.id);

      return res.json({
        status: "APROVADO",
        pagamento,
        assinaturas: normalizedItems,
        message: "Assinaturas ativadas sem cobrança (cupom/presente).",
      });
    }

    if (!HAS_MERCADO_PAGO) {
      const itemsStr = normalizedItems.map((i) => `${i.planoId}:${i.periodicidade}`).join("|");

      if (metodoFinal === "PIX") {
        const payload = `pix:bundle=${itemsStr};user=${usuarioId};pg=${pagamento.id};valor=${total.toFixed(2)}`;
        await prisma.pagamento.update({
          where: { id: pagamento.id },
          data: { pixCopiaECola: payload },
        });
        const qrCodeUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });

        return res.json({
          status: "PENDENTE",
          pagamento,
          pix: { copiaECola: payload, qrCodeUrl },
        });
      }

      if (metodoFinal === "BOLETO") {
        const linhaDigitavel = "23790.00000 00000.000000 00000.000000 0 00000000000000";
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
        message: "Pagamento bundle iniciado (simulado)",
      });
    }

    if (metodoFinal === "PIX") {
      const desc = `FootEra Bundle (${normalizedItems.length} itens)`;
      try {
        const mpResp: any = await mercadopago.payment.create({
          transaction_amount: Number(total.toFixed(2)),
          description: desc,
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
            bundleItems: normalizedItems,
          },
          external_reference: pagamento.id,
        });

        const mpBody: any = mpResp?.body || mpResp;
        const qr_code = mpBody.point_of_interaction?.transaction_data?.qr_code ?? null;
        const qr_code_base64 = mpBody.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

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
          pix: { copiaECola: qr_code, qrCodeUrl },
          message: "Pagamento PIX bundle criado. Assinaturas serão liberadas após aprovação.",
        });
      } catch (err: any) {
        console.error("Erro PIX bundle Mercado Pago:", err?.response?.data || err);
        return res.status(500).json({
          message: "Falha ao criar PIX bundle com Mercado Pago",
          detalhe: err?.response?.data || String(err),
        });
      }
    }

    try {
      const mpPrefResp: any = await mercadopago.preferences.create({
        items: [
          {
            title: `FootEra Bundle (${normalizedItems.length} itens)`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(total.toFixed(2)),
          },
        ],
        payer: { name: pagador?.nome, email: pagador?.email },
        metadata: { pagamentoId: pagamento.id, usuarioId, bundleItems: normalizedItems },
        external_reference: pagamento.id,
        notification_url: `${API_BASE_URL}/api/billing/mercadopago/webhook`,
      });

      const prefBody: any = mpPrefResp?.body || mpPrefResp;

      pagamento = await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { provider: "MERCADOPAGO", providerRef: String(prefBody.id) },
      });

      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl: prefBody.init_point,
        sandboxCheckoutUrl: prefBody.sandbox_init_point,
        message: "Redirecione o usuário para o checkout do Mercado Pago.",
      });
    } catch (err: any) {
      console.error("Erro preference bundle Mercado Pago:", err?.response?.data || err);
      return res.status(500).json({
        message: "Falha ao criar checkout bundle Mercado Pago",
        detalhe: err?.response?.data || String(err),
      });
    }
  } catch (err: any) {
    if (err?.code === "TRIAL_ACTIVE") {
      return res.status(403).json({
        code: "TRIAL_ACTIVE",
        message: "Trial ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.",
        ...(err.payload || {}),
      });
    }
    console.error("Erro em startCheckoutBundle:", err);
    return res.status(500).json({ message: "Erro ao iniciar checkout bundle", detalhe: String(err) });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { planoId } = req.body as { planoId?: string | null };
    const now = new Date();

    if (planoId) {
      const plano = normalizePlanoId(planoId);
      await (prisma as any).assinatura.updateMany({
        where: { usuarioId, plano, ativo: true },
        data: {
          ativo: true,
          canceledAt: now,
          status: "CANCELADA",
          bloqueadoEm: null,
        } as any,

      });
      return res.json({ ok: true, message: "Assinatura cancelada." });
    }

    await (prisma as any).assinatura.updateMany({
      where: { usuarioId, ativo: true },
      data: {
        ativo: true,
        canceledAt: now,
        status: "CANCELADA",
        bloqueadoEm: null,
      } as any,
    });

    res.json({ ok: true, message: "Assinaturas canceladas." });
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
  return res.status(400).json({
    message:
      "Troca de plano exige um novo checkout e aprovação de pagamento. Inicie o checkout do novo plano.",
  });
}

export async function providerWebhook(req: Request, res: Response) {
  try {
    const { provider, providerEventId, tipo, data } = req.body as any;

    const already = await prisma.eventoPagamento.findUnique({ where: { providerEventId } });
    if (already) return res.status(200).json({ ok: true, idempotent: true });

    await prisma.eventoPagamento.create({ data: { providerEventId, tipo } });

    let pagamento = null as any;

    if (data?.pagamentoId) {
      pagamento = await prisma.pagamento.findUnique({ where: { id: data.pagamentoId } });
    } else if (data?.providerRef) {
      pagamento = await prisma.pagamento.findUnique({
        where: { provider_providerRef: { provider, providerRef: data.providerRef } },
      });
    }

    if (!pagamento) return res.status(404).json({ message: "Pagamento não encontrado" });

    const now = new Date();

    if (tipo === "payment_approved") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: PagamentoStatus.APROVADO, pagoEm: pagamento.pagoEm ?? now },
      });

      if (pagamento.plano !== "BUNDLE") {
        await upsertSubscription(pagamento.usuarioId, pagamento.plano, pagamento.periodicidade);
      }

      return res.json({ ok: true });
    }

    if (tipo === "payment_canceled" || tipo === "payment_refunded") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: tipo === "payment_canceled" ? PagamentoStatus.CANCELADO : PagamentoStatus.REEMBOLSADO } as any,
      });

      return res.json({ ok: true });
    }

    return res.json({ ok: true, ignored: true });
  } catch (err) {
    console.error("Webhook billing error:", err);
    return res.status(500).json({ message: "Erro no webhook" });
  }
}

export async function mercadoPagoWebhook(req: Request, res: Response) {
  try {
    const paymentIdRaw =
      (req.query["data.id"] as string) ||
      (req.query.id as string) ||
      req.body?.data?.id ||
      (req.body?.resource ? String(req.body.resource).split("/").pop() : null);

    if (!paymentIdRaw) return res.status(200).json({ ok: true, ignored: true });

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

    if (!pagamento) return res.status(200).json({ ok: true, ignored: true });

    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { provider: "MERCADOPAGO", providerRef: mpId },
    });

    const now = new Date();

    if (status === "approved") {
      if (pagamento.plano === "BUNDLE" && Array.isArray(meta.bundleItems)) {
        const tipo = await getUserTipo(pagamento.usuarioId);

        const items = meta.bundleItems.map((x: any) => ({
          planoId: normalizePlanoId(x.planoId),
          periodicidade: x.periodicidade as Periodicidade,
        }));

        for (const it of items) {
          assertPlanoPermitido(tipo, it.planoId);
        }

        await approvePaymentAndProvision(pagamento.id, items);
        return res.status(200).json({ ok: true });
      }

      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: PagamentoStatus.APROVADO, pagoEm: pagamento.pagoEm ?? now },
      });
      await upsertSubscription(pagamento.usuarioId, pagamento.plano, pagamento.periodicidade);

      return res.status(200).json({ ok: true });
    }

    if (status === "cancelled" || status === "rejected") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: PagamentoStatus.CANCELADO, canceladoEm: now } as any,
      });
      return res.status(200).json({ ok: true });
    }

    if (status === "refunded" || status === "charged_back") {
      await prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: PagamentoStatus.REEMBOLSADO, reembolsadoEm: now } as any,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, ignored: true });
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
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { codigo, planoId, periodicidade } = req.body as {
      codigo: string;
      planoId: string;
      periodicidade: Periodicidade;
    };

    const tipo = await getUserTipo(usuarioId);
    assertPlanoPermitido(tipo, planoId);

    const cupom = await prisma.cupom.findUnique({ where: { codigo } });
    if (!cupom || !cupom.ativo || cupom.tipo !== "PRESENTE") {
      return res.status(400).json({ message: "Presente inválido" });
    }
    if (cupom.expiraEm && cupom.expiraEm < new Date())
      return res.status(400).json({ message: "Presente expirado" });
    if (cupom.usosMax != null && cupom.usosAtuais >= cupom.usosMax)
      return res.status(400).json({ message: "Presente esgotado" });

    const planoNorm = normalizePlanoId(planoId);

    if (cupom.plano && cupom.plano !== planoNorm)
      return res.status(400).json({ message: "Presente não válido para este plano" });
    if (cupom.periodicidade && cupom.periodicidade !== periodicidade)
      return res.status(400).json({ message: "Presente não válido para esta periodicidade" });

    if (isMetodologia(planoNorm) && periodicidade !== "Anual") {
      return res.status(400).json({ message: "Metodologias são apenas ANUAL." });
    }

    const pagamento = await prisma.pagamento.create({
      data: {
        usuarioId,
        plano: planoNorm,
        periodicidade,
        metodo: "PIX",
        status: "APROVADO",
        valor: 0 as any,
        moeda: "BRL",
        provider: "INTERNAL_FAKE",
        providerRef: `GIFT-${Date.now()}`,
        cupomId: cupom.id,
        pagoEm: new Date(),
      } as any,
    });

    await upsertSubscription(usuarioId, planoNorm, periodicidade);
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

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function checkExpiringSubscriptions(req: Request, res: Response) {
  try {
    const daysBefore = Number(process.env.BILLING_DAYS_BEFORE_REMINDER || "7") || 7;
    const graceDaysPaid = Number(process.env.BILLING_GRACE_DAYS || "7") || 7;
    const now = new Date();
    const limitReminder = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    const assinaturas = await (prisma as any).assinatura.findMany({
      where: { OR: [{ status: "TRIAL" as any }, { status: "ATIVA" as any }, { status: "CANCELADA" as any }] },
      include: { usuario: { select: { id: true, email: true, nome: true, nomeDeUsuario: true } } },
    });

    let blockedCount = 0;
    let remindersCount = 0;

    for (const a of assinaturas as any[]) {
      if (a.status === "TRIAL" && a.trialEndsAt) {
        if (now > a.trialEndsAt) {
          await (prisma as any).assinatura.update({
            where: { id: a.id },
            data: { status: "BLOQUEADA", ativo: false, canceledAt: now, bloqueadoEm: now } as any,
          });
          blockedCount++;
          continue;
        }

        if (a.status === "CANCELADA") {
          const due = a.renovaEm as Date | null;
          if (due && now > due) {
            await (prisma as any).assinatura.update({
              where: { id: a.id },
              data: { ativo: false } as any,
            });
          }
          continue;
        }
      }

      if (a.status === "ATIVA") {
        const due = a.renovaEm as Date | null;
        if (!due) continue;

        const limiteGrace = addDays(due, graceDaysPaid);
        if (now > limiteGrace) {
          await (prisma as any).assinatura.update({
            where: { id: a.id },
            data: { status: "BLOQUEADA", ativo: false, canceledAt: now, bloqueadoEm: now } as any,
          });
          blockedCount++;
          continue;
        }
      }
    }

    return res.json({ ok: true, daysBefore, graceDaysPaid, blockedCount, remindersCount });
  } catch (err) {
    console.error("Erro check-expiring:", err);
    return res.status(500).json({ message: "Erro ao checar assinaturas" });
  }
}
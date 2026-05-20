import { Request, Response } from "express";
import {
  PrismaClient,
  Prisma,
  MetodoPagamento,
  Periodicidade,
  PagamentoStatus,
  NotificacaoTipo,
  CreatorVendaStatus
} from "@prisma/client";
import QRCode from "qrcode";
import * as mercadopagoModule from "mercadopago";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import { getIO } from "../socket.js";
import { recomputeAndEmitBadge } from "./notificacoesController.js";

function isLegacyPlano(planoId: string | null | undefined) {
  return String(planoId || "").toUpperCase() === "ATLETA_METODO_1";
}

function normalizeTipoBilling(tipoRaw: string | null | undefined) {
  return String(tipoRaw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function allowedPlanIdsByTipo(tipoRaw: string) {
  const tipo = normalizeTipoBilling(tipoRaw);

  if (tipo === "atleta" || tipo === "learning") {
    return BILLING_SHOW_LEARNING_PLANS
      ? ["ATLETA_PRO", "ATLETA_LEARNING_1", "ATLETA_LEARNING_3"]
      : ["ATLETA_PRO"];
  }

  if (tipo === "professor") {
    return BILLING_SHOW_LEARNING_PLANS
      ? ["PROFESSOR_PRO", "PROFESSOR_LEARNING_1", "PROFESSOR_LEARNING_3"]
      : ["PROFESSOR_PRO"];
  }

  if (
    tipo === "clube" ||
    tipo === "escolinha" ||
    tipo === "escola" ||
    tipo === "federacao" ||
    tipo === "marca"
  ) {
    return BILLING_SHOW_LEARNING_PLANS
      ? ["ORGANIZACOES_PRO", "ORGANIZACOES_LEARNING_3"]
      : ["ORGANIZACOES_PRO"];
  }

  if (tipo === "olheiro") {
    return ["OLHEIRO_PRO"];
  }

  if (tipo === "admin") {
    return BILLING_SHOW_LEARNING_PLANS
      ? [
          "ATLETA_PRO",
          "ATLETA_LEARNING_1",
          "ATLETA_LEARNING_3",
          "PROFESSOR_PRO",
          "PROFESSOR_LEARNING_1",
          "PROFESSOR_LEARNING_3",
          "ORGANIZACOES_PRO",
          "ORGANIZACOES_LEARNING_3",
          "OLHEIRO_PRO",
        ]
      : ["ATLETA_PRO", "PROFESSOR_PRO", "ORGANIZACOES_PRO", "OLHEIRO_PRO"];
  }

  return [];
}

function assertPlanoPermitido(tipoUsuario: string, planoId: string) {
  const planoNorm = normalizePlanoId(planoId);

  if (isMetodologiaAvulsa(planoNorm)) {
    if (!BILLING_SHOW_METODOLOGIAS_AVULSAS) {
      const err: any = new Error("Assinatura de metodologia avulsa indisponível no momento.");
      err.statusCode = 403;
      err.code = "METODOLOGIA_AVULSA_DISABLED";
      throw err;
    }
    return;
  }

  if (isMetodologiaLearning(planoNorm)) {
    if (!BILLING_SHOW_METODOLOGIAS_LEARNING) {
      const err: any = new Error("Assinatura de metodologia learning indisponível no momento.");
      err.statusCode = 403;
      err.code = "METODOLOGIA_LEARNING_DISABLED";
      throw err;
    }
    return;
  }

  if (isAulaAoVivo(planoNorm)) {
    return;
  }

  const allowed = allowedPlanIdsByTipo(tipoUsuario);
  if (!allowed.includes(planoNorm)) {
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

const BILLING_SHOW_LEARNING_PLANS =
  process.env.BILLING_SHOW_LEARNING_PLANS === "true";

const BILLING_SHOW_METODOLOGIAS_AVULSAS =
  process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS === "true";

const BILLING_SHOW_METODOLOGIAS_LEARNING =
  process.env.BILLING_SHOW_METODOLOGIAS_LEARNING === "true";

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

function monthsForPeriodicidade(periodicidade?: Periodicidade | null) {
  return periodicidade === "Anual" ? 12 : 1;
}

function diffDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function criarNotificacaoBilling(args: {
  usuarioId: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  link?: string | null;
}) {
  const existente = await prisma.notificacao.findFirst({
    where: {
      usuarioId: args.usuarioId,
      tipo: args.tipo,
      titulo: args.titulo,
      mensagem: args.mensagem,
      lida: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existente) return existente;

  const notif = await prisma.notificacao.create({
    data: {
      usuarioId: args.usuarioId,
      tipo: args.tipo,
      titulo: args.titulo,
      mensagem: args.mensagem,
      link: args.link ?? "/pagamentos",
      lida: false,
    } as any,
  });

  try {
    getIO()?.to(args.usuarioId).emit("notification:new", notif);
  } catch {}

  try {
    await recomputeAndEmitBadge(args.usuarioId);
  } catch {}

  return notif;
}

const METODOLOGIA_BASE = 19.9;
const METODOLOGIA_POR_SEMANA = 2.5;
const METODOLOGIA_POR_ITEM = 1.0;
const METODOLOGIA_POR_VIDEO = 2.0;
const METODOLOGIA_POR_TREINO = 2.0;
const METODOLOGIA_POR_PONTO = 0.1; // opcional
const METODOLOGIA_MIN = 20.9;
const METODOLOGIA_MAX = 249.9;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function processExpiringSubscriptions() {
  const now = new Date();

  const assinaturas = await (prisma as any).assinatura.findMany({
    where: {
      OR: [
        { status: "TRIAL", ativo: true },
        { status: "ATIVA", ativo: true },
        { status: "CANCELADA", ativo: true },
      ],
    },
    orderBy: { startsAt: "asc" },
  });

  let bloqueadas = 0;
  let avisadas = 0;
  let desativadas = 0;

  for (const a of assinaturas as any[]) {
    const dataBase =
      a.status === "TRIAL"
        ? (a.trialStartsAt ?? a.startsAt)
        : a.startsAt;

    const months = monthsForPeriodicidade(a.periodicidade);
    const dataLimite = dataBase ? addMonths(new Date(dataBase), months) : null;

    // 1) AVISO COM 7 DIAS
    if (dataLimite && a.lembreteEnviado === false) {
      const dias = diffDays(dataLimite, now);

      if (dias <= 7 && dias >= 0) {
        await (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            lembreteEnviado: true,
          } as any,
        });

        await criarNotificacaoBilling({
          usuarioId: a.usuarioId,
          tipo: NotificacaoTipo.BILLING_WARNING,
          titulo: "Sua assinatura está perto do vencimento",
          mensagem:
            a.status === "TRIAL"
              ? `Faltam ${dias} dia(s) para terminar seu trial grátis. Escolha uma forma de pagamento para não perder seus benefícios.`
              : `Faltam ${dias} dia(s) para vencer sua assinatura ${a.plano}. Renove o pagamento para não perder seus benefícios.`,
          link: "/pagamentos",
        });

        avisadas++;
      }
    }

    // 2) TRIAL VENCIDO => BLOQUEIA
    if (a.status === "TRIAL" && dataLimite && now > dataLimite) {
      await (prisma as any).assinatura.update({
        where: { id: a.id },
        data: {
          status: "BLOQUEADA",
          ativo: false,
          canceledAt: now,
          bloqueadoEm: now,
          trialEndsAt: dataLimite,
          renovaEm: dataLimite,
        } as any,
      });

      await criarNotificacaoBilling({
        usuarioId: a.usuarioId,
        tipo: NotificacaoTipo.BILLING_BLOCKED,
        titulo: "Seu trial terminou",
        mensagem:
          "Seu período grátis terminou e sua assinatura foi bloqueada. Faça um novo pagamento para reativar os benefícios.",
        link: "/pagamentos",
      });

      bloqueadas++;
      continue;
    }

    // 3) ASSINATURA ATIVA VENCIDA SEM NOVO PAGAMENTO => BLOQUEIA
    if (a.status === "ATIVA" && dataLimite && now > dataLimite) {
      await (prisma as any).assinatura.update({
        where: { id: a.id },
        data: {
          status: "BLOQUEADA",
          ativo: false,
          canceledAt: now,
          bloqueadoEm: now,
          renovaEm: dataLimite,
        } as any,
      });

      await criarNotificacaoBilling({
        usuarioId: a.usuarioId,
        tipo: NotificacaoTipo.BILLING_BLOCKED,
        titulo: "Sua assinatura venceu",
        mensagem: `Sua assinatura ${a.plano} venceu e foi bloqueada por falta de renovação do pagamento.`,
        link: "/pagamentos",
      });

      bloqueadas++;
      continue;
    }

    // 4) CANCELADA E JÁ PASSOU O CICLO => DESATIVA DE VEZ
    if (a.status === "CANCELADA" && dataLimite && now > dataLimite && a.ativo) {
      await (prisma as any).assinatura.update({
        where: { id: a.id },
        data: {
          ativo: false,
          renovaEm: dataLimite,
        } as any,
      });

      desativadas++;
    }
  }

  return {
    ok: true,
    avisadas,
    bloqueadas,
    desativadas,
  };
}

function roundToDot90Ceil(value: number) {
  const intPart = Math.floor(value);
  let candidate = intPart + 0.9;
  if (candidate + 1e-9 < value) candidate = intPart + 1.9;
  return Number(candidate.toFixed(2));
}

const PLANS = [
  // ATLETA
  { id: "ATLETA_PRO", title: "Atleta Pro", monthly: 19.9, annual: null, benefits: ["Sem anúncios", "Poder agendar treinos dos professores FootEra", "Mais limites operacionais", "Quantidade ilimitada de treinos agendados por semana"] },
  { id: "ATLETA_LEARNING_1", title: "Atleta Learning 1", monthly: 44.9, annual: null, benefits: ["Tudo do Atleta Pro", "Escolher 1 metodologia por mês"] },
  { id: "ATLETA_LEARNING_3", title: "Atleta Learning 3", monthly: 64.9, annual: null, benefits: ["Tudo do Atleta Pro", "Escolher até 3 metodologias por mês"] },
  
  // PROFESSOR
  { id: "PROFESSOR_PRO", title: "Professor Pro", monthly: 39.9, annual: null, benefits: ["Sem anúncios", "Recursos Pro do professor", "Mais limites operacionais"] },
  { id: "PROFESSOR_LEARNING_1", title: "Professor Learning 1", monthly: 59.9, annual: null, benefits: ["Tudo do Professor Pro", "Escolher 1 metodologia por mês"] },
  { id: "PROFESSOR_LEARNING_3", title: "Professor Learning 3", monthly: 79.9, annual: null, benefits: ["Tudo do Professor Pro", "Escolher até 3 metodologias por mês"] },

  // ORGANIZAÇÕES
  { id: "ORGANIZACOES_PRO", title: "Organizações Pro", monthly: 79.9, annual: null, benefits: ["Sem anúncios", "Recursos Pro da organização", "Mais capacidade operacional"] },
  { id: "ORGANIZACOES_LEARNING_3", title: "Organizações Learning", monthly: 149.9, annual: null, benefits: ["Tudo do Pro", "Escolher até 3 metodologias por mês"] },

  // OLHEIRO
  { id: "OLHEIRO_PRO", title: "Olheiro Pro", monthly: 24.9, annual: null, benefits: ["Sem anúncios", "Ferramentas Pro do olheiro", "Mais limites operacionais"] },
] as const;

function normalizePlanoId(planoId: string) {
  const raw = String(planoId || "").trim();

  if (raw.toUpperCase().startsWith("METODOLOGIA_AVULSA:")) {
    const id = raw.split(":").slice(1).join(":").trim();
    return `METODOLOGIA_AVULSA:${id}`;
  }

  if (raw.toUpperCase().startsWith("METODOLOGIA:")) {
    const id = raw.split(":").slice(1).join(":").trim();
    return `METODOLOGIA:${id}`;
  }

  if (raw.toUpperCase().startsWith("AULA_AO_VIVO:")) {
    const id = raw.split(":").slice(1).join(":").trim();
    return `AULA_AO_VIVO:${id}`;
  }

  return raw.toUpperCase();
}

function isMetodologiaAvulsa(planoId: string) {
  return String(planoId || "").toUpperCase().startsWith("METODOLOGIA_AVULSA:");
}

function isMetodologiaLearning(planoId: string) {
  return String(planoId || "").toUpperCase().startsWith("METODOLOGIA:");
}

function isAulaAoVivo(planoId: string) {
  return String(planoId || "").toUpperCase().startsWith("AULA_AO_VIVO:");
}

function extractAulaAoVivoId(planoId: string) {
  return String(planoId || "")
    .replace(/^AULA_AO_VIVO:/i, "")
    .trim();
}

function extractMetodologiaId(planoId: string) {
  return String(planoId || "")
    .replace(/^METODOLOGIA_AVULSA:/i, "")
    .replace(/^METODOLOGIA:/i, "")
    .trim();
}

async function registrarCreatorVendaTx(args: {
  tx: Prisma.TransactionClient;
  compradorId: string;
  metodologiaAvulsaId?: string | null;
  metodologiaId?: string | null;
  valorBruto: number;
  provider?: string | null;
  providerRef?: string | null;
}) {
  const { tx, compradorId, metodologiaAvulsaId, metodologiaId, valorBruto } = args;

  const conteudo = metodologiaAvulsaId
    ? await tx.metodologiaAvulsa.findUnique({
        where: { id: metodologiaAvulsaId },
        select: { id: true, criadorUsuarioId: true },
      })
    : metodologiaId
      ? await tx.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true, criadorUsuarioId: true },
        })
      : null;

  if (!conteudo?.criadorUsuarioId) return null;

  const creator = await tx.creator.findUnique({
    where: { usuarioId: conteudo.criadorUsuarioId },
    select: { id: true, comissaoFootera: true },
  });

  if (!creator) return null;

  const percentualFootera = Number(creator.comissaoFootera ?? 0.15);
  const valorFootera = Number((valorBruto * percentualFootera).toFixed(2));
  const valorCreator = Number((valorBruto - valorFootera).toFixed(2));

  return tx.creatorVenda.upsert({
    where: {
      provider_providerRef: {
        provider: args.provider ?? "FOOTERA_BILLING",
        providerRef: args.providerRef ?? `${compradorId}:${metodologiaAvulsaId ?? metodologiaId}`,
      },
    },
    update: {
      status: CreatorVendaStatus.CONFIRMADA,
      valorBruto,
      percentualFootera,
      valorFootera,
      valorCreator,
      pagoEm: new Date(),
    },
    create: {
      creatorId: creator.id,
      compradorId,
      metodologiaId: metodologiaId ?? null,
      metodologiaAvulsaId: metodologiaAvulsaId ?? null,
      valorBruto,
      percentualFootera,
      valorFootera,
      valorCreator,
      status: CreatorVendaStatus.CONFIRMADA,
      pagoEm: new Date(),
      provider: args.provider ?? "FOOTERA_BILLING",
      providerRef: args.providerRef ?? `${compradorId}:${metodologiaAvulsaId ?? metodologiaId}`,
    },
  });
}

function findPlan(planoId: string) {
  const id = normalizePlanoId(planoId);
  return PLANS.find((p) => p.id === id);
}

async function priceFor(planoId: string, periodicidade: Periodicidade): Promise<number> {
  const id = normalizePlanoId(planoId);

  if (isMetodologiaAvulsa(id)) {
    const mid = extractMetodologiaId(id);
    const { valorFinal } = await computeMetodologiaAvulsaPricing(mid);
    return Number(valorFinal);
  }

  if (isAulaAoVivo(id)) {
    const aulaId = extractAulaAoVivoId(id);

    const aula = await prisma.aulaAoVivo.findUnique({
      where: { id: aulaId },
      select: {
        id: true,
        titulo: true,
        precoAcesso: true,
        acessoPago: true,
        status: true,
      },
    });

    if (!aula) throw new Error("Aula ao vivo não encontrada.");

    const valor = Number(aula.precoAcesso || 0);

    if (!aula.acessoPago || valor <= 0) {
      return 0;
    }

    return valor;
  }

  const p = findPlan(id);
  if (!p) throw new Error("Plano inválido");

  if (periodicidade === "Mensal") return Number(p.monthly || 0);
  return Number(p.annual || 0);
}

function metodologiaLimitFromPlano(planoId: string | null | undefined): number {
  const p = String(planoId || "").toUpperCase();

  // 0 metodologias
  if (!p) return 0;
  if (p === "ATLETA_PRO") return 0;
  if (p === "PROFESSOR_PRO") return 0;
  if (p === "ORGANIZACOES_PRO") return 0;
  if (p === "OLHEIRO_PRO") return 0;

  // 1 metodologia/mês
  if (p === "ATLETA_LEARNING_1") return 1;
  if (p === "PROFESSOR_LEARNING_1") return 1;

  // 3 metodologias/mês
  if (p === "ATLETA_LEARNING_3") return 3;
  if (p === "PROFESSOR_LEARNING_3") return 3;
  if (p === "ORGANIZACOES_LEARNING_3") return 3;

  return 0;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

async function computeMetodologiaAvulsaPricing(metodologiaId: string) {
  const ma = await prisma.metodologiaAvulsa.findUnique({
    where: { id: metodologiaId },
    include: {
      estruturas: {
        include: {
          itens: true,
        },
      },
    },
  });

  if (!ma || !ma.ativo) {
    const err: any = new Error("Metodologia avulsa não encontrada.");
    err.statusCode = 404;
    throw err;
  }

  const itens = ma.estruturas.flatMap((e) => e.itens || []);

  const totalSemanas = ma.estruturas.reduce((acc, e) => {
    return Math.max(acc, Number(e.duracaoSemanas || 0));
  }, 0);

  const videoCount = itens.filter((i) => i.tipo === "VIDEO" || i.tipo === "AULA").length;
  const treinoCount = itens.filter((i) => i.tipo === "TREINO").length;
  const itensCount = itens.length;
  const somaPontos = itens.reduce((acc, i) => acc + Number(i.pontos || 0), 0);

  return {
    metodologiaId: ma.id,
    titulo: ma.titulo,
    descricao: ma.descricao,
    valorFinal: Number(ma.precoAssinaturaMensal),
    publicoAlvo: ma.publicoAlvo,
    nivel: null,
    totalSemanas,
    videoCount,
    treinoCount,
    itensCount,
    somaPontos,
    breakdown: {
      precoAssinaturaMensal: Number(ma.precoAssinaturaMensal),
      totalSemanas,
      videoCount,
      treinoCount,
      itensCount,
      somaPontos,
    },
  };
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
    const dataBase =
      a.status === "TRIAL"
        ? (a.trialStartsAt ?? a.startsAt)
        : a.startsAt;

    const months = monthsForPeriodicidade(a.periodicidade);
    const dataLimite = dataBase ? addMonths(new Date(dataBase), months) : null;

    if (a.status === "TRIAL" && dataLimite && now > dataLimite) {
      updates.push(
        (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            status: "BLOQUEADA",
            ativo: false,
            canceledAt: now,
            bloqueadoEm: now,
            trialEndsAt: dataLimite,
            renovaEm: dataLimite,
          } as any,
        })
      );
      continue;
    }

    if (a.status === "ATIVA" && dataLimite && now > dataLimite) {
      updates.push(
        (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            status: "BLOQUEADA",
            ativo: false,
            canceledAt: now,
            bloqueadoEm: now,
            renovaEm: dataLimite,
          } as any,
        })
      );
      continue;
    }

    if (a.status === "CANCELADA" && dataLimite && now > dataLimite) {
      updates.push(
        (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            ativo: false,
            renovaEm: dataLimite,
          } as any,
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
    (a) =>
      !isMetodologiaAvulsa(a.plano) &&
      !isMetodologiaLearning(a.plano) &&
      !isLegacyPlano(a.plano) &&
      isAssinaturaAtiva(a)
  );

  return (
    principalAtiva ??
    assinaturas.find(
      (a) =>
        !isMetodologiaAvulsa(a.plano) &&
        !isMetodologiaLearning(a.plano) &&
        !isLegacyPlano(a.plano)
    ) ??
    null
  );
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
    const assinaturasFiltradas = (assinaturas as any[]).filter((a) => !isLegacyPlano(a.plano));
    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasFiltradas);
    const limiteMetodologiasMes = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);
    const inicioMes = startOfMonth(new Date());
    const metodologiasAtivasNoMes = await prisma.metodologiaAssinante.count({
      where: {
        usuarioId,
        status: "ATIVA",
        origem: "LEARNING",
        iniciouEm: { gte: inicioMes },
      },
    });

    const trialJaUsado = (assinaturas as any[]).some((a) =>
      Boolean(a.trialStartsAt || a.trialEndsAt)
    );

    const now = new Date();
    const status = String(assinaturaPrincipal?.status || "SEM_ASSINATURA");
    const trialEndsAt = (assinaturaPrincipal?.trialEndsAt as Date | null) ?? null;
    const trialAtivo = !!(status === "TRIAL" && trialEndsAt && now <= trialEndsAt);

    const dataBase =
      status === "TRIAL"
        ? ((assinaturaPrincipal?.trialStartsAt as Date | null) ??
          (assinaturaPrincipal?.startsAt as Date | null) ??
          null)
        : ((assinaturaPrincipal?.startsAt as Date | null) ?? null);

    const months =
      assinaturaPrincipal?.periodicidade
        ? monthsForPeriodicidade(assinaturaPrincipal.periodicidade)
        : 1;

    const dataLimite =
      assinaturaPrincipal && dataBase
        ? addMonths(new Date(dataBase), months)
        : null;

    const diasRestantes = dataLimite ? diffDays(dataLimite, now) : null;
    const precisaEscolherPagamento =
      (status === "TRIAL" || status === "ATIVA") &&
      diasRestantes != null &&
      diasRestantes <= 7 &&
      diasRestantes >= 0;
    const bloqueado = status === "BLOQUEADA";
    const cancelada = status === "CANCELADA";

    const metodoPreferido = assinaturaPrincipal?.metodoPreferido ?? null;
    const tipo = await getUserTipo(usuarioId);

    const metodologiasAtivasRaw = await prisma.metodologiaAssinante.findMany({
      where: { usuarioId, status: "ATIVA" },
      include: {
        metodologia: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            descricao: true,
            totalSemanas: true,
          },
        },
        metodologiaAvulsa: {
          select: {
            id: true,
            titulo: true,
            capaUrl: true,
            descricao: true,
            precoAssinaturaMensal: true,
          },
        },
      },
      orderBy: { iniciouEm: "desc" },
    });

    const metodologiasAtivas = metodologiasAtivasRaw
      .map((ma) => {
        if (ma.origem === "AVULSA" && ma.metodologiaAvulsa) {
          return {
            id: ma.metodologiaAvulsa.id,
            titulo: ma.metodologiaAvulsa.titulo,
            descricao: ma.metodologiaAvulsa.descricao,
            capaUrl: ma.metodologiaAvulsa.capaUrl,
            totalSemanas: null,
            status: ma.status,
            iniciouEm: ma.iniciouEm,
            origemRegistro: "AVULSA" as const,
            precoAssinaturaMensal: Number(ma.metodologiaAvulsa.precoAssinaturaMensal ?? 0),
            planoId: `METODOLOGIA_AVULSA:${ma.metodologiaAvulsa.id}`,
          };
        }

        if (ma.metodologia) {
          return {
            id: ma.metodologia.id,
            titulo: ma.metodologia.titulo,
            descricao: ma.metodologia.descricao,
            capaUrl: ma.metodologia.capaUrl,
            totalSemanas: ma.metodologia.totalSemanas,
            status: ma.status,
            iniciouEm: ma.iniciouEm,
            origemRegistro: "LEARNING" as const,
            precoAssinaturaMensal: null,
            planoId: `METODOLOGIA:${ma.metodologia.id}`,
          };
        }

        return null;
      })
      .filter(Boolean);

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
      assinaturas: assinaturasFiltradas || [],
      pagamentos,
      cupons,
      metodologiasAtivas,
      metodologias: {
        limiteMes: limiteMetodologiasMes,
        usadasNoMes: metodologiasAtivasNoMes,
        restantesNoMes: Math.max(0, limiteMetodologiasMes - metodologiasAtivasNoMes),
      },
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

      if (
        !isMetodologiaAvulsa(it.planoId) &&
        !isMetodologiaLearning(it.planoId) &&
        !isAulaAoVivo(it.planoId)
      ) {
        const plan = findPlan(it.planoId);
        if (!plan) {
          return res.status(400).json({
            message: `Plano inválido: ${it.planoId}`,
          });
        }
      }

      if (!["Mensal", "Anual"].includes(it.periodicidade as any)) {
        return res.status(400).json({ message: `Periodicidade inválida: ${it.planoId}` });
      }

      baseTotal += await priceFor(it.planoId, it.periodicidade);
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
            presenteBase += await priceFor(it.planoId, it.periodicidade);
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
    return res.status(500).json({ message: "Erro ao validar cupom. Para ele ser usado so pode ter o atleta_pro no carrinho.", err });
  }
}

export async function startTrial(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const now = new Date();

    const { planoId, periodicidade, metodoPreferido } = req.body as {
      planoId: string;
      periodicidade: Periodicidade;
      metodoPreferido?: MetodoPagamento | null;
    };

    const planoNorm = normalizePlanoId(planoId);
    const periodicidadeFinal: Periodicidade =
      periodicidade === "Anual" ? "Anual" : "Mensal";

    if (!planoNorm) {
      return res.status(400).json({ message: "Plano inválido" });
    }

    if (!["Mensal", "Anual"].includes(periodicidadeFinal as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const tipo = await getUserTipo(usuarioId);
    assertPlanoPermitido(tipo, planoNorm);

    const isAvulsa = isMetodologiaAvulsa(planoNorm);
    const isLearningMetodologia = isMetodologiaLearning(planoNorm);
    const isAula = isAulaAoVivo(planoNorm);
    const isPlanoPrincipal = !isAvulsa && !isLearningMetodologia && !isAula;

    if (isPlanoPrincipal && !findPlan(planoNorm)) {
      return res.status(400).json({ message: "Plano inválido" });
    }

    const jaUsouTrialNaConta = await (prisma as any).assinatura.findFirst({
      where: {
        usuarioId,
        trialStartsAt: { not: null },
      },
      select: {
        id: true,
        plano: true,
        trialStartsAt: true,
      },
    });

    if (jaUsouTrialNaConta) {
      return res.status(400).json({
        code: "TRIAL_ALREADY_USED",
        message: "Você já utilizou o mês grátis nesta conta.",
      });
    }

    const existing = await (prisma as any).assinatura.findUnique({
      where: {
        usuarioId_plano: {
          usuarioId,
          plano: planoNorm,
        },
      },
    });

    if (existing?.status === "ATIVA") {
      return res.status(400).json({
        code: "ALREADY_ACTIVE",
        message: "Você já possui acesso ativo neste item.",
      });
    }

    if (
      existing?.status === "TRIAL" &&
      existing.trialEndsAt &&
      now <= existing.trialEndsAt
    ) {
      return res.status(400).json({
        code: "TRIAL_ALREADY_ACTIVE",
        message: "Seu trial já está ativo.",
      });
    }

    if (existing?.trialStartsAt) {
      return res.status(400).json({
        code: "TRIAL_ALREADY_USED",
        message: "Você já utilizou o mês grátis neste item.",
      });
    }

    const trialEndsAt = addMonths(now, 1);
    const metodoPreferidoFinal: MetodoPagamento | null = metodoPreferido ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const assinatura = await (tx as any).assinatura.upsert({
        where: {
          usuarioId_plano: {
            usuarioId,
            plano: planoNorm,
          },
        },
        update: {
          periodicidade: periodicidadeFinal,
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
          periodicidade: periodicidadeFinal,
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

      await tx.pagamento.create({
        data: {
          usuarioId,
          plano: planoNorm,
          periodicidade: periodicidadeFinal,
          metodo: "PIX",
          status: "APROVADO",
          valor: 0 as any,
          moeda: "BRL",
          provider: "FOOTERA_TRIAL",
          providerRef: `TRIAL-${usuarioId}-${planoNorm}-${Date.now()}`,
          pagoEm: now,
          meta: {
            trial: true,
            trialStartsAt: now.toISOString(),
            trialEndsAt: trialEndsAt.toISOString(),
          },
        } as any,
      });

      if (isAvulsa) {
        const metodologiaAvulsaId = extractMetodologiaId(planoNorm);

        const metodologiaAvulsa = await tx.metodologiaAvulsa.findUnique({
          where: { id: metodologiaAvulsaId },
          select: { id: true, ativo: true },
        });

        if (!metodologiaAvulsa || !metodologiaAvulsa.ativo) {
          throw new Error("Metodologia avulsa não encontrada ou indisponível.");
        }

        await tx.metodologiaAssinante.upsert({
          where: {
            metodologiaAvulsaId_usuarioId: {
              metodologiaAvulsaId,
              usuarioId,
            },
          },
          update: {
            status: "ATIVA",
            origem: "AVULSA",
            iniciouEm: now,
            expiraEm: trialEndsAt,
            cancelouEm: null,
          },
          create: {
            metodologiaAvulsaId,
            usuarioId,
            status: "ATIVA",
            origem: "AVULSA",
            iniciouEm: now,
            expiraEm: trialEndsAt,
          },
        } as any);
      }

      if (isLearningMetodologia) {
        const metodologiaId = extractMetodologiaId(planoNorm);

        const metodologia = await tx.metodologia.findUnique({
          where: { id: metodologiaId },
          select: { id: true, ativo: true },
        });

        if (!metodologia || !metodologia.ativo) {
          throw new Error("Metodologia não encontrada ou indisponível.");
        }

        await tx.metodologiaAssinante.upsert({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId,
            },
          },
          update: {
            status: "ATIVA",
            origem: "LEARNING",
            iniciouEm: now,
            expiraEm: trialEndsAt,
            cancelouEm: null,
          },
          create: {
            metodologiaId,
            usuarioId,
            status: "ATIVA",
            origem: "LEARNING",
            iniciouEm: now,
            expiraEm: trialEndsAt,
          },
        } as any);
      }

      if (isAula) {
        const aulaAoVivoId = extractAulaAoVivoId(planoNorm);

        const aula = await tx.aulaAoVivo.findUnique({
          where: { id: aulaAoVivoId },
          select: {
            id: true,
            status: true,
            acessoPago: true,
            precoAcesso: true,
          },
        });

        if (!aula || aula.status === "CANCELADA") {
          throw new Error("Aula ao vivo não encontrada ou indisponível.");
        }

        await tx.aulaAoVivoAcesso.upsert({
          where: {
            aulaAoVivoId_usuarioId: {
              aulaAoVivoId,
              usuarioId,
            },
          },
          update: {
            status: "ATIVO",
            origem: "TRIAL",
            valorPago: 0 as any,
            pagoEm: now,
            expiraEm: trialEndsAt,
          },
          create: {
            aulaAoVivoId,
            usuarioId,
            status: "ATIVO",
            origem: "TRIAL",
            valorPago: 0 as any,
            pagoEm: now,
            expiraEm: trialEndsAt,
          },
        });
      }

      return assinatura;
    });

    return res.json({
      ok: true,
      assinatura: result,
      trialEndsAt,
      message: "Mês grátis iniciado com sucesso.",
    });
  } catch (err: any) {
    console.error("Erro startTrial:", err);

    return res.status(err?.statusCode || 500).json({
      message: err?.message || "Erro ao iniciar trial",
      code: err?.code,
    });
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
    !isMetodologiaAvulsa(a.plano) &&
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

async function approvePaymentAndProvision(
  pagamentoId: string,
  items: Array<{ planoId: string; periodicidade: Periodicidade }>
) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const pg = await tx.pagamento.update({
      where: { id: pagamentoId },
      data: { status: "APROVADO", pagoEm: now } as any,
    });

    for (const it of items) {
      const pid = normalizePlanoId(it.planoId);

      if (isMetodologiaAvulsa(pid)) {
        const metodologiaAvulsaId = extractMetodologiaId(pid);

        await (tx as any).metodologiaAssinante.upsert({
          where: {
            metodologiaAvulsaId_usuarioId: {
              metodologiaAvulsaId,
              usuarioId: pg.usuarioId,
            },
          },
          update: {
            status: "ATIVA",
            cancelouEm: null,
            origem: "AVULSA",
            metodologiaId: null,
            metodologiaAvulsaId,
            iniciouEm: now,
          },
          create: {
            usuarioId: pg.usuarioId,
            metodologiaId: null,
            metodologiaAvulsaId,
            origem: "AVULSA",
            status: "ATIVA",
            iniciouEm: now,
          },
        });

        const valorBruto = await priceFor(pid, it.periodicidade);

        await registrarCreatorVendaTx({
          tx,
          compradorId: pg.usuarioId,
          metodologiaAvulsaId,
          valorBruto,
          provider: "PAGAMENTO",
          providerRef: pg.id,
        });

        continue;
      }

      if (isMetodologiaLearning(pid)) {
        const metodologiaId = extractMetodologiaId(pid);

        await (tx as any).metodologiaAssinante.upsert({
          where: {
            metodologiaId_usuarioId: {
              metodologiaId,
              usuarioId: pg.usuarioId,
            },
          },
          update: {
            status: "ATIVA",
            cancelouEm: null,
            origem: "LEARNING",
            metodologiaAvulsaId: null,
            metodologiaId,
            iniciouEm: now,
          },
          create: {
            usuarioId: pg.usuarioId,
            metodologiaId,
            metodologiaAvulsaId: null,
            origem: "LEARNING",
            status: "ATIVA",
            iniciouEm: now,
          },
        });

        continue;
      }

      if (isAulaAoVivo(pid)) {
        const aulaAoVivoId = extractAulaAoVivoId(pid);
        const valorPago = await priceFor(pid, it.periodicidade);

        await (tx as any).aulaAoVivoAcesso.upsert({
          where: {
            aulaAoVivoId_usuarioId: {
              aulaAoVivoId,
              usuarioId: pg.usuarioId,
            },
          },
          update: {
            status: "ATIVO",
            origem: "PAGAMENTO",
            valorPago,
            pagoEm: now,
            expiraEm: null,
          },
          create: {
            aulaAoVivoId,
            usuarioId: pg.usuarioId,
            status: "ATIVO",
            origem: "PAGAMENTO",
            valorPago,
            pagoEm: now,
            expiraEm: null,
          },
        });

        continue;
      }

      await upsertSubscriptionTx(tx as any, pg.usuarioId, pid, it.periodicidade);
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

    const planoNorm = normalizePlanoId(planoId);

    if (!["Mensal", "Anual"].includes(periodicidade as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    if (
      isMetodologiaAvulsa(planoNorm) ||
      isMetodologiaLearning(planoNorm) ||
      isAulaAoVivo(planoNorm)
    ) {
      // produto especial: metodologia, metodologia avulsa ou aula ao vivo única
    } else {
      const plan = findPlan(planoNorm);
      if (!plan) {
        return res.status(400).json({ message: "Plano inválido" });
      }
    }
    try {
      validateMetodoAndFields(metodoFinal, pagador, cartao);
    } catch (e: any) {
      return res.status(400).json({ message: e.message || "Campos inválidos" });
    }

    let base = await priceFor(planoNorm, periodicidade);
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
        plano: planoNorm,
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
      const pid = normalizePlanoId(planoId);

      if (isMetodologiaAvulsa(pid)) {
        const metodologiaAvulsaId = extractMetodologiaId(pid);

        await prisma.metodologiaAssinante.upsert({
          where: {
            metodologiaAvulsaId_usuarioId: {
              metodologiaAvulsaId,
              usuarioId: pagamento.usuarioId,
            },
          },
          update: {
            status: "ATIVA",
            cancelouEm: null,
            origem: "AVULSA",
            metodologiaId: null,
            metodologiaAvulsaId,
          },
          create: {
            usuarioId: pagamento.usuarioId,
            metodologiaId: null,
            metodologiaAvulsaId,
            origem: "AVULSA",
            status: "ATIVA",
          },
        });
      } else {
        await upsertSubscription(pagamento.usuarioId, pid, pagamento.periodicidade);
      }

      if (cupomRow) await resgatarCupom(cupomRow.id, usuarioId, pagamento.id);

      return res.json({
        status: "APROVADO",
        pagamento,
        message: "Compra aprovada sem cobrança (cupom/presente).",
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

    let planTitle = "Plano";
    if (isMetodologiaAvulsa(normalizePlanoId(planoId))) {
      const mid = extractMetodologiaId(normalizePlanoId(planoId));
      const pr = await computeMetodologiaAvulsaPricing(mid);
      planTitle = `Metodologia Avulsa: ${pr.titulo}`;
    } else {
      const plan = findPlan(planoId);
      if (!plan) return res.status(400).json({ message: "Plano inválido" });
      planTitle = plan.title;
    }

    if (metodoFinal === "PIX") {
      try {
        const mpResp: any = await mercadopago.payment.create({
          transaction_amount: Number(total.toFixed(2)),
          description: `Assinatura ${planTitle} (${periodicidade})`,
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
            title: planTitle,
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

      if (
        !isMetodologiaAvulsa(it.planoId) &&
        !isMetodologiaLearning(it.planoId) &&
        !isAulaAoVivo(it.planoId)
      ) {
        const plan = findPlan(it.planoId);
        if (!plan) {
          return res.status(400).json({
            message: `Plano inválido: ${it.planoId}`,
          });
        }
      }

      if (!["Mensal", "Anual"].includes(it.periodicidade as any)) {
        return res.status(400).json({ message: `Periodicidade inválida: ${it.planoId}` });
      }

      totalBase += await priceFor(it.planoId, it.periodicidade);
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
              presenteBase += await priceFor(it.planoId, it.periodicidade);
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
          ativo: false,
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
        ativo: false,
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
      const pid = normalizePlanoId(pagamento.plano);

      if (isMetodologiaAvulsa(pid)) {
        const mid = extractMetodologiaId(pid);
        await prisma.metodologiaAssinante.upsert({
          where: { metodologiaId_usuarioId: { metodologiaId: mid, usuarioId: pagamento.usuarioId } },
          update: { status: "ATIVA", cancelouEm: null },
          create: { metodologiaId: mid, usuarioId: pagamento.usuarioId, status: "ATIVA" },
        });
      } else {
        await upsertSubscription(pagamento.usuarioId, pid, pagamento.periodicidade);
      }
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
      const pid = normalizePlanoId(pagamento.plano);

      if (isMetodologiaAvulsa(pid)) {
        const metodologiaId = extractMetodologiaId(pid);
        await prisma.metodologiaAssinante.upsert({
          where: { metodologiaId_usuarioId: { metodologiaId, usuarioId: pagamento.usuarioId } },
          update: { status: "ATIVA", cancelouEm: null },
          create: { metodologiaId, usuarioId: pagamento.usuarioId, status: "ATIVA" },
        });
      } else {
        await upsertSubscription(pagamento.usuarioId, pid, pagamento.periodicidade);
      }

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

export async function getMetodologiasAvulsas(req: AuthenticatedRequest, res: Response) {
  try {
    if (!BILLING_SHOW_METODOLOGIAS_AVULSAS) {
      return res.json({ items: [] });
    }

    const metodologias = await prisma.metodologiaAvulsa.findMany({
      where: {
        ativo: true,
      },
      include: {
        estruturas: {
          include: {
            itens: true,
          },
        },
      },
      orderBy: {
        criadoEm: "desc",
      },
    });

    const items = metodologias.map((m) => {
      const estruturas = m.estruturas || [];
      const itens = estruturas.flatMap((e) => e.itens || []);

      const videoCount = itens.filter((i) => i.tipo === "VIDEO" || i.tipo === "AULA").length;
      const treinoCount = itens.filter((i) => i.tipo === "TREINO").length;
      const aulaAoVivoCount = itens.filter((i) => i.tipo === "AULA_AO_VIVO").length;
      const somaPontos = itens.reduce((acc, i) => acc + Number(i.pontos || 0), 0);

      const totalSemanas = estruturas.reduce(
        (acc, e) => Math.max(acc, Number(e.duracaoSemanas || 0)),
        0
      );

      return {
        id: m.id,
        titulo: m.titulo,
        descricao: m.descricao,
        capaUrl: m.capaUrl,
        nivel: null,
        publicoAlvo: m.publicoAlvo ?? null,
        totalSemanas,
        videoCount,
        treinoCount,
        aulaAoVivoCount,
        precoAssinaturaMensal: Number(m.precoAssinaturaMensal ?? 0),
        pontosTotal: somaPontos,
        planoId: `METODOLOGIA_AVULSA:${m.id}`,
        _count: {
          itens: itens.length,
          assinantes: 0,
        },
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao carregar metodologias avulsas" });
  }
}

export async function resetMetodologiasAvulsasDev(req: AuthenticatedRequest, res: Response) {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ message: "Operação desativada em produção" });
    }

    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const tipo = await getUserTipo(usuarioId);
    if (String(tipo).toLowerCase() !== "admin") {
      return res.status(403).json({ message: "Apenas admin pode resetar (dev)" });
    }

    await prisma.metodologiaAssinante.deleteMany({});
    await prisma.metodologiaItem.deleteMany({});
    await prisma.metodologiaTreino.deleteMany({});
    await prisma.metodologia.deleteMany({});

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erro ao resetar metodologias (dev)" });
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

    if (isMetodologiaAvulsa(planoNorm)) {
      const mid = extractMetodologiaId(planoNorm);
      await prisma.metodologiaAssinante.upsert({
        where: { metodologiaId_usuarioId: { metodologiaId: mid, usuarioId } },
        update: { status: "ATIVA", cancelouEm: null },
        create: { metodologiaId: mid, usuarioId, status: "ATIVA" },
      });
    } else {
      await upsertSubscription(usuarioId, planoNorm, periodicidade);
    }
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

export async function checkExpiringSubscriptions(req: Request, res: Response) {
  try {
    const now = new Date();

    const assinaturas = await (prisma as any).assinatura.findMany({
      where: {
        ativo: true,
        OR: [
          { status: "TRIAL" },
          { status: "ATIVA" },
          { status: "CANCELADA" },
        ],
      },
      orderBy: { startsAt: "asc" },
    });

    let bloqueadas = 0;
    let lembretes = 0;
    let desativadas = 0;

    for (const a of assinaturas as any[]) {
      const dataLimite =
        a.status === "TRIAL"
          ? a.trialEndsAt
          : a.renovaEm;

      // aviso de 7 dias
      if (
        dataLimite &&
        a.lembreteEnviado === false
      ) {
        const dias = diffDays(dataLimite, now);

        if (dias <= 7 && dias >= 0) {
          await (prisma as any).assinatura.update({
            where: { id: a.id },
            data: {
              lembreteEnviado: true,
            } as any,
          });

          lembretes++;
        }
      }

      // trial vencido
      if (a.status === "TRIAL" && a.trialEndsAt && now > a.trialEndsAt) {
        await (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            status: "BLOQUEADA",
            ativo: false,
            canceledAt: now,
            bloqueadoEm: now,
          } as any,
        });
        bloqueadas++;
        continue;
      }

      // assinatura ativa vencida
      if (a.status === "ATIVA" && a.renovaEm && now > a.renovaEm) {
        await (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            status: "BLOQUEADA",
            ativo: false,
            canceledAt: now,
            bloqueadoEm: now,
          } as any,
        });
        bloqueadas++;
        continue;
      }

      // cancelada e já passou da renovação
      if (a.status === "CANCELADA" && a.renovaEm && now > a.renovaEm && a.ativo) {
        await (prisma as any).assinatura.update({
          where: { id: a.id },
          data: {
            ativo: false,
          } as any,
        });
        desativadas++;
      }
    }

    return res.json({
      ok: true,
      bloqueadas,
      lembretes,
      desativadas,
    });
  } catch (err) {
    console.error("Erro em checkExpiringSubscriptions:", err);
    return res.status(500).json({ message: "Erro ao verificar assinaturas expirando" });
  }
}

export async function getAulasAoVivoPagas(req: AuthenticatedRequest, res: Response) {
  try {
    const items = await prisma.aulaAoVivo.findMany({
      where: {
        metodologiaId: null,
        metodologiaAvulsaId: null,
        acessoPago: true,
        precoAcesso: {
          gt: 0,
        },
        status: {
          in: ["AGENDADA", "AO_VIVO", "FINALIZADA"],
        },
      },
      orderBy: {
        dataInicio: "asc",
      },
      select: {
        id: true,
        titulo: true,
        descricao: true,
        dataInicio: true,
        dataFim: true,
        inscricaoInicio: true,
        inscricaoFim: true,
        precoAcesso: true,
        acessoPago: true,
        status: true,
        totalParticipantes: true,
        criadorUsuario: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    return res.json({
      items: items.map((aula: any) => ({
        ...aula,
        precoAcesso: Number(aula.precoAcesso || 0),
        planoId: `AULA_AO_VIVO:${aula.id}`,
      })),
    });
  } catch (e: any) {
    console.error("Erro em getAulasAoVivoPagas:", e);
    return res.status(500).json({
      message: "Erro ao listar eventos ao vivo pagos.",
      detail: e?.message,
    });
  }
}


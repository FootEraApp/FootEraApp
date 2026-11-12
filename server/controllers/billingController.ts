import { Request, Response } from "express";
import { timingSafeEqual, randomUUID } from "crypto";
import { z } from "zod";
import { sendError } from "../utils/httpError.js";
import {
  PrismaClient,
  Prisma,
  MetodoPagamento,
  Periodicidade,
  PagamentoStatus,
  NotificacaoTipo,
  CreatorVendaStatus,
  CreatorTipo,
  EventoPagamentoStatus,
} from "@prisma/client";
import QRCode from "qrcode";
import * as mercadopagoModule from "mercadopago";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";
import { getIO } from "../socket.js";
import { recomputeAndEmitBadge } from "./notificacoesController.js";
import type {
  ActiveContext,
} from "../services/activeContext.js";
import {
  BillingComunicacaoCanal,
  BillingComunicacaoStatus,
} from "@prisma/client";
import {
  sendBillingEmail,
} from "../utils/mailer.js";
import {
  reembolsarMetodologiaAvulsaQa,
} from "../services/billingReembolsoService.js";
import {
  buscarPagamentoPorReferenciaExternaMercadoPago,
  classificarConciliacaoMercadoPago,
  consultarPagamentoMercadoPago,
  diagnosticarBuscaCheckoutSemReferencia,
  validarPixRecuperavelMercadoPago,
} from "../services/billingConciliacaoMercadoPagoService.js";
import {
  obterPagamentoMercadoPago,
} from "../services/billingMercadoPagoGateway.js";
import {
  registrarPendenciaEventoExcedente,
} from "../services/billingPendenciaEventoService.js";
import {
  consultarCheckoutDoUsuario,
  fingerprintCheckout,
  prepararCheckoutAtomico,
  adquirirEnvioCheckout,
  confirmarCheckoutExterno,
  marcarCheckoutInconclusivo,
  ErroCheckoutOperacao,
  confirmarPreferenciaCheckout,
} from "../services/billingCheckoutOperacaoService.js";
import {
  recuperarPreferenciaMercadoPago,
} from "../services/billingPreferenciaRecuperacaoService.js";
import {
  consultarBeneficioAniversario,
  obterCupomAniversario,
  ehCupomAniversario,
  CupomAniversarioError,
} from "../services/billingCupomAniversarioService.js";

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

function isTipoLearningEspecial(
  tipoRaw: string | null | undefined
) {
  const tipo = normalizeTipoBilling(tipoRaw);

  return (
    tipo === "marca" ||
    tipo === "federacao" ||
    tipo === "learning"
  );
}

function allowedPlanIdsByTipo(tipoRaw: string) {
  const tipo = normalizeTipoBilling(tipoRaw);

  if (isTipoLearningEspecial(tipo)) {
    return BILLING_SHOW_LEARNING_PLANS
      ? ["LEARNING_3"]
      : [];
  }

  if (tipo === "atleta") {
    return BILLING_SHOW_LEARNING_PLANS
      ? [
          "ATLETA_PRO",
          "ATLETA_LEARNING_1",
          "ATLETA_LEARNING_3",
        ]
      : ["ATLETA_PRO"];
  }

  if (tipo === "professor") {
    return BILLING_SHOW_LEARNING_PLANS
      ? [
          "PROFESSOR_PRO",
          "PROFESSOR_LEARNING_1",
          "PROFESSOR_LEARNING_3",
        ]
      : ["PROFESSOR_PRO"];
  }

  if (
    tipo === "clube" ||
    tipo === "escolinha" ||
    tipo === "escola"
  ) {
    return BILLING_SHOW_LEARNING_PLANS
      ? [
          "ORGANIZACOES_PRO",
          "ORGANIZACOES_LEARNING_3",
        ]
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

          "LEARNING_3",
        ]
      : [
          "ATLETA_PRO",
          "PROFESSOR_PRO",
          "ORGANIZACOES_PRO",
          "OLHEIRO_PRO",
        ];
  }

  return [];
}

function assertPlanoPermitido(
  tipoUsuario: string,
  planoId: string
) {
  const planoNorm =
    normalizePlanoId(planoId);

  if (
    isEvento(planoNorm)
  ) {
    return;
  }

  if (
    isMetodologiaAvulsa(
      planoNorm
    )
  ) {
    if (
      isTipoLearningEspecial(
        tipoUsuario
      )
    ) {
      return;
    }

    if (
      !BILLING_SHOW_METODOLOGIAS_AVULSAS
    ) {
      const err: any =
        new Error(
          "Assinatura de metodologia avulsa indisponível no momento."
        );

      err.statusCode = 403;
      err.code =
        "METODOLOGIA_AVULSA_DISABLED";

      throw err;
    }

    return;
  }

  if (
    isAulaAoVivo(
      planoNorm
    )
  ) {
    return;
  }

  if (
    isTipoLearningEspecial(
      tipoUsuario
    )
  ) {
    if (
      planoNorm ===
      "LEARNING_3"
    ) {
      if (
        !BILLING_SHOW_LEARNING_PLANS
      ) {
        const err: any =
          new Error(
            "Plano Learning indisponível no momento."
          );

        err.statusCode = 403;
        err.code =
          "LEARNING_PLAN_DISABLED";

        throw err;
      }

      return;
    }

    if (
      isMetodologiaLearning(
        planoNorm
      )
    ) {
      const err: any =
        new Error(
          "Assine o plano Learning para escolher metodologias dentro do limite mensal."
        );

      err.statusCode = 403;
      err.code =
        "USE_LEARNING_PLAN";

      throw err;
    }

    const err: any =
      new Error(
        "Este tipo de usuário pode assinar somente o plano Learning, além de comprar metodologias avulsas e eventos ao vivo/replays."
      );

    err.statusCode = 403;
    err.code =
      "PLAN_NOT_ALLOWED_FOR_USER_TYPE";

    throw err;
  }

  if (
    isMetodologiaLearning(
      planoNorm
    )
  ) {
    if (
      !BILLING_SHOW_METODOLOGIAS_LEARNING
    ) {
      const err: any =
        new Error(
          "Assinatura de metodologia learning indisponível no momento."
        );

      err.statusCode = 403;
      err.code =
        "METODOLOGIA_LEARNING_DISABLED";

      throw err;
    }

    return;
  }

  const allowed =
    allowedPlanIdsByTipo(
      tipoUsuario
    );

  if (
    !allowed.includes(
      planoNorm as any
    )
  ) {
    const err: any =
      new Error(
        "Plano não permitido para este tipo de usuário."
      );

    err.statusCode = 403;
    err.code =
      "PLAN_NOT_ALLOWED";

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
const FRONTEND_URL =
  (
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  ).replace(/\/+$/, "");

export async function getCheckoutOperacao(
  req: Request,
  res: Response
) {
  try {
    const usuarioId = getUserId(req);

    const chaveCliente = String(
      req.params.chaveCliente ?? ""
    ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
      });
    }

    if (
      chaveCliente.length < 16 ||
      chaveCliente.length > 128
    ) {
      return res.status(400).json({
        code: "CHECKOUT_KEY_INVALID",
      });
    }

    const contextoWhere =
      getContextoPagamentoWhere(req);

    if (!contextoWhere) {
      return res.status(403).json({
        code: "BILLING_CONTEXT_REQUIRED",
      });
    }

    const operacao =
      await consultarCheckoutDoUsuario(
        usuarioId,
        chaveCliente
      );

    if (!operacao) {
      return res.status(404).json({
        code: "CHECKOUT_OPERATION_NOT_FOUND",
      });
    }

    // Confere a propriedade e o contexto diretamente
    // no banco antes de fornecer qualquer informação.
    const pagamento =
      await prisma.pagamento.findFirst({
        where: {
          AND: [
            {
              id: operacao.pagamentoId,
              usuarioId,
            },
            contextoWhere,
          ],
        },
        select: {
          id: true,
          status: true,
          provider: true,
          providerRef: true,
          pixCopiaECola: true,
          valor: true,
          moeda: true,
        },
      });

    if (!pagamento) {
      return res.status(404).json({
        code: "CHECKOUT_OPERATION_NOT_FOUND",
      });
    }


    // Conciliação somente leitura de checkout inconclusivo.
    // Nunca cria cobrança, confirma checkout ou concede acesso.
    let conciliacaoExterna: {
      consultada: boolean;
      acao: string | null;
      motivo: string;
    } | null = null;

    if (
      operacao.status === "INCONCLUSIVA" ||
      operacao.status === "ENVIO_POSSIVEL"
    ) {
      const refOperacao =
        operacao.providerRef?.trim() || null;

      const refPagamento =
        pagamento.providerRef?.trim() || null;

      const referenciasConflitantes =
        Boolean(
          refOperacao &&
          refPagamento &&
          refOperacao !== refPagamento
        );

      const referencia =
        refOperacao ?? refPagamento;


      if (referenciasConflitantes) {
        conciliacaoExterna = {
          consultada: false,
          acao: "CONCILIACAO_MANUAL",
          motivo: "REFERENCIAS_EXTERNAS_DIVERGENTES",
        };
      } else if (
        !referencia &&
        operacao.modalidade.startsWith("PIX_") &&
        (
          pagamento.provider !== "MERCADOPAGO" ||
          pagamento.status !== PagamentoStatus.PENDENTE ||
          pagamento.moeda !== "BRL"
        )
      ) {
        conciliacaoExterna = {
          consultada: false,
          acao: "CONCILIACAO_MANUAL",
          motivo: "ESTADO_FINANCEIRO_INCOMPATIVEL",
        };
            } else if (
        !referencia &&
        operacao.modalidade.startsWith("PIX_") &&
        process.env.BILLING_CHECKOUT_SEARCH_RECOVERY === "true" &&
        process.env.NODE_ENV === "production" &&
        process.env.BILLING_CUPOM_RESERVA_QA !== "true"
      ) {
        const diagnostico =
          await diagnosticarBuscaCheckoutSemReferencia({
            id: pagamento.id,
            provider: pagamento.provider ?? "",
            providerRef: pagamento.providerRef,
            valor: pagamento.valor,
            moeda: pagamento.moeda,
            status: pagamento.status,
          });

        conciliacaoExterna = diagnostico;
      } else if (
        !operacao.modalidade.startsWith("PIX_") ||
        !referencia ||
        !/^\d+$/.test(referencia)
      ) {
        conciliacaoExterna = {
          consultada: false,
          acao: "CONCILIACAO_MANUAL",
          motivo:
            "IDENTIDADE_EXTERNA_INSUFICIENTE",
        };
      } else if (
        pagamento.provider !== "MERCADOPAGO" ||
        pagamento.status !== PagamentoStatus.PENDENTE ||
        pagamento.moeda !== "BRL"
      ) {
        conciliacaoExterna = {
          consultada: false,
          acao: "CONCILIACAO_MANUAL",
          motivo: "ESTADO_FINANCEIRO_INCOMPATIVEL",
        };
      } else {
        try {
          const mp =
            await consultarPagamentoMercadoPago(referencia);

          const resultado =
            classificarConciliacaoMercadoPago(
              {
                id: pagamento.id,
                provider: pagamento.provider,
                providerRef: referencia,
                valor: pagamento.valor,
                moeda: pagamento.moeda,
                status: pagamento.status,
              },
              mp
            );

          conciliacaoExterna = {
            consultada: true,
            acao: resultado.acao,
            motivo: resultado.motivo,
          };
        } catch (erro) {
          console.error(
            "[billing] Falha na consulta externa do checkout:",
            erro
          );

          conciliacaoExterna = {
            consultada: false,
            acao: "CONCILIACAO_MANUAL",
            motivo: "CONSULTA_EXTERNA_INDISPONIVEL",
          };
        }
      }
    }

    let pixRecuperavel = false;

    const candidatoPix =
      operacao.status === "CONFIRMADA" &&
      operacao.modalidade.startsWith("PIX_") &&
      pagamento.status === PagamentoStatus.PENDENTE &&
      pagamento.provider === "MERCADOPAGO" &&
      Boolean(pagamento.pixCopiaECola) &&
      Boolean(operacao.providerRef) &&
      pagamento.providerRef === operacao.providerRef &&
      /^\d+$/.test(operacao.providerRef ?? "");

    if (candidatoPix) {
      try {
        const mp =
          await consultarPagamentoMercadoPago(
            operacao.providerRef!
          );

        pixRecuperavel =
          validarPixRecuperavelMercadoPago({
            pagamentoId: pagamento.id,
            providerRef: operacao.providerRef!,
            valor: pagamento.valor,
            moeda: pagamento.moeda,
            pixCopiaECola:
              pagamento.pixCopiaECola!,
            mp,
          });
      } catch (erro) {
        console.error(
          "[billing] PIX exige conciliacao:",
          erro
        );

        pixRecuperavel = false;
      }
    }

    let checkoutUrlRecuperada: string | null = null;
    let preferenciaExigeRevisao = false;

    const podeConsultarPreferencia =
      operacao.status === "CONFIRMADA" &&
      operacao.modalidade.startsWith("PREFERENCIA_") &&
      pagamento.status === PagamentoStatus.PENDENTE;

    if (podeConsultarPreferencia) {
      try {
        if (
          pagamento.moeda !== "BRL" ||
          !operacao.providerRef
        ) {
          throw new Error(
            "PREFERENCIA_DADOS_LOCAIS_INVALIDOS"
          );
        }

        const valorCentavos =
          pagamento.valor.mul(100).toNumber();

        const recuperacao =
          await recuperarPreferenciaMercadoPago({
            preferenciaId: operacao.providerRef,
            pagamentoId: pagamento.id,
            valorCentavos,
          });

        checkoutUrlRecuperada =
          recuperacao.checkoutUrl;
      } catch (erro) {
        console.error(
          "[billing] Preferencia exige revisao:",
          erro
        );

        preferenciaExigeRevisao = true;
      }
    }

    const requerConciliacaoExterna =
      operacao.status === "INCONCLUSIVA" ||
      operacao.status === "ENVIO_POSSIVEL";

    const podeIniciarNovaCobranca =
      false;

    return res.json({
      operacao: {
        id: operacao.id,
        pagamentoId: pagamento.id,
        modalidade: operacao.modalidade,
        status: operacao.status,
        statusPagamento: pagamento.status,
        conciliacaoExterna,
        podeRecuperarPix: pixRecuperavel,
        checkoutUrlRecuperada,
        preferenciaExigeRevisao,
        requerConciliacaoExterna,
        podeIniciarNovaCobranca,
        preferenciaConfirmada:
          operacao.status === "CONFIRMADA" &&
          operacao.modalidade.startsWith("PREFERENCIA_") &&
          pagamento.status === PagamentoStatus.PENDENTE &&
          !preferenciaExigeRevisao &&
          checkoutUrlRecuperada !== null,
        criadoEm: operacao.criadoEm,
        atualizadoEm: operacao.atualizadoEm,
        pixCopiaECola: pixRecuperavel
          ? pagamento.pixCopiaECola
          : null,
      },
    });
  } catch (error) {
    console.error(
      "[billing] Erro ao consultar checkout:",
      error
    );

    return res.status(500).json({
      code: "CHECKOUT_OPERATION_QUERY_FAILED",
    });
  }
}

async function adquirirOperacaoAntesDoEnvio(
  operacaoId: string | undefined,
  pagamentoId: string
): Promise<{
  adquirida: boolean;
  statusHttp: number;
  code: string;
}> {
  if (!operacaoId) {
    return {
      adquirida: false,
      statusHttp: 503,
      code: "BILLING_CHECKOUT_OPERATION_MISSING",
    };
  }

  const adquirida =
    await adquirirEnvioCheckout(operacaoId);

  return {
    adquirida,
    statusHttp: adquirida ? 200 : 409,
    code: adquirida
      ? "BILLING_CHECKOUT_SEND_ACQUIRED"
      : "BILLING_CHECKOUT_OPERATION_ALREADY_STARTED",
  };
}

async function registrarFalhaExternaCheckout(
  operacaoId: string | undefined,
  erro: unknown
): Promise<void> {
  if (!operacaoId) {
    throw new Error(
      "BILLING_CHECKOUT_OPERATION_MISSING"
    );
  }

  const registrado =
    await marcarCheckoutInconclusivo(
      operacaoId,
      erro
    );

  if (!registrado) {
    const operacao =
      await prisma.billingCheckoutOperacao.findUnique({
        where: { id: operacaoId },
        select: { status: true },
      });

    if (operacao?.status !== "CONFIRMADA" &&
        operacao?.status !== "INCONCLUSIVA") {
      throw new Error(
        "BILLING_CHECKOUT_STATE_NOT_PERSISTED"
      );
    }
  }
}

function responderCheckoutExternoInconclusivo(
  res: Response,
  pagamentoId: string,
  modalidade: string,
  erro: unknown
) {
  console.error(
    "[billing] Checkout externo inconclusivo. Revisao necessaria.",
    {
      pagamentoId,
      modalidade,
      erro: erro instanceof Error ? erro.message : String(erro),
    }
  );

  return res.status(503).json({
    ok: false,
    code: "BILLING_CHECKOUT_EXTERNAL_RECONCILIATION_REQUIRED",
    pagamentoId,
    message:
      "Nao foi possivel confirmar a criacao do pagamento. " +
      "Nao tente criar outra cobranca antes de verificar " +
      "a situacao deste pagamento.",
  });
}

function normalizarReturnToPagamento(
  valor: unknown
) {
  const path =
    String(
      valor ?? ""
    ).trim();

  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  ) {
    return "/pagamentos";
  }

  return path;
}
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || "";

const HAS_MERCADO_PAGO =
  Boolean(MP_ACCESS_TOKEN) &&
  typeof mercadopago?.configure === "function";

if (MP_ACCESS_TOKEN && !HAS_MERCADO_PAGO) {
  throw new Error(
    "BILLING_MERCADOPAGO_SDK_INCOMPATIBLE"
  );
}

if (process.env.NODE_ENV === "production" && !HAS_MERCADO_PAGO) {
  throw new Error(
    "BILLING_PAYMENT_PROVIDER_NOT_CONFIGURED"
  );
}

if (HAS_MERCADO_PAGO) {
  mercadopago.configure({
    access_token: MP_ACCESS_TOKEN,
  });
} else {
  console.warn(
    "[billing] Modo fake permitido somente fora de produção."
  );
}

const BILLING_SHOW_LEARNING_PLANS =
  process.env.BILLING_SHOW_LEARNING_PLANS === "true";

const BILLING_SHOW_METODOLOGIAS_AVULSAS =
  process.env.BILLING_SHOW_METODOLOGIAS_AVULSAS === "true";

const BILLING_SHOW_METODOLOGIAS_LEARNING =
  process.env.BILLING_SHOW_METODOLOGIAS_LEARNING === "true";

const BILLING_CUPOM_RESERVA_QA = (() => {
  if (
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.NODE_ENV !== "test" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    HAS_MERCADO_PAGO ||
    Boolean(process.env.MP_ACCESS_TOKEN)
  ) {
    return false;
  }

  try {
    const databaseUrl = new URL(
      process.env.DATABASE_URL ?? ""
    );

    return (
      databaseUrl.protocol === "postgresql:" &&
      ["127.0.0.1", "localhost"].includes(
        databaseUrl.hostname
      ) &&
      databaseUrl.port === "5433" &&
      databaseUrl.pathname === "/footera_billing_qa"
    );
  } catch {
    return false;
  }
})();

const CUPOM_RESERVA_REVISAO_MS =
  48 * 60 * 60 * 1000;

type Pagador = {
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
};

type StartCheckoutBody = {
  planoId: string;
  periodicidade: Periodicidade;
  metodo: MetodoPagamento;
  cupom?: string | null;
  pagador?: Pagador;
  returnTo?: string | null;
  chaveCliente?: string;
};

const pagadorSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  email: z.string().trim().min(1).optional(),
  cpf: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
});

const startCheckoutSchema = z.object({
  planoId: z.string().trim().min(1, "planoId é obrigatório"),
  periodicidade: z.enum(["Mensal", "Anual"], {
    errorMap: () => ({ message: "Periodicidade inválida" }),
  }),
  metodo: z.enum(["PIX", "CREDITO", "DEBITO", "BOLETO"]).optional(),
  cupom: z.string().trim().optional().nullable(),
  pagador: pagadorSchema.optional(),
  returnTo:
    z.string()
      .trim()
      .optional()
      .nullable(),
  chaveCliente: z.string().uuid().optional(),
});

type StartBundleBody = {
  items:
    Array<{
      planoId: string;
      periodicidade: Periodicidade;
    }>;

  metodo:
    MetodoPagamento;

  cupom?:
    string | null;

  pagador?:
    Pagador;

  returnTo?:
    string | null;

  chaveCliente?: string;
};

type CartItem = { planoId: string; periodicidade: Periodicidade };

type BillingItemFinanceiro = {
  planoId: string;
  periodicidade: Periodicidade;
  valorBaseCentavos: number;
  valorFinalCentavos: number;
};

type BillingFinanceiroV1 = {
  versao: 1;
  totalCentavos: number;
  items: BillingItemFinanceiro[];
};

function billingCentavos(valor: number): number {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error("BILLING_INVALID_AMOUNT");
  }

  return Math.round((valor + Number.EPSILON) * 100);
}

function ratearDescontoBundle(
  items: BillingItemFinanceiro[],
  descontoCentavos: number
): BillingItemFinanceiro[] {
  const totalBase = items.reduce(
    (soma, item) => soma + item.valorBaseCentavos,
    0
  );

  if (
    !Number.isSafeInteger(descontoCentavos) ||
    descontoCentavos < 0 ||
    descontoCentavos > totalBase ||
    totalBase <= 0
  ) {
    throw new Error("BILLING_INVALID_BUNDLE_DISCOUNT");
  }

  const rateio = items.map((item, index) => {
    const numerador =
      item.valorBaseCentavos * descontoCentavos;

    const descontoInicial = Math.floor(
      numerador / totalBase
    );

    return {
      index,
      desconto: descontoInicial,
      resto: numerador % totalBase,
    };
  });

  let centavosRestantes =
    descontoCentavos -
    rateio.reduce(
      (soma, item) => soma + item.desconto,
      0
    );

  const prioridade = [...rateio].sort(
    (a, b) =>
      b.resto - a.resto ||
      a.index - b.index
  );

  for (const item of prioridade) {
    if (centavosRestantes <= 0) break;

    item.desconto += 1;
    centavosRestantes -= 1;
  }

  return items.map((item, index) => ({
    ...item,
    valorFinalCentavos:
      item.valorBaseCentavos -
      rateio[index].desconto,
  }));
}

function obterFinanceiroPagamento(
  pagamento: {
    valor: Prisma.Decimal;
    meta: Prisma.JsonValue | null;
  },
  items: CartItem[]
): BillingFinanceiroV1 | null {
  const meta = pagamento.meta;

  if (
    !meta ||
    typeof meta !== "object" ||
    Array.isArray(meta)
  ) {
    return null;
  }

  const financeiro = meta.financeiroV1;

  if (
    !financeiro ||
    typeof financeiro !== "object" ||
    Array.isArray(financeiro)
  ) {
    return null;
  }

  const dados = financeiro as Record<string, unknown>;

  if (
    dados.versao !== 1 ||
    !Number.isSafeInteger(dados.totalCentavos) ||
    !Array.isArray(dados.items) ||
    dados.items.length !== items.length
  ) {
    throw new Error("BILLING_INVALID_FINANCIAL_SNAPSHOT");
  }

  const linhas = dados.items.map((raw, index) => {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new Error("BILLING_INVALID_FINANCIAL_ITEM");
    }

    const item = raw as Record<string, unknown>;

    if (
      item.planoId !== normalizePlanoId(items[index].planoId) ||
      item.periodicidade !== items[index].periodicidade ||
      !Number.isSafeInteger(item.valorBaseCentavos) ||
      !Number.isSafeInteger(item.valorFinalCentavos) ||
      Number(item.valorBaseCentavos) < 0 ||
      Number(item.valorFinalCentavos) < 0 ||
      Number(item.valorFinalCentavos) >
        Number(item.valorBaseCentavos)
    ) {
      throw new Error("BILLING_FINANCIAL_ITEM_MISMATCH");
    }

    return {
      planoId: String(item.planoId),
      periodicidade: item.periodicidade as Periodicidade,
      valorBaseCentavos: Number(item.valorBaseCentavos),
      valorFinalCentavos: Number(item.valorFinalCentavos),
    };
  });

  const soma = linhas.reduce(
    (total, item) => total + item.valorFinalCentavos,
    0
  );

  const totalPagamentoCentavos =
    pagamento.valor.mul(100).toNumber();

  if (
    soma !== dados.totalCentavos ||
    soma !== totalPagamentoCentavos
  ) {
    throw new Error("BILLING_FINANCIAL_TOTAL_MISMATCH");
  }

  return {
    versao: 1,
    totalCentavos: soma,
    items: linhas,
  };
}

export async function revisarReservasCupomVencidasQa() {
  if (!BILLING_CUPOM_RESERVA_QA) {
    return 0;
  }

  const agora = new Date();

  const reservas = await prisma.cupomReserva.findMany({
    where: {
      status: "RESERVADA",
      expiraEm: {
        lte: agora,
      },
    },
    select: {
      id: true,
      pagamento: {
        select: {
          status: true,
        },
      },
    },
    orderBy: {
      expiraEm: "asc",
    },
    take: 100,
  });

  let marcadas = 0;

  for (const reserva of reservas) {
    // Pagamentos já alterados de status devem ser
    // examinados separadamente, nunca liberados aqui.
    if (
      reserva.pagamento.status !==
      PagamentoStatus.PENDENTE
    ) {
      continue;
    }

    const resultado = await prisma.cupomReserva.updateMany({
      where: {
        id: reserva.id,
        status: "RESERVADA",
        expiraEm: {
          lte: agora,
        },
      },
      data: {
        status: "CONCILIACAO_PENDENTE",
      },
    });

    marcadas += resultado.count;
  }

  return marcadas;
}

export async function criarPagamentoComReservaQa(
  args: {
    usuarioId: string;
    cupomId: string;
    data: Prisma.PagamentoUncheckedCreateInput;
    tx?: Prisma.TransactionClient;
  }
) {
  const executar = async (
    tx: Prisma.TransactionClient
  ) => {
      // Serializa as reservas do mesmo cupom no PostgreSQL.
      await tx.$queryRaw`
        SELECT id
        FROM "Cupom"
        WHERE id = ${args.cupomId}
        FOR UPDATE
      `;

      const cupom = await tx.cupom.findUniqueOrThrow({
        where: {
          id: args.cupomId,
        },
      });

      if (
        cupom.concedidoParaUsuarioId &&
        cupom.concedidoParaUsuarioId !== args.usuarioId
      ) {
        throw new Error("BILLING_COUPON_OWNER_MISMATCH");
      }

      if (
        cupom.codigo.startsWith("ANIVERSARIO_") &&
        !ehCupomAniversario(cupom)
      ) {
        throw new Error("BIRTHDAY_COUPON_INVALID_OWNER");
      }

      const agora = new Date();

      if (
        !cupom.ativo ||
        (cupom.expiraEm && cupom.expiraEm <= agora)
      ) {
        throw new Error("BILLING_COUPON_NOT_AVAILABLE");
      }

      const resgate = await tx.cupomResgate.findUnique({
        where: {
          cupomId_usuarioId: {
            cupomId: cupom.id,
            usuarioId: args.usuarioId,
          },
        },
      });

      if (resgate) {
        throw new Error("BILLING_COUPON_ALREADY_REDEEMED");
      }

      const reservaDoUsuario =
        await tx.cupomReserva.findFirst({
          where: {
            cupomId: cupom.id,
            usuarioId: args.usuarioId,
            status: {
              in: [
                "RESERVADA",
                "CONCILIACAO_PENDENTE",
              ],
            },
          },
        });

      if (reservaDoUsuario) {
        throw new Error(
          "BILLING_COUPON_ALREADY_RESERVED"
        );
      }

      const reservasAtivas =
        await tx.cupomReserva.count({
          where: {
            cupomId: cupom.id,
            status: {
              in: [
                "RESERVADA",
                "CONCILIACAO_PENDENTE",
              ],
            },
          },
        });

      if (
        cupom.usosMax !== null &&
        cupom.usosAtuais + reservasAtivas >= cupom.usosMax
      ) {
        throw new Error(
          "BILLING_COUPON_CAPACITY_EXHAUSTED"
        );
      }

      const pagamento = await tx.pagamento.create({
        data: args.data,
      });

      await tx.cupomReserva.create({
        data: {
          cupomId: cupom.id,
          usuarioId: args.usuarioId,
          pagamentoId: pagamento.id,
          status: "RESERVADA",
          expiraEm: new Date(
            agora.getTime() + CUPOM_RESERVA_REVISAO_MS
          ),
        },
      });

      return pagamento;
  };

  if (args.tx) {
    return executar(args.tx);
  }

  return prisma.$transaction(
    executar,
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

function exigeReservaCupom(
  cupom: {
    codigo: string;
    concedidoParaUsuarioId: string | null;
  } | null,
  usuarioId: string
): boolean {
  if (!cupom) return false;

  if (BILLING_CUPOM_RESERVA_QA) {
    return true;
  }

  return (
    ehCupomAniversario(cupom) &&
    cupom.concedidoParaUsuarioId === usuarioId
  );
}

function getUserId(req: Request) {
  const r = req as AuthenticatedRequest as any;
  return r.userId ?? r.authUser?.id ?? r.user?.id;
}

function getBillingActiveContext(
  req: Request
): ActiveContext | null {
  const r =
    req as AuthenticatedRequest as any;

  return (
    r.authUser?.activeContext ??
    r.user?.activeContext ??
    null
  );
}

function getBillingTipo(
  req: Request
) {
  const contexto =
    getBillingActiveContext(req);

  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    return contexto.organizationType
      ? String(
          contexto.organizationType
        )
      : null;
  }

  return contexto.tipoUsuario
    ? String(
        contexto.tipoUsuario
      )
    : null;
}

function getContextoPagamentoData(
  req: Request
) {
  const contexto =
    getBillingActiveContext(req);

  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "PERSONAL"
  ) {
    return {
      contextoKind:
        "PERSONAL",

      contextoTipo:
        String(
          contexto.tipoUsuario
        ),

      contextoPerfilId:
        contexto.profileId ??
        contexto.tipoUsuarioId ??
        null,

      contextoOrganizacaoId:
        null,

      contextoLegacyOrganizationId:
        null,
    };
  }

  return {
    contextoKind:
      "ORGANIZATION",

    contextoTipo:
      contexto.organizationType
        ? String(
            contexto.organizationType
          )
        : null,

    contextoPerfilId:
      null,

    contextoOrganizacaoId:
      contexto.organizationId ??
      null,

    contextoLegacyOrganizationId:
      contexto
        .legacyOrganizationId ??
      null,
  };
}

function getContextoPagamentoWhere(
  req: Request
): Prisma.PagamentoWhereInput | null {
  const contexto =
    getBillingActiveContext(req);

  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "PERSONAL"
  ) {
    return {
      contextoKind:
        "PERSONAL",

      contextoTipo:
        String(
          contexto.tipoUsuario
        ),

      contextoPerfilId:
        contexto.profileId ??
        contexto.tipoUsuarioId ??
        null,
    };
  }

  return {
    contextoKind:
      "ORGANIZATION",

    contextoTipo:
      contexto.organizationType
        ? String(
            contexto.organizationType
          )
        : null,

    AND: [
      {
        OR: [
          contexto.organizationId
            ? {
                contextoOrganizacaoId:
                  contexto.organizationId,
              }
            : undefined,

          contexto.legacyOrganizationId
            ? {
                contextoLegacyOrganizationId:
                  contexto
                    .legacyOrganizationId,
              }
            : undefined,
        ].filter(
          Boolean
        ) as Prisma.PagamentoWhereInput[],
      },
    ],
  };
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
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

function descricaoContextoAssinatura(assinatura: {
  contextoKind?: string | null;
  contextoTipo?: string | null;
}) {
  const tipo = assinatura.contextoTipo?.trim();

  if (!tipo) {
    return "perfil vinculado à assinatura";
  }

  if (assinatura.contextoKind === "ORGANIZATION") {
    return `organização (${tipo})`;
  }

  if (assinatura.contextoKind === "PERSONAL") {
    return `perfil ${tipo}`;
  }

  return `perfil ${tipo}`;
}

async function criarNotificacaoBilling(args: {
  usuarioId: string;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  link?: string | null;
}) {
  const linkNotificacao = args.link ?? "/pagamentos";

  const existente = await prisma.notificacao.findFirst({
    where: {
      usuarioId: args.usuarioId,
      tipo: args.tipo,
      titulo: args.titulo,
      mensagem: args.mensagem,
      link: linkNotificacao,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existente) return existente;

  const notif = await prisma.notificacao.create({
    data: {
      usuarioId: args.usuarioId,
      tipo: args.tipo,
      titulo: args.titulo,
      mensagem: args.mensagem,
      link: linkNotificacao,
      lida: false,
    } as any,
  });

  try {
    getIO()
      ?.to(
        `u:${args.usuarioId}`
      )
      .emit(
        "notification:new",
        notif
      );
  } catch {}

  try {
    await recomputeAndEmitBadge(args.usuarioId);
  } catch {}

  return notif;
}


type TipoEventoBilling =
  | "VENCIMENTO_7_DIAS"
  | "BLOQUEIO"
  | "TRIAL_ENCERRADO";

type ComunicacaoBillingArgs = {
  assinaturaId: string;
  usuarioId: string;
  cicloKey: string;
  evento: TipoEventoBilling;
  canal: BillingComunicacaoCanal;
  plano: string;
  contexto: string;
  dataVencimento: Date;
  diasRestantes?: number;
};

const BILLING_MAX_TENTATIVAS = 5;
const BILLING_LEASE_MS = 30 * 60 * 1000;
const BILLING_RETRY_MS = 60 * 60 * 1000;

async function processarComunicacaoBilling(
  args: ComunicacaoBillingArgs
): Promise<boolean> {
  const chave = {
    assinaturaId: args.assinaturaId,
    cicloKey: args.cicloKey,
    evento: args.evento,
    canal: args.canal,
  };

  // Garante a existência da comunicação.
  // Se outra instância criar o mesmo registro,
  // o PostgreSQL ignora a inserção duplicada.
  await prisma.billingComunicacao.createMany({
    data: [
      {
        ...chave,
        status: BillingComunicacaoStatus.PENDENTE,
      },
    ],
    skipDuplicates: true,
  });

  // Recupera o registro único, independentemente
  // de qual instância tenha realizado a inserção.
  const registro =
    await prisma.billingComunicacao.findUnique({
      where: {
        assinaturaId_cicloKey_evento_canal: chave,
      },
    });

  if (!registro) {
    throw new Error(
      "BILLING_COMUNICACAO_NAO_ENCONTRADA_APOS_CRIACAO"
    );
  }

  const agora = new Date();
  const limiteLease = new Date(
    agora.getTime() - BILLING_LEASE_MS
  );

  const adquirido =
    await prisma.billingComunicacao.updateMany({
      where: {
        id: registro.id,
        tentativas: {
          lt: BILLING_MAX_TENTATIVAS,
        },
        OR: [
          {
            status: BillingComunicacaoStatus.PENDENTE,
          },
          {
            status: BillingComunicacaoStatus.FALHOU,
            OR: [
              { proximaTentativaEm: null },
              { proximaTentativaEm: { lte: agora } },
            ],
          },
          {
            status: BillingComunicacaoStatus.PROCESSANDO,
            atualizadoEm: {
              lt: limiteLease,
            },
          },
        ],
      },
      data: {
        status: BillingComunicacaoStatus.PROCESSANDO,
        tentativas: { increment: 1 },
        ultimoErro: null,
        proximaTentativaEm: null,
      },
    });

  if (adquirido.count === 0) {
    return false;
  }

  // Número da tentativa que esta execução adquiriu.
  // Impede que uma tentativa anterior finalize
  // uma tentativa mais recente.
  const tentativaAtual = registro.tentativas + 1;

  try {
    const assinaturaAtual =
      await prisma.assinatura.findUnique({
        where: {
          id: args.assinaturaId,
        },
        select: {
          id: true,
          usuarioId: true,
          status: true,
          ativo: true,
          renovaEm: true,
          trialEndsAt: true,
          bloqueadoEm: true,
        },
      });

    const agoraValidacao = new Date();

    const fimAtual =
      args.evento === "TRIAL_ENCERRADO" ||
      (
        args.evento === "VENCIMENTO_7_DIAS" &&
        assinaturaAtual?.status === "TRIAL"
      )
        ? assinaturaAtual?.trialEndsAt ??
          assinaturaAtual?.renovaEm
        : assinaturaAtual?.renovaEm;

    const mesmoCiclo =
      fimAtual instanceof Date &&
      fimAtual.getTime() ===
        args.dataVencimento.getTime() &&
      args.cicloKey ===
        args.dataVencimento.toISOString();

    const avisoValido =
      args.evento === "VENCIMENTO_7_DIAS" &&
      assinaturaAtual?.ativo === true &&
      (
        assinaturaAtual.status === "ATIVA" ||
        assinaturaAtual.status === "TRIAL"
      ) &&
      args.dataVencimento > agoraValidacao &&
      diffDays(
        args.dataVencimento,
        agoraValidacao
      ) <= 7;

    const bloqueioValido =
      args.evento === "BLOQUEIO" &&
      assinaturaAtual?.status === "BLOQUEADA" &&
      assinaturaAtual.ativo === false &&
      assinaturaAtual.bloqueadoEm !== null &&
      assinaturaAtual.trialEndsAt === null;

    const trialEncerradoValido =
      args.evento === "TRIAL_ENCERRADO" &&
      assinaturaAtual?.status === "BLOQUEADA" &&
      assinaturaAtual.ativo === false &&
      assinaturaAtual.bloqueadoEm !== null &&
      assinaturaAtual.trialEndsAt !== null;

    const comunicacaoValida =
      assinaturaAtual?.usuarioId === args.usuarioId &&
      mesmoCiclo &&
      (
        avisoValido ||
        bloqueioValido ||
        trialEncerradoValido
      );

    if (!comunicacaoValida) {
      await prisma.billingComunicacao.updateMany({
        where: {
          id: registro.id,
          status: BillingComunicacaoStatus.PROCESSANDO,
          tentativas: tentativaAtual,
        },
        data: {
          status: BillingComunicacaoStatus.FALHOU,
          tentativas: BILLING_MAX_TENTATIVAS,
          ultimoErro:
            "Comunicação descartada: assinatura renovada, ciclo alterado ou status incompatível.",
          proximaTentativaEm: null,
        },
      });

      console.log(
        "[billing] Comunicação antiga descartada:",
        {
          assinaturaId: args.assinaturaId,
          evento: args.evento,
          canal: args.canal,
        }
      );

      return false;
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: args.usuarioId,
      },
      select: {
        nome: true,
        email: true,
        deletedAt: true,
      },
    });

    if (!usuario || usuario.deletedAt) {
      throw new Error(
        "Usuário inexistente ou com exclusão solicitada."
      );
    }

    const titulo =
      args.evento === "VENCIMENTO_7_DIAS"
        ? "Sua assinatura está perto do vencimento"
        : args.evento === "TRIAL_ENCERRADO"
          ? "Seu trial terminou"
          : "Sua assinatura venceu";
    const vencimentoFormatado =
      args.dataVencimento.toLocaleDateString(
        "pt-BR",
        { timeZone: "UTC" }
      );

    const mensagem =
      args.evento === "VENCIMENTO_7_DIAS"
        ? `A assinatura ${args.plano}, vinculada ao ${args.contexto}, vence em ${vencimentoFormatado}. Renove para continuar com seus benefícios.`
        : args.evento === "TRIAL_ENCERRADO"
          ? `O período grátis da assinatura ${args.plano}, vinculada ao ${args.contexto}, terminou em ${vencimentoFormatado}.`
          : `A assinatura ${args.plano}, vinculada ao ${args.contexto}, venceu em ${vencimentoFormatado} e foi bloqueada.`;

    if (
      args.canal === BillingComunicacaoCanal.APP
    ) {
      await criarNotificacaoBilling({
        usuarioId: args.usuarioId,
        tipo:
          args.evento === "VENCIMENTO_7_DIAS"
            ? NotificacaoTipo.BILLING_WARNING
            : NotificacaoTipo.BILLING_BLOCKED,
        titulo,
        mensagem,
        link:
          `/pagamentos?assinaturaId=${encodeURIComponent(args.assinaturaId)}` +
          `&ciclo=${encodeURIComponent(args.cicloKey)}`,
      });
    } else {
      if (!usuario.email?.trim()) {
        throw new Error(
          "Usuário sem e-mail cadastrado."
        );
      }

      await sendBillingEmail({
        to: usuario.email,
        nome: usuario.nome,
        plano: args.plano,
        contexto: args.contexto,
        tipo:
          args.evento === "VENCIMENTO_7_DIAS"
            ? "VENCIMENTO"
            : args.evento === "TRIAL_ENCERRADO"
              ? "TRIAL_ENCERRADO"
              : "BLOQUEIO",
        diasRestantes: args.diasRestantes,
        dataVencimento: args.dataVencimento,
      });
    }

    const finalizacao =
      await prisma.billingComunicacao.updateMany({
        where: {
          id: registro.id,
          status: BillingComunicacaoStatus.PROCESSANDO,
          tentativas: tentativaAtual,
        },
        data: {
          status: BillingComunicacaoStatus.ENVIADO,
          enviadoEm: new Date(),
          ultimoErro: null,
          proximaTentativaEm: null,
        },
      });

    if (finalizacao.count === 0) {
      console.warn(
        "[billing] Tentativa perdeu a posse da comunicação:",
        {
          comunicacaoId: registro.id,
          tentativa: tentativaAtual,
        }
      );

      return false;
    }

    return true;
  } catch (error) {
    const erro =
      error instanceof Error
        ? error.message
        : String(error);

    const proximaTentativaEm = new Date(
      Date.now() + BILLING_RETRY_MS
    );

    await prisma.billingComunicacao.updateMany({
      where: {
        id: registro.id,
        status: BillingComunicacaoStatus.PROCESSANDO,
        tentativas: tentativaAtual,
      },
      data: {
        status: BillingComunicacaoStatus.FALHOU,
        ultimoErro: erro.slice(0, 1000),
        proximaTentativaEm,
      },
    });

    console.error(
      "[billing] Falha na comunicação:",
      {
        assinaturaId: args.assinaturaId,
        evento: args.evento,
        canal: args.canal,
        erro,
      }
    );

    return false;
  }
}

async function enviarComunicacoesBilling(
  args: Omit<
    ComunicacaoBillingArgs,
    "canal"
  >
) {
  const canais = [
    BillingComunicacaoCanal.APP,
    BillingComunicacaoCanal.EMAIL,
  ];

  const resultados = await Promise.allSettled(
    canais.map((canal) =>
      processarComunicacaoBilling({
        ...args,
        canal,
      })
    )
  );

  for (const resultado of resultados) {
    if (resultado.status === "rejected") {
      console.error(
        "[billing] Erro no processamento de canal:",
        resultado.reason
      );
    }
  }
}

const METODOLOGIA_BASE = 19.9;
const METODOLOGIA_POR_SEMANA = 2.5;
const METODOLOGIA_POR_ITEM = 1.0;
const METODOLOGIA_POR_VIDEO = 2.0;
const METODOLOGIA_POR_TREINO = 2.0;
const METODOLOGIA_POR_PONTO = 0.1;
const METODOLOGIA_MIN = 20.9;
const METODOLOGIA_MAX = 249.9;

export async function processExpiringSubscriptions(
  options: {
    usuarioId?: string;
    assinaturaId?: string;
  } = {}
) {
  if (BILLING_CUPOM_RESERVA_QA) {
    const reservasEmRevisao =
      await revisarReservasCupomVencidasQa();

    if (reservasEmRevisao > 0) {
      console.log(
        "[billing] Reservas de cupom aguardando conciliação:",
        reservasEmRevisao
      );
    }
  }
  const now = new Date();

  const assinaturas = await prisma.assinatura.findMany({
    where: {
      ...(options.usuarioId
        ? { usuarioId: options.usuarioId }
        : {}),

      ...(options.assinaturaId
        ? { id: options.assinaturaId }
        : {}),

      OR: [
        { status: "TRIAL", ativo: true },
        { status: "ATIVA", ativo: true },
        { status: "CANCELADA", ativo: true },

        // Recupera comunicações de bloqueios anteriores.
        {
          status: "BLOQUEADA",
          bloqueadoEm: { not: null },
        },
      ],
    },
    orderBy: {
      startsAt: "asc",
    },
  });

  let avisadas = 0;
  let bloqueadas = 0;
  let desativadas = 0;

  for (const a of assinaturas) {
    try {
      const dataBase =
        a.status === "TRIAL"
          ? a.trialStartsAt ?? a.startsAt
          : a.startsAt;

      const meses =
        monthsForPeriodicidade(a.periodicidade);

      const dataCalculada = dataBase
        ? addMonths(new Date(dataBase), meses)
        : null;

      const dataRaw =
        a.status === "TRIAL" ||
        (
          a.status === "BLOQUEADA" &&
          a.trialEndsAt
        )
          ? a.trialEndsAt ??
            a.renovaEm ??
            dataCalculada
          : a.renovaEm ?? dataCalculada;

      if (!dataRaw) {
        continue;
      }

      const dataLimite = new Date(dataRaw);

      if (
        Number.isNaN(dataLimite.getTime())
      ) {
        continue;
      }

      // A chave do ciclo não depende do momento
      // em que o job é executado.
      const cicloKey =
        dataLimite.toISOString();

      const contextoDescricao =
        descricaoContextoAssinatura(a);

      const dadosComunicacao = {
        assinaturaId: a.id,
        usuarioId: a.usuarioId,
        cicloKey,
        plano: a.plano,
        contexto: contextoDescricao,
        dataVencimento: dataLimite,
      };

      const dias = diffDays(dataLimite, now);

      // 1. Aviso de vencimento
      if (
        a.ativo &&
        (
          a.status === "ATIVA" ||
          a.status === "TRIAL"
        ) &&
        dias >= 0 &&
        dias <= 7 &&
        dataLimite > now
      ) {
        await enviarComunicacoesBilling({
          ...dadosComunicacao,
          evento: "VENCIMENTO_7_DIAS",
          diasRestantes: dias,
        });

        // Campo legado mantido para compatibilidade.
        // A entrega real é controlada por canal.
        const avisoApp =
          await prisma.billingComunicacao.findUnique({
            where: {
              assinaturaId_cicloKey_evento_canal: {
                assinaturaId: a.id,
                cicloKey,
                evento: "VENCIMENTO_7_DIAS",
                canal: BillingComunicacaoCanal.APP,
              },
            },
            select: {
              status: true,
            },
          });

        if (
          avisoApp?.status ===
          BillingComunicacaoStatus.ENVIADO
        ) {
            if (!a.lembreteEnviado) {
              const atualizacao =
                await prisma.assinatura.updateMany({
                  where: {
                    id: a.id,
                    ativo: true,
                    status: a.status,
                    renovaEm: a.renovaEm,
                    trialEndsAt: a.trialEndsAt,
                    lembreteEnviado: false,
                  },
                  data: {
                    lembreteEnviado: true,
                  },
                });

              avisadas += atualizacao.count;
            }
        }
      }

      // 2. Trial encerrado ou assinatura vencida
      if (
        dataLimite <= now &&
        (
          a.status === "TRIAL" ||
          a.status === "ATIVA"
        ) &&
        a.ativo
      ) {
      const evento: TipoEventoBilling =
        a.status === "TRIAL"
          ? "TRIAL_ENCERRADO"
          : "BLOQUEIO";

      const alteracao = await prisma.$transaction(
        async (tx) => {
          const resultado = await tx.assinatura.updateMany({
            where: {
              id: a.id,
              ativo: true,
              status: a.status,
              renovaEm: a.renovaEm,
              ...(a.status === "TRIAL"
                ? { trialEndsAt: a.trialEndsAt }
                : {}),
            },
            data: {
              status: "BLOQUEADA",
              ativo: false,
              canceledAt: now,
              bloqueadoEm: now,
              renovaEm: dataLimite,
              ...(a.status === "TRIAL"
                ? { trialEndsAt: dataLimite }
                : {}),
            },
          });

          if (resultado.count === 0) {
            return resultado;
          }

          await tx.billingComunicacao.createMany({
            data: [
              {
                assinaturaId: a.id,
                cicloKey,
                evento,
                canal: BillingComunicacaoCanal.APP,
                status: BillingComunicacaoStatus.PENDENTE,
              },
              {
                assinaturaId: a.id,
                cicloKey,
                evento,
                canal: BillingComunicacaoCanal.EMAIL,
                status: BillingComunicacaoStatus.PENDENTE,
              },
            ],
            skipDuplicates: true,
          });

          return resultado;
        }
      );

      if (alteracao.count > 0) {
        bloqueadas++;

        await enviarComunicacoesBilling({
          ...dadosComunicacao,
          evento,
        });
      }

      continue;
      }

      // 3. Recuperar comunicações pendentes de bloqueios
      // já registrados pelo sistema novo.
      if (
        a.status === "BLOQUEADA" &&
        a.bloqueadoEm
      ) {
        const evento: TipoEventoBilling =
          a.trialEndsAt
            ? "TRIAL_ENCERRADO"
            : "BLOQUEIO";

        // Só recuperamos comunicações que já
        // começaram a ser processadas.
        // Bloqueios antigos sem registro são ignorados.
        const comunicacaoExistente =
          await prisma.billingComunicacao.findFirst({
            where: {
              assinaturaId: a.id,
              cicloKey,
              evento,
            },
            select: {
              id: true,
            },
          });

        if (!comunicacaoExistente) {
          continue;
        }

        // Verifica novamente o estado atual,
        // pois um webhook pode ter renovado a
        // assinatura após a consulta inicial.
        const assinaturaAtual =
          await prisma.assinatura.findUnique({
            where: {
              id: a.id,
            },
            select: {
              status: true,
              ativo: true,
              renovaEm: true,
            },
          });

        if (
          !assinaturaAtual ||
          assinaturaAtual.status !== "BLOQUEADA" ||
          assinaturaAtual.ativo
        ) {
          continue;
        }

        if (
          assinaturaAtual.renovaEm?.getTime() !==
          dataLimite.getTime()
        ) {
          continue;
        }

        await enviarComunicacoesBilling({
          ...dadosComunicacao,
          evento,
        });

        continue;
      }

      // 4. Cancelamento com benefícios válidos
      // até a data de vencimento.
      if (
        a.status === "CANCELADA" &&
        a.ativo &&
        dataLimite <= now
      ) {
        const alteracao =
          await prisma.assinatura.updateMany({
            where: {
              id: a.id,
              status: "CANCELADA",
              ativo: true,
            },
            data: {
              ativo: false,
            },
          });

        desativadas += alteracao.count;
      }
    } catch (error) {
      console.error(
        "[billing] Erro na assinatura:",
        a.id,
        error
      );
    }
  }

  return {
    ok: true,
    avisadas,
    bloqueadas,
    desativadas,
  };
}

const PLANS = [
  { id: "ATLETA_PRO", title: "Atleta Pro", monthly: 19.9, annual: null, benefits: ["Sem anúncios", "Poder agendar treinos dos professores FootEra", "Mais limites operacionais", "Quantidade ilimitada de treinos agendados por semana"] },
  { id: "ATLETA_LEARNING_1", title: "Atleta Learning 1", monthly: 44.9, annual: null, benefits: ["Tudo do Atleta Pro", "Escolher 1 metodologia por mês"] },
  { id: "ATLETA_LEARNING_3", title: "Atleta Learning 3", monthly: 64.9, annual: null, benefits: ["Tudo do Atleta Pro", "Escolher até 3 metodologias por mês"] },
  { id: "PROFESSOR_PRO", title: "Professor Pro", monthly: 39.9, annual: null, benefits: ["Sem anúncios", "Recursos Pro do professor", "Mais limites operacionais"] },
  { id: "PROFESSOR_LEARNING_1", title: "Professor Learning 1", monthly: 59.9, annual: null, benefits: ["Tudo do Professor Pro", "Escolher 1 metodologia por mês"] },
  { id: "PROFESSOR_LEARNING_3", title: "Professor Learning 3", monthly: 79.9, annual: null, benefits: ["Tudo do Professor Pro", "Escolher até 3 metodologias por mês"] },
  { id: "ORGANIZACOES_PRO", title: "Organizações Pro", monthly: 79.9, annual: null, benefits: ["Sem anúncios", "Recursos Pro da organização", "Mais capacidade operacional"] },
  { id: "ORGANIZACOES_LEARNING_3", title: "Organizações Learning", monthly: 149.9, annual: null, benefits: ["Tudo do Pro", "Escolher até 3 metodologias por mês"] },
  {
    id: "LEARNING_3",
    title: "Learning",
    monthly: 79.9,
    annual: null,
    benefits: [
      "Escolher até 3 metodologias Learning diferentes por mês",
    ],
  },
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

  if (
    raw
      .toUpperCase()
      .startsWith("EVENTO:")
  ) {
    const id =
      raw
        .split(":")
        .slice(1)
        .join(":")
        .trim();

    return `EVENTO:${id}`;
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

function isEvento(
  planoId: string
) {
  return String(
    planoId || ""
  )
    .toUpperCase()
    .startsWith(
      "EVENTO:"
    );
}

function extractEventoId(
  planoId: string
) {
  return String(
    planoId || ""
  )
    .replace(
      /^EVENTO:/i,
      ""
    )
    .trim();
}

function extractAulaAoVivoId(planoId: string) {
  return String(planoId || "")
    .replace(/^AULA_AO_VIVO:/i, "")
    .trim();
}

const REPLAY_COMPRA_DIAS =
  7;

const REPLAY_COMPRA_MS =
  REPLAY_COMPRA_DIAS *
  24 *
  60 *
  60 *
  1000;

function calcularValidadeReplayCompra(
  aula: {
    finalizouEm?:
      | Date
      | string
      | null;

    dataFim?:
      | Date
      | string
      | null;
  }
) {
  const finalizacaoRaw =
    aula.finalizouEm ||
    aula.dataFim ||
    null;

  if (!finalizacaoRaw) {
    return {
      finalizouEm: null,
      replayExpiraEm: null,
      replayExpirado: true,
      segundosRestantes: 0,
    };
  }

  const finalizouEm =
    finalizacaoRaw instanceof Date
      ? finalizacaoRaw
      : new Date(
          finalizacaoRaw
        );

  if (
    Number.isNaN(
      finalizouEm.getTime()
    )
  ) {
    return {
      finalizouEm: null,
      replayExpiraEm: null,
      replayExpirado: true,
      segundosRestantes: 0,
    };
  }

  const replayExpiraEm =
    new Date(
      finalizouEm.getTime() +
        REPLAY_COMPRA_MS
    );

  const diferenca =
    replayExpiraEm.getTime() -
    Date.now();

  return {
    finalizouEm,
    replayExpiraEm,

    replayExpirado:
      diferenca <= 0,

    segundosRestantes:
      Math.max(
        0,
        Math.floor(
          diferenca / 1000
        )
      ),
  };
}

export async function assertAulaAoVivoDisponivelParaCompra(
  planoId: string
) {
  const planoNorm =
    normalizePlanoId(
      planoId
    );

  if (
    !isAulaAoVivo(
      planoNorm
    )
  ) {
    return null;
  }

  const aulaAoVivoId =
    extractAulaAoVivoId(
      planoNorm
    );

  const agora =
    new Date();

  const aula =
    await prisma.aulaAoVivo
      .findUnique({
        where: {
          id:
            aulaAoVivoId,
        },

        select: {
          id:
            true,

          titulo:
            true,

          dataInicio:
            true,

          dataFim:
            true,

          finalizouEm:
            true,

          status:
            true,

          acessoPago:
            true,

          precoAcesso:
            true,

          replayDisponivel:
            true,

          videoGravadoUrl:
            true,
        },
      });

  if (!aula) {
    const erro: any =
      new Error(
        "Evento ao vivo não encontrado."
      );

    erro.statusCode =
      404;

    erro.code =
      "AULA_AO_VIVO_NOT_FOUND";

    throw erro;
  }

  const valor =
    Number(
      aula.precoAcesso ??
      0
    );

  if (
    aula.acessoPago !==
      true ||
    !Number.isFinite(
      valor
    ) ||
    valor <= 0
  ) {
    const erro: any =
      new Error(
        "Este evento não possui acesso pago."
      );

    erro.statusCode =
      400;

    erro.code =
      "AULA_AO_VIVO_GRATUITA";

    throw erro;
  }

  if (
    aula.status ===
    "CANCELADA"
  ) {
    const erro: any =
      new Error(
        "Este evento foi cancelado e não pode ser comprado."
      );

    erro.statusCode =
      400;

    erro.code =
      "AULA_AO_VIVO_CANCELADA";

    throw erro;
  }

  if (
    aula.status ===
    "FINALIZADA"
  ) {
    if (
      aula.replayDisponivel !==
        true ||
      !aula.videoGravadoUrl
    ) {
      const erro: any =
        new Error(
          "O replay desta aula ainda não está disponível."
        );

      erro.statusCode =
        409;

      erro.code =
        "REPLAY_NAO_DISPONIVEL";

      throw erro;
    }

    const validade =
      calcularValidadeReplayCompra(
        aula
      );

    if (
      validade.replayExpirado
    ) {
      const erro: any =
        new Error(
          "O prazo de sete dias para comprar este replay terminou."
        );

      erro.statusCode =
        410;

      erro.code =
        "REPLAY_EXPIRADO";

      throw erro;
    }

    return aula;
  }

  if (
    aula.status ===
      "AGENDADA" &&
    aula.dataInicio.getTime() <
      agora.getTime()
  ) {
    const erro: any =
      new Error(
        "Este evento já passou e ainda não possui replay disponível."
      );

    erro.statusCode =
      400;

    erro.code =
      "AULA_AO_VIVO_EXPIRADA";

    throw erro;
  }

  if (
    aula.status !==
      "AGENDADA" &&
    aula.status !==
      "AO_VIVO"
  ) {
    const erro: any =
      new Error(
        "Este evento não está disponível para compra."
      );

    erro.statusCode =
      400;

    erro.code =
      "AULA_AO_VIVO_INDISPONIVEL";

    throw erro;
  }

  return aula;
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
  pagamentoId?: string | null;
}) {
  const { tx, compradorId, metodologiaAvulsaId, metodologiaId, valorBruto } = args;

  const provider =
    args.provider ?? "FOOTERA_BILLING";

  const providerRef =
    args.providerRef ??
    `${compradorId}:${metodologiaAvulsaId ?? metodologiaId}`;

  const vendaExistente =
    await tx.creatorVenda.findUnique({
      where: {
        provider_providerRef: {
          provider,
          providerRef,
        },
      },
    });

  if (vendaExistente) {

    if (
      vendaExistente.compradorId !== compradorId ||
      vendaExistente.metodologiaId !== (metodologiaId ?? null) ||
      vendaExistente.metodologiaAvulsaId !==
        (metodologiaAvulsaId ?? null) ||
      (
        args.pagamentoId != null &&
        vendaExistente.pagamentoId !== args.pagamentoId
      )
    ) {
      throw new Error(
        "BILLING_SALE_IDEMPOTENCY_CONFLICT"
      );
    }

    if (
      vendaExistente.status !== CreatorVendaStatus.CONFIRMADA
    ) {
      throw new Error(
        "BILLING_SALE_REQUIRES_RECONCILIATION"
      );
    }

    return vendaExistente;
  }

  const selectConteudo = {
    id: true,
    criadorUsuarioId: true,
    clubeId: true,
    escolinhaId: true,
    marcaId: true,
    federacaoId: true,
  } as const;

  const conteudo = metodologiaAvulsaId
    ? await tx.metodologiaAvulsa.findUnique({
        where: { id: metodologiaAvulsaId },
        select: selectConteudo,
      })
    : metodologiaId
      ? await tx.metodologia.findUnique({
          where: { id: metodologiaId },
          select: selectConteudo,
        })
      : null;

  if (!conteudo) {
    throw new Error(
      "BILLING_CONTENT_NOT_FOUND"
    );
  }

  const vinculosInstitucionais = [
    conteudo.clubeId,
    conteudo.escolinhaId,
    conteudo.marcaId,
    conteudo.federacaoId,
  ].filter((id): id is string => Boolean(id));

  if (vinculosInstitucionais.length > 1) {
    throw new Error(
      "BILLING_CONTENT_HAS_MULTIPLE_ORGANIZATIONS"
    );
  }

  let creator: {
    id: string;
    comissaoFootera: Prisma.Decimal;
    tipo: CreatorTipo;
    ativo: boolean;
  } | null = null;

  if (vinculosInstitucionais.length === 1) {
    let organizacaoId: string | null = null;

    if (conteudo.clubeId) {
      const clube = await tx.clube.findUnique({
        where: { id: conteudo.clubeId },
        select: { organizacaoId: true },
      });

      organizacaoId = clube?.organizacaoId ?? null;
    } else if (conteudo.escolinhaId) {
      const escolinha = await tx.escolinha.findUnique({
        where: { id: conteudo.escolinhaId },
        select: { organizacaoId: true },
      });

      organizacaoId = escolinha?.organizacaoId ?? null;
    } else if (conteudo.marcaId) {
      const marca = await tx.marca.findUnique({
        where: { id: conteudo.marcaId },
        select: { organizacaoId: true },
      });

      organizacaoId = marca?.organizacaoId ?? null;
    } else if (conteudo.federacaoId) {
      const federacao = await tx.federacao.findUnique({
        where: { id: conteudo.federacaoId },
        select: { organizacaoId: true },
      });

      organizacaoId = federacao?.organizacaoId ?? null;
    }

    if (!organizacaoId) {
      throw new Error(
        "BILLING_CONTENT_ORGANIZATION_NOT_FOUND"
      );
    }

    creator = await tx.creator.findUnique({
      where: { organizacaoId },
      select: {
        id: true,
        comissaoFootera: true,
        tipo: true,
        ativo: true,
      },
    });
  } else if (conteudo.criadorUsuarioId) {
    creator = await tx.creator.findUnique({
      where: {
        usuarioId: conteudo.criadorUsuarioId,
      },
      select: {
        id: true,
        comissaoFootera: true,
        tipo: true,
        ativo: true,
      },
    });
  }

  if (!creator || !creator.ativo) {
    throw new Error("BILLING_CREATOR_NOT_FOUND_OR_INACTIVE");
  }

  const tipoEsperado =
    vinculosInstitucionais.length === 1
      ? "INSTITUCIONAL"
      : "PESSOA_FISICA";

  if (creator.tipo !== tipoEsperado) {
    throw new Error("BILLING_CREATOR_TYPE_MISMATCH");
  }

  const percentualFootera = Number(creator.comissaoFootera ?? 0.15);
  const valorFootera = Number((valorBruto * percentualFootera).toFixed(2));
  const valorCreator = Number((valorBruto - valorFootera).toFixed(2));

  const venda = await tx.creatorVenda.upsert({
    where: {
      provider_providerRef: {
        provider,
        providerRef,
      },
    },

    // Nunca recalcular uma venda já existente
    // apenas porque o webhook foi recebido novamente.
    update: {},

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
      provider,
      providerRef,
      pagamentoId: args.pagamentoId ?? null,
    },
  });

  if (
    venda.creatorId !== creator.id ||
    venda.compradorId !== compradorId ||
    venda.metodologiaId !== (metodologiaId ?? null) ||
    venda.metodologiaAvulsaId !==
      (metodologiaAvulsaId ?? null) ||
    (
      args.pagamentoId != null &&
      venda.pagamentoId !== args.pagamentoId
    )
  ) {
    throw new Error(
      "BILLING_SALE_IDEMPOTENCY_CONFLICT"
    );
  }

  // A repetição não deve transformar uma venda
  // pendente ou cancelada em confirmada silenciosamente.
  if (venda.status !== CreatorVendaStatus.CONFIRMADA) {
    throw new Error(
      "BILLING_SALE_REQUIRES_RECONCILIATION"
    );
  }

  return venda;
}

function findPlan(planoId: string) {
  const id = normalizePlanoId(planoId);
  return PLANS.find((p) => p.id === id);
}

export async function assertEventoDisponivelParaCompra(
  planoId: string,
  usuarioId: string
) {
  const eventoId =
    extractEventoId(
      planoId
    );

  const [
    evento,
    atleta,
    inscricao,
  ] =
    await Promise.all([
      prisma.evento.findUnique({
        where: {
          id:
            eventoId,
        },

        select: {
          id: true,
          titulo: true,
          status: true,
          dataEvento: true,
          inscricaoInicio:
            true,
          inscricaoFim:
            true,
          vagas: true,
          valorInscricao:
            true,
          linkInscricao:
            true,
        },
      }),

      prisma.atleta.findUnique({
        where: {
          usuarioId,
        },

        select: {
          id: true,
        },
      }),

      prisma.inscricaoEvento.findUnique({
        where: {
          eventoId_usuarioId: {
            eventoId,
            usuarioId,
          },
        },

        select: {
          status: true,
        },
      }),
    ]);

  if (!evento) {
    const err: any =
      new Error(
        "Evento não encontrado."
      );

    err.statusCode = 404;
    err.code =
      "EVENTO_NOT_FOUND";

    throw err;
  }

  if (!atleta) {
    const err: any =
      new Error(
        "Você precisa possuir um perfil de Atleta para participar deste evento."
      );

    err.statusCode = 403;
    err.code =
      "ATLETA_REQUIRED";

    throw err;
  }

  if (
    evento.linkInscricao
  ) {
    const err: any =
      new Error(
        "Este evento utiliza inscrição externa."
      );

    err.statusCode = 409;
    err.code =
      "EXTERNAL_REGISTRATION";

    throw err;
  }

  const agora =
    new Date();

  if (
    evento.status !==
      "ABERTO" ||
    evento.dataEvento <=
      agora
  ) {
    const err: any =
      new Error(
        "Este evento não está disponível para inscrições."
      );

    err.statusCode = 409;
    err.code =
      "EVENT_UNAVAILABLE";

    throw err;
  }

  if (
    evento.inscricaoInicio &&
    agora <
      evento.inscricaoInicio
  ) {
    const err: any =
      new Error(
        "As inscrições ainda não começaram."
      );

    err.statusCode = 409;
    throw err;
  }

  if (
    evento.inscricaoFim &&
    agora >
      evento.inscricaoFim
  ) {
    const err: any =
      new Error(
        "As inscrições foram encerradas."
      );

    err.statusCode = 409;
    throw err;
  }

  if (
    inscricao &&
    [
      "CONFIRMADA",
      "PRESENCA_OK",
    ].includes(
      String(
        inscricao.status
      )
    )
  ) {
    const err: any =
      new Error(
        "Você já está inscrito neste evento."
      );

    err.statusCode = 409;
    err.code =
      "ALREADY_REGISTERED";

    throw err;
  }

  if (
    evento.vagas != null
  ) {
    const outrosInscritos =
      await prisma.inscricaoEvento.count({
        where: {
          eventoId,

          usuarioId: {
            not:
              usuarioId,
          },

          status: {
            not:
              "CANCELADA",
          },
        },
      });

    if (
      outrosInscritos >=
      evento.vagas
    ) {
      const err: any =
        new Error(
          "As vagas deste evento estão esgotadas."
        );

      err.statusCode = 409;
      err.code =
        "EVENT_FULL";

      throw err;
    }
  }

  const valor =
    Number(
      evento.valorInscricao ??
        0
    );

  if (
    !Number.isFinite(
      valor
    ) ||
    valor <= 0
  ) {
    const err: any =
      new Error(
        "Este evento não exige pagamento."
      );

    err.statusCode = 400;
    err.code =
      "EVENT_FREE";

    throw err;
  }

  return {
    ...evento,
    valor,
  };
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

  if (
    isEvento(id)
  ) {
    const eventoId =
      extractEventoId(
        id
      );

    const evento =
      await prisma.evento.findUnique({
        where: {
          id:
            eventoId,
        },

        select: {
          valorInscricao:
            true,
        },
      });

    if (!evento) {
      throw new Error(
        "Evento não encontrado."
      );
    }

    return Number(
      evento.valorInscricao ??
        0
    );
  }

  const p = findPlan(id);
  if (!p) throw new Error("Plano inválido");

  if (periodicidade === "Mensal") return Number(p.monthly || 0);
  return Number(p.annual || 0);
}

function metodologiaLimitFromPlano(
  planoId: string | null | undefined
): number {
  const p =
    String(
      planoId || ""
    ).toUpperCase();

  if (!p) return 0;

  if (p === "ATLETA_PRO")
    return 0;

  if (p === "PROFESSOR_PRO")
    return 0;

  if (p === "ORGANIZACOES_PRO")
    return 0;

  if (p === "OLHEIRO_PRO")
    return 0;

  if (
    p === "ATLETA_LEARNING_1"
  )
    return 1;

  if (
    p === "PROFESSOR_LEARNING_1"
  )
    return 1;

  if (
    p === "ATLETA_LEARNING_3"
  )
    return 3;

  if (
    p === "PROFESSOR_LEARNING_3"
  )
    return 3;

  if (
    p ===
    "ORGANIZACOES_LEARNING_3"
  )
    return 3;

  if (
    p === "LEARNING_3"
  )
    return 3;

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
  const codigoNormalizado = codigo.trim().toUpperCase();

  if (codigoNormalizado.startsWith("ANIVERSARIO_")) {
    return {
      ok: false as const,
      reason: "Utilize o código público 20PARABENS.",
    };
  }

  const cupomAniversario =
    await obterCupomAniversario(usuarioId, codigo);

  const cupom =
    cupomAniversario ??
    await prisma.cupom.findUnique({
      where: {
        codigo: codigo.trim().toUpperCase(),
      },
    });
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
    cupom.concedidoParaUsuarioId &&
    cupom.concedidoParaUsuarioId !== usuarioId
  ) {
    return {
      ok: false,
      reason: "Este cupom pertence a outro usuário.",
    };
  }

  if (
    cupom.codigo.startsWith("ANIVERSARIO_") &&
    codigo.trim().toUpperCase() !== "20PARABENS"
  ) {
    return {
      ok: false,
      reason: "Utilize o código público 20PARABENS.",
    };
  }

  return { ok: true, cupom };
}

async function resgatarCupom(
  cupomId: string,
  usuarioId: string,
  pagamentoId?: string
) {
  await prisma.$transaction(
    async (tx) => {
      const cupom = await tx.cupom.findUnique({
        where: {
          id: cupomId,
        },
        select: {
          codigo: true,
          usosMax: true,
        },
      });

      if (!cupom) {
        throw new Error("BILLING_COUPON_NOT_FOUND");
      }

      // O cupom de aniversário exige uma reserva
      // e deve ser consumido exclusivamente no
      // fluxo transacional de confirmação do pagamento.
      if (cupom.codigo.startsWith("ANIVERSARIO_")) {
        throw new Error(
          "BIRTHDAY_COUPON_REQUIRES_RESERVED_PAYMENT"
        );
      }

      await tx.cupomResgate.create({
        data: {
          cupomId,
          usuarioId,
          pagamentoId: pagamentoId || null,
        },
      });

      const atualizado = await tx.cupom.updateMany({
        where: {
          id: cupomId,
          ativo: true,
          OR: [
            {
              usosMax: null,
            },
            {
              usosAtuais: {
                lt: cupom.usosMax ?? 0,
              },
            },
          ],
        },

        data: {
          usosAtuais: {
            increment: 1,
          },
        },
      });

      if (atualizado.count !== 1) {
        throw new Error(
          "BILLING_COUPON_LIMIT_REACHED"
        );
      }
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

function getContextoAssinaturaData(
  contexto: ActiveContext | null
) {
  if (!contexto) {
    return null;
  }

  if (
    contexto.kind ===
    "ORGANIZATION"
  ) {
    const contextoKey =
      contexto.organizationId
        ? `organization:${contexto.organizationId}`
        : contexto.legacyOrganizationId
          ? `organization-legacy:${contexto.legacyOrganizationId}`
          : null;

    if (!contextoKey) {
      return null;
    }

    return {
      contextoKey,

      contextoKind:
        "ORGANIZATION",

      contextoTipo:
        contexto.organizationType
          ? String(
              contexto.organizationType
            )
          : null,

      contextoPerfilId:
        null,

      contextoOrganizacaoId:
        contexto.organizationId ??
        null,

      contextoLegacyOrganizationId:
        contexto
          .legacyOrganizationId ??
        null,
    };
  }

  const contextoTipo =
    contexto.role
      ? String(contexto.role)
      : contexto.tipoUsuario
        ? String(
            contexto.tipoUsuario
          )
        : null;

  const contextoPerfilId =
    contexto.profileId ??
    contexto.tipoUsuarioId ??
    null;

  const contextoKey =
    contextoTipo
      ? `personal:${contextoTipo}`
      : null;

  if (!contextoKey) {
    return null;
  }

  return {
    contextoKey,

    contextoKind:
      "PERSONAL",

    contextoTipo,

    contextoPerfilId,

    contextoOrganizacaoId:
      null,

    contextoLegacyOrganizationId:
      null,
  };
}

function getContextoAssinaturaFromPagamento(
  pagamento: {
    contextoKind?: string | null;
    contextoTipo?: string | null;
    contextoPerfilId?: string | null;
    contextoOrganizacaoId?: string | null;
    contextoLegacyOrganizationId?: string | null;
  }
): ActiveContext | null {
  if (
    pagamento.contextoKind === "ORGANIZATION"
  ) {
    const organizationId =
      pagamento.contextoOrganizacaoId ??
      null;

    const legacyOrganizationId =
      pagamento
        .contextoLegacyOrganizationId ??
      null;

    if (
      !organizationId &&
      !legacyOrganizationId
    ) {
      return null;
    }

    return {
      key: organizationId
        ? `organization:${organizationId}`
        : `organization-legacy:${legacyOrganizationId}`,

      kind:
        "ORGANIZATION",

      label:
        pagamento.contextoTipo ??
        "Organização",

      tipoUsuario:
        pagamento.contextoTipo as any,

      tipoUsuarioId:
        null,

      organizationId,

      organizationType:
        pagamento.contextoTipo as any,

      organizationRole:
        null,

      legacyOrganizationId,

      role:
        null,

      profileId:
        null,
    };
  }

  if (
    pagamento.contextoKind === "PERSONAL" &&
    pagamento.contextoTipo
  ) {
    return {
      key:
        `personal:${pagamento.contextoTipo}`,

      kind:
        "PERSONAL",

      label:
        pagamento.contextoTipo,

      tipoUsuario:
        pagamento.contextoTipo as any,

      tipoUsuarioId:
        pagamento.contextoPerfilId ??
        null,

      role:
        pagamento.contextoTipo as any,

      profileId:
        pagamento.contextoPerfilId ??
        null,

      organizationId:
        null,

      organizationType:
        null,

      organizationRole:
        null,

      legacyOrganizationId:
        null,
    };
  }

  return null;
}

async function upsertSubscriptionTx(
  tx:
    | PrismaClient
    | Prisma.TransactionClient,
  usuarioId: string,
  contexto:
    ActiveContext,
  plano: string,
  periodicidade:
    Periodicidade
) {
  const contextoAssinatura =
    getContextoAssinaturaData(
      contexto
    );

  if (!contextoAssinatura) {
    throw new Error(
      "Contexto ativo inválido para assinatura."
    );
  }
  const planoNorm = normalizePlanoId(plano);
  const now = new Date();
  const months = periodicidade === "Mensal" ? 1 : 12;
  const renovaEm = addMonths(now, months);

  return (tx as any).assinatura.upsert({
    where: {
      usuarioId_plano_contextoKey: {
        usuarioId,
        plano:
          planoNorm,
        contextoKey:
          contextoAssinatura
            .contextoKey,
      },
    },
    update: {
      periodicidade,
      ...contextoAssinatura,
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
      ...contextoAssinatura,
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

async function upsertSubscription(
  usuarioId: string,
  contexto: ActiveContext,
  plano: string,
  periodicidade: Periodicidade
) {
  return upsertSubscriptionTx(
    prisma as any,
    usuarioId,
    contexto,
    plano,
    periodicidade
  );
}

async function getAssinaturasReadOnly(
  usuarioId: string,
  contexto: ActiveContext
) {
  const contextoAssinatura =
    getContextoAssinaturaData(contexto);

  if (!contextoAssinatura) {
    throw new Error(
      "Contexto ativo inválido para consultar assinaturas."
    );
  }

  const assinaturas =
    await prisma.assinatura.findMany({
      where: {
        usuarioId,
        contextoKey:
          contextoAssinatura.contextoKey,
      },
      orderBy: {
        startsAt: "desc",
      },
    });

  return assinaturas;
}

function isAssinaturaAtiva(
  a: any
) {
  if (
    !a ||
    a.ativo !== true
  ) {
    return false;
  }

  const status =
    String(
      a.status || ""
    )
      .trim()
      .toUpperCase();

  if (
    status !== "ATIVA" &&
    status !== "TRIAL" &&
    status !== "CANCELADA"
  ) {
    return false;
  }

  const fimRaw =
    status === "TRIAL"
      ? (
          a.trialEndsAt ??
          a.renovaEm
        )
      : a.renovaEm;

  if (fimRaw) {
    const fim =
      new Date(fimRaw);

    if (
      !Number.isNaN(
        fim.getTime()
      ) &&
      fim <= new Date()
    ) {
      return false;
    }
  }

  return true;
}

function pickPrincipalAssinatura(
  assinaturas: any[]
) {
  return (
    assinaturas.find(
      (a) =>
        !isMetodologiaAvulsa(
          a.plano
        ) &&
        !isMetodologiaLearning(
          a.plano
        ) &&
        !isLegacyPlano(
          a.plano
        ) &&
        isAssinaturaAtiva(
          a
        )
    ) ?? null
  );
}

export async function getPlans(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const usuarioId = getUserId(req);

    const tipoQuery = String(
      req.query.tipo ?? ""
    ).trim();

    const tipoContexto =
      usuarioId
        ? getBillingTipo(req)
        : null;

    const tipo = usuarioId
      ? normalizeTipoBilling(
          tipoContexto || ""
        )
      : normalizeTipoBilling(
          tipoQuery || "atleta"
        );

    if (
      usuarioId &&
      !tipo
    ) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para visualizar os planos disponíveis.",
      });
    }

    const permitidos =
      new Set(
        allowedPlanIdsByTipo(tipo)
      );

    const plans =
      PLANS.filter((plan) =>
        permitidos.has(plan.id)
      );

    return res.json({
      plans,
      tipoUsuario: tipo,
    });
  } catch (error: any) {
    return sendError(
      res,
      error,
      "Erro ao carregar planos."
    );
  }
}

export async function getMyBilling(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const activeContext =
      getBillingActiveContext(req);

    if (!activeContext) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para visualizar sua assinatura.",
      });
    }

    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const contextoPagamentoWhere =
      getContextoPagamentoWhere(req);

    if (!contextoPagamentoWhere) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para visualizar seus pagamentos.",
      });
    }

    const pagamentos =
      await prisma.pagamento.findMany({
        where: {
          usuarioId,

          ...contextoPagamentoWhere,
        },

        orderBy: {
          criadoEm:
            "desc",
        },
      });

    const cupons = await prisma.cupomResgate.findMany({
      where: { usuarioId },
      include: { cupom: true },
      orderBy: { resgatadoEm: "desc" },
    });

    const assinaturas =
      await getAssinaturasReadOnly(
        usuarioId,
        activeContext
      );
    const assinaturasFiltradas = (assinaturas as any[]).filter((a) => !isLegacyPlano(a.plano));
    const assinaturaPrincipal = pickPrincipalAssinatura(assinaturasFiltradas);
    const limiteMetodologiasMes = metodologiaLimitFromPlano(assinaturaPrincipal?.plano);
    const inicioMes = startOfMonth(new Date());
    const metodologiasUsadasNoMes =
      limiteMetodologiasMes > 0
        ? await prisma
            .metodologiaAssinante
            .count({
              where: {
                usuarioId,

                origem:
                  "LEARNING",

                iniciouEm: {
                  gte: inicioMes,
                },
              },
            })
        : 0;

    const trialJaUsado =
      Boolean(
        await (prisma as any)
          .assinatura
          .findFirst({
            where: {
              usuarioId,

              trialStartsAt: {
                not: null,
              },
            },

            select: {
              id: true,
            },
          })
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
    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }

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
        limiteMes:
          limiteMetodologiasMes,

        usadasNoMes:
          metodologiasUsadasNoMes,

        restantesNoMes:
          Math.max(
            0,
            limiteMetodologiasMes -
              metodologiasUsadasNoMes
          ),
      },
      billingState,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erro ao carregar billing", err });
  }
}

export async function getMeuCupomAniversario(
  req: Request,
  res: Response
) {
  try {
    const usuarioId = getUserId(req);

    if (!usuarioId) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
      });
    }

    const beneficio =
      await consultarBeneficioAniversario(usuarioId);

    return res.json(beneficio);
  } catch (error) {
    console.error(
      "[billing] Erro ao consultar aniversário:",
      error
    );

    return res.status(500).json({
      code: "BIRTHDAY_QUERY_FAILED",
      message: "Não foi possível consultar o benefício.",
    });
  }
}

export async function applyCoupon(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const body = req.body as any;
    const codigo = String(body.codigo || "").trim();

    if (codigo.toUpperCase().startsWith("ANIVERSARIO_")) {
      return res.status(403).json({
        code: "BIRTHDAY_COUPON_PUBLIC_CODE_REQUIRED",
        message: "Utilize o código público 20PARABENS.",
      });
    }

    const rawItems =
      Array.isArray(body.items) && body.items.length
        ? body.items
        : body.planoId && body.periodicidade
        ? [{ planoId: body.planoId, periodicidade: body.periodicidade }]
        : [];

    if (!codigo) return res.status(400).json({ message: "Informe o código do cupom" });
    if (!rawItems.length) return res.status(400).json({ message: "Informe items do carrinho" });

    const usuarioTipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!usuarioTipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }

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
        !isAulaAoVivo(it.planoId) &&
        !isEvento(it.planoId)
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

    // Prévia de cupom para pacotes.
    // Usa as mesmas regras do checkout-bundle.
    if (items.length > 1) {
      if (items.some((item) => isEvento(item.planoId))) {
        return res.status(400).json({
          code: "EVENT_BUNDLE_NOT_ALLOWED",
          message: "Eventos não podem fazer parte de pacotes.",
        });
      }

      const chaves = items.map((item) => item.planoId);

      if (new Set(chaves).size !== chaves.length) {
        return res.status(400).json({
          code: "BUNDLE_DUPLICATE_ITEMS",
          message: "O pacote possui produtos duplicados.",
        });
      }

      const cupomAniversario = await obterCupomAniversario(
        usuarioId,
        codigo
      );

      const cupomBundle =
        cupomAniversario ??
        await prisma.cupom.findUnique({
          where: {
            codigo: codigo.trim().toUpperCase(),
          },
        });

      if (!cupomBundle || !cupomBundle.ativo) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_INVALID",
          message: "Cupom inválido.",
        });
      }

      if (
        cupomBundle.expiraEm &&
        cupomBundle.expiraEm <= new Date()
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_EXPIRED",
          message: "Cupom expirado.",
        });
      }

      if (
        cupomBundle.usosMax != null &&
        cupomBundle.usosAtuais >= cupomBundle.usosMax
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_EXHAUSTED",
          message: "Cupom esgotado.",
        });
      }

      if (
        cupomBundle.plano ||
        cupomBundle.periodicidade ||
        (
          Boolean(cupomBundle.concedidoParaUsuarioId) &&
          !(
            ehCupomAniversario(cupomBundle) &&
            cupomBundle.concedidoParaUsuarioId === usuarioId &&
            codigo.toUpperCase() === "20PARABENS"
          )
        ) ||
        !["PERCENTUAL", "VALOR"].includes(cupomBundle.tipo)
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_NOT_ELIGIBLE",
          message: "Este cupom não é válido para pacotes.",
        });
      }

      const resgateExistente =
        await prisma.cupomResgate.findUnique({
          where: {
            cupomId_usuarioId: {
              cupomId: cupomBundle.id,
              usuarioId,
            },
          },
        });

      if (resgateExistente) {
        return res.status(409).json({
          code: "BUNDLE_COUPON_ALREADY_USED",
          message: "Este cupom já foi utilizado.",
        });
      }

      const itensFinanceiros: BillingItemFinanceiro[] =
        await Promise.all(
          items.map(async (item) => {
            const valor = await priceFor(
              item.planoId,
              item.periodicidade
            );

            const centavos = billingCentavos(valor);

            return {
              planoId: item.planoId,
              periodicidade: item.periodicidade,
              valorBaseCentavos: centavos,
              valorFinalCentavos: centavos,
            };
          })
        );

      const baseCentavos = itensFinanceiros.reduce(
        (soma, item) => soma + item.valorBaseCentavos,
        0
      );

      let descontoCentavos = 0;

      if (cupomBundle.tipo === "PERCENTUAL") {
        const percentual = cupomBundle.descontoPerc;

        if (
          percentual == null ||
          !Number.isInteger(percentual) ||
          percentual < 0 ||
          percentual > 100
        ) {
          return res.status(400).json({
            code: "BUNDLE_COUPON_INVALID_PERCENT",
            message: "Percentual do cupom inválido.",
          });
        }

        descontoCentavos = Math.round(
          (baseCentavos * percentual) / 100
        );
      } else {
        if (cupomBundle.descontoFixo == null) {
          return res.status(400).json({
            code: "BUNDLE_COUPON_INVALID_VALUE",
            message: "Valor do cupom inválido.",
          });
        }

        descontoCentavos = billingCentavos(
          Number(cupomBundle.descontoFixo)
        );
      }

      descontoCentavos = Math.min(
        baseCentavos,
        descontoCentavos
      );

      if (descontoCentavos >= baseCentavos) {
        return res.status(400).json({
          code: "BUNDLE_FULL_DISCOUNT_NOT_SUPPORTED",
          message:
            "Cupons que zeram o pacote ainda não são aceitos.",
        });
      }

      const rateados = ratearDescontoBundle(
        itensFinanceiros,
        descontoCentavos
      );

      const totalCentavos = rateados.reduce(
        (soma, item) => soma + item.valorFinalCentavos,
        0
      );

      return res.json({
        items,
        base: baseCentavos / 100,
        desconto: descontoCentavos / 100,
        total: totalCentavos / 100,
        cupom: {
          codigo: ehCupomAniversario(cupomBundle)
            ? "20PARABENS"
            : cupomBundle.codigo,
          tipo: cupomBundle.tipo,
        },
        financeiroV1: {
          versao: 1,
          totalCentavos,
          items: rateados,
        },
      });
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
      cupom: {
        codigo: ehCupomAniversario(c)
          ? "20PARABENS"
          : c.codigo,
        tipo: c.tipo,
      },
    });
  } catch (err) {
    if (err instanceof CupomAniversarioError) {
      return res.status(
        err.code === "BIRTHDAY_COUPON_ALREADY_USED" ? 409 : 403
      ).json({
        code: err.code,
        message: err.message,
      });
    }

    console.error("[billing] Erro ao validar cupom:", err);

    return res.status(500).json({
      code: "BILLING_COUPON_VALIDATION_FAILED",
      message: "Não foi possível validar o cupom.",
    });
  }
}

export async function startTrial(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const contextoPagamento =
      getContextoPagamentoData(req);

    const activeContext =
      getBillingActiveContext(req);

    const contextoAssinatura =
      getContextoAssinaturaData(
        activeContext
      );

    if (
      !contextoPagamento ||
      !activeContext ||
      !contextoAssinatura
    ) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para iniciar o período grátis.",
      });
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

    if (
      isEvento(planoNorm)
    ) {
      return res.status(400).json({
        code:
          "EVENT_TRIAL_NOT_ALLOWED",

        message:
          "Inscrições em eventos não participam do mês grátis.",
      });
    }

    if (!["Mensal", "Anual"].includes(periodicidadeFinal as any)) {
      return res.status(400).json({ message: "Periodicidade inválida" });
    }

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }
    assertPlanoPermitido(tipo, planoNorm);

    const isAvulsa = isMetodologiaAvulsa(planoNorm);
    const isLearningMetodologia = isMetodologiaLearning(planoNorm);
    const isAula = isAulaAoVivo(planoNorm);
    const isEventoCompra =
      isEvento(
        planoNorm
      );

    const isPlanoPrincipal =
      !isAvulsa &&
      !isLearningMetodologia &&
      !isAula &&
      !isEventoCompra;

    if (isAula) {
      await assertAulaAoVivoDisponivelParaCompra(planoNorm);
    }

    if (isPlanoPrincipal && !findPlan(planoNorm)) {
      return res.status(400).json({ message: "Plano inválido" });
    }

    const jaUsouTrialNaConta =
      await (prisma as any)
        .assinatura
        .findFirst({
          where: {
            usuarioId,

            trialStartsAt: {
              not: null,
            },
          },

          select: {
            id: true,
            plano: true,
            trialStartsAt: true,
          },
        });

    if (
      jaUsouTrialNaConta
    ) {
      return res
        .status(400)
        .json({
          code:
            "TRIAL_ALREADY_USED",

          message:
            "Você já utilizou o mês grátis nesta conta.",
        });
    }

    const existing =
      await (prisma as any)
        .assinatura
        .findUnique({
          where: {
            usuarioId_plano_contextoKey:
              {
                usuarioId,

                plano:
                  planoNorm,

                contextoKey:
                  contextoAssinatura
                    .contextoKey,
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
      const assinatura =
        await (tx as any)
          .assinatura
          .upsert({
            where: {
              usuarioId_plano_contextoKey:
                {
                  usuarioId,

                  plano:
                    planoNorm,

                  contextoKey:
                    contextoAssinatura
                      .contextoKey,
                },
            },
        update: {
          ...contextoAssinatura,
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
          ...contextoAssinatura,
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
          ...contextoPagamento,
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
    return sendError(res, err, "Erro ao iniciar trial");
  }
}

export async function setPreferredPaymentMethod(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const activeContext =
      getBillingActiveContext(req);

    const contextoAssinatura =
      getContextoAssinaturaData(
        activeContext
      );

    if (
      !activeContext ||
      !contextoAssinatura
    ) {
      return res
        .status(403)
        .json({
          code:
            "ACTIVE_CONTEXT_REQUIRED",

          message:
            "Selecione um perfil ativo para alterar o método de pagamento.",
        });
    }

    const { metodoFinal, planoId } = req.body as {
      metodoFinal: MetodoPagamento;
      planoId?: string | null;
    };

    const METODOS_VALIDOS: MetodoPagamento[] = ["PIX", "CREDITO", "DEBITO", "BOLETO"];
    if (!METODOS_VALIDOS.includes(metodoFinal)) {
      return res.status(400).json({ message: "Método inválido" });
    }

    const assinaturas =
      await getAssinaturasReadOnly(
        usuarioId,
        activeContext
      );
    const principal = pickPrincipalAssinatura(assinaturas as any[]);
    const alvoPlano = planoId ? normalizePlanoId(planoId) : principal?.plano;
    if (!alvoPlano) return res.status(400).json({ message: "Nenhuma assinatura encontrada para salvar método." });

    await (prisma as any)
      .assinatura
      .update({
        where: {
          usuarioId_plano_contextoKey:
            {
              usuarioId,

              plano:
                alvoPlano,

              contextoKey:
                contextoAssinatura
                  .contextoKey,
            },
        },

        data: {
          metodoPreferido:
            metodoFinal,

          metodoPreferidoDefinidoEm:
            new Date(),
        } as any,
      });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Erro ao salvar método preferido", err });
  }
}

async function guardTrialRule(
  usuarioId: string,
  contexto: ActiveContext
) {
  const now =
    new Date();

  const assinaturas =
    await getAssinaturasReadOnly(
      usuarioId,
      contexto
    );

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

function validateMetodoAndFields(
  metodo: MetodoPagamento,
  pagador?: Pagador
) {
  const METODOS_VALIDOS:
    MetodoPagamento[] = [
      "PIX",
      "CREDITO",
      "DEBITO",
      "BOLETO",
    ];

  if (
    !METODOS_VALIDOS.includes(
      metodo
    )
  ) {
    throw new Error(
      "Método de pagamento inválido"
    );
  }

  if (metodo === "PIX") {
    if (
      !pagador?.nome ||
      !pagador?.email
    ) {
      throw new Error(
        "Informe nome e e-mail para PIX"
      );
    }
  }

  if (metodo === "BOLETO") {
    if (
      !pagador?.nome ||
      !pagador?.email ||
      !pagador?.cpf
    ) {
      throw new Error(
        "Informe nome, e-mail e CPF para boleto"
      );
    }
  }

  if (
    metodo === "CREDITO" ||
    metodo === "DEBITO"
  ) {
    if (
      !pagador?.nome ||
      !pagador?.email
    ) {
      throw new Error(
        "Informe nome e e-mail do titular"
      );
    }
  }
}

async function registrarPagamentoBeneficioTx(
  tx: Prisma.TransactionClient,
  args: {
    pagamentoId: string;
    usuarioId: string;
    itemKey: string;
    tipo:
      | "ASSINATURA"
      | "METODOLOGIA"
      | "METODOLOGIA_AVULSA"
      | "AULA_AO_VIVO"
      | "EVENTO";
    recursoId: string;
    contextoKind?: string | null;
    contextoTipo?: string | null;
    contextoPerfilId?: string | null;
    contextoOrganizacaoId?: string | null;
  }
) {
  const beneficio = await tx.pagamentoBeneficio.upsert({
    where: {
      pagamentoId_itemKey: {
        pagamentoId: args.pagamentoId,
        itemKey: args.itemKey,
      },
    },

    update: {},

    create: {
      pagamentoId: args.pagamentoId,
      usuarioId: args.usuarioId,
      itemKey: args.itemKey,
      tipo: args.tipo,
      recursoId: args.recursoId,
      contextoKind: args.contextoKind ?? null,
      contextoTipo: args.contextoTipo ?? null,
      contextoPerfilId: args.contextoPerfilId ?? null,
      contextoOrganizacaoId:
        args.contextoOrganizacaoId ?? null,
    },
  });

  // Evita reutilizar uma chave de item para
  // conceder um benefício diferente.
  if (
    beneficio.usuarioId !== args.usuarioId ||
    beneficio.tipo !== args.tipo ||
    beneficio.recursoId !== args.recursoId
  ) {
    throw new Error(
      "BILLING_BENEFIT_IDEMPOTENCY_CONFLICT"
    );
  }

  if (beneficio.revogadoEm) {
    throw new Error(
      "BILLING_BENEFIT_ALREADY_REVOKED"
    );
  }

  return beneficio;
}

async function registrarBeneficioItemTx(
  tx: Prisma.TransactionClient,
  pg: {
    id: string;
    usuarioId: string;
    contextoKind: string | null;
    contextoTipo: string | null;
    contextoPerfilId: string | null;
    contextoOrganizacaoId: string | null;
  },
  planoId: string,
  recursoIdOverride?: string
) {
  const pid = normalizePlanoId(planoId);

  let tipo:
    | "ASSINATURA"
    | "METODOLOGIA"
    | "METODOLOGIA_AVULSA"
    | "AULA_AO_VIVO"
    | "EVENTO";

  let recursoId: string;

  if (isEvento(pid)) {
    tipo = "EVENTO";
    recursoId = extractEventoId(pid);
  } else if (isMetodologiaAvulsa(pid)) {
    tipo = "METODOLOGIA_AVULSA";
    recursoId = extractMetodologiaId(pid);
  } else if (isMetodologiaLearning(pid)) {
    tipo = "METODOLOGIA";
    recursoId = extractMetodologiaId(pid);
  } else if (isAulaAoVivo(pid)) {
    tipo = "AULA_AO_VIVO";
    recursoId = extractAulaAoVivoId(pid);
  } else {
    tipo = "ASSINATURA";
    recursoId = pid;
  }

  return registrarPagamentoBeneficioTx(tx, {
    pagamentoId: pg.id,
    usuarioId: pg.usuarioId,
    itemKey: pid,
    tipo,
    recursoId: recursoIdOverride ?? recursoId,
    contextoKind: pg.contextoKind,
    contextoTipo: pg.contextoTipo,
    contextoPerfilId: pg.contextoPerfilId,
    contextoOrganizacaoId: pg.contextoOrganizacaoId,
  });
}

async function approvePaymentAndProvision(
  pagamentoId: string,
  items: Array<{
    planoId: string;
    periodicidade: Periodicidade;
  }>
) {
  const now =
    new Date();

  return prisma.$transaction(
    async (tx) => {
      // Serializa aprovação e finalização financeira
      // do mesmo pagamento entre processos.
      const pagamentoBloqueado = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${pagamentoId}
        FOR UPDATE
      `;

      if (pagamentoBloqueado.length !== 1) {
        throw new Error(
          "BILLING_PAYMENT_NOT_FOUND_FOR_LOCK"
        );
      }
      const pagamentoAtual =
        await tx.pagamento.findUnique({
          where: {
            id: pagamentoId,
          },

          select: {
            id: true,
            usuarioId: true,
            status: true,
          },
        });

      if (!pagamentoAtual) {
        const err: any =
          new Error(
            "Pagamento não encontrado."
          );

        err.statusCode = 404;
        err.code =
          "PAGAMENTO_NOT_FOUND";

        throw err;
      }

      if (
        pagamentoAtual.status ===
        PagamentoStatus.APROVADO
      ) {
        return tx.pagamento
          .findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });
      }

      if (
        pagamentoAtual.status ===
        PagamentoStatus.CANCELADO
      ) {
        throw new Error(
          "BILLING_LATE_APPROVAL_REQUIRES_RECONCILIATION"
        );
      }

      if (
        pagamentoAtual.status !==
        PagamentoStatus.PENDENTE
      ) {
        const err: any =
          new Error(
            "Este pagamento não está pendente."
          );

        err.statusCode = 409;
        err.code =
          "PAYMENT_NOT_PENDING";

        throw err;
      }

      const claim =
        await tx.pagamento.updateMany({
          where: {
            id: pagamentoId,
            status:
              PagamentoStatus.PENDENTE,
          },

          data: {
            status:
              PagamentoStatus.APROVADO,
            pagoEm:
              now,
          },
        });

      if (claim.count === 0) {
        const pagamentoDepoisDaDisputa =
          await tx.pagamento.findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });

        if (
          pagamentoDepoisDaDisputa.status !==
          PagamentoStatus.APROVADO
        ) {
          throw new Error(
            "BILLING_PAYMENT_APPROVAL_CONFLICT"
          );
        }

        return pagamentoDepoisDaDisputa;
      }

      const pg =
        await tx.pagamento
          .findUniqueOrThrow({
            where: {
              id: pagamentoId,
            },
          });

      const financeiroV1 = obterFinanceiroPagamento(
        pg,
        items
      );

      const cupomParaConfirmacao = pg.cupomId
        ? await tx.cupom.findUnique({
            where: { id: pg.cupomId },
            select: {
              codigo: true,
              usosMax: true,
              concedidoParaUsuarioId: true,
            },
          })
        : null;

      const aniversarioNaConfirmacao =
        ehCupomAniversario(cupomParaConfirmacao);

      if (
        aniversarioNaConfirmacao &&
        cupomParaConfirmacao?.concedidoParaUsuarioId !==
          pg.usuarioId
      ) {
        throw new Error(
          "BIRTHDAY_COUPON_PAYMENT_OWNER_MISMATCH"
        );
      }

      const reservaPagamento =
        (BILLING_CUPOM_RESERVA_QA || aniversarioNaConfirmacao) &&
        pg.cupomId
          ? await tx.cupomReserva.findUnique({
              where: {
                pagamentoId: pg.id,
              },
            })
          : null;

      if (
        pg.cupomId &&
        (
          pg.plano === "BUNDLE" ||
          aniversarioNaConfirmacao ||
          (
            BILLING_CUPOM_RESERVA_QA &&
            reservaPagamento !== null
          )
        )
      ) {
        if (!financeiroV1) {
          throw new Error(
            "BILLING_BUNDLE_COUPON_SNAPSHOT_REQUIRED"
          );
        }

        const cupomAtual = await tx.cupom.findUnique({
          where: {
            id: pg.cupomId,
          },
        });

        if (!cupomAtual) {
          throw new Error("BILLING_COUPON_NOT_FOUND");
        }

        const reserva = reservaPagamento;

        if (
          aniversarioNaConfirmacao &&
          !reserva
        ) {
          throw new Error(
            "BIRTHDAY_COUPON_RESERVATION_REQUIRED"
          );
        }

        if (
          BILLING_CUPOM_RESERVA_QA &&
          pg.plano === "BUNDLE" &&
          pg.cupomId &&
          !reserva
        ) {
          console.warn(
            "[billing] Pagamento com cupom sem reserva:",
            {
              pagamentoId: pg.id,
              cupomId: pg.cupomId,
            }
          );
        }

        if (reserva) {
          if (
            reserva.cupomId !== pg.cupomId ||
            reserva.usuarioId !== pg.usuarioId ||
            ![
              "RESERVADA",
              "CONCILIACAO_PENDENTE",
            ].includes(reserva.status)
          ) {
            throw new Error(
              "BILLING_COUPON_RESERVATION_MISMATCH"
            );
          }
        }

        const resgate = await tx.cupomResgate.findUnique({
          where: {
            cupomId_usuarioId: {
              cupomId: pg.cupomId,
              usuarioId: pg.usuarioId,
            },
          },
        });

        if (resgate) {
          if (resgate.pagamentoId !== pg.id) {
            throw new Error("BILLING_COUPON_ALREADY_REDEEMED");
          }
        } else {
          const incremento = await tx.cupom.updateMany({
            where: {
              id: pg.cupomId,
              ativo: true,
              OR: [
                { usosMax: null },
                {
                  usosAtuais: {
                    lt: cupomAtual.usosMax ?? 0,
                  },
                },
              ],
            },
            data: {
              usosAtuais: { increment: 1 },
            },
          });

          if (incremento.count !== 1) {
            throw new Error("BILLING_COUPON_LIMIT_REACHED");
          }

          await tx.cupomResgate.create({
            data: {
              cupomId: pg.cupomId,
              usuarioId: pg.usuarioId,
              pagamentoId: pg.id,
            },
          });

          if (reserva) {
            const consumo = await tx.cupomReserva.updateMany({
              where: {
                id: reserva.id,
                status: {
                  in: [
                    "RESERVADA",
                    "CONCILIACAO_PENDENTE",
                  ],
                },
              },
              data: {
                status: "CONSUMIDA",
                consumidaEm: now,
              },
            });

            if (consumo.count !== 1) {
              throw new Error(
                "BILLING_COUPON_RESERVATION_CONSUME_CONFLICT"
              );
            }
          }
        }
      }

      const contextoAssinatura =
        getContextoAssinaturaFromPagamento(
          pg
        );

      if (!contextoAssinatura) {
        throw new Error(
          "Pagamento sem contexto válido para provisionar assinatura."
        );
      }

      for (const [itemIndex, it] of items.entries()) {
        const pid = normalizePlanoId(it.planoId);

        const financeiroItem =
          financeiroV1?.items[itemIndex] ?? null;


      if (isEvento(pid)) {
        const eventoId = extractEventoId(pid);

        const compensacaoExistente =
          await tx.billingCompensacaoEvento.findUnique({
            where: {
              pagamentoId: pg.id,
            },
            select: {
              status: true,
            },
          });

        const pendenciaExistente =
          await tx.billingPendenciaEvento.findUnique({
            where: {
              pagamentoId: pg.id,
            },
            select: {
              status: true,
            },
          });

        if (
          compensacaoExistente !== null ||
          pendenciaExistente !== null
        ) {
          throw new Error(
            "BILLING_EVENT_FINANCIAL_RECONCILIATION_REQUIRED"
          );
        }
        // IMPORTANTE:
        // Bloquear o evento antes de contar as vagas.
        // Dois pagamentos concorrentes para o mesmo
        // evento serão processados em sequência.
        const eventosBloqueados = await tx.$queryRaw<
          Array<{
            id: string;
            vagas: number | null;
          }>
        >`
          SELECT "id", "vagas"
          FROM "Evento"
          WHERE "id" = ${eventoId}
          FOR UPDATE
        `;

        const evento = eventosBloqueados[0];

        if (!evento) {
          throw new Error(
            "Evento do pagamento não foi encontrado."
          );
        }

        // Consultar a inscrição do comprador.
        const inscricaoExistente =
          await tx.inscricaoEvento.findUnique({
            where: {
              eventoId_usuarioId: {
                eventoId,
                usuarioId: pg.usuarioId,
              },
            },
            select: {
              id: true,
              status: true,
            },
          });

        const possuiVagaConfirmada =
          inscricaoExistente !== null &&
          [
            "CONFIRMADA",
            "PRESENCA_OK",
          ].includes(String(inscricaoExistente.status));

        // Quem já está confirmado não precisa
        // consumir uma vaga adicional.
        if (!possuiVagaConfirmada && evento.vagas !== null) {
          const vagasOcupadas =
            await tx.inscricaoEvento.count({
              where: {
                eventoId,
                status: {
                  not: "CANCELADA",
                },
              },
            });

          if (vagasOcupadas >= evento.vagas) {
            const erro: any = new Error(
              "BILLING_EVENT_CAPACITY_EXCEEDED"
            );

            erro.code =
              "BILLING_EVENT_CAPACITY_EXCEEDED";

            erro.statusCode = 503;
            erro.pagamentoId = pg.id;
            erro.eventoId = eventoId;

            throw erro;
          }
        }

        await tx.inscricaoEvento.upsert({
          where: {
            eventoId_usuarioId: {
              eventoId,
              usuarioId: pg.usuarioId,
            },
          },
          update: {
            status: "CONFIRMADA",
          },
          create: {
            eventoId,
            usuarioId: pg.usuarioId,
            status: "CONFIRMADA",
          },
        });

        await registrarBeneficioItemTx(
          tx,
          pg,
          pid
        );

        continue;
      }

      if (isMetodologiaAvulsa(pid)) {
        const metodologiaAvulsaId =
          extractMetodologiaId(pid);

        const expiraEm = addMonths(
          now,
          monthsForPeriodicidade(it.periodicidade)
        );

        // UPSERT atômico: impede que aprovações
        // simultâneas reduzam a validade do acesso.
        const acessosAtualizados =
          await tx.$queryRaw<Array<{ id: string }>>`
            INSERT INTO "MetodologiaAssinante" (
              "id",
              "usuarioId",
              "metodologiaId",
              "metodologiaAvulsaId",
              "origem",
              "status",
              "iniciouEm",
              "expiraEm"
            )
            VALUES (
              ${randomUUID()},
              ${pg.usuarioId},
              NULL,
              ${metodologiaAvulsaId},
              'AVULSA'::"MetodologiaAssinaturaOrigem",
              'ATIVA'::"MetodologiaAssinaturaStatus",
              ${now},
              ${expiraEm}
            )
            ON CONFLICT (
              "metodologiaAvulsaId",
              "usuarioId"
            )
            DO UPDATE SET
              "status" =
                'ATIVA'::"MetodologiaAssinaturaStatus",

              "cancelouEm" = NULL,

              "iniciouEm" =
                CASE
                  WHEN "MetodologiaAssinante"."status" =
                    'ATIVA'::"MetodologiaAssinaturaStatus"
                  THEN "MetodologiaAssinante"."iniciouEm"
                  ELSE EXCLUDED."iniciouEm"
                END,

              "expiraEm" =
                CASE
                  WHEN "MetodologiaAssinante"."status" =
                    'ATIVA'::"MetodologiaAssinaturaStatus"
                  THEN
                    CASE
                      WHEN "MetodologiaAssinante"."expiraEm"
                        IS NULL
                      THEN NULL
                      ELSE GREATEST(
                        "MetodologiaAssinante"."expiraEm",
                        EXCLUDED."expiraEm"
                      )
                    END
                  ELSE EXCLUDED."expiraEm"
                END

            WHERE "MetodologiaAssinante"."origem" =
              'AVULSA'::"MetodologiaAssinaturaOrigem"

            RETURNING "id"
          `;

        if (acessosAtualizados.length !== 1) {
          throw new Error(
            "BILLING_ACCESS_ORIGIN_REQUIRES_RECONCILIATION"
          );
        }

        // Mantenha abaixo o código já existente:
        // const valorBruto = financeiroItem ...

        const valorBruto = financeiroItem
          ? financeiroItem.valorFinalCentavos / 100
          : await priceFor(pid, it.periodicidade);

        await registrarCreatorVendaTx({
          tx,
          compradorId: pg.usuarioId,
          metodologiaAvulsaId,
          valorBruto,
          pagamentoId: pg.id,
          provider: "PAGAMENTO",
          providerRef:
            pg.plano === "BUNDLE"
              ? `${pg.id}:AVULSA:${metodologiaAvulsaId}`
              : pg.id,
        });

        await registrarBeneficioItemTx(tx, pg, pid);
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

        await registrarBeneficioItemTx(tx, pg, pid);
        continue;
      }

      if (isAulaAoVivo(pid)) {
        const aulaAoVivoId = extractAulaAoVivoId(pid);

        const valorPago = financeiroItem
          ? financeiroItem.valorFinalCentavos / 100
          : await priceFor(pid, it.periodicidade);

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

        await registrarBeneficioItemTx(tx, pg, pid);
        continue;
      }

      const assinatura = await upsertSubscriptionTx(
        tx,
        pg.usuarioId,
        contextoAssinatura,
        pid,
        it.periodicidade
      );

      if (!assinatura?.id) {
        throw new Error(
          "BILLING_SUBSCRIPTION_ID_REQUIRED"
        );
      }

      await registrarBeneficioItemTx(
        tx,
        pg,
        pid,
        assinatura.id
      );
    }

    return pg;
  });
}

/**
 * Entrada exclusivamente para teste de concorrencia
 * com a compensacao financeira.
 *
 * Nao adicionar em routes/billing.ts.
 * Nao chamar em producao.
 */
export async function aprovarPagamentoEventoConcorrenciaQa(
  pagamentoId: string,
  eventoId: string
) {
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(
      process.env.DATABASE_URL ?? ""
    );
  } catch {
    throw new Error(
      "BILLING_APROVACAO_QA_DATABASE_INVALIDA"
    );
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    databaseUrl.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1"].includes(
      databaseUrl.hostname
    ) ||
    databaseUrl.port !== "5433" ||
    databaseUrl.pathname !== "/footera_billing_qa"
  ) {
    throw new Error(
      "BILLING_APROVACAO_CONCORRENCIA_QA_DISABLED"
    );
  }

  const banco = await prisma.$queryRaw<
    Array<{ nome: string }>
  >`
    SELECT current_database() AS nome
  `;

  if (banco[0]?.nome !== "footera_billing_qa") {
    throw new Error(
      "BILLING_APROVACAO_QA_BANCO_INCORRETO"
    );
  }

  if (
    !/^[0-9a-f-]{36}$/i.test(pagamentoId) ||
    !/^[0-9a-f-]{36}$/i.test(eventoId)
  ) {
    throw new Error(
      "BILLING_APROVACAO_QA_ID_INVALIDO"
    );
  }

  const pagamento = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    select: {
      id: true,
      plano: true,
      status: true,
      provider: true,
      valor: true,
      moeda: true,
      reembolsadoEm: true,
    },
  });

  if (
    !pagamento ||
    pagamento.plano !== `EVENTO:${eventoId}` ||
    pagamento.status !== PagamentoStatus.PENDENTE ||
    pagamento.provider !== "MERCADOPAGO" ||
    pagamento.moeda !== "BRL" ||
    pagamento.reembolsadoEm !== null
  ) {
    throw new Error(
      "BILLING_APROVACAO_QA_PAGAMENTO_INVALIDO"
    );
  }

  const pendencia = await prisma.billingPendenciaEvento.findUnique({
    where: { pagamentoId },
  });

  const compensacao = await prisma.billingCompensacaoEvento.findUnique({
    where: { pagamentoId },
  });

  if (
    !pendencia ||
    pendencia.eventoId !== eventoId ||
    !compensacao ||
    compensacao.pendenciaId !== pendencia.id
  ) {
    throw new Error(
      "BILLING_APROVACAO_QA_COMPENSACAO_AUSENTE"
    );
  }

  // Executa a mesma funcao interna usada pela
  // aprovacao real, sem simular sua logica.
  return approvePaymentAndProvision(pagamentoId, [
    {
      planoId: `EVENTO:${eventoId}`,
      periodicidade: "Mensal",
    },
  ]);
}

export async function startCheckout(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const contextoPagamento =
      getContextoPagamentoData(req);

    if (!contextoPagamento) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para iniciar o pagamento.",
      });
    }

    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const {
      planoId,
      periodicidade,
      metodo,
      cupom,
      pagador,
      returnTo,
      chaveCliente,
    } =
      startCheckoutSchema.parse(
        req.body
      ) as StartCheckoutBody;

    const planoNorm =
      normalizePlanoId(
        planoId
      );

    const compraAvulsa =
      isMetodologiaAvulsa(
        planoNorm
      ) ||
      isAulaAoVivo(
        planoNorm
      ) ||
      isEvento(
        planoNorm
      );

    const activeContext =
      getBillingActiveContext(req);

    if (!activeContext) {
      return res
        .status(403)
        .json({
          code:
            "ACTIVE_CONTEXT_REQUIRED",

          message:
            "Selecione um perfil ativo para continuar.",
        });
    }

    const trialInfo =
      compraAvulsa
        ? {
            metodoPreferido:
              null,
          }
        : await guardTrialRule(
            usuarioId,
            activeContext
          );

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }

    assertPlanoPermitido(
      tipo,
      planoNorm
    );

    const metodoFinal =
      (
        metodo ||
        trialInfo.metodoPreferido
      ) as MetodoPagamento;

    const aulaAoVivoParaCheckout =
      isAulaAoVivo(planoNorm)
        ? await assertAulaAoVivoDisponivelParaCompra(planoNorm)
        : null;

    const eventoParaCheckout =
      isEvento(planoNorm)
        ? await assertEventoDisponivelParaCompra(
            planoNorm,
            usuarioId
          )
        : null;

    if (
      isEvento(planoNorm) &&
      cupom &&
      String(cupom).trim().toUpperCase() !== "20PARABENS"
    ) {
      return res.status(400).json({
        code:
          "EVENT_COUPON_NOT_ALLOWED",

        message:
          "Cupons não são aplicados a inscrições de eventos.",
      });
    }

    if (
      isMetodologiaAvulsa(
        planoNorm
      ) ||
      isMetodologiaLearning(
        planoNorm
      ) ||
      isAulaAoVivo(
        planoNorm
      ) ||
      isEvento(
        planoNorm
      )
    ) {
    } else {
      const plan = findPlan(planoNorm);
      if (!plan) {
        return res.status(400).json({ message: "Plano inválido" });
      }
    }
    try {
      validateMetodoAndFields(metodoFinal, pagador);
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

    const valorBaseCentavos = billingCentavos(base);

    const total = Math.max(0, base - desconto);

    const totalCentavos = Math.min(
      valorBaseCentavos,
      billingCentavos(total)
    );

    if (
      cupomRow &&
      ehCupomAniversario(cupomRow) &&
      totalCentavos <= 0
    ) {
      return res.status(409).json({
        code: "BIRTHDAY_COUPON_FREE_CHECKOUT_NOT_ALLOWED",
        message:
          "O cupom de aniversário não pode ser aplicado a uma compra de valor zero.",
      });
    }

    if (
      BILLING_CUPOM_RESERVA_QA &&
      cupomRow &&
      totalCentavos === 0
    ) {
      return res.status(409).json({
        code: "BILLING_FREE_COUPON_QA_NOT_READY",
        message:
          "Cupons que zeram o pagamento estão temporariamente indisponíveis durante a validação financeira.",
      });
    }

    const totalDecimal = new Prisma.Decimal(
      (totalCentavos / 100).toFixed(2)
    );

    const financeiroV1: BillingFinanceiroV1 = {
      versao: 1,
      totalCentavos,
      items: [
        {
          planoId: planoNorm,
          periodicidade,
          valorBaseCentavos,
          valorFinalCentavos: totalCentavos,
        },
      ],
    };

    const provider = HAS_MERCADO_PAGO
      ? "MERCADOPAGO"
      : "INTERNAL_FAKE";

    const pagamentoData: Prisma.PagamentoUncheckedCreateInput = {
      usuarioId,
      ...contextoPagamento,

      plano: planoNorm,
      periodicidade,
      metodo: metodoFinal,

      valor: totalDecimal,
      moeda: "BRL",

      provider,
      providerRef: null,

      cupomId: cupomRow?.id ?? null,

      status: PagamentoStatus.PENDENTE,
      pagoEm: null,

      meta: {
        financeiroV1,
      } as Prisma.InputJsonValue,
    };

    let pagamento;
      let operacaoCheckout:
        Awaited<
          ReturnType<typeof prepararCheckoutAtomico>
        >["operacao"] | null = null;

      if (HAS_MERCADO_PAGO && totalCentavos > 0) {
        if (!chaveCliente) {
          return res.status(400).json({
            code: "BILLING_CHECKOUT_KEY_REQUIRED",
            message: "Chave da operação obrigatória.",
          });
        }

        const resultado = await prepararCheckoutAtomico({
          usuarioId,
          chaveCliente,

          modalidade:
            metodoFinal === "PIX"
              ? "PIX_INDIVIDUAL"
              : "PREFERENCIA_INDIVIDUAL",

          fingerprintRequisicao: fingerprintCheckout({
            usuarioId,
            contexto: contextoPagamento,
            items: financeiroV1.items,
            metodo: metodoFinal,
            cupomId: cupomRow?.id ?? null,
            totalCentavos,
            moeda: "BRL",
          }),

          criarPagamento: (tx) =>
            cupomRow && exigeReservaCupom(cupomRow, usuarioId)
              ? criarPagamentoComReservaQa({
                  usuarioId,
                  cupomId: cupomRow.id,
                  data: pagamentoData,
                  tx,
                })
              : tx.pagamento.create({
                  data: pagamentoData,
                }),
        });

        pagamento = resultado.pagamento;
        operacaoCheckout = resultado.operacao;

        if (resultado.reutilizada) {
          return res.status(409).json({
            code: "BILLING_CHECKOUT_OPERATION_EXISTS",
            pagamentoId: pagamento.id,
            operacaoStatus: operacaoCheckout.status,
            message:
              "Esta compra já possui uma operação. Consulte o andamento.",
          });
        }
      } else {
        pagamento =
          cupomRow && exigeReservaCupom(cupomRow, usuarioId)
            ? await criarPagamentoComReservaQa({
                usuarioId,
                cupomId: cupomRow.id,
                data: pagamentoData,
              })
            : await prisma.pagamento.create({
                data: pagamentoData,
              });
      }

    if (total === 0) {
      pagamento =
        await approvePaymentAndProvision(
          pagamento.id,
          [
            {
              planoId:
                planoNorm,
              periodicidade,
            },
          ]
        );

      if (cupomRow) {
        await resgatarCupom(
          cupomRow.id,
          usuarioId,
          pagamento.id
        );
      }

      return res.json({
        status: "APROVADO",
        pagamento,
        message:
          "Compra aprovada sem cobrança (cupom/presente).",
      });
    }

    if (!HAS_MERCADO_PAGO) {
      const providerRef = `FAKE-${randomUUID()}`;
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

    if (
      isEvento(planoNorm)
    ) {
      planTitle =
        `Inscrição: ${
          eventoParaCheckout?.titulo ??
          "Evento FootEra"
        }`;
    } else if (
      isMetodologiaAvulsa(
        planoNorm
      )
    ) {
      const mid =
        extractMetodologiaId(
          planoNorm
        );

      const pr =
        await computeMetodologiaAvulsaPricing(
          mid
        );

      planTitle =
        `Metodologia Avulsa: ${pr.titulo}`;
    } else if (
      isAulaAoVivo(
        planoNorm
      )
    ) {
      planTitle =
        `Evento ao vivo: ${
          aulaAoVivoParaCheckout?.titulo ??
          "Evento ao vivo"
        }`;
    } else {
      const plan =
        findPlan(
          planoNorm
        );

      if (!plan) {
        return res.status(400).json({
          message:
            "Plano inválido",
        });
      }

      planTitle =
        plan.title;
    }

    if (
      metodoFinal === "PIX" &&
      !operacaoCheckout?.chaveOperacao
    ) {
      return res.status(503).json({
        code: "BILLING_CHECKOUT_OPERATION_KEY_MISSING",
        message: "Chave da operação não disponível.",
      });
    }

    const aquisicaoCheckoutIndividual =
      await adquirirOperacaoAntesDoEnvio(
        operacaoCheckout?.id,
        pagamento.id
      );

    if (!aquisicaoCheckoutIndividual.adquirida) {
      return res.status(
        aquisicaoCheckoutIndividual.statusHttp
      ).json({
        code: aquisicaoCheckoutIndividual.code,
        pagamentoId: pagamento.id,
        message:
          "Esta compra já possui uma tentativa externa. Consulte seu andamento antes de iniciar outra.",
      });
    }

    if (metodoFinal === "PIX") {
      try {
        const mpResp: any = await mercadopago.payment.create({
          transaction_amount: Number(total.toFixed(2)),
          description:
            isEvento(planoNorm)
              ? planTitle
              : `Assinatura ${planTitle} (${periodicidade})`,
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
        },
        {
          idempotency: operacaoCheckout!.chaveOperacao,
        });

        const mpBody: any = mpResp?.body || mpResp;

        const qr_code = mpBody.point_of_interaction?.transaction_data?.qr_code ?? null;
        const qr_code_base64 = mpBody.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

        const qrCodeUrl =
          typeof qr_code_base64 === "string"
            ? `data:image/png;base64,${qr_code_base64}`
            : null;

        const mpPaymentId = String(mpBody.id ?? "");

        if (!/^\d+$/.test(mpPaymentId)) {
          throw new Error(
            "BILLING_MP_PAYMENT_ID_INVALID"
          );
        }

        if (!operacaoCheckout) {
          throw new Error(
            "BILLING_CHECKOUT_OPERATION_MISSING"
          );
        }

        await confirmarCheckoutExterno({
          operacaoId: operacaoCheckout.id,
          providerRef: mpPaymentId,
          pixCopiaECola:
            typeof qr_code === "string"
              ? qr_code
              : null,
        });

        pagamento = await prisma.pagamento.findUniqueOrThrow({
          where: { id: pagamento.id },
        });

        return res.json({
          status: "PENDENTE",
          pagamento,
          pix: { copiaECola: qr_code, qrCodeUrl },
          message:
            isEvento(planoNorm)
              ? "Pagamento PIX criado. Sua inscrição será confirmada após a aprovação do pagamento."
              : "Pagamento PIX criado. A assinatura será liberada após confirmação do pagamento.",
        });
      } catch (err: unknown) {
        try {
          await registrarFalhaExternaCheckout(
            operacaoCheckout?.id,
            err
          );
        } catch (erroRegistro) {
          console.error(
            "[billing] Falha crítica ao persistir PIX individual inconclusivo:",
            {
              pagamentoId: pagamento.id,
              operacaoId: operacaoCheckout?.id,
              erroRegistro,
            }
          );
        }

        return responderCheckoutExternoInconclusivo(
          res,
          pagamento.id,
          "PIX_INDIVIDUAL",
          err
        );
      }
    }

    const retornoSeguro =
      normalizarReturnToPagamento(
        returnTo
      );

    const retornoEncoded =
      encodeURIComponent(
        retornoSeguro
      );

    const pagamentoIdEncoded =
      encodeURIComponent(
        pagamento.id
      );

    const retornoPagamentoBase =
      `${FRONTEND_URL}/pagamentos`;

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
        back_urls: {
        success:
          `${retornoPagamentoBase}` +
          `?mpReturn=approved` +
          `&pagamentoId=${pagamentoIdEncoded}` +
          `&returnTo=${retornoEncoded}`,

        pending:
          `${retornoPagamentoBase}` +
          `?mpReturn=pending` +
          `&pagamentoId=${pagamentoIdEncoded}` +
          `&returnTo=${retornoEncoded}`,

        failure:
          `${retornoPagamentoBase}` +
          `?mpReturn=failure` +
          `&pagamentoId=${pagamentoIdEncoded}` +
          `&returnTo=${retornoEncoded}`,
      },

      auto_return:
        "approved",
      });

      const prefBody: any = mpPrefResp?.body || mpPrefResp;

      if (!operacaoCheckout) {
        throw new Error(
          "BILLING_CHECKOUT_OPERATION_MISSING"
        );
      }

      await confirmarPreferenciaCheckout({
        operacaoId: operacaoCheckout.id,
        preferenciaId: String(prefBody.id ?? ""),
      });

      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl: prefBody.init_point,
        sandboxCheckoutUrl: prefBody.sandbox_init_point,
        message: "Redirecione o usuário para o checkout do Mercado Pago.",
      });
    } catch (err: unknown) {
      try {
        await registrarFalhaExternaCheckout(
          operacaoCheckout?.id,
          err
        );
      } catch (erroRegistro) {
        console.error(
          "[billing] Falha crítica ao persistir preferência individual inconclusiva:",
          {
            pagamentoId: pagamento.id,
            operacaoId: operacaoCheckout?.id,
            erroRegistro,
          }
        );
      }

      return responderCheckoutExternoInconclusivo(
        res,
        pagamento.id,
        "PREFERENCIA_INDIVIDUAL",
        err
      );
    }
  } catch (err: any) {
    const erroCodigo =
      err instanceof Error ? err.message : "";

    if (err instanceof CupomAniversarioError) {
      return res.status(
        err.code === "BIRTHDAY_COUPON_ALREADY_USED" ? 409 : 403
      ).json({
        code: err.code,
        message: err.message,
      });
    }

    if (err instanceof ErroCheckoutOperacao) {
      return res.status(409).json({
        code: err.codigo,
        message:
          "A chave desta operação já foi utilizada ou está em conflito. Verifique a compra anterior.",
      });
    }

    if (
      [
        "BILLING_COUPON_NOT_AVAILABLE",
        "BILLING_COUPON_ALREADY_REDEEMED",
        "BILLING_COUPON_ALREADY_RESERVED",
        "BILLING_COUPON_CAPACITY_EXHAUSTED",
      ].includes(erroCodigo)
    ) {
      return res.status(409).json({
        code: erroCodigo,
        message:
          "Este cupom não está disponível para um novo pagamento.",
      });
    }
    if (err?.name === "ZodError") {
      return res.status(400).json({ message: "Dados inválidos.", details: err.errors });
    }

    if (err?.code === "TRIAL_ACTIVE") {
      return res.status(403).json({
        code: "TRIAL_ACTIVE",
        message: "Trial ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.",
        ...(err.payload || {}),
      });
    }

    return sendError(res, err, "Erro ao iniciar checkout");
  }
}

export async function startCheckoutBundle(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    const contextoPagamento =
      getContextoPagamentoData(req);

    if (!contextoPagamento) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para iniciar o pagamento.",
      });
    }
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }

    const {
      items,
      metodo,
      cupom,
      pagador,
      returnTo,
      chaveCliente,
    } = req.body as StartBundleBody;

    if (
      chaveCliente !== undefined &&
      !z.string().uuid().safeParse(chaveCliente).success
    ) {
      return res.status(400).json({
        code: "CHECKOUT_KEY_INVALID",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Informe items do carrinho." });
    }

    const normalizedItems =
      items.map((it) => ({
        planoId:
          normalizePlanoId(
            it.planoId
          ),

        periodicidade:
          it.periodicidade,
      }));

    const keys = normalizedItems.map(
      (item) => item.planoId
    );

    if (new Set(keys).size !== keys.length) {
      return res.status(400).json({
        code: "BUNDLE_DUPLICATE_ITEMS",
        message:
          "Um mesmo produto não pode aparecer duas vezes no pacote.",
      });
    }

    if (
      normalizedItems.some(
        (item) =>
          isEvento(
            item.planoId
          )
      )
    ) {
      return res.status(400).json({
        code:
          "EVENT_BUNDLE_NOT_ALLOWED",

        message:
          "Inscrições de eventos devem ser pagas individualmente.",
      });
    }

    const activeContext =
      getBillingActiveContext(req);

    if (!activeContext) {
      return res
        .status(403)
        .json({
          code:
            "ACTIVE_CONTEXT_REQUIRED",

          message:
            "Selecione um perfil ativo para continuar.",
        });
    }

    const { metodoPreferido } = await guardTrialRule(usuarioId, activeContext);

    const metodoFinal = (metodo || metodoPreferido) as MetodoPagamento;
    if (!metodoFinal) return res.status(400).json({ message: "Escolha um método de pagamento" });

    try {
      validateMetodoAndFields(metodoFinal, pagador);
    } catch (e: any) {
      return res.status(400).json({ message: e.message || "Campos inválidos" });
    }

    let totalBase = 0;
    const itemsFinanceiros: BillingItemFinanceiro[] = [];

    for (const it of normalizedItems) {
      assertPlanoPermitido(tipo, it.planoId);

      if (isAulaAoVivo(it.planoId)) {
        await assertAulaAoVivoDisponivelParaCompra(it.planoId);
      }

      if (
        !isMetodologiaAvulsa(it.planoId) &&
        !isMetodologiaLearning(it.planoId) &&
        !isAulaAoVivo(it.planoId) &&
        !isEvento(it.planoId)
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

      const valorItem = await priceFor(
        it.planoId,
        it.periodicidade
      );

      const centavos = billingCentavos(valorItem);

      totalBase += centavos / 100;

      itemsFinanceiros.push({
        planoId: it.planoId,
        periodicidade: it.periodicidade,
        valorBaseCentavos: centavos,
        valorFinalCentavos: centavos,
      });
    }

    const baseCentavos = itemsFinanceiros.reduce(
      (soma, item) => soma + item.valorBaseCentavos,
      0
    );

    let cupomRow: Awaited<
      ReturnType<typeof prisma.cupom.findUnique>
    > = null;

    let descontoCentavos = 0;

    if (cupom) {
      const codigo = String(cupom).trim();

      if (codigo.toUpperCase().startsWith("ANIVERSARIO_")) {
        return res.status(403).json({
          code: "BIRTHDAY_COUPON_PUBLIC_CODE_REQUIRED",
          message: "Utilize o código público 20PARABENS.",
        });
      }

      const cupomAniversario =
        await obterCupomAniversario(
          usuarioId,
          codigo
        );

      cupomRow =
        cupomAniversario ??
        await prisma.cupom.findUnique({
          where: { codigo: codigo.toUpperCase() },
        });

      if (!cupomRow || !cupomRow.ativo) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_INVALID",
          message: "Cupom inválido.",
        });
      }

      if (
        cupomRow.expiraEm &&
        cupomRow.expiraEm <= new Date()
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_EXPIRED",
          message: "Cupom expirado.",
        });
      }

      if (
        cupomRow.usosMax != null &&
        cupomRow.usosAtuais >= cupomRow.usosMax
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_EXHAUSTED",
          message: "Cupom esgotado.",
        });
      }

      // Nesta primeira etapa, somente cupons
      // válidos para o pacote inteiro.
      if (
        cupomRow.plano ||
        cupomRow.periodicidade ||
        (
          cupomRow.concedidoParaUsuarioId !== null &&
          !(
            ehCupomAniversario(cupomRow) &&
            cupomRow.concedidoParaUsuarioId === usuarioId &&
            codigo.toUpperCase() === "20PARABENS"
          )
        ) ||
        !["PERCENTUAL", "VALOR"].includes(cupomRow.tipo)
      ) {
        return res.status(400).json({
          code: "BUNDLE_COUPON_NOT_ELIGIBLE",
          message:
            "Este cupom não é válido para compras em pacote.",
        });
      }

      // O schema atual permite somente um
      // resgate por usuário e cupom.
      const resgateExistente =
        await prisma.cupomResgate.findUnique({
          where: {
            cupomId_usuarioId: {
              cupomId: cupomRow.id,
              usuarioId,
            },
          },
        });

      if (resgateExistente) {
        return res.status(409).json({
          code: "BUNDLE_COUPON_ALREADY_USED",
          message: "Este cupom já foi utilizado.",
        });
      }

      if (cupomRow.tipo === "PERCENTUAL") {
        const percentual = cupomRow.descontoPerc;

        if (
          percentual == null ||
          !Number.isInteger(percentual) ||
          percentual < 0 ||
          percentual > 100
        ) {
          throw new Error("BILLING_INVALID_COUPON_PERCENT");
        }

        descontoCentavos = Math.round(
          (baseCentavos * percentual) / 100
        );
      } else {
        if (cupomRow.descontoFixo == null) {
          throw new Error("BILLING_INVALID_COUPON_VALUE");
        }

        descontoCentavos = billingCentavos(
          Number(cupomRow.descontoFixo)
        );
      }

      descontoCentavos = Math.min(
        baseCentavos,
        descontoCentavos
      );

      // Cupom que zera a compra será tratado
      // em uma etapa específica.
      if (descontoCentavos >= baseCentavos) {
        return res.status(400).json({
          code: "BUNDLE_FULL_DISCOUNT_NOT_SUPPORTED",
          message:
            "Cupons que zeram o valor do pacote ainda não são aceitos.",
        });
      }
    }

    const itemsRateados = ratearDescontoBundle(
      itemsFinanceiros,
      descontoCentavos
    );

    const totalCentavos = itemsRateados.reduce(
      (soma, item) => soma + item.valorFinalCentavos,
      0
    );

    const total = totalCentavos / 100;

    const totalDecimal = new Prisma.Decimal(
      total.toFixed(2)
    );

    const financeiroV1: BillingFinanceiroV1 = {
      versao: 1,
      totalCentavos,
      items: itemsRateados,
    };

    const provider =
      HAS_MERCADO_PAGO
        ? "MERCADOPAGO"
        : "INTERNAL_FAKE";

    const pagamentoData: Prisma.PagamentoUncheckedCreateInput = {
      usuarioId,
      ...contextoPagamento,

      plano: "BUNDLE",
      periodicidade: "Mensal",
      metodo: metodoFinal,
      valor: totalDecimal,
      moeda: "BRL",

      provider,
      providerRef: null,

      cupomId: cupomRow?.id ?? null,

      status: PagamentoStatus.PENDENTE,
      pagoEm: null,

      meta: {
        bundleItems: normalizedItems,
        financeiroV1,
      } as Prisma.InputJsonValue,
    };

    let pagamento;
    let operacaoCheckout:
      Awaited<
        ReturnType<typeof prepararCheckoutAtomico>
      >["operacao"] | null = null;

    if (HAS_MERCADO_PAGO && totalCentavos > 0) {
      if (!chaveCliente) {
        return res.status(400).json({
          code: "BILLING_CHECKOUT_KEY_REQUIRED",
          message: "Chave da operação obrigatória.",
        });
      }

      const resultado = await prepararCheckoutAtomico({
        usuarioId,
        chaveCliente,

        modalidade:
          metodoFinal === "PIX"
            ? "PIX_BUNDLE"
            : "PREFERENCIA_BUNDLE",

        fingerprintRequisicao: fingerprintCheckout({
          usuarioId,
          contexto: contextoPagamento,
          items: financeiroV1.items,
          metodo: metodoFinal,
          cupomId: cupomRow?.id ?? null,
          totalCentavos,
          moeda: "BRL",
        }),

        criarPagamento: (tx) =>
          cupomRow && exigeReservaCupom(cupomRow, usuarioId)
            ? criarPagamentoComReservaQa({
                usuarioId,
                cupomId: cupomRow.id,
                data: pagamentoData,
                tx,
              })
            : tx.pagamento.create({
                data: pagamentoData,
              }),
      });

      pagamento = resultado.pagamento;
      operacaoCheckout = resultado.operacao;

      if (resultado.reutilizada) {
        return res.status(409).json({
          code: "BILLING_CHECKOUT_OPERATION_EXISTS",
          pagamentoId: pagamento.id,
          operacaoStatus: operacaoCheckout.status,
          message:
            "Esta compra já possui uma operação. Consulte o andamento.",
        });
      }
    } else {
      pagamento =
        cupomRow && exigeReservaCupom(cupomRow, usuarioId)
          ? await criarPagamentoComReservaQa({
              usuarioId,
              cupomId: cupomRow.id,
              data: pagamentoData,
            })
          : await prisma.pagamento.create({
              data: pagamentoData,
            });
    }

    if (total === 0) {
      pagamento =
        await approvePaymentAndProvision(
          pagamento.id,
          normalizedItems
        );

      return res.json({
        status:
          "APROVADO",

        pagamento,

        assinaturas:
          normalizedItems,

        message:
          "Assinaturas ativadas sem cobrança (cupom/presente).",
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

    if (
  metodoFinal === "PIX" &&
  !operacaoCheckout?.chaveOperacao
) {
  return res.status(503).json({
    code: "BILLING_CHECKOUT_OPERATION_KEY_MISSING",
    message: "Chave da operação não disponível.",
  });
}

    const aquisicaoCheckoutBundle =
      await adquirirOperacaoAntesDoEnvio(
        operacaoCheckout?.id,
        pagamento.id
      );

    if (!aquisicaoCheckoutBundle.adquirida) {
      return res.status(
        aquisicaoCheckoutBundle.statusHttp
      ).json({
        code: aquisicaoCheckoutBundle.code,
        pagamentoId: pagamento.id,
        message:
          "Este checkout já possui uma tentativa externa. Consulte seu andamento antes de tentar novamente.",
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
        },
        {
          idempotency: operacaoCheckout!.chaveOperacao,
        });

        const mpBody: any = mpResp?.body || mpResp;
        const qr_code = mpBody.point_of_interaction?.transaction_data?.qr_code ?? null;
        const qr_code_base64 = mpBody.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

        const qrCodeUrl =
          typeof qr_code_base64 === "string"
            ? `data:image/png;base64,${qr_code_base64}`
            : null;

        const mpPaymentId = String(mpBody.id ?? "");

        if (!/^\d+$/.test(mpPaymentId)) {
          throw new Error(
            "BILLING_MP_PAYMENT_ID_INVALID"
          );
        }

        if (!operacaoCheckout) {
          throw new Error(
            "BILLING_CHECKOUT_OPERATION_MISSING"
          );
        }

        await confirmarCheckoutExterno({
          operacaoId: operacaoCheckout.id,
          providerRef: mpPaymentId,
          pixCopiaECola:
            typeof qr_code === "string"
              ? qr_code
              : null,
        });

        pagamento = await prisma.pagamento.findUniqueOrThrow({
          where: { id: pagamento.id },
        });

        return res.json({
          status: "PENDENTE",
          pagamento,
          pix: { copiaECola: qr_code, qrCodeUrl },
          message: "Pagamento PIX bundle criado. Assinaturas serão liberadas após aprovação.",
        });
      } catch (err: unknown) {
        try {
          await registrarFalhaExternaCheckout(
            operacaoCheckout?.id,
            err
          );
        } catch (erroRegistro) {
          console.error(
            "[billing] Falha crítica ao persistir PIX bundle inconclusivo:",
            {
              pagamentoId: pagamento.id,
              operacaoId: operacaoCheckout?.id,
              erroRegistro,
            }
          );
        }

        return responderCheckoutExternoInconclusivo(
          res,
          pagamento.id,
          "PIX_BUNDLE",
          err
        );
      }
    }

    try {
      const retornoSeguro =
        normalizarReturnToPagamento(
          returnTo
        );

      const retornoEncoded =
        encodeURIComponent(
          retornoSeguro
        );

      const pagamentoIdEncoded =
        encodeURIComponent(
          pagamento.id
        );

      const retornoPagamentoBase =
        `${FRONTEND_URL}/pagamentos`;

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
        back_urls: {
          success:
            `${retornoPagamentoBase}` +
            `?mpReturn=approved` +
            `&pagamentoId=${pagamentoIdEncoded}` +
            `&returnTo=${retornoEncoded}`,

          pending:
            `${retornoPagamentoBase}` +
            `?mpReturn=pending` +
            `&pagamentoId=${pagamentoIdEncoded}` +
            `&returnTo=${retornoEncoded}`,

          failure:
            `${retornoPagamentoBase}` +
            `?mpReturn=failure` +
            `&pagamentoId=${pagamentoIdEncoded}` +
            `&returnTo=${retornoEncoded}`,
        },

        auto_return:
          "approved",
      });

      const prefBody: any = mpPrefResp?.body || mpPrefResp;

      if (!operacaoCheckout) {
        throw new Error(
          "BILLING_CHECKOUT_OPERATION_MISSING"
        );
      }

      await confirmarPreferenciaCheckout({
        operacaoId: operacaoCheckout.id,
        preferenciaId: String(prefBody.id ?? ""),
      });

      return res.json({
        status: "PENDENTE",
        pagamento,
        checkoutUrl: prefBody.init_point,
        sandboxCheckoutUrl: prefBody.sandbox_init_point,
        message: "Redirecione o usuário para o checkout do Mercado Pago.",
      });
    } catch (err: unknown) {
      try {
        await registrarFalhaExternaCheckout(
          operacaoCheckout?.id,
          err
        );
      } catch (erroRegistro) {
        console.error(
          "[billing] Falha crítica ao persistir preferência bundle inconclusiva:",
          {
            pagamentoId: pagamento.id,
            operacaoId: operacaoCheckout?.id,
            erroRegistro,
          }
        );
      }

      return responderCheckoutExternoInconclusivo(
        res,
        pagamento.id,
        "PREFERENCIA_BUNDLE",
        err
      );
    }
  } catch (err: any) {
    const erroCodigo =
      err instanceof Error ? err.message : "";

    if (err instanceof CupomAniversarioError) {
      return res.status(
        err.code === "BIRTHDAY_COUPON_ALREADY_USED" ? 409 : 403
      ).json({
        code: err.code,
        message: err.message,
      });
    }

    if (err instanceof ErroCheckoutOperacao) {
      return res.status(409).json({
        code: err.codigo,
        message:
          "A chave desta operação já foi utilizada ou está em conflito. Verifique a compra anterior.",
      });
    }

    if (
      [
        "BILLING_COUPON_NOT_AVAILABLE",
        "BILLING_COUPON_ALREADY_REDEEMED",
        "BILLING_COUPON_ALREADY_RESERVED",
        "BILLING_COUPON_CAPACITY_EXHAUSTED",
      ].includes(erroCodigo)
    ) {
      return res.status(409).json({
        code: erroCodigo,
        message:
          "Este cupom não está disponível para um novo pagamento.",
      });
    }

    if (err?.code === "TRIAL_ACTIVE") {
      return res.status(403).json({
        code: "TRIAL_ACTIVE",
        message: "Trial ativo. Você poderá escolher a forma de pagamento quando faltarem 7 dias para terminar.",
        ...(err.payload || {}),
      });
    }
    return sendError(res, err, "Erro ao iniciar checkout bundle");
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  try {
    const usuarioId = getUserId(req);
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const activeContext =
      getBillingActiveContext(req);

    const contextoAssinatura =
      getContextoAssinaturaData(
        activeContext
      );

    if (
      !activeContext ||
      !contextoAssinatura
    ) {
      return res
        .status(403)
        .json({
          code:
            "ACTIVE_CONTEXT_REQUIRED",

          message:
            "Selecione um perfil ativo para cancelar a assinatura.",
        });
    }

    const { planoId } = req.body as { planoId?: string | null };
    const now = new Date();

    if (planoId) {
      const plano = normalizePlanoId(planoId);
      await (prisma as any)
      .assinatura
      .updateMany({
        where: {
          usuarioId,

          contextoKey:
            contextoAssinatura
              .contextoKey,

          plano,

          ativo:
            true,
        },

        data: {
          ativo:
            false,

          canceledAt:
            now,

          status:
            "CANCELADA",

          bloqueadoEm:
            null,
        } as any,
      });
      return res.json({ ok: true, message: "Assinatura cancelada." });
    }

    await (prisma as any).assinatura.updateMany({
      where: {
        usuarioId,

        contextoKey:
          contextoAssinatura
            .contextoKey,

        ativo: true,
      },

      data: {
        ativo: false,

        canceledAt:
          now,

        status:
          "CANCELADA",

        bloqueadoEm:
          null,
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

function isProviderWebhookAuthorized(req: Request): boolean {
  const expected = process.env.BILLING_WEBHOOK_SECRET || "";
  if (!expected) return false;

  const received = String(req.headers["x-webhook-secret"] || "");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  if (expectedBuf.length !== receivedBuf.length) return false;

  return timingSafeEqual(expectedBuf, receivedBuf);
}

const WEBHOOK_LEASE_MS = 5 * 60 * 1000;

async function cancelarPagamentoPendenteComReserva(
  pagamentoId: string,
  provider: string
) {
  return prisma.$transaction(
    async (tx) => {
      const pagamento = await tx.pagamento.findUnique({
        where: {
          id: pagamentoId,
        },
      });

      if (!pagamento) {
        throw new Error("BILLING_PAYMENT_NOT_FOUND");
      }

      if (pagamento.provider !== provider) {
        throw new Error(
          "BILLING_PAYMENT_PROVIDER_MISMATCH"
        );
      }

      // Cancelamento repetido é idempotente.
      if (pagamento.status === PagamentoStatus.CANCELADO) {
        return {
          pagamentoId,
          idempotent: true,
        };
      }

      // Não cancelar pagamentos aprovados ou reembolsados
      // por meio do fluxo de cancelamento de pendentes.
      if (pagamento.status !== PagamentoStatus.PENDENTE) {
        throw new Error(
          "BILLING_CANCELLATION_REQUIRES_RECONCILIATION"
        );
      }

      const agora = new Date();

      // Disputa atomicamente o pagamento com a aprovação.
      const alteracao = await tx.pagamento.updateMany({
        where: {
          id: pagamentoId,
          provider,
          status: PagamentoStatus.PENDENTE,
        },
        data: {
          status: PagamentoStatus.CANCELADO,
          canceladoEm: agora,
        },
      });

      if (alteracao.count !== 1) {
        throw new Error(
          "BILLING_CANCELLATION_CONFLICT"
        );
      }

      const reserva = await tx.cupomReserva.findUnique({
        where: {
          pagamentoId,
        },
      });

      if (reserva) {
        if (
          reserva.usuarioId !== pagamento.usuarioId ||
          reserva.cupomId !== pagamento.cupomId ||
          ![
            "RESERVADA",
            "CONCILIACAO_PENDENTE",
          ].includes(reserva.status)
        ) {
          throw new Error(
            "BILLING_COUPON_RESERVATION_MISMATCH"
          );
        }

        const liberacao = await tx.cupomReserva.updateMany({
          where: {
            id: reserva.id,
            status: {
              in: [
                "RESERVADA",
                "CONCILIACAO_PENDENTE",
              ],
            },
          },
          data: {
            status: "LIBERADA",
            liberadaEm: agora,
          },
        });

        if (liberacao.count !== 1) {
          throw new Error(
            "BILLING_COUPON_RELEASE_CONFLICT"
          );
        }
      }

      return {
        pagamentoId,
        idempotent: false,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

async function executarEventoPagamento<T>(
  providerEventId: string,
  tipo: string,
  processar: () => Promise<T>
): Promise<{
  resultado?: T;
  repetido: boolean;
}> {
  const chave = providerEventId.trim();

  if (!chave) {
    throw new Error("BILLING_EVENT_ID_REQUIRED");
  }

  // Reserva a identidade do evento.
  // Em entregas simultâneas, outra requisição pode
  // ter criado o registro primeiro.
  let evento = await prisma.eventoPagamento.findUnique({
    where: {
      providerEventId: chave,
    },
  });

  if (!evento) {
    try {
      evento = await prisma.eventoPagamento.create({
        data: {
          providerEventId: chave,
          tipo,
          status: EventoPagamentoStatus.RECEBIDO,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // O evento foi criado pela outra requisição.
        evento = await prisma.eventoPagamento.findUnique({
          where: {
            providerEventId: chave,
          },
        });

        if (!evento) {
          throw new Error(
            "BILLING_EVENT_CONCURRENT_CREATE_NOT_FOUND"
          );
        }
      } else {
        throw error;
      }
    }
  }

  if (evento.tipo !== tipo) {
    throw new Error("BILLING_EVENT_TYPE_CONFLICT");
  }

  if (evento.status === "CONCLUIDO") {
    return { repetido: true };
  }

  const agora = new Date();
  const limiteLease = new Date(
    agora.getTime() - WEBHOOK_LEASE_MS
  );

  // Somente um processo pode adquirir o evento.
  const adquirido = await prisma.eventoPagamento.updateMany({
    where: {
      id: evento.id,
      OR: [
        { status: "RECEBIDO" },
        { status: "FALHOU" },
        {
          status: "PROCESSANDO",
          processandoEm: { lt: limiteLease },
        },
      ],
    },
    data: {
      status: "PROCESSANDO",
      processandoEm: agora,
      tentativas: { increment: 1 },
      ultimoErro: null,
    },
  });

  if (adquirido.count !== 1) {
    throw new Error("BILLING_EVENT_ALREADY_PROCESSING");
  }

  try {
    const resultado = await processar();

    const finalizado =
      await prisma.eventoPagamento.updateMany({
        where: {
          id: evento.id,
          status: EventoPagamentoStatus.PROCESSANDO,
          processandoEm: agora,
        },
        data: {
          status: EventoPagamentoStatus.CONCLUIDO,
          concluidoEm: new Date(),
          processandoEm: null,
          ultimoErro: null,
        },
      });

    if (finalizado.count !== 1) {
      throw new Error(
        "BILLING_EVENT_LEASE_LOST"
      );
    }

    return {
      resultado,
      repetido: false,
    };
  } catch (error) {
    await prisma.eventoPagamento.updateMany({
      where: {
        id: evento.id,
        status: "PROCESSANDO",
        processandoEm: agora,
      },
      data: {
        status: "FALHOU",
        ultimoErro: (
          error instanceof Error
            ? error.message
            : String(error)
        ).slice(0, 1000),
        processandoEm: null,
      },
    });

    throw error;
  }
}

async function auditarReembolsoPagamento(
  pagamentoId: string
) {
  const pagamento = await prisma.pagamento.findUnique({
    where: { id: pagamentoId },
    select: {
      id: true,
      usuarioId: true,
      status: true,
      plano: true,
      valor: true,
      provider: true,
      cupomId: true,
    },
  });

  if (!pagamento) {
    throw new Error("BILLING_PAYMENT_NOT_FOUND");
  }

  const [beneficios, vendas] = await Promise.all([
    prisma.pagamentoBeneficio.findMany({
      where: { pagamentoId },
      select: {
        id: true,
        tipo: true,
        recursoId: true,
        itemKey: true,
        revogadoEm: true,
      },
    }),
    prisma.creatorVenda.findMany({
      where: { pagamentoId },
      select: {
        id: true,
        creatorId: true,
        status: true,
        valorBruto: true,
        valorFootera: true,
        valorCreator: true,
      },
    }),
  ]);

  return {
    pagamentoId: pagamento.id,
    status: pagamento.status,
    plano: pagamento.plano,
    provider: pagamento.provider,
    possuiCupom: Boolean(pagamento.cupomId),
    beneficios: beneficios.length,
    vendas: vendas.length,
    tiposBeneficios: [
      ...new Set(beneficios.map((b) => b.tipo)),
    ],
    possuiBeneficiosRegistrados: beneficios.length > 0,
    possuiVendasCreator: vendas.length > 0,

    beneficiosJaRevogados: beneficios.filter(
      (beneficio) => beneficio.revogadoEm !== null
    ).length,

    vendasConfirmadas: vendas.filter(
      (venda) => venda.status === "CONFIRMADA"
    ).length,

    vendasReembolsadas: vendas.filter(
      (venda) => venda.status === "REEMBOLSADA"
    ).length,

    exigeConciliacao: true,
  };
}

export async function providerWebhook(
  req: Request,
  res: Response
) {
  try {
    if (!isProviderWebhookAuthorized(req)) {
      return res.status(401).json({
        message: "Não autorizado",
      });
    }

    const {
      provider,
      providerEventId,
      tipo,
      data,
    } = req.body ?? {};

    if (
      typeof provider !== "string" ||
      !provider.trim() ||
      typeof providerEventId !== "string" ||
      !providerEventId.trim() ||
      typeof tipo !== "string"
    ) {
      return res.status(400).json({
        code: "INVALID_BILLING_EVENT",
        message: "Evento de pagamento inválido.",
      });
    }

    const tiposPermitidos = [
      "payment_approved",
      "payment_canceled",
      "payment_refunded",
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({
        code: "UNSUPPORTED_BILLING_EVENT",
        message: "Tipo de evento não suportado.",
      });
    }

    // Mantém a chave legada para não perder a
    // identificação de eventos já registrados.
    const resultado = await executarEventoPagamento(
      providerEventId,
      tipo,
      async () => {

    const pagamentoId =
      data?.pagamentoId != null
        ? String(data.pagamentoId).trim()
        : null;

    const providerRef =
      data?.providerRef != null
        ? String(data.providerRef).trim()
        : null;

    if (!pagamentoId && !providerRef) {
      throw new Error(
        "BILLING_PAYMENT_REFERENCE_REQUIRED"
      );
    }

    const pagamentoPorId = pagamentoId
      ? await prisma.pagamento.findUnique({
          where: { id: pagamentoId },
        })
      : null;

    const pagamentoPorReferencia = providerRef
      ? await prisma.pagamento.findUnique({
          where: {
            provider_providerRef: {
              provider,
              providerRef,
            },
          },
        })
      : null;

    if (
      pagamentoId &&
      providerRef &&
      (
        !pagamentoPorId ||
        !pagamentoPorReferencia ||
        pagamentoPorId.id !== pagamentoPorReferencia.id
      )
    ) {
      throw new Error(
        "BILLING_PAYMENT_IDENTITY_CONFLICT"
      );
    }

    const pagamento =
      pagamentoPorId ?? pagamentoPorReferencia;


        if (!pagamento) {
          throw new Error(
            "BILLING_PAYMENT_NOT_FOUND"
          );
        }

        if (
          pagamento.provider !== provider ||
          pagamento.provider === "MERCADOPAGO"
        ) {
          throw new Error(
            "BILLING_PAYMENT_PROVIDER_MISMATCH"
          );
        }

        if (tipo === "payment_approved") {
          if (pagamento.plano === "BUNDLE") {
            const meta =
              (pagamento.meta ?? {}) as any;

            const bundleItems =
              Array.isArray(meta.bundleItems)
                ? meta.bundleItems
                : [];

            if (bundleItems.length === 0) {
              throw new Error(
                "BILLING_BUNDLE_WITHOUT_ITEMS"
              );
            }

            const items = bundleItems.map(
              (item: any) => ({
                planoId: normalizePlanoId(
                  item.planoId
                ),
                periodicidade:
                  item.periodicidade as Periodicidade,
              })
            );

            await approvePaymentAndProvision(
              pagamento.id,
              items
            );
          } else {
            await approvePaymentAndProvision(
              pagamento.id,
              [
                {
                  planoId: pagamento.plano,
                  periodicidade:
                    pagamento.periodicidade,
                },
              ]
            );
          }

          return { pagamentoId: pagamento.id };
        }

        if (tipo === "payment_canceled") {
          // Somente no QA, usando o provedor simulado.
          // O evento representa um cancelamento definitivo
          // confirmado pelo próprio teste.
          if (
            !BILLING_CUPOM_RESERVA_QA ||
            provider !== "INTERNAL_FAKE"
          ) {
            throw new Error(
              "BILLING_REVERSAL_REQUIRES_RECONCILIATION"
            );
          }

          const cancelamento =
            await cancelarPagamentoPendenteComReserva(
              pagamento.id,
              provider
            );

          return cancelamento;
        }

        if (tipo === "payment_refunded") {
          if (
            BILLING_CUPOM_RESERVA_QA &&
            provider === "INTERNAL_FAKE"
          ) {
            const auditoria =
              await auditarReembolsoPagamento(pagamento.id);

            console.log(
              "[billing][QA] Auditoria de reembolso:",
              auditoria
            );

            return reembolsarMetodologiaAvulsaQa(
              pagamento.id
            );
          }

          throw new Error(
            "BILLING_REVERSAL_REQUIRES_RECONCILIATION"
          );
        }

        throw new Error(
          "UNSUPPORTED_BILLING_EVENT"
        );
      }
    );

    return res.status(200).json({
      ok: true,
      idempotent: resultado.repetido,
    });
  } catch (error) {
    console.error(
      "[providerWebhook]",
      error
    );

    const mensagem =
      error instanceof Error
        ? error.message
        : "BILLING_WEBHOOK_ERROR";

    if (
      mensagem === "BILLING_EVENT_ALREADY_PROCESSING" ||
      mensagem === "BILLING_EVENT_LEASE_LOST"
    ) {
      return res.status(503).json({
        code: mensagem,
        message:
          "Evento em processamento. Uma nova tentativa será necessária.",
      });
    }

    if (
      mensagem === "BILLING_REVERSAL_REQUIRES_RECONCILIATION" ||
      mensagem === "BILLING_CANCELLATION_REQUIRES_RECONCILIATION" ||
      mensagem === "BILLING_CANCELLATION_CONFLICT" ||
      mensagem === "BILLING_LATE_APPROVAL_REQUIRES_RECONCILIATION" ||
      mensagem === "BILLING_REFUND_QA_DISABLED" ||
      mensagem === "BILLING_REFUND_QA_PROVIDER_MISMATCH" ||
      mensagem === "BILLING_REFUND_FINANCIAL_MISMATCH" ||
      mensagem === "BILLING_REFUND_ACCESS_STATUS_UNEXPECTED" ||
      mensagem === "BILLING_REFUND_REQUIRES_RECONCILIATION" ||
      mensagem === "BILLING_REFUND_REQUIRES_APPROVED_PAYMENT" ||
      mensagem === "BILLING_REFUND_BENEFIT_MISMATCH" ||
      mensagem === "BILLING_REFUND_ACCESS_NOT_FOUND" ||
      mensagem === "BILLING_REFUND_ACCESS_ORIGIN_UNCERTAIN" ||
      mensagem === "BILLING_REFUND_BENEFIT_CONFLICT" ||
      mensagem === "BILLING_REFUND_SALES_CONFLICT" ||
      mensagem === "BILLING_REFUND_BUNDLE_SNAPSHOT_INVALID" ||
      mensagem === "BILLING_REFUND_ACCESS_CONFLICT" ||
      mensagem === "BILLING_REFUND_PAYMENT_CONFLICT"
    ) {
      return res.status(503).json({
        code: mensagem,
        message:
          "Reversão financeira aguardando conciliação.",
      });
    }

    return res.status(500).json({
      code: "BILLING_WEBHOOK_FAILED",
      message: "Erro ao processar webhook.",
    });
  }
}

async function sincronizarCheckoutPixAprovado(
  pagamentoId: string,
  providerRef: string
): Promise<void> {
  const operacao =
    await prisma.billingCheckoutOperacao.findFirst({
      where: {
        pagamentoId,
        modalidade: {
          in: ["PIX_INDIVIDUAL", "PIX_BUNDLE"],
        },
      },
      select: {
        id: true,
        status: true,
        providerRef: true,
      },
    });

  // Pagamentos sem operação PIX, incluindo
  // cartão, preferências e registros legados,
  // não entram nessa sincronização.
  if (!operacao) {
    return;
  }

  if (!/^\d+$/.test(providerRef)) {
    throw new Error(
      "BILLING_CHECKOUT_PIX_PROVIDER_REF_INVALID"
    );
  }

  const pagamento =
    await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamentoId },
      select: {
        id: true,
        status: true,
        provider: true,
        providerRef: true,
        metodo: true,
      },
    });

  if (
    pagamento.status !== PagamentoStatus.APROVADO ||
    pagamento.provider !== "MERCADOPAGO" ||
    pagamento.providerRef !== providerRef ||
    pagamento.metodo !== "PIX"
  ) {
    throw new Error(
      "BILLING_CHECKOUT_PIX_PAYMENT_NOT_VERIFIED"
    );
  }

  if (operacao.status === "CONFIRMADA") {
    if (operacao.providerRef !== providerRef) {
      throw new Error(
        "BILLING_CHECKOUT_PIX_REFERENCE_CONFLICT"
      );
    }

    return;
  }

  if (
    operacao.status !== "INCONCLUSIVA" &&
    operacao.status !== "ENVIO_POSSIVEL"
  ) {
    throw new Error(
      "BILLING_CHECKOUT_PIX_STATE_REQUIRES_REVIEW"
    );
  }

  if (
    operacao.providerRef &&
    operacao.providerRef !== providerRef
  ) {
    throw new Error(
      "BILLING_CHECKOUT_PIX_REFERENCE_CONFLICT"
    );
  }

  await confirmarCheckoutExterno({
    operacaoId: operacao.id,
    providerRef,
  });
}

export async function mercadoPagoWebhook(req: Request, res: Response) {
  try {
    const tipoNotificacao = String(
      req.body?.type ?? req.query.type ?? ""
    ).trim().toLowerCase();

    if (tipoNotificacao !== "payment") {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "UNSUPPORTED_NOTIFICATION_TYPE",
      });
    }

    const paymentIdRaw =
      req.query["data.id"];

    if (
      typeof paymentIdRaw !== "string" ||
      !/^\d+$/.test(paymentIdRaw)
    ) {
      return res.status(400).json({
        ok: false,
        code: "MP_PAYMENT_ID_INVALID",
      });
    }

    const p = await obterPagamentoMercadoPago(
      paymentIdRaw,
      async (id) => {
        const resposta: any =
          await mercadopago.payment.get(id);

        return resposta?.body ?? resposta;
      }
    );

    if (
      !p ||
      typeof p !== "object" ||
      String(p.id ?? "") !== paymentIdRaw
    ) {
      return res.status(503).json({
        ok: false,
        code: "BILLING_MP_PAYMENT_ID_MISMATCH",
      });
    }

    const status: string = String(p.status ?? "");
    const mpId = String(p.id);
    const externalRef = p.external_reference as string | null;
    const meta = p.metadata || {};
    const idMetadataRaw =
      meta.pagamentoId ??
      meta.pagamento_id;

    const idMetadata =
      idMetadataRaw != null
        ? String(idMetadataRaw).trim()
        : null;

    const idExterno =
      externalRef != null
        ? String(externalRef).trim()
        : null;

    // Se o provedor informou duas identidades,
    // elas precisam corresponder ao mesmo pagamento.
    if (
      idMetadata &&
      idExterno &&
      idMetadata !== idExterno
    ) {
      throw new Error(
        "BILLING_PAYMENT_REFERENCE_CONFLICT"
      );
    }

    const idInterno = idMetadata || idExterno;

    const pagamentoPorId = idInterno
      ? await prisma.pagamento.findUnique({
          where: { id: idInterno },
        })
      : null;

    const pagamentoPorReferencia =
      await prisma.pagamento.findUnique({
        where: {
          provider_providerRef: {
            provider: "MERCADOPAGO",
            providerRef: mpId,
          },
        },
      });

    // Duas referências não podem identificar
    // pagamentos internos diferentes.
    if (
      pagamentoPorId &&
      pagamentoPorReferencia &&
      pagamentoPorId.id !== pagamentoPorReferencia.id
    ) {
      throw new Error(
        "BILLING_PAYMENT_IDENTITY_CONFLICT"
      );
    }

    const pagamento =
      pagamentoPorId ?? pagamentoPorReferencia;

    if (!pagamento) {
      console.warn(
        "[billing] Pagamento não localizado:",
        mpId
      );

      // Não confirmar um evento que ainda
      // precisa ser conciliado.
      return res.status(503).json({
        ok: false,
        code: "BILLING_PAYMENT_NOT_FOUND",
      });
    }

    if (pagamento.provider !== "MERCADOPAGO") {
      throw new Error(
        "BILLING_PAYMENT_PROVIDER_MISMATCH"
      );
    }

    const conciliacao =
      classificarConciliacaoMercadoPago(
        {
          id: pagamento.id,
          provider: pagamento.provider,
          providerRef: pagamento.providerRef,
          valor: pagamento.valor,
          moeda: pagamento.moeda,
          status: pagamento.status,
        },
        {
          id: p.id,
          status: p.status,
          status_detail: p.status_detail,
          transaction_amount: p.transaction_amount,
          currency_id: p.currency_id,
          external_reference: p.external_reference,
          metadata: p.metadata,
        }
      );

  if (
    status === "approved" &&
    pagamento.plano.startsWith("EVENTO:")
  ) {
    const pendenciaExistente =
      await prisma.billingPendenciaEvento.findUnique({
        where: {
          pagamentoId: pagamento.id,
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (pendenciaExistente) {
      console.warn(
        "[billing] Evento com pendência financeira: aprovação automática bloqueada.",
        {
          pagamentoId: pagamento.id,
          pendenciaId: pendenciaExistente.id,
          status: pendenciaExistente.status,
        }
      );

      return res.status(503).json({
        ok: false,
        code:
          "BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED",
        pagamentoId: pagamento.id,
      });
    }
  }

  if (
    conciliacao.acao === "CONCILIACAO_MANUAL"
  ) {
    console.error(
      "[billing][MP] Conciliacao manual:",
      conciliacao
    );

    return res.status(503).json({
      ok: false,
      code: "BILLING_MP_REQUIRES_RECONCILIATION",
      motivo: conciliacao.motivo,
    });
  }

  if (conciliacao.acao === "AGUARDAR") {
    return res.status(200).json({
      ok: true,
      conciliacaoPendente: true,
    });
  }

  if (conciliacao.acao === "JA_CONCILIADO") {
    if (pagamento.status === PagamentoStatus.APROVADO) {
      await sincronizarCheckoutPixAprovado(
        pagamento.id,
        mpId
      );
    }

    return res.status(200).json({
      ok: true,
      idempotent: true,
    });
  }

  if (
    conciliacao.acao === "APROVAR" &&
    status !== "approved"
  ) {
    throw new Error("BILLING_MP_STATE_CONFLICT");
  }

  if (
    conciliacao.acao === "CANCELAR_PENDENTE" &&
    status !== "cancelled" &&
    status !== "rejected"
  ) {
    throw new Error("BILLING_MP_STATE_CONFLICT");
  }
    if (
      conciliacao.acao === "APROVAR" &&
      pagamento.plano === "BUNDLE"
    ) {
      const dadosLocais =
        pagamento.meta &&
        typeof pagamento.meta === "object" &&
        !Array.isArray(pagamento.meta)
          ? pagamento.meta
          : null;

      const itensLocais = dadosLocais?.bundleItems;

      if (
        !Array.isArray(itensLocais) ||
        itensLocais.length < 2 ||
        itensLocais.some(
          (item: any) =>
            !item ||
            typeof item.planoId !== "string" ||
            !["Mensal", "Anual"].includes(
              item.periodicidade
            )
        )
      ) {
        return res.status(503).json({
          ok: false,
          code: "BILLING_MP_BUNDLE_SNAPSHOT_INVALID",
        });
      }
    }
    // A referência pode começar como uma
    // preferência de checkout e depois passar
    // a identificar o pagamento real.
    if (pagamento.providerRef !== mpId) {
      if (!pagamentoPorId) {
        throw new Error(
          "BILLING_PAYMENT_REFERENCE_UNVERIFIED"
        );
      }

      const alterado =
        await prisma.pagamento.updateMany({
          where: {
            id: pagamento.id,
            provider: "MERCADOPAGO",
            providerRef: pagamento.providerRef,
            status: PagamentoStatus.PENDENTE,
          },
          data: {
            providerRef: mpId,
          },
        });

      if (alterado.count !== 1) {
        const pagamentoAtual =
          await prisma.pagamento.findUnique({
            where: {
              id: pagamento.id,
            },
            select: {
              id: true,
              provider: true,
              providerRef: true,
              status: true,
            },
          });

        // A referência precisa continuar vinculada
        // ao mesmo pagamento interno.
        if (
          !pagamentoAtual ||
          pagamentoAtual.provider !== "MERCADOPAGO" ||
          pagamentoAtual.providerRef !== mpId
        ) {
          return res.status(503).json({
            ok: false,
            code: "BILLING_PAYMENT_REFERENCE_UPDATE_CONFLICT",
          });
        }

        /// Outro webhook concluiu a aprovação.
        // Recupera o estado do checkout PIX antes
        // de retornar, sem reprovisionar benefícios.
        if (
          pagamentoAtual.status === PagamentoStatus.APROVADO &&
          conciliacao.acao === "APROVAR"
        ) {
          await sincronizarCheckoutPixAprovado(
            pagamento.id,
            mpId
          );

          return res.status(200).json({
            ok: true,
            idempotent: true,
          });
        }
        // Outro webhook apenas atualizou providerRef,
        // mas o pagamento continua pendente.
        // Nesse caso, seguimos para a transação de
        // aprovação, que possui controle de concorrência.
        if (
          pagamentoAtual.status === PagamentoStatus.PENDENTE
        ) {
          // Nenhuma ação: continuar o fluxo abaixo.
        } else {
          // Cancelamento, falha ou outro estado
          // não podem ser tratados como aprovação.
          return res.status(503).json({
            ok: false,
            code: "BILLING_MP_CONCURRENT_STATE_CONFLICT",
          });
        }
      }
    }

    const now = new Date();

    if (
      status === "approved"
    ) {
      if (p.status_detail === "partially_refunded") {
        console.error(
          "[billing][MercadoPago] Reembolso parcial exige conciliação:",
          {
            pagamentoId: pagamento.id,
            providerRef: mpId,
          }
        );

        return res.status(503).json({
          ok: false,
          code: "BILLING_MP_PARTIAL_REFUND_REQUIRES_RECONCILIATION",
        });
      }
      if (
        pagamento.plano ===
        "BUNDLE"
      ) {
        const pagamentoMeta =
          (pagamento.meta || {}) as any;

        const bundleItemsRaw =
          Array.isArray(pagamentoMeta.bundleItems)
            ? pagamentoMeta.bundleItems
            : [];

        if (
          bundleItemsRaw.length ===
          0
        ) {
          throw new Error(
            "Pagamento bundle aprovado sem itens registrados."
          );
        }

        const items =
          bundleItemsRaw.map(
            (item: any) => ({
              planoId:
                normalizePlanoId(
                  item.planoId
                ),

              periodicidade:
                item.periodicidade as Periodicidade,
            })
          );

        await approvePaymentAndProvision(
          pagamento.id,
          items
        );

        await sincronizarCheckoutPixAprovado(
          pagamento.id,
          mpId
        );

        return res
          .status(200)
          .json({
            ok: true,
          });
      }

      await approvePaymentAndProvision(
        pagamento.id,
        [
          {
            planoId:
              pagamento.plano,

            periodicidade:
              pagamento.periodicidade,
          },
        ]
      );

      await sincronizarCheckoutPixAprovado(
        pagamento.id,
        mpId
      );

      return res
        .status(200)
        .json({
          ok: true,
        });
    }

    if (status === "cancelled" || status === "rejected") {
      // Neste ponto o status foi consultado diretamente
      // ao Mercado Pago, não confiado ao payload recebido.
      await cancelarPagamentoPendenteComReserva(
        pagamento.id,
        "MERCADOPAGO"
      );

      return res.status(200).json({
        ok: true,
      });
    }

    if (
      status === "refunded" ||
      status === "charged_back"
    ) {
      console.error(
        "[billing] Reembolso exige conciliação:",
        {
          pagamentoId: pagamento.id,
          statusMercadoPago: status,
        }
      );

      return res.status(503).json({
        ok: false,
        code: "BILLING_REFUND_REQUIRES_RECONCILIATION",
      });
    }

    const estadosEmAberto = [
      "pending",
      "in_process",
      "authorized",
      "in_mediation",
    ];

    if (estadosEmAberto.includes(status)) {
      console.warn(
        "[billing][MercadoPago] Pagamento aguardando conciliação:",
        {
          pagamentoId: pagamento.id,
          providerRef: mpId,
          status,
          statusDetail: p.status_detail ?? null,
        }
      );

      return res.status(200).json({
        ok: true,
        conciliacaoPendente: true,
      });
    }

    console.error(
      "[billing][MercadoPago] Status não reconhecido:",
      {
        pagamentoId: pagamento.id,
        providerRef: mpId,
        status,
      }
    );

    return res.status(503).json({
      ok: false,
      code: "BILLING_MP_STATUS_UNSUPPORTED",
    });

  } catch (err: any) {
    if (
      err?.code ===
      "BILLING_EVENT_CAPACITY_EXCEEDED"
    ) {
      const pagamentoId = String(
        err.pagamentoId ?? ""
      );

      const eventoId = String(
        err.eventoId ?? ""
      );

      if (!pagamentoId || !eventoId) {
        return res.status(503).json({
          ok: false,
          code:
            "BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED",
        });
      }

      try {
        const pagamento =
          await prisma.pagamento.findUnique({
            where: {
              id: pagamentoId,
            },
            select: {
              id: true,
              status: true,
              provider: true,
              providerRef: true,
            },
          });

        if (!pagamento) {
          throw new Error(
            "Pagamento excedente não encontrado"
          );
        }

        await registrarPendenciaEventoExcedente({
          pagamentoId,
          eventoId,
        });

        // Registrar pendência durável para análise.
        // Este registro NÃO efetua estorno.
        const auditoriaExistente =
          await prisma.auditLog.findFirst({
            where: {
              acao:
                "BILLING_EVENT_CAPACITY_RECONCILIATION",
              entidade: "Pagamento",
              entidadeId: pagamentoId,
            },
            select: {
              id: true,
            },
          });

        if (!auditoriaExistente) {
          await prisma.auditLog.create({
            data: {
              acao:
                "BILLING_EVENT_CAPACITY_RECONCILIATION",
              entidade: "Pagamento",
              entidadeId: pagamentoId,
              descricao:
                "Pagamento externo aprovado, mas sem vaga disponível. Requer análise e possível estorno.",
              meta: {
                eventoId,
                provider: pagamento.provider,
                providerRef: pagamento.providerRef,
                statusLocal: pagamento.status,
                motivo:
                  "BILLING_EVENT_CAPACITY_EXCEEDED",
              },
            },
          });
        }

        console.error(
          "[billing] Pagamento excedente aguardando conciliação:",
          {
            pagamentoId,
            eventoId,
            providerRef: pagamento.providerRef,
          }
        );

        return res.status(503).json({
          ok: false,
          code:
            "BILLING_EVENT_CAPACITY_RECONCILIATION_REQUIRED",
          pagamentoId,
        });
      } catch (erroAuditoria) {
        console.error(
          "[billing] Falha ao registrar conciliação:",
          erroAuditoria
        );

        return res.status(503).json({
          ok: false,
          code:
            "BILLING_EVENT_CAPACITY_AUDIT_FAILED",
        });
      }
    }

    return sendError(
      res,
      err,
      "Erro ao processar webhook Mercado Pago"
    );
  }
}

export async function getMetodologiasAvulsas(req: AuthenticatedRequest, res: Response) {
  try {
    const usuarioId = getUserId(req);

    const tipoQuery =
      String(
        req.query.tipo ?? ""
      ).trim();

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }

    if (
      !BILLING_SHOW_METODOLOGIAS_AVULSAS &&
      !isTipoLearningEspecial(tipo)
    ) {
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

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }
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
    const contextoPagamento =
      getContextoPagamentoData(req);

    const activeContext =
      getBillingActiveContext(req);

    if (
      !contextoPagamento ||
      !activeContext
    ) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para resgatar o presente.",
      });
    }
    if (!usuarioId) return res.status(401).json({ message: "Não autenticado" });

    const { codigo, planoId, periodicidade } = req.body as {
      codigo: string;
      planoId: string;
      periodicidade: Periodicidade;
    };

    const tipo =
      normalizeTipoBilling(
        getBillingTipo(req) || ""
      );

    if (!tipo) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um perfil ativo para continuar.",
      });
    }
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
        ...contextoPagamento,
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
      await upsertSubscription(
        usuarioId,
        activeContext,
        planoNorm,
        periodicidade
      );
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

export async function checkExpiringSubscriptions(
  req: Request,
  res: Response
) {
  try {
    const resultado =
      await processExpiringSubscriptions();

    return res.json({
      ok: true,
      bloqueadas: resultado.bloqueadas,
      lembretes: resultado.avisadas,
      desativadas: resultado.desativadas,
    });
  } catch (error) {
    console.error(
      "[billingController.checkExpiringSubscriptions]",
      error
    );

    return res.status(500).json({
      message:
        "Erro ao verificar assinaturas expirando.",
    });
  }
}

export async function getAulasAoVivoPagas(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const agora =
      new Date();

    const limiteReplay =
      new Date(
        agora.getTime() -
          REPLAY_COMPRA_MS
      );

    const aulas =
      await prisma
        .aulaAoVivo
        .findMany({
          where: {
            metodologiaId:
              null,
            metodologiaAvulsaId:
              null,
            acessoPago:
              true,
            precoAcesso: {
              gt:
                0,
            },
            OR: [
              {
                status:
                  "AGENDADA",
                dataInicio: {
                  gte:
                    agora,
                },
              },
              {
                status:
                  "AO_VIVO",
              },
              {
                status:
                  "FINALIZADA",
                replayDisponivel:
                  true,
                videoGravadoUrl: {
                  not:
                    null,
                },
                OR: [
                  {
                    finalizouEm: {
                      gte:
                        limiteReplay,
                      lte:
                        agora,
                    },
                  },
                  {
                    finalizouEm:
                      null,

                    dataFim: {
                      gte:
                        limiteReplay,

                      lte:
                        agora,
                    },
                  },
                ],
              },
            ],
          },
          select: {
            id:
              true,

            titulo:
              true,

            descricao:
              true,

            dataInicio:
              true,

            dataFim:
              true,

            finalizouEm:
              true,

            inscricaoInicio:
              true,

            inscricaoFim:
              true,

            precoAcesso:
              true,

            acessoPago:
              true,

            status:
              true,

            replayDisponivel:
              true,

            totalParticipantes:
              true,

            criadorUsuarioId:
              true,

            criadorUsuario: {
              select: {
                id:
                  true,

                nome:
                  true,

                nomeDeUsuario:
                  true,

                tipo:
                  true,
              },
            },

            convidadoUsuarioId:
              true,

            convidadoNome:
              true,

            convidadoDescricao:
              true,

            convidadoUsuario: {
              select: {
                id:
                  true,

                nome:
                  true,

                nomeDeUsuario:
                  true,

                tipo:
                  true,
              },
            },

            convidados: {
              orderBy: {
                ordem:
                  "asc",
              },

              include: {
                usuario: {
                  select: {
                    id:
                      true,

                    nome:
                      true,

                    nomeDeUsuario:
                      true,

                    tipo:
                      true,
                  },
                },
              },
            },
          },
        });

    const items =
      aulas
        .map((aula) => {
          const ehReplay =
            aula.status ===
            "FINALIZADA";

          const validade =
            ehReplay
              ? calcularValidadeReplayCompra(
                  aula
                )
              : null;
          if (
            ehReplay &&
            (
              !validade ||
              validade
                .replayExpirado
            )
          ) {
            return null;
          }

          return {
            ...aula,

            precoAcesso:
              Number(
                aula.precoAcesso ??
                0
              ),

            planoId:
              `AULA_AO_VIVO:${aula.id}`,

            ehReplay,

            replayExpiraEm:
              validade
                ?.replayExpiraEm
                ?.toISOString() ??
              null,

            segundosRestantes:
              validade
                ?.segundosRestantes ??
              null,
          };
        })
        .filter(
          (
            item
          ): item is NonNullable<
            typeof item
          > =>
            item !== null
        );
    items.sort(
      (a, b) => {
        const rank = (
          status: string
        ) => {
          if (
            status ===
            "AO_VIVO"
          ) {
            return 0;
          }

          if (
            status ===
            "AGENDADA"
          ) {
            return 1;
          }

          return 2;
        };

        const diferencaRank =
          rank(a.status) -
          rank(b.status);

        if (
          diferencaRank !== 0
        ) {
          return diferencaRank;
        }

        if (
          a.status ===
          "FINALIZADA"
        ) {
          return (
            new Date(
              a.replayExpiraEm ||
                0
            ).getTime() -
            new Date(
              b.replayExpiraEm ||
                0
            ).getTime()
          );
        }

        return (
          a.dataInicio.getTime() -
          b.dataInicio.getTime()
        );
      }
    );

    return res.json({
      items,
      validadeReplayDias:
        REPLAY_COMPRA_DIAS,
    });
  } catch (error: any) {
    return sendError(
      res,
      error,
      "Erro ao listar eventos ao vivo pagos."
    );
  }
}
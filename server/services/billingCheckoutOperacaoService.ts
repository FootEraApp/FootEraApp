// server/services/billingCheckoutOperacaoService.ts
// Camada de persistencia de tentativas de checkout.
// NAO chama o Mercado Pago. NAO faz reenvio automatico de operacoes inconclusivas.
import { createHash, randomUUID } from "node:crypto";
import {
  BillingCheckoutOperacaoStatus,
  Prisma,
  type BillingCheckoutOperacao,
  type Pagamento,
} from "@prisma/client";
import { prisma } from "../prisma.js";

const STATUS = BillingCheckoutOperacaoStatus;

export class ErroCheckoutOperacao extends Error {
  constructor(public readonly codigo: string) {
    super(codigo);
    this.name = "ErroCheckoutOperacao";
  }
}

function jsonCanonico(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(",")}]`;
  const objeto = valor as Record<string, unknown>;
  return `{${Object.keys(objeto)
    .filter((chave) => objeto[chave] !== undefined)
    .sort()
    .map((chave) => `${JSON.stringify(chave)}:${jsonCanonico(objeto[chave])}`)
    .join(",")}}`;
}

/** Calcule a partir de usuario, contexto, itens, metodo, cupom e valor FINAL em centavos.
 * Nao inclua dados sensiveis (CPF, token, cartao) no objeto de entrada.
 */
export function fingerprintCheckout(dados: Record<string, unknown>): string {
  return createHash("sha256").update(jsonCanonico(dados)).digest("hex");
}

type CriarPagamento = (tx: Prisma.TransactionClient) => Promise<Pagamento>;

export type PrepararCheckoutArgs = {
  usuarioId: string;
  chaveCliente: string;
  modalidade: "PIX_INDIVIDUAL" | "PREFERENCIA_INDIVIDUAL" | "PIX_BUNDLE" | "PREFERENCIA_BUNDLE";
  fingerprintRequisicao: string;
  criarPagamento: CriarPagamento;
};

function validarArgs(args: PrepararCheckoutArgs): void {
  if (!args.usuarioId.trim() || args.chaveCliente.length < 16 || args.chaveCliente.length > 128 ||
      !/^[a-f0-9]{64}$/i.test(args.fingerprintRequisicao)) {
    throw new ErroCheckoutOperacao("BILLING_CHECKOUT_OPERATION_INPUT_INVALID");
  }
}

function conferirReuso(
  operacao: BillingCheckoutOperacao,
  args: PrepararCheckoutArgs
): void {
  if (operacao.usuarioId !== args.usuarioId ||
      operacao.fingerprintRequisicao !== args.fingerprintRequisicao ||
      operacao.modalidade !== args.modalidade) {
    throw new ErroCheckoutOperacao("BILLING_CHECKOUT_IDEMPOTENCY_CONFLICT");
  }
}

/**
 * Criacao do Pagamento e da operacao na MESMA transacao.
 * A restricao unique(usuarioId, chaveCliente) protege processos simultaneos.
 * O callback deve SOMENTE gravar no PostgreSQL; nunca chamar API externa.
 */
export async function prepararCheckoutAtomico(args: PrepararCheckoutArgs): Promise<{
  pagamento: Pagamento;
  operacao: BillingCheckoutOperacao;
  reutilizada: boolean;
}> {
  validarArgs(args);

  const existente = await prisma.billingCheckoutOperacao.findUnique({
    where: { usuarioId_chaveCliente: { usuarioId: args.usuarioId, chaveCliente: args.chaveCliente } },
    include: { pagamento: true },
  });
  if (existente) {
    conferirReuso(existente, args);
    return { pagamento: existente.pagamento, operacao: existente, reutilizada: true };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const pagamento = await args.criarPagamento(tx);
      if (pagamento.usuarioId !== args.usuarioId) {
        throw new ErroCheckoutOperacao("BILLING_CHECKOUT_OWNER_MISMATCH");
      }
      const operacao = await tx.billingCheckoutOperacao.create({
        data: {
          pagamentoId: pagamento.id,
          usuarioId: args.usuarioId,
          chaveCliente: args.chaveCliente,
          chaveOperacao: randomUUID(),
          modalidade: args.modalidade,
          fingerprintRequisicao: args.fingerprintRequisicao,
          status: STATUS.PREPARADA,
        },
      });
      return { pagamento, operacao, reutilizada: false };
    }, { maxWait: 10000, timeout: 15000 });
    } catch (erro) {
        const conflitoPrisma =
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(erro.code);

        if (conflitoPrisma) {
        const vencedor =
            await prisma.billingCheckoutOperacao.findUnique({
            where: {
                usuarioId_chaveCliente: {
                usuarioId: args.usuarioId,
                chaveCliente: args.chaveCliente,
                },
            },
            include: {
                pagamento: true,
            },
            });

        if (vencedor) {
            conferirReuso(vencedor, args);

            return {
            pagamento: vencedor.pagamento,
            operacao: vencedor,
            reutilizada: true,
            };
        }
        }

        throw erro;
  }
}

/** Somente uma requisicao PREPARADA pode passar para ENVIO_POSSIVEL. */
export async function adquirirEnvioCheckout(operacaoId: string): Promise<boolean> {
  const resultado = await prisma.billingCheckoutOperacao.updateMany({
    where: { id: operacaoId, status: STATUS.PREPARADA },
    data: { status: STATUS.ENVIO_POSSIVEL, envioPossivelEm: new Date() },
  });
  return resultado.count === 1;
}

export async function confirmarCheckoutExterno(args: {
  operacaoId: string;
  providerRef: string;
  pixCopiaECola?: string | null;
}): Promise<void> {
  if (!args.operacaoId.trim() || !args.providerRef.trim()) {
    throw new ErroCheckoutOperacao(
      "BILLING_CHECKOUT_PROVIDER_REF_INVALID"
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const operacao =
        await tx.billingCheckoutOperacao.findUniqueOrThrow({
          where: { id: args.operacaoId },
        });

      if (operacao.status === STATUS.CONFIRMADA) {
        if (operacao.providerRef !== args.providerRef) {
          throw new ErroCheckoutOperacao(
            "BILLING_CHECKOUT_PROVIDER_REF_CONFLICT"
          );
        }

        return;
      }

      if (
        operacao.status !== STATUS.ENVIO_POSSIVEL &&
        operacao.status !== STATUS.INCONCLUSIVA
      ) {
        throw new ErroCheckoutOperacao(
          "BILLING_CHECKOUT_STATE_INVALID"
        );
      }

      // Aquisição condicional: outra confirmação não pode
      // finalizar esta mesma operação simultaneamente.
      const adquirido =
        await tx.billingCheckoutOperacao.updateMany({
          where: {
            id: operacao.id,
            status: {
              in: [
                STATUS.ENVIO_POSSIVEL,
                STATUS.INCONCLUSIVA,
              ],
            },
          },
          data: {
            status: STATUS.CONFIRMADA,
            providerRef: args.providerRef,
            confirmadoEm: new Date(),
            ultimoErro: null,
          },
        });

      if (adquirido.count !== 1) {
        throw new ErroCheckoutOperacao(
          "BILLING_CHECKOUT_STATE_CONFLICT"
        );
      }

      const pagamento =
        await tx.pagamento.findUniqueOrThrow({
          where: { id: operacao.pagamentoId },
        });

      if (
        pagamento.providerRef &&
        pagamento.providerRef !== args.providerRef
      ) {
        throw new ErroCheckoutOperacao(
          "BILLING_CHECKOUT_PROVIDER_REF_CONFLICT"
        );
      }

      const alterado =
        await tx.pagamento.updateMany({
          where: {
            id: pagamento.id,
            OR: [
              { providerRef: null },
              { providerRef: args.providerRef },
            ],
          },
          data: {
            provider: "MERCADOPAGO",
            providerRef: args.providerRef,
            ...(args.pixCopiaECola !== undefined
              ? { pixCopiaECola: args.pixCopiaECola }
              : {}),
          },
        });

      if (alterado.count !== 1) {
        throw new ErroCheckoutOperacao(
          "BILLING_CHECKOUT_PAYMENT_CONFLICT"
        );
      }
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}

export async function confirmarPreferenciaCheckout(
  args: {
    operacaoId: string;
    preferenciaId: string;
  }
): Promise<void> {
  const preferenciaId = args.preferenciaId.trim();

  if (!preferenciaId) {
    throw new ErroCheckoutOperacao(
      "BILLING_CHECKOUT_PREFERENCE_ID_INVALID"
    );
  }

  await prisma.$transaction(async (tx) => {
    const operacao =
      await tx.billingCheckoutOperacao.findUniqueOrThrow({
        where: { id: args.operacaoId },
      });

    if (
      ![
        "PREFERENCIA_INDIVIDUAL",
        "PREFERENCIA_BUNDLE",
      ].includes(operacao.modalidade)
    ) {
      throw new ErroCheckoutOperacao(
        "BILLING_CHECKOUT_MODALITY_CONFLICT"
      );
    }

    if (operacao.status === "CONFIRMADA") {
      if (operacao.providerRef !== preferenciaId) {
        throw new ErroCheckoutOperacao(
          "BILLING_CHECKOUT_PREFERENCE_CONFLICT"
        );
      }

      return;
    }

    const resultado =
      await tx.billingCheckoutOperacao.updateMany({
        where: {
          id: operacao.id,
          status: {
            in: [
              "ENVIO_POSSIVEL",
              "INCONCLUSIVA",
            ],
          },
        },
        data: {
          status: "CONFIRMADA",
          providerRef: preferenciaId,
          confirmadoEm: new Date(),
          ultimoErro: null,
        },
      });

    if (resultado.count !== 1) {
      throw new ErroCheckoutOperacao(
        "BILLING_CHECKOUT_STATE_CONFLICT"
      );
    }
  });
}

/** Resultado desconhecido: NAO reenvia e NAO cancela automaticamente. */
export async function marcarCheckoutInconclusivo(
  operacaoId: string,
  erro: unknown
): Promise<boolean> {
  const descricao = erro instanceof Error ? erro.message : String(erro);
  const atualizado = await prisma.billingCheckoutOperacao.updateMany({
    where: { id: operacaoId, status: STATUS.ENVIO_POSSIVEL },
    data: { status: STATUS.INCONCLUSIVA, ultimoErro: descricao.slice(0, 1000) },
  });
  return atualizado.count === 1;
}

/** Somente consultas autenticadas; o controller tambem deve validar contexto. */
export async function consultarCheckoutDoUsuario(usuarioId: string, chaveCliente: string) {
  if (!usuarioId || !chaveCliente) {
    throw new ErroCheckoutOperacao("BILLING_CHECKOUT_OPERATION_INPUT_INVALID");
  }
  return prisma.billingCheckoutOperacao.findFirst({
    where: { usuarioId, chaveCliente },
    select: {
      id: true,
      pagamentoId: true,
      modalidade: true,
      status: true,
      providerRef: true,
      criadoEm: true,
      atualizadoEm: true,
      pagamento: {
        select: {
          id: true,
          usuarioId: true,
          contextoKind: true,
          contextoTipo: true,
          contextoPerfilId: true,
          contextoOrganizacaoId: true,
          contextoLegacyOrganizationId: true,
          status: true,
        },
      },
    },
  });
}


export async function diagnosticarCheckoutInconclusivo(
  operacaoId: string
) {
  if (!operacaoId.trim()) {
    throw new ErroCheckoutOperacao(
      "BILLING_CHECKOUT_OPERATION_INPUT_INVALID"
    );
  }

  const operacao =
    await prisma.billingCheckoutOperacao.findUnique({
      where: { id: operacaoId },
      include: { pagamento: true },
    });

  if (!operacao) {
    throw new ErroCheckoutOperacao(
      "BILLING_CHECKOUT_OPERATION_NOT_FOUND"
    );
  }

  const requerConciliacao =
    operacao.status === STATUS.ENVIO_POSSIVEL ||
    operacao.status === STATUS.INCONCLUSIVA;

  const referencia =
    operacao.providerRef?.trim() ||
    operacao.pagamento.providerRef?.trim() ||
    null;

  const referenciaConflitante =
    Boolean(
      operacao.providerRef &&
      operacao.pagamento.providerRef &&
      operacao.providerRef !==
        operacao.pagamento.providerRef
    );

  return {
    operacaoId: operacao.id,
    pagamentoId: operacao.pagamentoId,
    modalidade: operacao.modalidade,
    status: operacao.status,
    requerConciliacao,
    referenciaDisponivel:
      Boolean(referencia),
    referenciaConflitante,
    metodoRecuperacao:
      !requerConciliacao
        ? "NAO_APLICAVEL"
        : referenciaConflitante
          ? "REVISAO_MANUAL"
          : referencia
            ? "CONSULTAR_PROVEDOR"
            : "IDENTIDADE_EXTERNA_DESCONHECIDA",
    podeCriarOutraCobranca: false,
  };
}
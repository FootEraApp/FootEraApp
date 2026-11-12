
import { prisma } from "../prisma.js";

const MOTIVO =
  "BILLING_EVENT_CAPACITY_EXCEEDED";

export async function registrarPendenciaEventoExcedente(
  args: {
    pagamentoId: string;
    eventoId: string;
  }
) {
  const pagamento =
    await prisma.pagamento.findUnique({
      where: {
        id: args.pagamentoId,
      },
      select: {
        id: true,
        plano: true,
        status: true,
        provider: true,
        providerRef: true,
        valor: true,
        moeda: true,
      },
    });

  // Somente pagamentos externos de eventos,
  // ainda pendentes no sistema, podem gerar
  // uma pendencia de compensacao financeira.
  if (
    !pagamento ||
    pagamento.plano !==
      `EVENTO:${args.eventoId}` ||
    pagamento.provider !== "MERCADOPAGO" ||
    pagamento.status !== "PENDENTE" ||
    pagamento.moeda !== "BRL" ||
    !pagamento.providerRef ||
    !/^\d+$/.test(pagamento.providerRef)
  ) {
    throw new Error(
      "BILLING_EVENT_PENDING_RECONCILIATION_INVALID_PAYMENT"
    );
  }

  // pagamentoId possui UNIQUE no schema.
  // Assim, varias notificacoes referentes
  // ao mesmo pagamento compartilham o
  // mesmo registro de pendencia.
  const pendencia =
    await prisma.billingPendenciaEvento.upsert({
      where: {
        pagamentoId: pagamento.id,
      },
      create: {
        pagamentoId: pagamento.id,
        eventoId: args.eventoId,
        motivo: MOTIVO,
        status: "PENDENTE_ANALISE",
        providerRef: pagamento.providerRef,
        valor: pagamento.valor,
        moeda: pagamento.moeda,
      },
      update: {},
    });

  // Rejeita reutilizacao de uma pendencia
  // com evento ou dados financeiros
  // inconsistentes.
  if (
    pendencia.eventoId !== args.eventoId ||
    pendencia.motivo !== MOTIVO ||
    pendencia.providerRef !==
      pagamento.providerRef ||
    pendencia.valor.comparedTo(
      pagamento.valor
    ) !== 0 ||
    pendencia.moeda !== pagamento.moeda
  ) {
    throw new Error(
      "BILLING_EVENT_PENDING_RECONCILIATION_CONFLICT"
    );
  }

  return pendencia;
}
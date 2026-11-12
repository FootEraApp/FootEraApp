
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";

const MOTIVO =
  "BILLING_EVENT_CAPACITY_EXCEEDED";

export async function prepararCompensacaoEvento(
  pagamentoId: string
) {
  const id = String(pagamentoId || "").trim();

  if (!id) {
    throw new Error(
      "BILLING_COMPENSACAO_PAGAMENTO_ID_REQUIRED"
    );
  }

  return prisma.$transaction(
    async (tx) => {
      const linhas = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "Pagamento"
        WHERE "id" = ${id}
        FOR UPDATE
      `;

      if (linhas.length !== 1) {
        throw new Error(
          "BILLING_COMPENSACAO_PAGAMENTO_NOT_FOUND"
        );
      }

      const existente =
        await tx.billingCompensacaoEvento.findUnique({
          where: {
            pagamentoId: id,
          },
        });

      if (existente) {
        return {
          compensacao: existente,
          criadaAgora: false,
        };
      }

      const pendencia =
        await tx.billingPendenciaEvento.findUnique({
          where: {
            pagamentoId: id,
          },
          include: {
            pagamento: true,
          },
        });

      if (!pendencia) {
        throw new Error(
          "BILLING_COMPENSACAO_PENDENCIA_NOT_FOUND"
        );
      }

      const pg = pendencia.pagamento;

      if (
        pendencia.motivo !== MOTIVO ||
        ![
          "PENDENTE_ANALISE",
          "EM_ANALISE",
        ].includes(pendencia.status) ||
        pg.status !== "PENDENTE" ||
        pg.provider !== "MERCADOPAGO" ||
        pg.plano !== `EVENTO:${pendencia.eventoId}` ||
        pg.moeda !== "BRL" ||
        pg.providerRef !== pendencia.providerRef ||
        !/^\d+$/.test(pendencia.providerRef) ||
        !pg.valor.equals(pendencia.valor) ||
        pg.valor.lessThanOrEqualTo(
          new Prisma.Decimal(0)
        )
      ) {
        throw new Error(
          "BILLING_COMPENSACAO_INVALID_PAYMENT"
        );
      }

      const beneficios =
        await tx.pagamentoBeneficio.count({
          where: {
            pagamentoId: id,
          },
        });

      if (beneficios > 0) {
        throw new Error(
          "BILLING_COMPENSACAO_HAS_BENEFITS"
        );
      }

      const inscricoes =
        await tx.inscricaoEvento.count({
          where: {
            eventoId: pendencia.eventoId,
            usuarioId: pg.usuarioId,
            status: {
              not: "CANCELADA",
            },
          },
        });

      if (inscricoes > 0) {
        throw new Error(
          "BILLING_COMPENSACAO_HAS_REGISTRATION"
        );
      }

      const chaveIdempotencia =
        `footera-evento-refund-${id}`;

      const compensacao =
        await tx.billingCompensacaoEvento.create({
          data: {
            pagamentoId: id,
            pendenciaId: pendencia.id,
            chaveIdempotencia,
            status: "PREPARADA",
            valor: pg.valor,
            moeda: pg.moeda,
            providerRef: pendencia.providerRef,
          },
        });

      return {
        compensacao,
        criadaAgora: true,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
}
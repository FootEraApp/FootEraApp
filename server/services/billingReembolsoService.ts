
// server/services/billingReembolsoService.ts
// Reembolso TOTAL SIMULADO: metodologia avulsa individual
// ou BUNDLE somente de metodologias avulsas.
// NÃO usar para Mercado Pago real, reembolso parcial ou produção.

import {
  CreatorVendaStatus,
  PagamentoStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma.js";

type Linha = {
  metodologiaId: string;
  valorCentavos: number;
};

function linhasDoPagamento(pg: {
  plano: string;
  valor: Prisma.Decimal;
  meta: Prisma.JsonValue | null;
}): Linha[] {
  const centavosTotal = pg.valor.mul(100).toNumber();

  if (
    !Number.isSafeInteger(centavosTotal) ||
    centavosTotal <= 0
  ) {
    throw new Error("BILLING_REFUND_FINANCIAL_MISMATCH");
  }

  if (pg.plano.startsWith("METODOLOGIA_AVULSA:")) {
    const metodologiaId = pg.plano
      .slice("METODOLOGIA_AVULSA:".length)
      .trim();

    if (!metodologiaId) {
      throw new Error("BILLING_REFUND_BENEFIT_MISMATCH");
    }

    return [{ metodologiaId, valorCentavos: centavosTotal }];
  }

  if (pg.plano !== "BUNDLE") {
    throw new Error("BILLING_REFUND_REQUIRES_RECONCILIATION");
  }

  const meta = pg.meta;

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new Error("BILLING_REFUND_BUNDLE_SNAPSHOT_INVALID");
  }

  const bundle = meta.bundleItems;
  const financeiro = meta.financeiroV1;

  if (
    !Array.isArray(bundle) ||
    bundle.length < 2 ||
    !financeiro ||
    typeof financeiro !== "object" ||
    Array.isArray(financeiro) ||
    financeiro.versao !== 1 ||
    !Array.isArray(financeiro.items) ||
    financeiro.items.length !== bundle.length ||
    financeiro.totalCentavos !== centavosTotal
  ) {
    throw new Error("BILLING_REFUND_BUNDLE_SNAPSHOT_INVALID");
  }

  const linhas = bundle.map((item, index) => {
    const registro = item as Record<string, unknown> | null;
    const f = (financeiro.items as unknown[])[index] as
      Record<string, unknown> | null;

    const plano = String(registro?.planoId ?? "");
    const periodicidade = registro?.periodicidade;
    const valor = f?.valorFinalCentavos;

    if (
      !plano.startsWith("METODOLOGIA_AVULSA:") ||
      !plano.slice("METODOLOGIA_AVULSA:".length).trim() ||
      !f ||
      f.planoId !== plano ||
      f.periodicidade !== periodicidade ||
      typeof valor !== "number" ||
        !Number.isSafeInteger(valor) ||
        valor < 0 ||
        typeof f.valorBaseCentavos !== "number" ||
        !Number.isSafeInteger(f.valorBaseCentavos) ||
        f.valorBaseCentavos < valor
    ) {
      throw new Error("BILLING_REFUND_BUNDLE_SNAPSHOT_INVALID");
    }

    return {
      metodologiaId: plano.slice("METODOLOGIA_AVULSA:".length),
      valorCentavos: Number(valor),
    };
  });

  if (
    new Set(linhas.map((i) => i.metodologiaId)).size !==
      linhas.length ||
    linhas.reduce((s, i) => s + i.valorCentavos, 0) !==
      centavosTotal
  ) {
    throw new Error("BILLING_REFUND_BUNDLE_SNAPSHOT_INVALID");
  }

  return linhas;
}

export async function reembolsarMetodologiaAvulsaQa(
  pagamentoId: string
) {  
  let db: URL;

  try {
    db = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new Error("BILLING_REFUND_QA_DISABLED");
  }

  if (
    process.env.NODE_ENV !== "test" ||
    Boolean(process.env.MP_ACCESS_TOKEN) ||
    process.env.BILLING_CUPOM_RESERVA_QA !== "true" ||
    process.env.ENABLE_MP_CONCILIACAO_SCHEDULER !== "false" ||
    process.env.ENABLE_BILLING_SCHEDULER !== "false" ||
    db.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost"].includes(
      db.hostname
    ) ||
    db.port !== "5433" ||
    db.pathname !== "/footera_billing_qa"
  ) {
    throw new Error("BILLING_REFUND_QA_DISABLED");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Pagamento"
        WHERE id = ${pagamentoId}
        FOR UPDATE
      `;

      const pg = await tx.pagamento.findUnique({
        where: { id: pagamentoId },
      });

      if (!pg) {
        throw new Error("BILLING_PAYMENT_NOT_FOUND");
      }

      if (pg.provider !== "INTERNAL_FAKE") {
        throw new Error(
          "BILLING_REFUND_QA_PROVIDER_MISMATCH"
        );
      }

      if (pg.status === PagamentoStatus.REEMBOLSADO) {
        return { pagamentoId, idempotent: true };
      }

      if (pg.status !== PagamentoStatus.APROVADO) {
        throw new Error(
          "BILLING_REFUND_REQUIRES_APPROVED_PAYMENT"
        );
      }

      if (pg.moeda !== "BRL") {
        throw new Error(
          "BILLING_REFUND_FINANCIAL_MISMATCH"
        );
      }

      const linhas = linhasDoPagamento(pg);

      const beneficios =
        await tx.pagamentoBeneficio.findMany({
          where: { pagamentoId },
        });

      const vendas = await tx.creatorVenda.findMany({
        where: { pagamentoId },
      });

      const ids = linhas.map((i) => i.metodologiaId);

      if (
        beneficios.length !== linhas.length ||
        beneficios.some(
          (b) =>
            b.usuarioId !== pg.usuarioId ||
            b.tipo !== "METODOLOGIA_AVULSA" ||
            b.revogadoEm !== null ||
            !ids.includes(b.recursoId)
        ) ||
        new Set(beneficios.map((b) => b.recursoId)).size !==
          linhas.length ||
        vendas.length !== linhas.length ||
        vendas.some(
          (v) =>
            v.status !== CreatorVendaStatus.CONFIRMADA ||
            v.compradorId !== pg.usuarioId ||
            !v.metodologiaAvulsaId ||
            !ids.includes(v.metodologiaAvulsaId)
        ) ||
        new Set(vendas.map((v) => v.metodologiaAvulsaId))
          .size !== vendas.length
      ) {
        throw new Error(
          "BILLING_REFUND_REQUIRES_RECONCILIATION"
        );
      }

      for (const venda of vendas) {
        const linha = linhas.find(
          (i) =>
            i.metodologiaId === venda.metodologiaAvulsaId
        );

        if (
          !linha ||
          !venda.valorBruto.mul(100).equals(
            linha.valorCentavos
          ) ||
          !venda.valorFootera
            .plus(venda.valorCreator)
            .equals(venda.valorBruto)
        ) {
          throw new Error(
            "BILLING_REFUND_FINANCIAL_MISMATCH"
          );
        }
      }

      // Locks em ordem determinística para reduzir deadlocks.
      const acessos =
        await tx.metodologiaAssinante.findMany({
          where: {
            usuarioId: pg.usuarioId,
            metodologiaAvulsaId: { in: ids },
          },
          orderBy: { id: "asc" },
        });

      if (acessos.length !== linhas.length) {
        throw new Error(
          "BILLING_REFUND_ACCESS_NOT_FOUND"
        );
      }

      for (const acesso of acessos) {
        await tx.$queryRaw`
          SELECT id FROM "MetodologiaAssinante"
          WHERE id = ${acesso.id}
          FOR UPDATE
        `;
      }

      // Releitura do estado atual após os locks.
      const acessosAtuais =
        await tx.metodologiaAssinante.findMany({
          where: {
            id: { in: acessos.map((a) => a.id) },
          },
        });

      if (
        acessosAtuais.some(
          (a) =>
            a.status !== "ATIVA" ||
            a.origem !== "AVULSA"
        )
      ) {
        throw new Error(
          "BILLING_REFUND_ACCESS_ORIGIN_UNCERTAIN"
        );
      }

      const agora = new Date();
      let preservados = 0;

      for (const linha of linhas) {
        const beneficio = beneficios.find(
          (b) => b.recursoId === linha.metodologiaId
        )!;

        const acesso = acessosAtuais.find(
          (a) =>
            a.metodologiaAvulsaId === linha.metodologiaId
        )!;

        const outro =
          await tx.pagamentoBeneficio.findFirst({
            where: {
              id: { not: beneficio.id },
              usuarioId: pg.usuarioId,
              tipo: "METODOLOGIA_AVULSA",
              recursoId: linha.metodologiaId,
              revogadoEm: null,
              pagamento: {
                status: PagamentoStatus.APROVADO,
              },
            },
            select: { id: true },
          });

        if (!outro) {
          const alterado =
            await tx.metodologiaAssinante.updateMany({
              where: {
                id: acesso.id,
                status: "ATIVA",
                origem: "AVULSA",
              },
              data: {
                status: "CANCELADA",
                cancelouEm: agora,
              },
            });

          if (alterado.count !== 1) {
            throw new Error(
              "BILLING_REFUND_ACCESS_CONFLICT"
            );
          }
        } else {
          preservados++;
        }

        const marcado =
          await tx.pagamentoBeneficio.updateMany({
            where: {
              id: beneficio.id,
              revogadoEm: null,
            },
            data: {
              revogadoEm: agora,
              motivoRevogacao:
                "REEMBOLSO_TOTAL_QA_SIMULADO",
            },
          });

        if (marcado.count !== 1) {
          throw new Error(
            "BILLING_REFUND_BENEFIT_CONFLICT"
          );
        }
      }

      if (vendas.length) {
        const alteradas =
          await tx.creatorVenda.updateMany({
            where: {
              pagamentoId,
              status: CreatorVendaStatus.CONFIRMADA,
            },
            data: {
              status: CreatorVendaStatus.REEMBOLSADA,
            },
          });

        if (alteradas.count !== vendas.length) {
          throw new Error(
            "BILLING_REFUND_SALES_CONFLICT"
          );
        }
      }

      const resultado = await tx.pagamento.updateMany({
        where: {
          id: pagamentoId,
          status: PagamentoStatus.APROVADO,
        },
        data: {
          status: PagamentoStatus.REEMBOLSADO,
          reembolsadoEm: agora,
        },
      });

      if (resultado.count !== 1) {
        throw new Error(
          "BILLING_REFUND_PAYMENT_CONFLICT"
        );
      }

      // Não devolve usos de cupons automaticamente.
      return {
        pagamentoId,
        idempotent: false,
        acessosPreservados: preservados,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
      isolationLevel:
        Prisma.TransactionIsolationLevel.ReadCommitted,
    }
  );
}
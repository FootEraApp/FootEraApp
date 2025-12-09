import { Request, Response } from "express";
import { PrismaClient, Prisma, StatusConexao } from "@prisma/client";

const prisma = new PrismaClient();

type TipoVinculo = "clube" | "escolinha";

async function resolveEntityId(
  tx: Prisma.TransactionClient | PrismaClient,
  tipo: TipoVinculo,
  idOuUsuarioId: string
): Promise<string | null> {
  if (tipo === "escolinha") {
    const e = await tx.escolinha.findFirst({
      where: { OR: [{ id: idOuUsuarioId }, { usuarioId: idOuUsuarioId }] },
      select: { id: true },
    });
    return e?.id ?? null;
  } else {
    const c = await tx.clube.findFirst({
      where: { OR: [{ id: idOuUsuarioId }, { usuarioId: idOuUsuarioId }] },
      select: { id: true },
    });
    return c?.id ?? null;
  }
}

export const vinculoController = {
  async solicitarVinculo(req: Request, res: Response) {
    try {
      const { atletaId, entidadeId, tipoVinculo } = req.body as {
        atletaId?: string;
        entidadeId?: string;
        tipoVinculo?: TipoVinculo;
      };

      if (!atletaId || !entidadeId || !tipoVinculo) {
        return res
          .status(400)
          .json({ message: "Campos obrigatórios: atletaId, entidadeId, tipoVinculo" });
      }

      if (!["clube", "escolinha"].includes(tipoVinculo)) {
        return res.status(400).json({ message: "Tipo de vínculo inválido" });
      }

      const entidadeRealId = await resolveEntityId(prisma, tipoVinculo, entidadeId);
      if (!entidadeRealId) {
        return res.status(404).json({
          message: `${tipoVinculo === "clube" ? "Clube" : "Escolinha"} não encontrado(a)`,
        });
      }

      const jaExiste = await prisma.solicitacaoVinculo.findFirst({
        where: {
          atletaId,
          tipoEntidade: tipoVinculo,
          entidadeId: entidadeRealId,
          status: { in: ["pendente", "aceito"] },
        },
        select: { id: true, status: true },
      });

      if (jaExiste) {
        return res.status(409).json({
          message: "Já existe uma solicitação ativa para esse vínculo.",
          solicitacao: jaExiste,
        });
      }

      const solicitacao = await prisma.solicitacaoVinculo.create({
        data: {
          atletaId,
          tipoEntidade: tipoVinculo,
          entidadeId: entidadeRealId,
          status: "pendente",
        },
      });

      return res
        .status(201)
        .json({ message: "Solicitação enviada com sucesso", solicitacao });
    } catch (error) {
      console.error("Erro em solicitarVinculo:", error);
      return res
        .status(500)
        .json({ message: "Erro ao solicitar vínculo", error: String(error) });
    }
  },

  async responderSolicitacao(req: Request, res: Response) {
    try {
      const { solicitacaoId, aprovar } = req.body as {
        solicitacaoId?: string;
        aprovar?: boolean;
      };

      if (!solicitacaoId || typeof aprovar !== "boolean") {
        return res
          .status(400)
          .json({ message: "Campos obrigatórios: solicitacaoId, aprovar" });
      }

      await prisma.$transaction(async (tx) => {
        const solicitacao = await tx.solicitacaoVinculo.findUnique({
          where: { id: solicitacaoId },
          include: { atleta: true },
        });

        if (!solicitacao) {
          throw new Error("Solicitação não encontrada");
        }

        const novoStatus = aprovar ? "aceito" : "recusado";

        await tx.solicitacaoVinculo.update({
          where: { id: solicitacaoId },
          data: { status: novoStatus },
        });

        const statusConexao = aprovar
          ? StatusConexao.Aprovado
          : StatusConexao.Recusado;

        if (!aprovar) {
          await tx.atleta.update({
            where: { id: solicitacao.atletaId },
            data: { statusConexao },
          });
          return;
        }

        let dadosUpdate: Prisma.AtletaUpdateInput = { statusConexao };

        if (solicitacao.tipoEntidade === "escolinha") {
          const escolinha = await tx.escolinha.findUnique({
            where: { id: solicitacao.entidadeId },
            select: { id: true },
          });
          if (!escolinha) {
            throw new Error("Escolinha não encontrada para aprovação");
          }
          dadosUpdate.escolinha = { connect: { id: escolinha.id } };
        } else {
          const clube = await tx.clube.findUnique({
            where: { id: solicitacao.entidadeId },
            select: { id: true },
          });
          if (!clube) {
            throw new Error("Clube não encontrado para aprovação");
          }
          dadosUpdate.clube = { connect: { id: clube.id } };
        }

        await tx.atleta.update({
          where: { id: solicitacao.atletaId },
          data: dadosUpdate,
        });

        await tx.ranking.upsert({
          where: { atletaId: solicitacao.atletaId },
          update: {},
          create: { atletaId: solicitacao.atletaId, total: 0, posicao: 0 },
        });
      });

      return res.json({ ok: true });
    } catch (error: any) {
      console.error("Erro em responderSolicitacao:", error);
      return res.status(500).json({
        message: "Erro ao responder solicitação",
        error: error?.message ?? String(error),
      });
    }
  },

  async pendentes(req: Request, res: Response) {
    try {
      const { entidadeId, tipo } = req.params as {
        entidadeId: string;
        tipo: TipoVinculo;
      };

      if (!["clube", "escolinha"].includes(tipo)) {
        return res.status(400).json({ message: "Tipo inválido" });
      }

      const realId = await resolveEntityId(prisma, tipo, entidadeId);
      if (!realId) {
        return res
          .status(404)
          .json({ message: `${tipo === "clube" ? "Clube" : "Escolinha"} não encontrado(a)` });
      }

      const solicitacoes = await prisma.solicitacaoVinculo.findMany({
        where: { tipoEntidade: tipo, entidadeId: realId, status: "pendente" },
        include: { atleta: true },
        orderBy: { criadoEm: "desc" },
      });

      return res.json(solicitacoes);
    } catch (error) {
      console.error("Erro em pendentes:", error);
      return res
        .status(500)
        .json({ message: "Erro ao buscar solicitações pendentes", error });
    }
  },
};
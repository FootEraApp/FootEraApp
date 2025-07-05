import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const vinculoController = {
  async solicitarVinculo(req: Request, res: Response) {
    try {
      const { atletaId, entidadeId, tipoVinculo } = req.body;

      if (!["clube", "escolinha"].includes(tipoVinculo)) {
        return res.status(400).json({ message: "Tipo de vínculo inválido" });
      }

      const solicitacao = await prisma.solicitacaoVinculo.create({
        data: {
          atletaId,
          tipoEntidade: tipoVinculo,
          entidadeId: entidadeId.toString(),
          status: "pendente",
        },
      });

      return res.status(201).json({ message: "Solicitação enviada com sucesso", solicitacao });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao solicitar vínculo", error });
    }
  },

  async responderSolicitacao(req: Request, res: Response) {
    try {
      const { solicitacaoId, aprovar } = req.body;

      const solicitacao = await prisma.solicitacaoVinculo.findUnique({
        where: { id: solicitacaoId },
        include: { atleta: true },
      });

      if (!solicitacao) return res.status(404).json({ message: "Solicitação não encontrada" });

      const novoStatus = aprovar ? "aceito" : "recusado";

      await prisma.solicitacaoVinculo.update({
        where: { id: solicitacaoId },
        data: { status: novoStatus },
      });

      if (aprovar) {
        await prisma.atleta.update({
          where: { id: solicitacao.atletaId },
          data: {
            statusConexao: "Aprovado",
            clubeId: solicitacao.tipoEntidade === "clube" ? solicitacao.entidadeId : undefined,
            escolinhaId: solicitacao.tipoEntidade === "escolinha" ? solicitacao.entidadeId : undefined,
          },
        });
      }

      return res.json({ message: "Solicitação processada com sucesso" });
    } catch (error) {
      return res.status(500).json({ message: "Erro ao responder solicitação", error });
    }
  },

  async pendentes(req: Request, res: Response) {
    try {
      const { entidadeId, tipo } = req.params;

      if (!["clube", "escolinha"].includes(tipo)) {
        return res.status(400).json({ message: "Tipo inválido" });
      }

      const solicitacoes = await prisma.solicitacaoVinculo.findMany({
        where: {
          tipoEntidade: tipo,
          entidadeId,
          status: "pendente",
        },
        include: { atleta: true },
      });

      return res.json(solicitacoes);
    } catch (error) {
      return res.status(500).json({ message: "Erro ao buscar solicitações pendentes", error });
    }
  },
};

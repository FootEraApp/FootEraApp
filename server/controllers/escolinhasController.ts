import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { touchFairUse } from "server/lib/usage.js";
import { aplicarCorteEscolinha, getRangeFromQuery } from "../utils/analyticsWindow.js";
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";


export async function relatorioRetencaoEscolinha(req: Request, res: Response) {
  try {
    const escolinhaId = String(req.query.escolinhaId || "").trim();
    if (!escolinhaId) {
      return res.status(400).json({ message: "escolinhaId é obrigatório." });
    }

    let { from, to } = getRangeFromQuery(req.query, 365);

    ({ from, to } = aplicarCorteEscolinha(from, to));

    const alunosAtivos = await prisma.relacaoTreinamento.count({
      where: {
        escolinhaId,
        criadoEm: { gte: from, lte: to },
      },
    });

    const alunosCancelados = await prisma.relacaoTreinamento.count({
      where: {
        escolinhaId,
        encerradoEm: { gte: from, lte: to },
      },
    });

    return res.json({
      range: { from, to },
      metrics: {
        ativos: alunosAtivos,
        cancelados: alunosCancelados,
      },
    });
  } catch (err) {
    console.error("relatorioRetencaoEscolinha", err);
    return res
      .status(500)
      .json({ message: "Erro ao montar relatório de retenção." });
  }
}

async function setFairUseHeadersIfNeeded(res: Response, escolinhaId?: string) {
  if (!escolinhaId) return;
  try {
    const fu = await touchFairUse(escolinhaId, "atletas_vinculados_total");
    if (fu.warn) {
      res.setHeader("X-FairUse-Warn", "atletas_vinculados_total");
      res.setHeader("X-FairUse-Used", String(fu.used));
      res.setHeader("X-FairUse-Limit", String(fu.limit));
    }
  } catch (e) {
    console.warn("touchFairUse falhou:", e);
  }
}

export const getEscolinhas = async (_req: Request, res: Response) => {
  try {
    const escolinhas = await prisma.escolinha.findMany({
      include: { atletas: true, midias: true },
    });
    res.json(escolinhas);
  } catch (error) {
    console.error("Erro ao buscar escolinhas:", error);
    res.status(500).json({ message: "Erro ao buscar escolinhas." });
  }
};

export const getEscolinhaById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const escolinha = await prisma.escolinha.findUnique({
      where: { id },
      include: { atletas: true, midias: true },
    });
    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }

    await setFairUseHeadersIfNeeded(res, id);

    res.json(escolinha);
  } catch (error) {
    console.error("Erro ao buscar escolinha:", error);
    res.status(500).json({ message: "Erro ao buscar escolinha." });
  }
};

export const createEscolinha = async (req: Request, res: Response) => {
  try {
    const novaEscolinha = await prisma.escolinha.create({ data: req.body });
    res.status(201).json(novaEscolinha);
  } catch (error) {
    console.error("Erro ao criar escolinha:", error);
    res.status(500).json({ message: "Erro ao criar escolinha." });
  }
};

export const updateEscolinha = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const escolinha = await prisma.escolinha.findUnique({ where: { id } });
    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }
    const atualizada = await prisma.escolinha.update({
      where: { id },
      data: req.body,
    });
    res.json(atualizada);
  } catch (error) {
    console.error("Erro ao atualizar escolinha:", error);
    res.status(500).json({ message: "Erro ao atualizar escolinha." });
  }
};

export const deleteEscolinha = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const escolinha = await prisma.escolinha.findUnique({ where: { id } });
    if (!escolinha) {
      return res.status(404).json({ message: "Escolinha não encontrada." });
    }
    await prisma.escolinha.delete({ where: { id } });
    res.json({ message: "Escolinha excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar escolinha:", error);
    res.status(500).json({ message: "Erro ao deletar escolinha." });
  }
};

export const desvincularAtletaDaEscolinha = async (req: Request, res: Response) => {
  const { escolinhaId } = req.params;
  const { atletaId } = req.body;

  if (!escolinhaId || !atletaId) {
    return res.status(400).json({ message: "escolinhaId e atletaId são obrigatórios." });
  }

  try {
    const relacao = await prisma.relacaoTreinamento.findFirst({
      where: { escolinhaId, atletaId },
    });

    if (!relacao) {
      return res.status(404).json({ message: "Relação não encontrada." });
    }

    const agora = new Date();

    await prisma.relacaoTreinamento.update({
      where: { id: relacao.id },
      data: { encerradoEm: agora },
    });

    await salvarHistoricoAtletaVinculo({
      atletaId,
      dono: { tipo: "Escolinha", id: escolinhaId },
      inicioVinculo: relacao.criadoEm,
      fimVinculo: agora,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao desvincular atleta da escolinha:", err);
    return res.status(500).json({ message: "Erro ao desvincular atleta da escolinha." });
  }
};

export const listarHistoricoAtletasEscolinha = async (req: Request, res: Response) => {
  const { escolinhaId } = req.params;

  try {
    const historicos = await prisma.atletaHistoricoVinculo.findMany({
      where: { escolinhaId },
      orderBy: { fimVinculo: "desc" },
    });

    res.json(historicos);
  } catch (err) {
    console.error("Erro ao listar histórico de atletas da escolinha:", err);
    res.status(500).json({ message: "Erro ao listar histórico de atletas da escolinha." });
  }
};

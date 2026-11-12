import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { touchFairUse } from "server/lib/usage.js";
import { aplicarCorteEscolinha, getRangeFromQuery } from "../utils/analyticsWindow.js";
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";
import { garantirOrganizacaoLegada } from "../services/organizacoes.js";
import type { Prisma } from "@prisma/client";

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
    const novaEscolinha =
      await prisma.$transaction(
        async (tx) => {
          const criada =
            await tx.escolinha.create({
              data: req.body,
            });

          await garantirOrganizacaoLegada({
            tipo: "ESCOLINHA",
            ownerId: criada.id,

            proprietarioUsuarioId:
              criada.usuarioId,

            tx,
          });

          return criada;
        }
      );
    res.status(201).json(novaEscolinha);
  } catch (error) {
    console.error("Erro ao criar escolinha:", error);
    res.status(500).json({ message: "Erro ao criar escolinha." });
  }
};

export const updateEscolinha = async (req: Request, res: Response) => {
  const { id } = req.params;

  const camposProtegidos = [
    "id",
    "usuarioId",
    "organizacaoId",
    "usuario",
    "organizacao",
  ] as const;

  for (const campo of camposProtegidos) {
    if (
      Object.prototype.hasOwnProperty.call(
        req.body ?? {},
        campo,
      )
    ) {
      return res.status(400).json({
        code: "PROTECTED_ORGANIZATION_FIELD",
        message:
          `O campo "${campo}" não pode ser alterado pela edição comum. ` +
          "Para trocar o proprietário, utilize a transferência de propriedade.",
      });
    }
  }

  try {
    const escolinhaExistente = await prisma.escolinha.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!escolinhaExistente) {
      return res.status(404).json({
        message: "Escolinha não encontrada.",
      });
    }

    const camposPermitidos = [
      "nome",
      "cnpj",
      "telefone1",
      "telefone2",
      "email",
      "siteOficial",
      "sede",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "estado",
      "pais",
      "cep",
      "logo",
      "descricao",
    ] as const;

    const dados: Record<string, unknown> = {};

    for (const campo of camposPermitidos) {
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, campo)) {
        const valor = req.body[campo];

        if (typeof valor !== "string" && valor !== null) {
          return res.status(400).json({
            code: "INVALID_FIELD_VALUE",
            message: `Valor inválido para ${campo}.`,
          });
        }

        dados[campo] = valor;
      }
    }

    if (Object.keys(dados).length === 0) {
      return res.status(400).json({
        code: "NO_EDITABLE_FIELDS",
        message: "Nenhum campo editável informado.",
      });
    }

    const atualizada = await prisma.escolinha.update({
      where: { id },
      data: dados as Prisma.EscolinhaUncheckedUpdateInput,
    });

    return res.json(atualizada);
  } catch (error) {
    console.error("[updateEscolinha]", error);

    return res.status(500).json({
      message: "Erro ao atualizar escolinha.",
    });
  }
};

export const deleteEscolinha = async (
  _req: Request,
  res: Response,
) => {
  return res.status(409).json({
    code: "ORGANIZATION_DELETION_REQUIRES_REVIEW",
    message:
      "A exclusão definitiva de escolinhas está desativada. " +
      "Utilize a transferência de propriedade ou o futuro " +
      "procedimento de encerramento institucional.",
  });
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

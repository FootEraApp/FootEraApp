import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import { salvarHistoricoAtletaVinculo } from "../services/historicoAtleta.js";
import {
  garantirOrganizacaoLegada,
} from "../services/organizacoes.js";
import type { Prisma } from "@prisma/client";

export const desvincularAtletaDoClube = async (req: Request, res: Response) => {
  const { clubeId } = req.params;
  const { atletaId } = req.body;

  if (!clubeId || !atletaId) {
    return res.status(400).json({ message: "clubeId e atletaId são obrigatórios." });
  }

  try {
    const relacao = await prisma.relacaoTreinamento.findFirst({
      where: { clubeId, atletaId },
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
      dono: { tipo: "Clube", id: clubeId },
      inicioVinculo: relacao.criadoEm,
      fimVinculo: agora,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao desvincular atleta do clube:", err);
    return res.status(500).json({ message: "Erro ao desvincular atleta do clube." });
  }
};

export const listarHistoricoAtletasClube = async (req: Request, res: Response) => {
  const { clubeId } = req.params;

  try {
    const historicos = await prisma.atletaHistoricoVinculo.findMany({
      where: { clubeId },
      orderBy: { fimVinculo: "desc" },
    });

    res.json(historicos);
  } catch (err) {
    console.error("Erro ao listar histórico de atletas do clube:", err);
    res.status(500).json({ message: "Erro ao listar histórico de atletas do clube." });
  }
};

export const getClubes = async (_req: Request, res: Response) => {
  try {
    const clubes = await prisma.clube.findMany();
    res.json(clubes);
  } catch (error) {
    console.error("Erro ao buscar clubes:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

export const getClube = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const clube = await prisma.clube.findUnique({
      where: { id },
      include: {
        atletas: true,
        midias: true,
        postagens: true,
      },
    });

    if (!clube) {
      return res.status(404).json({ message: "Clube não encontrado." });
    }

    res.json(clube);
  } catch (error) {
    console.error("Erro ao buscar clube:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

export const createClube = async (req: Request, res: Response) => {
  try {
    const {
      usuarioId,
      nome,
      cnpj,
      telefone1,
      telefone2,
      email,
      siteOficial,
      sede,
      estadio,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      pais,
      cep,
      logo,
    } = req.body;

    const clube =
      await prisma.$transaction(
        async (tx) => {
          const criado =
            await tx.clube.create({
              data: {
                usuarioId,
                nome,
                cnpj,
                telefone1,
                telefone2,
                email,
                siteOficial,
                sede,
                estadio,
                logradouro,
                numero,
                complemento,
                bairro,
                cidade,
                estado,
                pais,
                cep,
                logo,
              },
            });

          await garantirOrganizacaoLegada({
            tipo: "CLUBE",
            ownerId: criado.id,

            proprietarioUsuarioId:
              usuarioId,

            tx,
          });

          return criado;
        }
      );

    res.status(201).json(clube);
  } catch (error) {
    console.error("Erro ao criar clube:", error);
    res.status(500).json({ message: "Erro interno ao criar clube." });
  }
};

export const updateClube = async (req: Request, res: Response) => {
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
    const clubeExistente = await prisma.clube.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!clubeExistente) {
      return res.status(404).json({
        message: "Clube não encontrado.",
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
      "estadio",
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
      "responsavel",
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

    const clubeAtualizado = await prisma.clube.update({
      where: { id },
      data: dados as Prisma.ClubeUncheckedUpdateInput,
    });

    return res.json(clubeAtualizado);
  } catch (error) {
    console.error("[updateClube]", error);

    return res.status(500).json({
      message: "Erro ao atualizar clube.",
    });
  }
};

export const deleteClube = async (
  _req: Request,
  res: Response,
) => {
  return res.status(409).json({
    code: "ORGANIZATION_DELETION_REQUIRES_REVIEW",
    message:
      "A exclusão definitiva de clubes está desativada. " +
      "Utilize a transferência de propriedade ou o futuro " +
      "procedimento de encerramento institucional.",
  });
};
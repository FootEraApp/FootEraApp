import { Request, Response } from "express";
import { TipoUsuario, PrismaClient, Prisma, StatusConexao } from "@prisma/client";
import { prisma } from "../prisma.js";
import {
  getActiveContext,
} from "../services/activeContext.js";
import {
  hasRole,
} from "../services/roles.js";

type TipoVinculo = "clube" | "escolinha";

function papelDoVinculo(
  tipo: TipoVinculo
): TipoUsuario {
  return tipo ===
    "clube"
    ? TipoUsuario.Clube
    : TipoUsuario.Escolinha;
}

async function resolveEntity(
  tx:
    | Prisma.TransactionClient
    | PrismaClient,
  tipo: TipoVinculo,
  idOuUsuarioId: string
): Promise<{
  id: string;
  usuarioId: string | null;
} | null> {
  if (
    tipo ===
    "escolinha"
  ) {
    return tx.escolinha.findFirst({
      where: {
        OR: [
          {
            id:
              idOuUsuarioId,
          },
          {
            usuarioId:
              idOuUsuarioId,
          },
        ],
      },

      select: {
        id: true,
        usuarioId: true,
      },
    });
  }

  return tx.clube.findFirst({
    where: {
      OR: [
        {
          id:
            idOuUsuarioId,
        },
        {
          usuarioId:
            idOuUsuarioId,
        },
      ],
    },

    select: {
      id: true,
      usuarioId: true,
    },
  });
}

async function resolveEntityId(
  tx:
    | Prisma.TransactionClient
    | PrismaClient,
  tipo: TipoVinculo,
  idOuUsuarioId: string
): Promise<string | null> {
  const entidade =
    await resolveEntity(
      tx,
      tipo,
      idOuUsuarioId
    );

  return (
    entidade?.id ??
    null
  );
}

export const vinculoController = {
  async solicitarVinculo(req: Request, res: Response) {
    try {

      const me =
        String(
          (req as any).user?.id ||
          (req as any).userId ||
          ""
        ).trim();

      if (!me) {
        return res.status(401).json({
          message:
            "Não autenticado.",
        });
      }

      const contexto =
        await getActiveContext(
          me
        );

      if (
        !contexto ||
        contexto.kind !==
          "PERSONAL" ||
        contexto.tipoUsuario !==
          TipoUsuario.Atleta
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_REQUIRED",

          message:
            "Use seu perfil de Atleta para solicitar este vínculo.",
        });
      }

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

      const atleta =
        await prisma.atleta.findUnique({
          where: {
            id:
              atletaId,
          },

          select: {
            id: true,
            usuarioId: true,
          },
        });

      if (
        !atleta ||
        atleta.usuarioId !==
          me
      ) {
        return res.status(403).json({
          message:
            "Este atleta não pertence ao usuário autenticado.",
        });
      }

      if (
        contexto.tipoUsuarioId &&
        contexto.tipoUsuarioId !==
          atleta.id
      ) {
        return res.status(409).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "O atleta informado não corresponde ao perfil ativo.",
        });
      }

      if (!["clube", "escolinha"].includes(tipoVinculo)) {
        return res.status(400).json({ message: "Tipo de vínculo inválido" });
      }

      const entidade =
        await resolveEntity(
          prisma,
          tipoVinculo,
          entidadeId
        );

      if (!entidade) {
        return res.status(404).json({
          message:
            `${
              tipoVinculo ===
              "clube"
                ? "Clube"
                : "Escolinha"
            } não encontrado(a)`,
        });
      }

      const entidadeRealId =
        entidade.id;

      if (!entidade.usuarioId) {
        return res.status(409).json({
          code:
            "TARGET_WITHOUT_USER",

          message:
            "A organização selecionada não possui usuário associado.",
        });
      }

      const papelEntidadeAtivo =
        await hasRole(
          entidade.usuarioId,
          papelDoVinculo(
            tipoVinculo
          )
        );

      if (!papelEntidadeAtivo) {
        return res.status(409).json({
          code:
            "TARGET_ROLE_INACTIVE",

          message:
            "A organização selecionada não possui esse papel ativo.",
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

      const me =
        String(
          (req as any).user?.id ||
          (req as any).userId ||
          ""
        ).trim();

      if (!me) {
        return res.status(401).json({
          message:
            "Não autenticado.",
        });
      }

      const solicitacaoAtual =
        await prisma.solicitacaoVinculo.findUnique({
          where: {
            id:
              solicitacaoId,
          },

          include: {
            atleta: {
              select: {
                id: true,
                usuarioId: true,
              },
            },
          },
        });

      if (!solicitacaoAtual) {
        return res.status(404).json({
          message:
            "Solicitação não encontrada.",
        });
      }

      const tipoEntidade =
        solicitacaoAtual
          .tipoEntidade as
            TipoVinculo;

      const entidade =
        await resolveEntity(
          prisma,
          tipoEntidade,
          solicitacaoAtual
            .entidadeId
        );

      if (!entidade) {
        return res.status(404).json({
          message:
            "Organização da solicitação não encontrada.",
        });
      }

      const contexto =
        await getActiveContext(
          me
        );

      const papelEsperado =
        papelDoVinculo(
          tipoEntidade
        );

      if (
        !contexto ||
        contexto.kind !==
          "ORGANIZATION" ||
        contexto.tipoUsuario !==
          papelEsperado ||
        contexto.tipoUsuarioId !==
          entidade.id
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Use a organização correspondente para responder esta solicitação.",
        });
      }

      if (
        solicitacaoAtual
          .atleta
          ?.usuarioId
      ) {
        const atletaAtivo =
          await hasRole(
            solicitacaoAtual
              .atleta
              .usuarioId,
            TipoUsuario.Atleta
          );

        if (!atletaAtivo) {
          return res.status(409).json({
            code:
              "ATHLETE_ROLE_INACTIVE",

            message:
              "O perfil Atleta desta solicitação não está mais ativo.",
          });
        }
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

      const me =
        String(
          (req as any).user?.id ||
          (req as any).userId ||
          ""
        ).trim();

      if (!me) {
        return res.status(401).json({
          message:
            "Não autenticado.",
        });
      }

      const contexto =
        await getActiveContext(
          me
        );

      const papelEsperado =
        papelDoVinculo(
          tipo
        );

      if (
        !contexto ||
        contexto.kind !==
          "ORGANIZATION" ||
        contexto.tipoUsuario !==
          papelEsperado ||
        contexto.tipoUsuarioId !==
          realId
      ) {
        return res.status(403).json({
          code:
            "ACTIVE_CONTEXT_MISMATCH",

          message:
            "Você não está usando a organização correspondente.",
        });
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
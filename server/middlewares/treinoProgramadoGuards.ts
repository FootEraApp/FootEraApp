import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  TipoOrganizacao,
  TipoUsuario,
} from "@prisma/client";

import {
  prisma,
} from "../prisma.js";

import {
  getActiveContext,
} from "../services/activeContext.js";

import {
  canPermission,
} from "../services/permissions.js";

export async function requireAdminOrTreinoOwner(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const usuarioId =
      String(
        (req as any).userId ??
        (req as any).user?.id ??
        (req as any).user?.usuarioId ??
        "",
      ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        message:
          "Não autenticado.",
      });
    }

    /*
     * Admin global continua podendo
     * administrar qualquer treino.
     */
    const isAdmin =
      await canPermission(
        usuarioId,
        "VER_ADMIN",
      );

    if (isAdmin) {
      return next();
    }

    const contexto =
      await getActiveContext(
        usuarioId,
      );

    if (!contexto) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_REQUIRED",

        message:
          "Selecione um contexto válido para editar este treino.",
      });
    }

    const podeCriarTreino =
      await canPermission(
        usuarioId,
        "CRIAR_TREINO",
      );

    if (!podeCriarTreino) {
      return res.status(403).json({
        code:
          "PERMISSION_DENIED",

        message:
          "O contexto ativo não possui permissão para editar treinos.",
      });
    }

    const treinoId =
      String(
        req.params.id ??
        "",
      ).trim();

    if (
      !treinoId &&
      req.method === "POST"
    ) {
      return next();
    }

    if (!treinoId) {
      return res.status(400).json({
        message:
          "Treino inválido.",
      });
    }

    const treino =
      await prisma.treinoProgramado.findUnique({
        where: {
          id:
            treinoId,
        },

        include: {
          professores: {
            select: {
              professorId:
                true,
            },
          },
        },
      });

    if (!treino) {
      return res.status(404).json({
        message:
          "Treino não encontrado.",
      });
    }

    let permitido =
      false;

    /*
     * Professor pessoal:
     *
     * Pedro — Professor
     */
    if (
      contexto.kind ===
        "PERSONAL" &&
      contexto.tipoUsuario ===
        TipoUsuario.Professor
    ) {
      const professorId =
        String(
          contexto.tipoUsuarioId ??
          "",
        ).trim();

      permitido =
        Boolean(
          professorId &&
          treino.professorId ===
            professorId,
        ) ||
        (
          Boolean(professorId) &&
          treino.professores.some(
            (item) =>
              item.professorId ===
              professorId,
          )
        );
    }

    /*
     * Contexto da organização:
     *
     * Clube FootEra — Proprietário
     * Clube FootEra — Professor
     * Escolinha X — Administrador
     */
    if (
      contexto.kind ===
      "ORGANIZATION"
    ) {
      const organizacaoLegadaId =
        String(
          contexto
            .legacyOrganizationId ??
          "",
        ).trim();

      if (
        contexto.organizationType ===
          TipoOrganizacao.CLUBE &&
        organizacaoLegadaId &&
        treino.clubeId ===
          organizacaoLegadaId
      ) {
        permitido =
          true;
      }

      if (
        contexto.organizationType ===
          TipoOrganizacao.ESCOLA &&
        organizacaoLegadaId &&
        treino.escolinhaId ===
          organizacaoLegadaId
      ) {
        permitido =
          true;
      }
    }

    if (!permitido) {
      return res.status(403).json({
        code:
          "ACTIVE_CONTEXT_MISMATCH",

        message:
          "Este treino não pertence ao contexto ativo.",
      });
    }

    return next();
  } catch (error) {
    console.error(
      "[requireAdminOrTreinoOwner]",
      error,
    );

    return res.status(500).json({
      message:
        "Erro ao validar permissão do treino.",
    });
  }
}
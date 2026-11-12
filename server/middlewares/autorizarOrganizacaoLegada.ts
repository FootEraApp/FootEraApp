
import type { RequestHandler } from "express";
import {
  FuncaoMembroOrganizacao,
} from "@prisma/client";
import { prisma } from "../prisma.js";

export function autorizarOrganizacaoLegada(
  tipo: "CLUBE" | "ESCOLINHA",
): RequestHandler {
  return async (req, res, next) => {
    const usuarioId = String(req.userId ?? "").trim();
    const legadoId = String(
        tipo === "CLUBE"
            ? req.params.clubeId ?? req.params.id ?? ""
            : req.params.escolinhaId ?? req.params.id ?? "",
        ).trim();

    if (!usuarioId) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Faça login novamente.",
      });
    }

    if (!legadoId) {
      return res.status(400).json({
        code: "INVALID_ORGANIZATION_ID",
        message: "Organização inválida.",
      });
    }

    try {
      const legado =
        tipo === "CLUBE"
          ? await prisma.clube.findUnique({
              where: { id: legadoId },
              select: { organizacaoId: true },
            })
          : await prisma.escolinha.findUnique({
              where: { id: legadoId },
              select: { organizacaoId: true },
            });

      if (!legado?.organizacaoId) {
        return res.status(403).json({
          code: "ORGANIZATION_NOT_AVAILABLE",
          message: "Organização sem vínculo institucional válido.",
        });
      }

      const administradorGlobal = await prisma.administrador.findUnique({
        where: { usuarioId },
        select: { id: true },
        });

        if (administradorGlobal) {
        return next();
        }

      const membro = await prisma.membroOrganizacao.findFirst({
        where: {
          usuarioId,
          organizacaoId: legado.organizacaoId,
          ativo: true,
          funcao: {
            in: [
                FuncaoMembroOrganizacao.PROPRIETARIO,
                FuncaoMembroOrganizacao.ADMINISTRADOR,
            ],
            },
          organizacao: {
            is: { ativo: true },
          },
        },
        select: { id: true },
      });

      if (!membro) {
        return res.status(403).json({
          code: "ORGANIZATION_PERMISSION_DENIED",
          message:
            "Somente proprietários ou administradores ativos desta organização podem realizar esta operação.",
        });
      }

      return next();
    } catch (error) {
      console.error("[autorizarOrganizacaoLegada]", error);

      return res.status(500).json({
        code: "ORGANIZATION_AUTH_FAILED",
        message: "Não foi possível verificar a autorização.",
      });
    }
  };
}
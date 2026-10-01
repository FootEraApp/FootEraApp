import { prisma } from "../prisma.js";
import {
  canPermission,
} from "../services/permissions.js";

export async function requireMetodologiaCreateAccess(
  req: any,
  res: any,
  next: any
) {
  const userId =
    req.user?.id ||
    req.userId;

  if (!userId) {
    return res.status(401).json({
      message:
        "Não autenticado.",
    });
  }

  const podeCriar =
    await canPermission(
      String(userId),
      "PUBLICAR_METODOLOGIA"
    );

  if (!podeCriar) {
    return res.status(403).json({
      message:
        "Seu contexto atual não possui permissão para criar metodologias.",
    });
  }

  return next();
}

export async function requireMetodologiaOwnership(
  req: any,
  res: any,
  next: any
) {
  const userId =
    req.user?.id ||
    req.userId;

  const metodologiaId =
    req.params?.metodologiaId ||
    req.params?.id;

  if (!userId) {
    return res.status(401).json({
      message:
        "Não autenticado.",
    });
  }

  if (!metodologiaId) {
    return res.status(400).json({
      message:
        "Metodologia não informada.",
    });
  }

  const metodologia =
    await prisma.metodologia.findUnique({
      where: {
        id: metodologiaId,
      },

      select: {
        id: true,
        criadorUsuarioId: true,
      },
    });

  if (!metodologia) {
    return res.status(404).json({
      message:
        "Metodologia não encontrada.",
    });
  }

  if (
    String(
      metodologia.criadorUsuarioId
    ) !==
    String(userId)
  ) {
    return res.status(403).json({
      message:
        "Apenas o criador da metodologia pode editar ou apagar este conteúdo.",
    });
  }

  return next();
}
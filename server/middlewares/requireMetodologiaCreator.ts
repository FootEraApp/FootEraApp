import { prisma } from "../prisma.js";
import {
  canPermission,
} from "../services/permissions.js";
import { getActiveContext } from "../services/activeContext.js";

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
      where: { id: metodologiaId },
      select: {
        id: true,
        criadorUsuarioId: true,
        clubeId: true,
        escolinhaId: true,
        marcaId: true,
        federacaoId: true,
      },
    });

  if (!metodologia) {
    return res.status(404).json({
      message:
        "Metodologia não encontrada.",
    });
  }

  const contexto = await getActiveContext(String(userId));

  const ehInstitucional = Boolean(
    metodologia.clubeId ||
    metodologia.escolinhaId ||
    metodologia.marcaId ||
    metodologia.federacaoId
  );

  if (!ehInstitucional) {
    const autorizado =
      contexto?.kind === "PERSONAL" &&
      metodologia.criadorUsuarioId === String(userId);

    if (!autorizado) {
      return res.status(403).json({
        code: "METODOLOGIA_PERSONAL_ACCESS_DENIED",
        message:
          "Você não pode administrar esta metodologia pessoal.",
      });
    }

    return next();
  }

  if (
    contexto?.kind !== "ORGANIZATION" ||
    !contexto.organizationId ||
    !contexto.legacyOrganizationId
  ) {
    return res.status(403).json({
      code: "ORGANIZATION_CONTEXT_REQUIRED",
      message:
        "Selecione a organização proprietária da metodologia.",
    });
  }

  const legacyId = contexto.legacyOrganizationId;

  const mesmaOrganizacao =
    (contexto.organizationType === "ESCOLA" &&
      metodologia.escolinhaId === legacyId) ||
    (contexto.organizationType === "CLUBE" &&
      metodologia.clubeId === legacyId) ||
    (contexto.organizationType === "MARCA" &&
      metodologia.marcaId === legacyId) ||
    (contexto.organizationType === "FEDERACAO" &&
      metodologia.federacaoId === legacyId);

  if (!mesmaOrganizacao) {
    return res.status(403).json({
      code: "METODOLOGIA_ORGANIZATION_MISMATCH",
      message:
        "Esta metodologia não pertence à organização selecionada.",
    });
  }

  const membro = await prisma.membroOrganizacao.findUnique({
    where: {
      organizacaoId_usuarioId: {
        organizacaoId: contexto.organizationId,
        usuarioId: String(userId),
      },
    },
    select: {
      ativo: true,
      funcao: true,
      organizacao: {
        select: {
          ativo: true,
        },
      },
    },
  });

  const gestorAtivo =
    membro?.ativo === true &&
    membro.organizacao.ativo === true &&
    (
      membro.funcao === "PROPRIETARIO" ||
      membro.funcao === "ADMINISTRADOR"
    );

  if (!gestorAtivo) {
    return res.status(403).json({
      code: "METODOLOGIA_MANAGEMENT_DENIED",
      message:
        "Você não possui vínculo de gestão ativo com esta organização.",
    });
  }

  return next();
}
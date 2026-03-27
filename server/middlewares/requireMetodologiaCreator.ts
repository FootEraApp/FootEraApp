import { prisma } from "../prisma.js";

export async function requireMetodologiaCreateAccess(req: any, res: any, next: any) {
  const userId = req.user?.id || req.userId;
  const tipo = String(req.user?.tipo || "").toLowerCase().trim();

  const PLANOS_QUE_PODEM_CRIAR_METODOLOGIA = new Set([
    "PROFESSOR_PRO",
    "PROFESSOR_LEARNING_1",
    "PROFESSOR_LEARNING_3",
    "ORGANIZACOES_PRO",
    "ORGANIZACOES_LEARNING_3",
  ]);

  if (!userId) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  if (!["professor", "clube", "escolinha"].includes(tipo)) {
    return res.status(403).json({ message: "Sem permissão para criar metodologia." });
  }

  // Professor parceiro passa direto
  if (tipo === "professor") {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { parceiro: true },
    });

    if (usuario?.parceiro) return next();
  }

  const agora = new Date();

  const assinatura = await prisma.assinatura.findFirst({
    where: {
      usuarioId: userId,
      ativo: true,
      OR: [
        { status: "ATIVA" },
        { status: "TRIAL", trialEndsAt: { gt: agora } },
      ],
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      plano: true,
      status: true,
      ativo: true,
      trialEndsAt: true,
    },
  }).catch(() => null);

  const plano = String((assinatura as any)?.plano || "").toUpperCase();

  if (PLANOS_QUE_PODEM_CRIAR_METODOLOGIA.has(plano)) {
    if (tipo === "professor" && plano.startsWith("PROFESSOR_")) {
      return next();
    }

    if (["clube", "escolinha"].includes(tipo) && plano.startsWith("ORGANIZACOES_")) {
      return next();
    }
  }

  return res.status(403).json({
    message: "Disponível apenas para Professor Parceiro ou planos Learning/Pro permitidos.",
  });
}

export async function requireMetodologiaOwnership(req: any, res: any, next: any) {
  const userId = req.user?.id || req.userId;
  const metodologiaId =
    req.params?.metodologiaId ||
    req.params?.id;

  if (!userId) {
    return res.status(401).json({ message: "Não autenticado." });
  }

  if (!metodologiaId) {
    return res.status(400).json({ message: "Metodologia não informada." });
  }

  const metodologia = await prisma.metodologia.findUnique({
    where: { id: metodologiaId },
    select: {
      id: true,
      criadorUsuarioId: true,
    },
  });

  if (!metodologia) {
    return res.status(404).json({ message: "Metodologia não encontrada." });
  }

  if (String(metodologia.criadorUsuarioId) !== String(userId)) {
    return res.status(403).json({
      message: "Apenas o criador da metodologia pode editar ou apagar este conteúdo.",
    });
  }

  return next();
}
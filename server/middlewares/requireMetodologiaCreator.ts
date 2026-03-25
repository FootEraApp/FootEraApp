import { prisma } from "../prisma.js";

export async function requireMetodologiaCreator(req: any, res: any, next: any) {
  const userId = req.user?.id;
  const tipo = String(req.user?.tipo || "").toLowerCase().trim();

  const ORGANIZACOES_PRO = "ORGANIZACOES_PRO";
  const PROFESSOR_PRO = "PROFESSOR_PRO";

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

  if (["clube", "escolinha"].includes(tipo)) {
    if (plano === ORGANIZACOES_PRO) {
      return next();
    }
  }

  if (tipo === "professor") {
    if (plano === PROFESSOR_PRO) {
      return next();
    }
  }

  return res.status(403).json({
    message: "Disponível apenas para Professor Parceiro ou planos Pro.",
  });
}
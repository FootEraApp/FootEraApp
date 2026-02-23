import { prisma } from "../prisma.js";

export async function requireMetodologiaCreator(req: any, res: any, next: any) {
  const userId = req.user?.id;
  const tipo = String(req.user?.tipo || "").toLowerCase();

  const ORGANIZACOES_PRO = "ORGANIZACOES_PRO";
  const PROFESSOR_PRO = "PROFESSOR_PRO"; // troque se necessário

  if (!userId) return res.status(401).json({ message: "Não autenticado." });

  if (!["professor", "clube", "escolinha"].includes(tipo)) {
    return res.status(403).json({ message: "Sem permissão para criar metodologia." });
  }

  // professor parceiro passa
  if (tipo === "professor") {
    const prof = await prisma.usuario.findFirst({
      where: { id: userId },
      select: { parceiro: true },
    });
    if (prof?.parceiro) return next();
  }

  // assinatura ativa
  const agora = new Date();
  const assinatura = await prisma.assinatura.findFirst({
    where: { usuarioId: userId, status: "ATIVA", trialEndsAt: { gt: agora } },
    select: { id: true },
  }).catch(() => null);

  const produtoId = String((assinatura as any)?.produtoId || "").toUpperCase();

  if ((tipo === "clube" || tipo === "escolinha") && produtoId === ORGANIZACOES_PRO) {
    return next();
  }

  if (tipo === "professor" && produtoId === PROFESSOR_PRO) {
    return next();
  }

  return res.status(403).json({
    message: "Disponível apenas para Professor Parceiro ou planos Pro.",
  });
}
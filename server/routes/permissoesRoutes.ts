import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { prisma } from "../prisma.js";

const router = Router();
router.use(authenticateToken);

router.get("/metodologias/criar", async (req: any, res) => {
  const userId = req.user?.id;
  const tipo = String(req.user?.tipo || "").toLowerCase();

  const ORGANIZACOES_PRO = "ORGANIZACOES_PRO";
  const PROFESSOR_PRO = "PROFESSOR_PRO"; // troque se seu ID for outro

  if (!userId) return res.status(401).json({ canCreate: false });

  // só professor/clube/escolinha
  if (!["professor", "clube", "escolinha"].includes(tipo)) {
    return res.json({ canCreate: false });
  }

  // 1) parceiro (somente professor)
  let isParceiro = false;
  if (tipo === "professor") {
    const prof = await prisma.usuario.findFirst({
      where: { id: userId },
      select: { parceiro: true },
    });
    isParceiro = Boolean(prof?.parceiro);
    if (isParceiro) return res.json({ canCreate: true });
  }

  // 2) checar assinatura ativa
  // ✅ AJUSTE o model/tabela conforme o seu schema (Assinatura / Plano / etc)
  // Exemplo comum:
  const agora = new Date();

  const assinatura = await prisma.assinatura.findFirst({
    where: {
      usuarioId: userId,
      status: "ATIVA",
      trialEndsAt: { gt: agora }, // ou null se não expira
    },
    select: { id: true },
  }).catch(() => null);

  const produtoId = String((assinatura as any)?.produtoId || "").toUpperCase();

  if (tipo === "clube" || tipo === "escolinha") {
    return res.json({ canCreate: produtoId === ORGANIZACOES_PRO });
  }

  // professor
  return res.json({ canCreate: produtoId === PROFESSOR_PRO });
});

export default router;
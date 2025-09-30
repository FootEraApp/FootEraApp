import { Response, Router } from "express";
import { authenticateToken, AuthenticatedRequest } from "../middlewares/auth.js";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticateToken);

router.get("/observados/:atletaId/nota", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;          
    const atletaId = String(req.params.atletaId);

    const olheiro = await prisma.olheiro.findUnique({
        where: { usuarioId: userId },
        select: { id: true },
    });
    if (!olheiro) return res.status(403).json({ error: "Somente olheiros." });
    const observando = await prisma.atletaObservado.findFirst({
        where: { atletaId, olheiroId: olheiro.id },
    });
        if (!observando) return res.status(403).json({ error: "Esse atleta não está na sua lista de observados." });

    const nota = await prisma.scoutNote.findUnique({
        where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
        select: { texto: true, updatedAt: true },
    });

    return res.json(nota ?? { texto: "", updatedAt: null });
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "Erro ao salvar nota"})
    }
 });

router.put("/observados/:atletaId/nota", async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userId!;
  const atletaId = String(req.params.atletaId);
  const texto = String(req.body?.texto ?? "");

  const olheiro = await prisma.olheiro.findUnique({
    where: { usuarioId: userId },
    select: { id: true },
  });
  if (!olheiro) return res.status(403).json({ error: "Somente olheiros." });

  const observando = await prisma.atletaObservado.findFirst({
    where: { atletaId, olheiroId: olheiro.id },
  });
  if (!observando) return res.status(403).json({ error: "Esse atleta não está na sua lista de observados." });

  const saved = await prisma.scoutNote.upsert({
    where: { olheiroId_atletaId: { olheiroId: olheiro.id, atletaId } },
    update: { texto },
    create: { olheiroId: olheiro.id, atletaId, texto },
    select: { updatedAt: true },
  });

  return res.json({ ok: true, updatedAt: saved.updatedAt });
});

export default router;
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  listarObservados,
  observarAtleta,
  pararDeObservar,
  statusObservacao,
  atualizarObservado
} from "../controllers/atletaObservadoController.js";
import { prisma } from "../prisma.js";

const router = Router();

router.get("/resolve/:usuarioId", authenticateToken, async (req, res) => {
  try {
    const { usuarioId } = req.params;
    if (!usuarioId) return res.status(400).json({ error: "usuarioId é obrigatório" });

    const atleta = await prisma.atleta.findUnique({
      where: { usuarioId },       
      select: { id: true },
    });

    if (!atleta) return res.status(404).json({ error: "Atleta não encontrado" });
    return res.json({ atletaId: atleta.id });
  } catch (e) {
    console.error("GET /api/observados/resolve/:usuarioId", e);
    return res.status(500).json({ error: "Falha ao resolver atletaId" });
  }
});
router.patch("/:atletaId", authenticateToken, atualizarObservado);
router.delete("/:atletaId", authenticateToken, pararDeObservar);
router.get("/status/:atletaId", authenticateToken, statusObservacao);
router.get("/", authenticateToken, listarObservados);
router.post("/", authenticateToken, observarAtleta);

export default router;
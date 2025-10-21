// server/routes/vinculo
import { Router } from "express";
import { vinculoController } from "../controllers/vinculoController.js";
import { buscarProfessorPorIdInterno } from "../controllers/professoresController.js";

const router = Router();

router.post("/solicitar", vinculoController.solicitarVinculo);
router.post("/responder", vinculoController.responderSolicitacao);
router.get("/pendentes/:entidadeId/:tipo", vinculoController.pendentes);

router.get("/", async (req, res) => {
  const { tipo, id } = req.query;
  if (tipo !== "Professor" || !id) return res.json([]);

  const prof = await buscarProfessorPorIdInterno(String(id));
  if (!prof) return res.json([]);

  const out: Array<{ organizacaoId: string; tipo?: "Escolinha" | "Clube" }> = [];
  if (prof.organizacaoId) out.push({ organizacaoId: prof.organizacaoId });
  if (prof.escolinhaId)   out.push({ organizacaoId: prof.escolinhaId, tipo: "Escolinha" });
  if (prof.clubeId)       out.push({ organizacaoId: prof.clubeId,     tipo: "Clube" });

  res.json(out);
});

export default router;
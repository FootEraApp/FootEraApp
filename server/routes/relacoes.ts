import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { getAtletasPorVinculo, getAtletasVinculadosPorTipoUsuarioId } from "../controllers/relacoescontroller.js";

const router = Router();

router.get("/atletas-por-tipo", authenticateToken, getAtletasVinculadosPorTipoUsuarioId);
router.get("/atletas", authenticateToken, getAtletasPorVinculo);

export default router;
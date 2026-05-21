import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  seguirUsuario,
  deixarDeSeguir,
  listarSeguindo,
  minhaRede,
  statusSeguidor,  
  removerSeguidor,
  aceitarSeguidor,
  recusarSeguidor,
} from "../controllers/seguirController.js";

const router = Router();
router.use(authenticateToken);

router.get("/minha-rede", minhaRede);
router.get("/seguindo", listarSeguindo);
router.get("/meus-seguidos", listarSeguindo);
router.get("/status", statusSeguidor);
router.delete("/seguidores/:seguidorUsuarioId", removerSeguidor);
router.delete("/:seguidoUsuarioId", deixarDeSeguir);
router.post("/aceitar", aceitarSeguidor);
router.post("/recusar", recusarSeguidor);
router.delete("/", deixarDeSeguir); 
router.post("/", seguirUsuario);

export default router;
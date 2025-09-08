import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  seguirUsuario,
  deixarDeSeguir,
  listarSeguindo,
  minhaRede,
  statusSeguidor,  
} from "../controllers/seguirController.js";

const router = Router();
router.use(authenticateToken);

router.get("/minha-rede", minhaRede);
router.get("/seguindo", listarSeguindo);   
router.get("/meus-seguidos", listarSeguindo);
router.get("/status", statusSeguidor);   
router.post("/", seguirUsuario);
router.delete(["/:seguidoUsuarioId", "/"], deixarDeSeguir);

export default router;
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  seguirUsuario,
  deixarDeSeguir,
  listarSeguindo,
  minhaRede,
} from "../controllers/seguirController.js";

const router = Router();

router.use(authenticateToken);

router.get("/minha-rede", authenticateToken, minhaRede);
router.get("/meus-seguidos", listarSeguindo);
router.post("/", seguirUsuario);
router.delete(["/:seguidoUsuarioId", "/"], deixarDeSeguir);

export default router;

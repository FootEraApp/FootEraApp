import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  ativarCreator,
  atualizarCreator,
  getDashboardCreator,
  getMeuCreator,
  getPerfilPublicoCreator,
  getCreatorPublicoOrganizacao,
  registrarViewCreator
} from "../controllers/creatorController.js";

const router = Router();

router.get(
  "/organization/:organizacaoId",
  getCreatorPublicoOrganizacao
);
router.post("/profile/:usuarioId/view", registrarViewCreator);
router.get(
  "/profile/:usuarioId",
  getPerfilPublicoCreator
);
router.get("/me", authenticateToken, getMeuCreator);
router.post("/ativar", authenticateToken, ativarCreator);
router.put("/me", authenticateToken, atualizarCreator);
router.get("/dashboard", authenticateToken, getDashboardCreator);

export default router;
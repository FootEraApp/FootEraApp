// server/routes/templates.ts
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireCapability } from "../middlewares/guards.js";
import {
  criarTemplate,
  listarTemplates,
  deletarTemplate,
} from "../controllers/templatesController.js";

const router = Router();

// Criar template (gated por capability)
router.post(
  "/",
  authenticateToken,
  requireCapability("templates:criar"),
  criarTemplate
);

// Listar templates (me/public/org via ?scope=)
router.get("/", authenticateToken, listarTemplates);

// Deletar template (de quem criou/owner ou admin)
router.delete("/:id", authenticateToken, deletarTemplate);

export default router;
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import { requireCapability } from "../middlewares/guards.js";
import {
  criarTemplate,
  listarTemplates,
  deletarTemplate,
} from "../controllers/templatesController.js";

const router = Router();

router.post(
  "/",
  authenticateToken,
  requireCapability("templates:criar"),
  criarTemplate
);

router.get("/", authenticateToken, listarTemplates);
router.delete("/:id", authenticateToken, deletarTemplate);

export default router;
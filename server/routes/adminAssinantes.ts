import { Router } from "express";
import { listar, overview, excluir} from "../controllers/assinaturasAdminController.js";
import {
  authenticateToken,
} from "../middlewares/auth.js";
import {
  requireAdmin,
} from "../middlewares/guards.js";

const router = Router();

router.use(
  authenticateToken,
  requireAdmin
);

router.get(
  "/overview",
  overview
);

router.delete(
  "/:id",
  excluir
);

router.get(
  "/",
  listar
);

export default router;
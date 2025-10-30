import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/assinaturasController.js";

const r = Router();

r.get("/:usuarioId", authenticateToken, ctrl.getByUsuario);
r.patch("/:usuarioId", authenticateToken, ctrl.updatePlano);
r.post("/:usuarioId/cancelar", authenticateToken, ctrl.cancelar);
r.post("/:usuarioId/reativar", authenticateToken, ctrl.reativar);

export default r;
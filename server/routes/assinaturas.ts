import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import * as ctrl from "../controllers/assinaturasController.js";

const r = Router();

r.use(authenticateToken);

r.get("/:usuarioId", ctrl.getByUsuario);
r.patch("/:usuarioId", ctrl.updatePlano);
r.post("/:usuarioId/cancelar", ctrl.cancelar);
r.post("/:usuarioId/reativar", ctrl.reativar);

export default r;
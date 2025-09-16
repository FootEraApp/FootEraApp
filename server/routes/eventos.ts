import { Router } from "express";
import * as ctrl from "../controllers/eventosController.js";

const r = Router();

r.get("/clubes/:clubeId", ctrl.listarDoClube);
r.post("/clubes/:clubeId", ctrl.auth, ctrl.ehDonoDoClubeOuAdmin, ctrl.criar);
r.get("/:id", ctrl.obter);

export default r;
import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import {
  catalogoClubes,
  catalogoEscolinhas,
  catalogoProfessores,
} from "../controllers/catalogoController.js";

const r = Router();

r.get("/clubes", authenticateToken, catalogoClubes);
r.get("/escolinhas", authenticateToken, catalogoEscolinhas);
r.get("/professores", authenticateToken, catalogoProfessores);

export default r;
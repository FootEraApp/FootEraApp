import express from "express";
import { adminAuth } from "../middlewares/admin-auth";

import {
  loginAdmin,
  getDashboardStats,
  listUsuarios,
  deleteUsuario,
  listClubes,
  deleteClube,
  listEscolinhas,
  deleteEscolinha,
  listAtletas,
  deleteAtleta
} from "../controllers/adminController";

const router = express.Router();

router.post("/login", loginAdmin);
router.get("/dashboard", getDashboardStats);

router.get("/usuarios", listUsuarios);
router.delete("/usuarios/:id", deleteUsuario);

router.get("/clubes", listClubes);
router.delete("/clubes/:id", deleteClube);

router.get("/escolinhas", listEscolinhas);
router.delete("/escolinhas/:id", deleteEscolinha);

router.get("/atletas", listAtletas);
router.delete("/atletas/:id", deleteAtleta);

router.get("/admin/painel", adminAuth, (req, res) => {
  res.send("Você é admin");
});
export default router;

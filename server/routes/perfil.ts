import { Router } from "express";
import { getPerfilUsuario, atualizarPerfil } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/me", authenticateToken, (req, res) => {
  getPerfilUsuario(req, res);
});

router.get("/:id", authenticateToken, (req, res) => {
  getPerfilUsuario(req, res);
});

router.put("/:id", authenticateToken, (req, res) => {
  atualizarPerfil(req, res);
});

export default router;
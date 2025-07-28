import { Router } from "express";
import { getPerfil } from "../controllers/perfilController";
import { authenticateToken } from "../middlewares/auth";

const router = Router();

router.get("/me", authenticateToken, (req, res) => {
  getPerfil(req, res);
});

router.get("/:id", authenticateToken, (req, res) => {
  getPerfil(req, res);
});

export default router;
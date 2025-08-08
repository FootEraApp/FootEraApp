
import { Router } from "express";
import { getUsuarioPorId } from "../controllers/usuarioController";

const router = Router();

router.get("/:id", getUsuarioPorId);

export default router;
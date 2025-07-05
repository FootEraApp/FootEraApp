import { Router } from "express";
import {
  getGrupos,
  getGrupoById,
  createGrupo,
  adicionarMembro,
  removerMembro
} from "../controllers/gruposController";

const router = Router();

router.get("/", getGrupos);
router.get("/:id", getGrupoById);
router.post("/", createGrupo);
router.post("/:id/membros", adicionarMembro);
router.delete("/:id/membros/:userId", removerMembro);

export default router;

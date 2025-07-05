import express from "express";
import {
  listarAmigos,
  seguirUsuario,
  deixarDeSeguir,
  listarSeguidores,
  listarSeguindo
} from "../controllers/amigosController";

const router = express.Router();

router.get("/amigos", listarAmigos);
router.get("/seguidores", listarSeguidores);
router.get("/seguindo", listarSeguindo);
router.post("/seguir", seguirUsuario);
router.delete("/deixar-de-seguir", deixarDeSeguir);

export default router;

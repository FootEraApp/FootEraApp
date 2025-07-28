import { Router } from "express";
import { login } from "../controllers/authController"; 
import { cadastrarUsuario } from "server/controllers/cadastroController";

const router = Router();

router.post("/cadastro", cadastrarUsuario);
router.post("/login", login);

export default router;
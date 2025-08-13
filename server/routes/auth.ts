import { Router } from "express";
import { login } from "../controllers/authController"; 
import { cadastrarUsuario } from "server/controllers/cadastroController";
import { forgotPassword, resetPassword} from "server/controllers/senhaController";

const router = Router();

router.post("/cadastro", cadastrarUsuario);
router.post("/login", login);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

export default router;
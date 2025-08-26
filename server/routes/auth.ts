import { Router } from "express";
import { login } from "../controllers/authController.js"; 
import { cadastrarUsuario } from "server/controllers/cadastroController.js";
import { forgotPassword, resetPassword} from "server/controllers/senhaController.js";

const router = Router();

router.post("/cadastro", cadastrarUsuario);
router.post("/login", login);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

export default router;
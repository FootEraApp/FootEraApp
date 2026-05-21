// server/routes/usuario
import { Router } from "express";
import { 
  getUsuarioPorId, 
  getUsuarioChallenges,
  getUsuarioParceiro,
  getUsuarioAssinatura,
  getPresenca,
  buscarUsuarios
} from "../controllers/usuarioController.js";
import { authenticateToken } from "server/middlewares/auth.js";
import { listAdminUsers } from "server/controllers/adminUsersController.js";

const router = Router();

router.get("/buscar", authenticateToken, buscarUsuarios);
router.get("/:id", getUsuarioPorId);
router.get("/:id/challenges", authenticateToken, getUsuarioChallenges);
router.get("/:id/presenca", authenticateToken, getPresenca);
router.get("/:id/parceiro", authenticateToken, getUsuarioParceiro);
router.get("/:id/assinatura", getUsuarioAssinatura);
router.get("/", authenticateToken, listAdminUsers);

export default router;
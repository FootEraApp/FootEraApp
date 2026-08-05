import { Router } from "express";
import { adminAuth } from "../middlewares/admin-auth.js";
import { listar, overview, excluir} from "../controllers/assinaturasAdminController.js";

const router = Router();

router.get("/overview", adminAuth, overview);
router.delete("/:id", adminAuth, excluir);
router.get("/", adminAuth, listar);

export default router;
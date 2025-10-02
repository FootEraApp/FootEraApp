import { Router } from "express";
import { formadoresController } from "../controllers/formadoresController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = Router();

router.get("/dashboard", authenticateToken, formadoresController.dashboard);
router.get("/vinculos", authenticateToken, formadoresController.listarAtletas);
router.post("/vinculos", authenticateToken, formadoresController.criarVinculo);

router.get("/transferencias", authenticateToken, formadoresController.listarTransferencias);
router.post("/transferencias", authenticateToken, formadoresController.criarTransferencia);

router.post("/solidariedade/calc", authenticateToken, formadoresController.calcularSolidariedade);
router.get("/badges", authenticateToken, formadoresController.listarBadges);

export default router;

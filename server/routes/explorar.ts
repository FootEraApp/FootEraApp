import express from "express";
import { buscarExplorar, listarAtletasExplorar } from "../controllers/explorarController.js";
import { authenticateToken } from "server/middlewares/auth.js";

const router = express.Router();

router.get("/atletas", authenticateToken, listarAtletasExplorar)
router.get("/", buscarExplorar);

export default router;

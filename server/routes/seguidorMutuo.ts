import express from "express";
import { buscarSeguidoresMutuos } from "../controllers/seguidorMutuoController.js";
import {authenticateToken} from "../middlewares/auth.js";

const router = express.Router();

router.get("/", authenticateToken, buscarSeguidoresMutuos);

export default router;
import express from "express";
import { buscarSeguidoresMutuos } from "../controllers/seguidorMutuoController";
import {authenticateToken} from "../middlewares/auth";

const router = express.Router();

router.get("/", authenticateToken, buscarSeguidoresMutuos);

export default router;
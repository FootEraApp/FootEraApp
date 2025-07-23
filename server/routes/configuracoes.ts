import express from "express";
import { getConfiguracoes, atualizarConfiguracoes } from "../controllers/configuracoesController";

const router = express.Router();

router.get("/", getConfiguracoes);
router.patch("/", atualizarConfiguracoes);

export default router;

import express from "express";
import { authenticateToken } from "server/middlewares/auth";
import { prisma } from "server/lib/prisma";
import {
  getDesafioById,
  criarSubmissaoDesafio,
  getSubmissoesPorDesafio,
  getSubmissoesPorAtleta,
  criarDesafio,
  editarDesafio,
  excluirDesafio,
  getDesafios
} from "../controllers/desafiosController";

const router = express.Router();

router.get("/", getDesafios);
router.get("/:id", getDesafioById);
router.post("/", authenticateToken, criarDesafio);
router.put("/:id", authenticateToken, editarDesafio);
router.delete("/:id", authenticateToken, excluirDesafio);
router.post("/:id/submissoes", criarSubmissaoDesafio);
router.get("/:id/submissoes", getSubmissoesPorDesafio);
router.get("/atleta/:atletaId/submissoes", getSubmissoesPorAtleta);

export default router;

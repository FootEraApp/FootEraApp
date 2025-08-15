import express from "express";
import { authenticateToken } from "server/middlewares/auth.js";
import {
  getDesafioById,
  criarSubmissaoDesafio,
  getSubmissoesPorDesafio,
  getSubmissoesPorAtleta,
  criarDesafio,
  editarDesafio,
  excluirDesafio,
  getDesafios
} from "../controllers/desafiosController.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient;
const router = express.Router();

router.get("/", getDesafios);
router.get("/:id", getDesafioById);
router.post("/", authenticateToken, criarDesafio);
router.put("/:id", authenticateToken, editarDesafio);
router.delete("/:id", authenticateToken, excluirDesafio);
router.post("/:id/submissoes", criarSubmissaoDesafio);
router.get("/:id/submissoes", getSubmissoesPorDesafio);
router.get("/atleta/:atletaId/submissoes", getSubmissoesPorAtleta);
router.get("/submissoes", authenticateToken, async (req, res) => {
  try {
    const submissoes = await prisma.submissaoDesafio.findMany({
      include: {
        desafio: true,
        midias: true,
        atleta: {
          include: {
            usuario: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return res.json(submissoes);
  } catch (err) {
    console.error("Erro ao buscar submissões:", err);
    return res.status(500).json({ error: "Erro interno ao buscar submissões" });
  }
});

export default router;
